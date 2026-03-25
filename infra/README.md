# AI Creative Video Platform — Infrastructure

Terragrunt-managed Terraform infrastructure for the AI Creative Video Platform, deployed across three environments on AWS.

---

## Architecture Overview

```
infra/
├── terragrunt.hcl                  # Root: remote state, provider generation, common inputs
├── modules/
│   ├── networking/                 # VPC, subnets, NAT gateways, security groups
│   ├── queue/                      # SQS render job queue + DLQ + results queue
│   ├── storage/                    # S3 buckets: input, output, temp
│   ├── worker/                     # ECS Fargate: task def, service, autoscaling, CloudWatch
│   └── iam/                        # IAM roles and policies (standalone module)
└── environments/
    ├── dev/                        # 0.5 vCPU / 1 GB, scales 0–2, single NAT
    ├── staging/                    # 1 vCPU / 2 GB, scales 0–5, single NAT
    └── prod/                       # 2 vCPU / 4 GB, scales 1–20, HA NAT per-AZ
```

### Module Dependency Graph

```
networking ──┐
             ├──► worker
queue ───────┤
             │
storage ─────┘
```

Worker depends on `networking`, `queue`, and `storage` outputs via Terragrunt `dependency` blocks.

---

## Prerequisites

| Tool         | Version  |
|--------------|----------|
| Terraform    | ≥ 1.5.0  |
| Terragrunt   | ≥ 0.50.0 |
| AWS CLI      | ≥ 2.x    |

```bash
brew install terraform terragrunt awscli   # macOS
# or
tfenv install 1.7.0 && tfenv use 1.7.0
```

---

## Initial Setup

### 1. Update AWS Account IDs

Each environment has an `env.hcl` with a placeholder account ID. Replace them:

```bash
# dev
sed -i 's/111111111111/YOUR_DEV_ACCOUNT/' environments/dev/env.hcl

# staging
sed -i 's/222222222222/YOUR_STAGING_ACCOUNT/' environments/staging/env.hcl

# prod
sed -i 's/333333333333/YOUR_PROD_ACCOUNT/' environments/prod/env.hcl
```

### 2. Create the Terraform State Bucket

The remote state S3 bucket must exist before the first `apply`. Create it once per AWS account:

```bash
# For dev account (run once):
aws s3api create-bucket \
  --bucket creative-video-tfstate-YOUR_DEV_ACCOUNT \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket creative-video-tfstate-YOUR_DEV_ACCOUNT \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name creative-video-tfstate-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Repeat for staging and prod accounts.

### 3. Create Secrets in AWS Secrets Manager

Worker tasks expect two secrets per environment (create manually or via a secrets rotation module):

```bash
# dev
aws secretsmanager create-secret \
  --name dev/creative-video/openai-api-key \
  --secret-string '{"api_key":"sk-..."}' \
  --region us-east-1

aws secretsmanager create-secret \
  --name dev/creative-video/tts-api-key \
  --secret-string '{"api_key":"..."}' \
  --region us-east-1
```

### 4. Build and Push the Worker Docker Image

```bash
# Build
docker build -t creative-video-worker ../worker/

# Tag and push to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin YOUR_DEV_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

aws ecr create-repository --repository-name creative-video-worker --region us-east-1

docker tag creative-video-worker:latest \
  YOUR_DEV_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/creative-video-worker:latest

docker push YOUR_DEV_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/creative-video-worker:latest
```

---

## Deploying

> **Order matters.** Always deploy modules in dependency order: `networking` → `queue` → `storage` → `worker`.

### Deploy a single module

```bash
cd environments/dev/networking
terragrunt apply

cd ../queue
terragrunt apply

cd ../storage
terragrunt apply

cd ../worker
terragrunt apply
```

### Deploy an entire environment at once

```bash
cd environments/dev
terragrunt run-all apply
```

Terragrunt automatically resolves the dependency graph and applies in the correct order.

### Validate and plan without applying

```bash
# Plan a single module
cd environments/dev/worker
terragrunt plan

