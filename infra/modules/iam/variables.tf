# -----------------------------------------------------------------------------
# modules/iam — variables
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "project" {
  description = "Project name used as a resource prefix"
  type        = string
}

variable "render_queue_arn" {
  description = "ARN of the primary render job SQS queue"
  type        = string
}

variable "result_queue_arn" {
  description = "ARN of the render results SQS queue (empty string if not enabled)"
  type        = string
  default     = ""
}

variable "render_dlq_arn" {
  description = "ARN of the render job dead-letter SQS queue"
  type        = string
  default     = ""
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
  description = "ARN of the temporary processing S3 bucket"
  type        = string
}

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
