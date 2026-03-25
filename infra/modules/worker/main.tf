# -----------------------------------------------------------------------------
# modules/worker — ECS Fargate task definition, service, autoscaling, CloudWatch
# -----------------------------------------------------------------------------

locals {
  name_prefix    = "${var.project}-${var.environment}"
  has_secrets    = var.openai_secret_arn != "" || var.tts_secret_arn != ""
  has_result_q   = var.result_queue_url != ""
}

# ---------------------------------------------------------------------------
# CloudWatch Log Group
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name_prefix}-worker"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${local.name_prefix}-worker-logs"
  }
}

# ---------------------------------------------------------------------------
# IAM — task execution role + task role (via iam module pattern inline)
# ---------------------------------------------------------------------------
resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "${local.name_prefix}-ecs-task-execution-role" }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  count = local.has_secrets ? 1 : 0
  name  = "${local.name_prefix}-execution-secrets"
  role  = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "SecretsRead"
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = compact([var.openai_secret_arn, var.tts_secret_arn])
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "${local.name_prefix}-ecs-task-role" }
}

resource "aws_iam_role_policy" "ecs_task_sqs" {
  name = "${local.name_prefix}-task-sqs"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "RenderQueueConsume"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:ChangeMessageVisibility",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
        ]
        Resource = [var.render_queue_arn]
      },
      {
        Sid    = "ResultQueuePublish"
        Effect = "Allow"
        Action = ["sqs:SendMessage", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"]
        Resource = compact([local.has_result_q ? var.result_queue_arn : ""])
      },
    ]
  })
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${local.name_prefix}-task-s3"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "InputRead"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:HeadObject", "s3:ListBucket"]
        Resource = [var.input_bucket_arn, "${var.input_bucket_arn}/*"]
      },
      {
        Sid    = "OutputWrite"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:HeadObject", "s3:ListBucket", "s3:DeleteObject"]
        Resource = [var.output_bucket_arn, "${var.output_bucket_arn}/*"]
      },
      {
        Sid    = "TempAccess"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:HeadObject", "s3:ListBucket", "s3:DeleteObject"]
        Resource = [var.temp_bucket_arn, "${var.temp_bucket_arn}/*"]
      },
    ]
  })
}

resource "aws_iam_role_policy" "ecs_task_secrets" {
  count = local.has_secrets ? 1 : 0
  name  = "${local.name_prefix}-task-secrets"
  role  = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "SecretsRead"
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = compact([var.openai_secret_arn, var.tts_secret_arn])
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_logs" {
  name = "${local.name_prefix}-task-logs"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "CloudWatchLogs"
      Effect = "Allow"
      Action = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.worker.arn}:*"
    }]
  })
}

# ---------------------------------------------------------------------------
# ECS Cluster
# ---------------------------------------------------------------------------
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${local.name_prefix}-cluster"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# ---------------------------------------------------------------------------
# Security Group for Fargate tasks (egress only)
# ---------------------------------------------------------------------------
resource "aws_security_group" "worker" {
  name        = "${local.name_prefix}-worker-sg"
  description = "ECS Fargate worker — egress only"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-worker-sg" }
}