# Validate all modules (uses mock outputs for dependencies)
cd environments/dev
terragrunt run-all validate
```

---

## Environment Sizing

| Environment | CPU         | Memory | Min Tasks | Max Tasks | NAT Gateway  |
|-------------|-------------|--------|-----------|-----------|--------------|
| dev         | 0.5 vCPU    | 1 GB   | 0         | 2         | Single (cost saving) |
| staging     | 1 vCPU      | 2 GB   | 0         | 5         | Single (cost saving) |
| prod        | 2 vCPU      | 4 GB   | 1         | 20        | Per-AZ (HA) |

Workers scale based on the SQS `ApproximateNumberOfMessagesVisible` metric:
- **Scale out** when queue depth ≥ 5 messages
- **Scale in** when queue depth ≤ 0 messages (3 consecutive periods)

---

## Tearing Down

```bash
# Destroy a single module
cd environments/dev/worker
terragrunt destroy

# Destroy an entire environment (reverse dependency order is handled automatically)
cd environments/dev
terragrunt run-all destroy
```

> ⚠️ **Prod has `force_destroy = false`** on S3 buckets. You must manually empty them before `destroy`.

---

## Module Reference

### `modules/networking`

Creates a VPC with public/private subnets, NAT gateways (1 per AZ or single), internet gateway, route tables, and an egress-only security group for ECS tasks. Also creates an S3 VPC endpoint to reduce NAT costs.

**Key outputs:** `vpc_id`, `private_subnet_ids`, `public_subnet_ids`, `ecs_worker_security_group_id`

---

### `modules/queue`

Creates a primary SQS render job queue with a dead-letter queue, and optionally a results queue (also with DLQ). SSE encryption enabled on all queues.

**Key outputs:** `render_queue_url`, `render_queue_arn`, `result_queue_url`, `result_queue_arn`

---

### `modules/storage`

Creates three S3 buckets:
- **input** — raw source assets (versioned, CORS-enabled)
- **output** — rendered videos (versioned, lifecycle to STANDARD_IA)
- **temp** — intermediate processing files (auto-expire lifecycle)

All buckets are private with AES256 encryption and public-access block.

**Key outputs:** `input_bucket_name`, `output_bucket_name`, `temp_bucket_name`, `*_bucket_arn`

---

### `modules/worker`

Creates an ECS cluster, task definition, Fargate service, CloudWatch log group, IAM roles (execution + task), worker security group, and autoscaling policies backed by SQS depth alarms.

IAM is **inline** in the worker module for simplicity (the `modules/iam` module is available for standalone use).

**Key outputs:** `ecs_cluster_name`, `ecs_service_name`, `task_definition_arn`, `cloudwatch_log_group_name`

---

### `modules/iam`

Standalone IAM module if you prefer to separate IAM from the worker module. Provides the same execution role, task role, S3/SQS/Secrets policies.

---

## Remote State

State is stored in S3 with DynamoDB locking:

| Resource     | Name pattern                              |
|--------------|-------------------------------------------|
| S3 bucket    | `creative-video-tfstate-<AWS_ACCOUNT_ID>` |
| DynamoDB     | `creative-video-tfstate-lock`             |
| State key    | `<env>/<module>/terraform.tfstate`        |

Each environment should use a separate AWS account (and therefore separate state bucket) for isolation.

---

## Common Issues

**`NoSuchBucket` on first apply**
→ The state bucket doesn't exist yet. See [Initial Setup](#2-create-the-terraform-state-bucket).

**`Error: ResourceNotFoundException` for DynamoDB**
→ The lock table doesn't exist yet. Create it as shown in the setup steps.

**`mock_outputs` used during plan**
→ Expected when planning the `worker` module before other modules are applied. Mock outputs are for `validate`/`plan` only.

**ECS service stuck at 0 tasks**
→ Check the CloudWatch log group `/ecs/creative-video-<env>-worker` and the ECS service events tab for pull/start errors. Verify the ECR image URI is correct in the worker `terragrunt.hcl`.
