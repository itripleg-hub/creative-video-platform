#!/bin/bash
# Start the Python rendering worker
set -e

cd "$(dirname "$0")/../worker"

export INPUT_BUCKET=creative-input
export OUTPUT_BUCKET=creative-output
export TEMP_BUCKET=creative-temp
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
export AWS_ENDPOINT_URL=http://localhost:9000
export AWS_REGION=us-east-1
export BACKEND_CALLBACK_URL=http://localhost:8080/api
export LOG_LEVEL=DEBUG

if ! command -v ffmpeg &>/dev/null; then
  echo "ERROR: ffmpeg is not installed. Install it first:"
  echo "  macOS:  brew install ffmpeg"
  echo "  Linux:  sudo apt install ffmpeg"
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "Installing dependencies..."
pip install -e ".[dev]" --quiet

echo "Starting worker..."
python -m worker.main
