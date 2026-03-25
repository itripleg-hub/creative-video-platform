# -----------------------------------------------------------------------------
# modules/iam — ECS task execution role + task role with S3/SQS/Secrets policies
# -----------------------------------------------------------------------------

locals {
  name_prefix   = "${var.project}-${var.environment}"
  has_result_q  = var.result_queue_arn != ""
  has_dlq       = var.render_dlq_arn != ""
  has_secrets   = var.openai_secret_arn != "" || var.tts_secret_arn != ""
}

# ---------------------------------------------------------------------------
# ECS Task Execution Role
# Used by ECS/Fargate agent to pull images and write logs
# ---------------------------------------------------------------------------
resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-ecs-task-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow pulling secrets from Secrets Manager during container startup
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  count = local.has_secrets ? 1 : 0
  name  = "${local.name_prefix}-ecs-execution-secrets"
  role  = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSecretsRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
        ]
        Resource = compact([
          var.openai_secret_arn,
          var.tts_secret_arn,
        ])
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# ECS Task Role
# Used by the application code running inside the container
# ---------------------------------------------------------------------------
resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-ecs-task-role"
  }
}

# SQS permissions — receive, process, and (optionally) publish results
resource "aws_iam_role_policy" "ecs_task_sqs" {
  name = "${local.name_prefix}-ecs-task-sqs"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "RenderQueueAccess"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:ChangeMessageVisibility",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
        ]
        Resource = compact([
          var.render_queue_arn,
          local.has_dlq ? var.render_dlq_arn : null,
        ])
      },
      {
        Sid    = "ResultQueuePublish"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
        ]
        Resource = compact([
          local.has_result_q ? var.result_queue_arn : null,
        ])
      },
    ]
  })
}

# S3 permissions — read input, write output and temp
resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${local.name_prefix}-ecs-task-s3"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "InputBucketRead"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:HeadObject",
          "s3:ListBucket",
        ]
        Resource = [
          var.input_bucket_arn,
          "${var.input_bucket_arn}/*",
        ]
      },
      {
        Sid    = "OutputBucketWrite"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:HeadObject",
          "s3:ListBucket",
          "s3:DeleteObject",
        ]
        Resource = [
          var.output_bucket_arn,
          "${var.output_bucket_arn}/*",
        ]
      },
      {
        Sid    = "TempBucketFullAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:HeadObject",
          "s3:ListBucket",
          "s3:DeleteObject",
        ]
        Resource = [
          var.temp_bucket_arn,
          "${var.temp_bucket_arn}/*",
        ]
      },
    ]
  })
}

# Secrets Manager — runtime access (e.g. refreshing tokens)
resource "aws_iam_role_policy" "ecs_task_secrets" {
  count = local.has_secrets ? 1 : 0
  name  = "${local.name_prefix}-ecs-task-secrets"
  role  = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSecretsRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ]
        Resource = compact([
          var.openai_secret_arn,
          var.tts_secret_arn,
        ])
      }
    ]
  })
}

# CloudWatch Logs — allow writing from inside the container (belt + suspenders with execution role)
resource "aws_iam_role_policy" "ecs_task_logs" {
  name = "${local.name_prefix}-ecs-task-logs"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogsWrite"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:*:*:log-group:/ecs/${local.name_prefix}*:*"
      }
    ]
  })
}
