# -----------------------------------------------------------------------------
# dev environment — shared locals read by child terragrunt.hcl files
# -----------------------------------------------------------------------------
locals {
  environment = "dev"
  project     = "creative-video"
  region      = "us-east-1"
  aws_account = "111111111111" # replace with your actual dev account ID
}
