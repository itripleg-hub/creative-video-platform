# -----------------------------------------------------------------------------
# prod / queue
# -----------------------------------------------------------------------------
locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env      = local.env_vars.locals.environment
  project  = local.env_vars.locals.project
}

include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/queue"
}

inputs = {
  environment = local.env
  project     = local.project

  queue_name        = "${local.project}-${local.env}-render-jobs"
  result_queue_name = "${local.project}-${local.env}-render-results"

  # Prod: longer visibility timeout to allow large render jobs
  visibility_timeout_seconds = 900
  message_retention_seconds  = 345600 # 4 days

  # DLQ: move to dead-letter after 5 failures
  max_receive_count = 5

  enable_result_queue = true

  # Keep failed messages for 14 days for inspection
  dlq_message_retention_seconds = 1209600
}