# ---------------------------------------------------------------------------
# ECS Task Definition
# ---------------------------------------------------------------------------
locals {
  secrets = compact([
    var.openai_secret_arn != "" ? jsonencode({
      name      = "OPENAI_API_KEY"
      valueFrom = var.openai_secret_arn
    }) : "",
    var.tts_secret_arn != "" ? jsonencode({
      name      = "TTS_API_KEY"
      valueFrom = var.tts_secret_arn
    }) : "",
  ])

  container_environment = concat(
    [
      { name = "ENVIRONMENT",        value = var.environment },
      { name = "PROJECT",            value = var.project },
      { name = "AWS_REGION",         value = var.region },
      { name = "RENDER_QUEUE_URL",   value = var.render_queue_url },
      { name = "INPUT_BUCKET",       value = var.input_bucket_name },
      { name = "OUTPUT_BUCKET",      value = var.output_bucket_name },
      { name = "TEMP_BUCKET",        value = var.temp_bucket_name },
      { name = "LOG_LEVEL",          value = var.python_log_level },
      { name = "FFMPEG_THREADS",     value = tostring(var.ffmpeg_threads) },
    ],
    local.has_result_q ? [{ name = "RESULT_QUEUE_URL", value = var.result_queue_url }] : [],
  )

  container_secrets = var.openai_secret_arn != "" || var.tts_secret_arn != "" ? compact([
    var.openai_secret_arn != "" ? jsonencode({ name = "OPENAI_API_KEY", valueFrom = var.openai_secret_arn }) : null,
    var.tts_secret_arn != ""   ? jsonencode({ name = "TTS_API_KEY",    valueFrom = var.tts_secret_arn })   : null,
  ]) : []
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.worker_cpu)
  memory                   = tostring(var.worker_memory)
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = var.worker_image
      essential = true

      environment = local.container_environment

      secrets = var.openai_secret_arn != "" || var.tts_secret_arn != "" ? compact([
        var.openai_secret_arn != "" ? { name = "OPENAI_API_KEY", valueFrom = var.openai_secret_arn } : null,
        var.tts_secret_arn != ""   ? { name = "TTS_API_KEY",    valueFrom = var.tts_secret_arn }   : null,
      ]) : []

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "worker"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "python -c 'import sys; sys.exit(0)'"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      readonlyRootFilesystem = false
      privileged             = false
    }
  ])

  tags = {
    Name = "${local.name_prefix}-worker-task"
  }
}

# ---------------------------------------------------------------------------
# ECS Service
# ---------------------------------------------------------------------------
resource "aws_ecs_service" "worker" {
  name                               = "${local.name_prefix}-worker"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.worker.arn
  desired_count                      = var.worker_desired_count
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  propagate_tags                     = "SERVICE"
  enable_execute_command             = true # allows ECS Exec for debugging
  health_check_grace_period_seconds  = 0    # no LB, no grace period needed

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = concat([aws_security_group.worker.id], var.security_group_ids)
    assign_public_ip = false
  }

  lifecycle {
    ignore_changes = [desired_count] # autoscaling manages this
  }

  tags = {
    Name = "${local.name_prefix}-worker-service"
  }
}

# ---------------------------------------------------------------------------
# Application Auto Scaling
# ---------------------------------------------------------------------------
resource "aws_appautoscaling_target" "worker" {
  max_capacity       = var.worker_max_count
  min_capacity       = var.worker_min_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Scale OUT when queue depth exceeds threshold
resource "aws_appautoscaling_policy" "worker_scale_out" {
  name               = "${local.name_prefix}-worker-scale-out"
  policy_type        = "StepScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  step_scaling_policy_configuration {
    adjustment_type          = "ChangeInCapacity"
    cooldown                 = var.scale_out_cooldown
    metric_aggregation_type  = "Maximum"

    step_adjustment {
      metric_interval_lower_bound = 0
      scaling_adjustment          = 1
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "sqs_queue_depth_high" {
  alarm_name          = "${local.name_prefix}-sqs-depth-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = var.sqs_queue_depth_scale_out
  alarm_description   = "Scale out workers when render queue has pending jobs"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = split("/", var.render_queue_url)[length(split("/", var.render_queue_url)) - 1]
  }

  alarm_actions = [aws_appautoscaling_policy.worker_scale_out.arn]

  tags = {
    Name = "${local.name_prefix}-sqs-depth-high"
  }
}

# Scale IN when queue depth falls to zero
resource "aws_appautoscaling_policy" "worker_scale_in" {
  name               = "${local.name_prefix}-worker-scale-in"
  policy_type        = "StepScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  step_scaling_policy_configuration {
    adjustment_type          = "ChangeInCapacity"
    cooldown                 = var.scale_in_cooldown
    metric_aggregation_type  = "Maximum"

    step_adjustment {
      metric_interval_upper_bound = 0
      scaling_adjustment          = -1
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "sqs_queue_depth_low" {
  alarm_name          = "${local.name_prefix}-sqs-depth-low"
  comparison_operator = "LessThanOrEqualToThreshold"
  evaluation_periods  = 3
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = var.sqs_queue_depth_scale_in
  alarm_description   = "Scale in workers when render queue is empty"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = split("/", var.render_queue_url)[length(split("/", var.render_queue_url)) - 1]
  }

  alarm_actions = [aws_appautoscaling_policy.worker_scale_in.arn]

  tags = {
    Name = "${local.name_prefix}-sqs-depth-low"
  }
}
