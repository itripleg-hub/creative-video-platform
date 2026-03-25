#!/bin/bash
# Start the entire platform locally
# Usage: ./scripts/start-all.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "  Creative Video Platform - Local Start"
echo "========================================="
echo ""

# Step 1: Dependencies
echo "[1/3] Starting PostgreSQL + MinIO..."
bash "$SCRIPT_DIR/start-deps.sh"
echo ""

# Step 2: Backend (background)
echo "[2/3] Starting backend..."
bash "$SCRIPT_DIR/start-backend.sh" &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
echo ""

# Wait for backend to be ready
echo "Waiting for backend to start..."
for i in $(seq 1 30); do
  if curl -s http://localhost:8080/api/meta/languages > /dev/null 2>&1; then
    echo "Backend is ready!"
    break
  fi
  sleep 2
done
echo ""

# Step 3: Frontend (background)
echo "[3/3] Starting frontend..."
bash "$SCRIPT_DIR/start-frontend.sh" &
FRONTEND_PID=$!
echo ""

echo "========================================="
echo "  Everything is running!"
echo "========================================="
echo ""
echo "  Frontend:       http://localhost:5173"
echo "  Backend API:    http://localhost:8080"
echo "  MinIO Console:  http://localhost:9001"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# Wait for either to exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker compose stop" EXIT
wait
