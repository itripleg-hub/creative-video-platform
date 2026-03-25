# -----------------------------------------------------------------------------
# staging / queue
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

  # Staging: production-like visibility timeout
  visibility_timeout_seconds = 600
  message_retention_seconds  = 259200 # 3 days

  # DLQ: move to dead-letter after 3 failures
  max_receive_count = 3

  enable_result_queue = true
}
