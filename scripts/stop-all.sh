#!/bin/bash
# Stop all local services
echo "Stopping containers..."
docker compose down

echo "Killing background processes..."
pkill -f "gradlew bootRun" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "worker.main" 2>/dev/null || true

echo "All stopped."
