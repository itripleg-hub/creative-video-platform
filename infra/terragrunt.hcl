# -----------------------------------------------------------------------------
# Root terragrunt.hcl
# Shared remote state config and common inputs for all environments/modules.
# -----------------------------------------------------------------------------

locals {
  # Parse environment and region from the directory path
  # e.g. environments/dev/worker → environment = "dev"
  path_parts  = split("/", path_relative_to_include())
  environment = local.path_parts[1]
  module_name = length(local.path_parts) > 2 ? local.path_parts[2] : "root"

  # Load environment-level common vars
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  region      = local.env_vars.locals.region
  project     = local.env_vars.locals.project
  aws_account = local.env_vars.locals.aws_account
}

# ---------------------------------------------------------------------------
# Remote state — one S3 bucket + DynamoDB table per AWS account
# ---------------------------------------------------------------------------
remote_state {
  backend = "s3"

  config = {
    encrypt        = true
    bucket         = "${local.project}-tfstate-${local.aws_account}"
    key            = "${local.environment}/${local.module_name}/terraform.tfstate"
    region         = local.region
    dynamodb_table = "${local.project}-tfstate-lock"
  }

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}

# ---------------------------------------------------------------------------
# Common provider generation — injected into every module
# ---------------------------------------------------------------------------
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"

  contents = <<EOF
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${local.region}"

  default_tags {
    tags = {
      Project     = "${local.project}"
      Environment = "${local.environment}"
      ManagedBy   = "terragrunt"
    }
  }
}
EOF
}

# ---------------------------------------------------------------------------
# Common inputs available to all modules
# ---------------------------------------------------------------------------
inputs = {
  environment = local.environment
  region      = local.region
  project     = local.project
}
