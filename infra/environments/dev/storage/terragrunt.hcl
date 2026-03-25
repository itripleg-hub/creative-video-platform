# -----------------------------------------------------------------------------
# dev / storage
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

  # Temp objects expire after 2 days in dev
  temp_lifecycle_days = 2

  # Allowed origins for presigned-URL uploads from local dev / staging FE
  cors_allowed_origins = ["http://localhost:3000", "http://localhost:5173"]
}
