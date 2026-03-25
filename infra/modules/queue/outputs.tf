# -----------------------------------------------------------------------------
# modules/queue — outputs
# -----------------------------------------------------------------------------

output "render_queue_url" {
  description = "URL of the primary render job queue"
  value       = aws_sqs_queue.render.url
}

output "render_queue_arn" {
  description = "ARN of the primary render job queue"
  value       = aws_sqs_queue.render.arn
}

output "render_queue_name" {
  description = "Name of the primary render job queue"
  value       = aws_sqs_queue.render.name
}

output "render_dlq_url" {
  description = "URL of the render job dead-letter queue"
  value       = aws_sqs_queue.render_dlq.url
}

output "render_dlq_arn" {
  description = "ARN of the render job dead-letter queue"
  value       = aws_sqs_queue.render_dlq.arn
}

output "result_queue_url" {
  description = "URL of the render results queue (empty string if not enabled)"
  value       = var.enable_result_queue ? aws_sqs_queue.result[0].url : ""
}

output "result_queue_arn" {
  description = "ARN of the render results queue (empty string if not enabled)"
  value       = var.enable_result_queue ? aws_sqs_queue.result[0].arn : ""
}

output "result_queue_name" {
  description = "Name of the render results queue (empty string if not enabled)"
  value       = var.enable_result_queue ? aws_sqs_queue.result[0].name : ""
}
