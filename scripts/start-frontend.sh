#!/bin/bash
# Start the React frontend dev server
set -e

cd "$(dirname "$0")/../frontend"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ ! -f ".env" ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

echo "Starting frontend on http://localhost:5173"
npm run dev
