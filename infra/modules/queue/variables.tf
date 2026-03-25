# -----------------------------------------------------------------------------
# modules/queue — variables
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "project" {
  description = "Project name used as a resource prefix"
  type        = string
}

variable "queue_name" {
  description = "Name of the primary render job queue"
  type        = string
}

variable "result_queue_name" {
  description = "Name of the render results queue"
  type        = string
  default     = ""
}

variable "visibility_timeout_seconds" {
  description = "Seconds a message is hidden after being received (should exceed max task duration)"
  type        = number
  default     = 300
}

variable "message_retention_seconds" {
  description = "Seconds messages are retained in the queue"
  type        = number
  default     = 345600 # 4 days
}

variable "max_receive_count" {
  description = "Number of times a message is received before being moved to the DLQ"
  type        = number
  default     = 5
}

variable "enable_result_queue" {
  description = "Whether to create the results queue"
  type        = bool
  default     = false
}

variable "dlq_message_retention_seconds" {
  description = "Seconds messages are retained in the dead-letter queue"
  type        = number
  default     = 1209600 # 14 days
}
