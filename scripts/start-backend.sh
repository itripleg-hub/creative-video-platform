#!/bin/bash
# Start the Java Spring Boot backend
set -e

cd "$(dirname "$0")/../backend"

export DB_URL=jdbc:postgresql://localhost:5433/creative_video
export DB_USERNAME=creative
export DB_PASSWORD=creative
export JWT_SECRET=dev-secret-change-in-production-must-be-256-bits-long-enough
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
export STORAGE_ENDPOINT=http://localhost:9000
export STORAGE_REGION=us-east-1
export STORAGE_INPUT_BUCKET=creative-input
export STORAGE_OUTPUT_BUCKET=creative-output

echo "Building backend..."
./gradlew build -x test --quiet 2>/dev/null || {
  echo "Gradle wrapper not found. Generating..."
  gradle wrapper --gradle-version 8.5
  ./gradlew build -x test --quiet
}

echo "Starting backend on http://localhost:8080"
./gradlew bootRun
