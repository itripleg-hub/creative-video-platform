#!/bin/bash
# Start PostgreSQL and MinIO containers for local development
set -e

echo "Starting PostgreSQL and MinIO..."
docker compose up -d postgres minio minio-init

echo ""
echo "Waiting for services to be ready..."
sleep 5

echo ""
echo "Services running:"
echo "  PostgreSQL:    localhost:5433  (creative/creative)"
echo "  MinIO API:     localhost:9000  (minioadmin/minioadmin)"
echo "  MinIO Console: localhost:9001"
echo ""
echo "S3 buckets created: creative-input, creative-output, creative-temp"
