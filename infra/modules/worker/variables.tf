# -----------------------------------------------------------------------------
# modules/worker — variables
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "project" {
  description = "Project name used as a resource prefix"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

# ---------------------------------------------------------------------------
# Container
# ---------------------------------------------------------------------------
variable "worker_image" {
  description = "Docker image URI for the worker container (ECR or Docker Hub)"
  type        = string
}

variable "worker_cpu" {
  description = "Fargate CPU units (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 512
}

variable "worker_memory" {
  description = "Fargate memory in MiB"
  type        = number
  default     = 1024
}

# ---------------------------------------------------------------------------
# Scaling
# ---------------------------------------------------------------------------
variable "worker_desired_count" {
  description = "Initial desired number of worker tasks"
  type        = number
  default     = 1
}

variable "worker_min_count" {
  description = "Minimum number of worker tasks for autoscaling"
  type        = number
  default     = 0
}

variable "worker_max_count" {
  description = "Maximum number of worker tasks for autoscaling"
  type        = number
  default     = 10
}

variable "scale_out_cooldown" {
  description = "Seconds to wait before allowing another scale-out event"
  type        = number
  default     = 60
}

variable "scale_in_cooldown" {
  description = "Seconds to wait before allowing another scale-in event"
  type        = number
  default     = 300
}

variable "sqs_queue_depth_scale_out" {
  description = "SQS ApproximateNumberOfMessages threshold to trigger scale-out"
  type        = number
  default     = 5
}

variable "sqs_queue_depth_scale_in" {
  description = "SQS ApproximateNumberOfMessages threshold to trigger scale-in"
  type        = number
  default     = 0
}

# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------
variable "vpc_id" {
  description = "ID of the VPC to deploy the ECS service into"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for Fargate tasks"
  type        = list(string)
}

variable "security_group_ids" {
  description = "Additional security group IDs to attach to Fargate tasks (optional)"
  type        = list(string)
  default     = []
}

# ---------------------------------------------------------------------------
# Queues (from queue module outputs)
# ---------------------------------------------------------------------------
variable "render_queue_url" {
  description = "URL of the primary render job SQS queue"
  type        = string
}

variable "render_queue_arn" {
  description = "ARN of the primary render job SQS queue"
  type        = string
}

variable "result_queue_url" {
  description = "URL of the render results SQS queue"
  type        = string
  default     = ""
}

variable "result_queue_arn" {
  description = "ARN of the render results SQS queue"
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------
# Storage (from storage module outputs)
# ---------------------------------------------------------------------------
variable "input_bucket_name" {
  description = "Name of the input assets S3 bucket"
  type        = string
}

variable "output_bucket_name" {
  description = "Name of the rendered output S3 bucket"
  type        = string
}

variable "temp_bucket_name" {
  description = "Name of the temp processing S3 bucket"
  type        = string
}

variable "input_bucket_arn" {
  description = "ARN of the input assets S3 bucket"
  type        = string
}

variable "output_bucket_arn" {
  description = "ARN of the rendered output S3 bucket"
  type        = string
}

variable "temp_bucket_arn" {
  description = "ARN of the temp processing S3 bucket"
  type        = string
}

# ---------------------------------------------------------------------------
# Secrets
# ---------------------------------------------------------------------------
variable "openai_secret_arn" {
  description = "ARN of the OpenAI API key secret in Secrets Manager"
  type        = string
  default     = ""
}

variable "tts_secret_arn" {
  description = "ARN of the TTS API key secret in Secrets Manager"
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------
# Runtime config
# ---------------------------------------------------------------------------
variable "python_log_level" {
  description = "Python logging level for the worker (DEBUG, INFO, WARNING, ERROR)"
  type        = string
  default     = "INFO"
}

variable "ffmpeg_threads" {
  description = "Number of threads FFmpeg is allowed to use"
  type        = number
  default     = 0 # 0 = auto-detect
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch log events"
  type        = number
  default     = 14
}
