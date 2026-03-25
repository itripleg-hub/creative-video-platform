# -----------------------------------------------------------------------------
# staging environment root
# -----------------------------------------------------------------------------
locals {
  env_vars = read_terragrunt_config("env.hcl")
}

include "root" {
  path = find_in_parent_folders()
}
