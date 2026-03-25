# -----------------------------------------------------------------------------
# modules/worker — outputs
# -----------------------------------------------------------------------------

output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_id" {
  description = "ID of the ECS worker service"
  value       = aws_ecs_service.worker.id
}

output "ecs_service_name" {
  description = "Name of the ECS worker service"
  value       = aws_ecs_service.worker.name
}

output "task_definition_arn" {
  description = "ARN of the latest ECS task definition"
  value       = aws_ecs_task_definition.worker.arn
}

output "task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task.arn
}

output "worker_security_group_id" {
  description = "ID of the worker security group"
  value       = aws_security_group.worker.id
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for worker tasks"
  value       = aws_cloudwatch_log_group.worker.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group for worker tasks"
  value       = aws_cloudwatch_log_group.worker.arn
}

output "autoscaling_target_resource_id" {
  description = "Resource ID of the autoscaling target"
  value       = aws_appautoscaling_target.worker.resource_id
}
