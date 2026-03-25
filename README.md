# AI Creative Video Platform

Monorepo for the Creative Video Platform — a Canva-like video localization tool.

## Components

| Directory | Stack | Description |
|-----------|-------|-------------|
| `frontend/` | React 18 + TypeScript + Vite | Template editor, job wizard, monitoring dashboard |
| `backend/` | Java 17 + Spring Boot 3.x | API, auth, orchestration, SSE, storage |
| `worker/` | Python 3.11 + FFmpeg + Pillow | Rendering engine, text layout, subtitle composition |
| `infra/` | Terragrunt + Terraform | Worker runtime, queues, storage, env config |
| `docs/` | Markdown | Architecture decisions, API contracts, layer model spec |

## Phase 1 Scope

- Auth (JWT login/refresh/roles)
- Template CRUD with dynamic N-count text layers
- Source video upload via presigned URLs
- Canvas-like preview/editor (React)
- Job creation with persisted layer payload
- Basic Python rendering (FFmpeg + Pillow)
- Result upload + download
- SSE job progress streaming

## Getting Started

See each component's README for setup instructions.
