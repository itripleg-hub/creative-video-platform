# -----------------------------------------------------------------------------
# dev environment root — no resources, just wiring
# -----------------------------------------------------------------------------
locals {
  env_vars = read_terragrunt_config("env.hcl")
}

# Inherit root remote_state and provider generation
include "root" {
  path = find_in_parent_folders()
}
