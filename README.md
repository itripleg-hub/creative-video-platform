# AI Creative Video Platform

A Canva-like video localization tool. Create templates with dynamic text layers, edit visually, and render localized videos across multiple languages with optional AI voiceover and subtitles.

## Components

| Directory | Stack | Description |
|-----------|-------|-------------|
| `frontend/` | React 18 + TypeScript + Vite + Konva | Template editor, job wizard, monitoring |
| `backend/` | Java 17 + Spring Boot 3.x + PostgreSQL | API, auth, orchestration, SSE |
| `worker/` | Python 3.11 + FFmpeg + Pillow | Video rendering engine |
| `infra/` | Terragrunt + Terraform | AWS infrastructure (ECS, SQS, S3) |

## Prerequisites

- **Docker** (for PostgreSQL + MinIO)
- **Java 17+** (backend)
- **Node.js 18+** (frontend)
- **Python 3.11+** and **FFmpeg** (worker — only needed for rendering)

## Quick Start

### Option 1: Start everything at once

```bash
./scripts/start-all.sh
```

This starts PostgreSQL, MinIO, the backend, and the frontend. Open http://localhost:5173 when it's ready.

### Option 2: Start services individually

**Step 1 — Start databases:**

```bash
./scripts/start-deps.sh
```

Starts PostgreSQL (port 5432) and MinIO (ports 9000/9001) with auto-created S3 buckets.

**Step 2 — Start backend:**

```bash
./scripts/start-backend.sh
```

Builds and runs the Spring Boot API on http://localhost:8080.

**Step 3 — Start frontend:**

```bash
./scripts/start-frontend.sh
```

Installs npm packages and runs the Vite dev server on http://localhost:5173.

**Step 4 — Start worker (optional, for rendering):**

```bash
./scripts/start-worker.sh
```

Creates a Python venv, installs deps, and starts the rendering worker.

### Stopping everything

```bash
./scripts/stop-all.sh
```

## Scripts Reference

| Script | What it does |
|--------|-------------|
| `scripts/start-deps.sh` | Docker: PostgreSQL + MinIO + create S3 buckets |
| `scripts/start-backend.sh` | Build + run Spring Boot (port 8080) |
| `scripts/start-frontend.sh` | npm install + Vite dev server (port 5173) |
| `scripts/start-worker.sh` | Python venv + pip install + start worker |
| `scripts/start-all.sh` | All of the above in one command |
| `scripts/stop-all.sh` | Kill everything + docker compose down |

## Local Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | — |
| Backend API | http://localhost:8080 | — |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| PostgreSQL | localhost:5433 | creative / creative |

## Architecture

```
React Frontend (5173)
    |
    v
Spring Boot API (8080)
    |-- PostgreSQL (5432)
    |-- MinIO / S3 (9000)
    |-- SSE (real-time job updates)
    |
    v
Python Worker
    |-- FFmpeg (video composition)
    |-- Pillow (text layout)
    |-- S3 (asset download/upload)
```

## Project Structure

```
creative-video-platform/
├── docker-compose.yml          # PostgreSQL + MinIO
├── scripts/                    # Start/stop scripts
├── docs/                       # Architecture docs, layer model spec
├── frontend/                   # React app
│   ├── src/features/editor/    # Canvas editor (react-konva)
│   ├── src/features/jobs/      # Job wizard + monitoring
│   └── src/shared/             # API, hooks, stores, components
├── backend/                    # Spring Boot API
│   └── src/main/java/.../
│       ├── domain/             # JPA entities
│       ├── web/controller/     # REST endpoints
│       ├── service/            # Business logic
│       └── security/           # JWT auth
├── worker/                     # Python rendering
│   ├── worker/renderer/        # FFmpeg + Pillow pipeline
│   ├── worker/text_layout.py   # Text measurement engine
│   └── tests/                  # Pytest suite
└── infra/                      # Terragrunt/Terraform
    ├── modules/                # ECS, SQS, S3, VPC, IAM
    └── environments/           # dev, staging, prod
```

## Documentation

- [Architecture Decisions](docs/ARCHITECTURE.md)
- [Dynamic Layer Model](docs/LAYER-MODEL.md)
- [Backend API Reference](backend/README.md)
- [Frontend Guide](frontend/README.md)
- [Worker Guide](worker/README.md)
- [Infrastructure Guide](infra/README.md)
