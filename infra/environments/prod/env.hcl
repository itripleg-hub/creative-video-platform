# -----------------------------------------------------------------------------
# prod environment — shared locals read by child terragrunt.hcl files
# -----------------------------------------------------------------------------
locals {
  environment = "prod"
  project     = "creative-video"
  region      = "us-east-1"
  aws_account = "333333333333" # replace with your actual prod account ID
}
