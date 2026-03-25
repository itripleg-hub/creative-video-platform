# -----------------------------------------------------------------------------
# modules/storage — S3 buckets: input, output, temp
# All buckets are private, encrypted, versioned (except temp)
# -----------------------------------------------------------------------------

locals {
  name_prefix = "${var.project}-${var.environment}"
}

# ---------------------------------------------------------------------------
# Input Bucket — raw source assets uploaded by users
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "input" {
  bucket        = var.input_bucket
  force_destroy = var.force_destroy

  tags = {
    Name    = var.input_bucket
    Purpose = "input-assets"
  }
}

resource "aws_s3_bucket_versioning" "input" {
  bucket = aws_s3_bucket.input.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "input" {
  bucket = aws_s3_bucket.input.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "input" {
  bucket                  = aws_s3_bucket.input.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "input" {
  count  = length(var.cors_allowed_origins) > 0 ? 1 : 0
  bucket = aws_s3_bucket.input.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# ---------------------------------------------------------------------------
# Output Bucket — rendered video files delivered to end users
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "output" {
  bucket        = var.output_bucket
  force_destroy = var.force_destroy

  tags = {
    Name    = var.output_bucket
    Purpose = "rendered-output"
  }
}

resource "aws_s3_bucket_versioning" "output" {
  bucket = aws_s3_bucket.output.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "output" {
  bucket = aws_s3_bucket.output.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "output" {
  bucket                  = aws_s3_bucket.output.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "output" {
  count  = var.output_lifecycle_days > 0 ? 1 : 0
  bucket = aws_s3_bucket.output.id

  rule {
    id     = "transition-to-infrequent-access"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = var.output_lifecycle_days
      storage_class = "STANDARD_IA"
    }
  }
}

# ---------------------------------------------------------------------------
# Temp Bucket — intermediate files during processing (auto-deleted)
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "temp" {
  bucket        = var.temp_bucket
  force_destroy = true # temp bucket always force-destroyable

  tags = {
    Name    = var.temp_bucket
    Purpose = "processing-temp"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "temp" {
  bucket = aws_s3_bucket.temp.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "temp" {
  bucket                  = aws_s3_bucket.temp.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "temp" {
  bucket = aws_s3_bucket.temp.id

  rule {
    id     = "expire-temp-objects"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = var.temp_lifecycle_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}
