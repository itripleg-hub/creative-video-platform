# -----------------------------------------------------------------------------
# staging / storage
# -----------------------------------------------------------------------------
locals {
  env_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  env      = local.env_vars.locals.environment
  project  = local.env_vars.locals.project
  region   = local.env_vars.locals.region
}

include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/storage"
}

inputs = {
  environment = local.env
  project     = local.project
  region      = local.region

  input_bucket  = "${local.project}-${local.env}-input"
  output_bucket = "${local.project}-${local.env}-output"
  temp_bucket   = "${local.project}-${local.env}-temp"

  # Temp objects expire after 3 days in staging
  temp_lifecycle_days = 3

  # Transition output to IA after 30 days
  output_lifecycle_days = 30

  # Allowed origins for staging frontend
  cors_allowed_origins = ["https://staging.creative-video.example.com"]
}
