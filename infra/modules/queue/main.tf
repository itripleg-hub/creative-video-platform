# -----------------------------------------------------------------------------
# modules/queue — SQS render queue + dead-letter queue (+ optional results queue)
# -----------------------------------------------------------------------------

locals {
  name_prefix = "${var.project}-${var.environment}"
}

# ---------------------------------------------------------------------------
# Dead-Letter Queue — receives messages after max_receive_count failures
# ---------------------------------------------------------------------------
resource "aws_sqs_queue" "render_dlq" {
  name                       = "${var.queue_name}-dlq"
  message_retention_seconds  = var.dlq_message_retention_seconds
  sqs_managed_sse_enabled    = true

  tags = {
    Name    = "${var.queue_name}-dlq"
    Purpose = "dead-letter"
  }
}

# ---------------------------------------------------------------------------
# Primary Render Job Queue
# ---------------------------------------------------------------------------
resource "aws_sqs_queue" "render" {
  name                       = var.queue_name
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.render_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = {
    Name    = var.queue_name
    Purpose = "render-jobs"
  }
}

# ---------------------------------------------------------------------------
# Results Queue (optional) — worker publishes completion/failure events here
# ---------------------------------------------------------------------------
resource "aws_sqs_queue" "result_dlq" {
  count = var.enable_result_queue ? 1 : 0

  name                      = "${var.result_queue_name}-dlq"
  message_retention_seconds = var.dlq_message_retention_seconds
  sqs_managed_sse_enabled   = true

  tags = {
    Name    = "${var.result_queue_name}-dlq"
    Purpose = "dead-letter"
  }
}

resource "aws_sqs_queue" "result" {
  count = var.enable_result_queue ? 1 : 0

  name                       = var.result_queue_name
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.result_dlq[0].arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = {
    Name    = var.result_queue_name
    Purpose = "render-results"
  }
}

# ---------------------------------------------------------------------------
# Queue Policy — allow ECS task role to send/receive/delete (set by IAM module)
# Policy resource kept here for discoverability; actual permissions in IAM module.
# ---------------------------------------------------------------------------
resource "aws_sqs_queue_policy" "render" {
  queue_url = aws_sqs_queue.render.id
  policy    = data.aws_iam_policy_document.render_queue_policy.json
}

data "aws_iam_policy_document" "render_queue_policy" {
  statement {
    sid    = "AllowAccountAccess"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = [data.aws_caller_identity.current.account_id]
    }

    actions = [
      "sqs:SendMessage",
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:ChangeMessageVisibility",
    ]

    resources = [aws_sqs_queue.render.arn]
  }
}

data "aws_caller_identity" "current" {}
