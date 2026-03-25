# -----------------------------------------------------------------------------
# modules/storage — outputs
# -----------------------------------------------------------------------------

output "input_bucket_name" {
  description = "Name of the input assets S3 bucket"
  value       = aws_s3_bucket.input.bucket
}

output "input_bucket_arn" {
  description = "ARN of the input assets S3 bucket"
  value       = aws_s3_bucket.input.arn
}

output "output_bucket_name" {
  description = "Name of the rendered output S3 bucket"
  value       = aws_s3_bucket.output.bucket
}

output "output_bucket_arn" {
  description = "ARN of the rendered output S3 bucket"
  value       = aws_s3_bucket.output.arn
}

output "temp_bucket_name" {
  description = "Name of the temporary processing S3 bucket"
  value       = aws_s3_bucket.temp.bucket
}

output "temp_bucket_arn" {
  description = "ARN of the temporary processing S3 bucket"
  value       = aws_s3_bucket.temp.arn
}
