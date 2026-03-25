# -----------------------------------------------------------------------------
# modules/storage — variables
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
  description = "AWS region where buckets are created"
  type        = string
}

variable "input_bucket" {
  description = "Name for the input assets S3 bucket"
  type        = string
}

variable "output_bucket" {
  description = "Name for the rendered output S3 bucket"
  type        = string
}

variable "temp_bucket" {
  description = "Name for the temporary processing S3 bucket"
  type        = string
}

variable "temp_lifecycle_days" {
  description = "Number of days before temp objects are automatically deleted"
  type        = number
  default     = 7
}

variable "output_lifecycle_days" {
  description = "Number of days before output objects transition to STANDARD_IA (0 = disabled)"
  type        = number
  default     = 30
}

variable "cors_allowed_origins" {
  description = "List of origins allowed to make cross-origin requests (for presigned URL uploads)"
  type        = list(string)
  default     = []
}

variable "force_destroy" {
  description = "Allow buckets to be destroyed even when non-empty (use with caution in prod)"
  type        = bool
  default     = false
}
