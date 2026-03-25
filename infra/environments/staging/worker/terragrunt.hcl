# -----------------------------------------------------------------------------
# staging / worker
# ECS Fargate — medium sizing (1 vCPU / 2 GB), scales 0–5
# -----------------------------------------------------------------------------
locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env      = local.env_vars.locals.environment
  project  = local.env_vars.locals.project
  region   = local.env_vars.locals.region
}

include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/worker"
}

dependency "networking" {
  config_path = "../networking"

  mock_outputs = {
    vpc_id             = "vpc-mock"
    private_subnet_ids = ["subnet-mock-1", "subnet-mock-2"]
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "queue" {
  config_path = "../queue"

  mock_outputs = {
    render_queue_url = "https://sqs.us-east-1.amazonaws.com/222222222222/mock-queue"
    render_queue_arn = "arn:aws:sqs:us-east-1:222222222222:mock-queue"
    result_queue_url = "https://sqs.us-east-1.amazonaws.com/222222222222/mock-result-queue"
    result_queue_arn = "arn:aws:sqs:us-east-1:222222222222:mock-result-queue"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "storage" {
  config_path = "../storage"

  mock_outputs = {
    input_bucket_arn   = "arn:aws:s3:::mock-input"
    output_bucket_arn  = "arn:aws:s3:::mock-output"
    temp_bucket_arn    = "arn:aws:s3:::mock-temp"
    input_bucket_name  = "mock-input"
    output_bucket_name = "mock-output"
    temp_bucket_name   = "mock-temp"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  environment = local.env
  project     = local.project
  region      = local.region

  # Container image — override with your ECR URI once built
  worker_image = "222222222222.dkr.ecr.us-east-1.amazonaws.com/${local.project}-worker:latest"

  # staging sizing: 1 vCPU / 2 GB
  worker_cpu    = 1024
  worker_memory = 2048

  # Scaling: staging scales to 0 when idle, up to 5
  worker_desired_count = 0
  worker_min_count     = 0
  worker_max_count     = 5

  # Networking
  vpc_id             = dependency.networking.outputs.vpc_id
  private_subnet_ids = dependency.networking.outputs.private_subnet_ids

  # Queues
  render_queue_url = dependency.queue.outputs.render_queue_url
  render_queue_arn = dependency.queue.outputs.render_queue_arn
  result_queue_url = dependency.queue.outputs.result_queue_url
  result_queue_arn = dependency.queue.outputs.result_queue_arn

  # Storage
  input_bucket_name  = dependency.storage.outputs.input_bucket_name
  output_bucket_name = dependency.storage.outputs.output_bucket_name
  temp_bucket_name   = dependency.storage.outputs.temp_bucket_name
  input_bucket_arn   = dependency.storage.outputs.input_bucket_arn
  output_bucket_arn  = dependency.storage.outputs.output_bucket_arn
  temp_bucket_arn    = dependency.storage.outputs.temp_bucket_arn

  # Secrets
  openai_secret_arn = "arn:aws:secretsmanager:us-east-1:222222222222:secret:staging/creative-video/openai-api-key"
  tts_secret_arn    = "arn:aws:secretsmanager:us-east-1:222222222222:secret:staging/creative-video/tts-api-key"

  # Worker runtime config
  python_log_level = "INFO"
  ffmpeg_threads   = 2
  log_retention_days = 30
}
