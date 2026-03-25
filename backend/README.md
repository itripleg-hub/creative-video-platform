# Creative Video Platform — Backend

Spring Boot 3 REST API for the AI Creative Video Platform. Handles authentication, template management, video job orchestration, SSE event streaming, and asset storage via S3-compatible backends.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Spring Boot 3.2 (Java 17) |
| Security | Spring Security + JWT (JJWT 0.12) |
| Database | PostgreSQL 15+ |
| Migrations | Liquibase |
| ORM | Spring Data JPA / Hibernate |
| JSON columns | hypersistence-utils (JSONB) |
| Mapping | MapStruct 1.5 |
| Storage | AWS S3 / MinIO (presigned URLs) |
| Build | Gradle 8.5 |

---

## Prerequisites

- Java 17+
- PostgreSQL 15+
- AWS S3 bucket (or MinIO for local dev)
- (Optional) Docker + Docker Compose for local dependencies

---

## Quick Start

### 1. Database setup

```sql
CREATE USER creative WITH PASSWORD 'creative';
CREATE DATABASE creative_video OWNER creative;
```

### 2. Environment variables

```bash
export DB_URL=jdbc:postgresql://localhost:5433/creative_video
export DB_USERNAME=creative
export DB_PASSWORD=creative
export JWT_SECRET=your-256-bit-secret-key-here-change-in-production

# AWS / MinIO storage
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export STORAGE_INPUT_BUCKET=creative-input
export STORAGE_OUTPUT_BUCKET=creative-output

# For MinIO (local dev only)
export STORAGE_ENDPOINT=http://localhost:9000
export STORAGE_REGION=us-east-1
```

### 3. Build & run

```bash
# Build (skip tests for quick start)
./gradlew build -x test

# Run
./gradlew bootRun

# Or run the jar directly
java -jar build/libs/creative-video-platform-0.1.0-SNAPSHOT.jar
```

The API starts on **http://localhost:8080**.

---

## API Reference

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | public | Email + password login, returns JWT pair |
| POST | `/api/auth/refresh` | public | Rotate refresh token |
| POST | `/api/auth/logout` | JWT | Revoke all refresh tokens |
| GET | `/api/account` | JWT | Current user info |
| POST | `/api/account/change-password` | JWT | Change own password |

### Templates

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/templates` | JWT | List templates (filterable by `status`, `search`) |
| POST | `/api/templates` | JWT | Create template |
| GET | `/api/templates/{id}` | JWT | Get template |
| PUT | `/api/templates/{id}` | JWT | Update template (creates new version) |
| DELETE | `/api/templates/{id}` | JWT | Archive template |
| POST | `/api/templates/{id}/clone` | JWT | Clone template |
| GET | `/api/templates/{id}/versions` | JWT | List all versions |
| GET | `/api/templates/{id}/versions/{v}` | JWT | Get specific version with layers |

### Assets

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/assets/upload-url` | JWT | Generate presigned S3 PUT URL |
| POST | `/api/assets` | JWT | Register asset after upload |
| GET | `/api/assets/{id}` | JWT | Get asset metadata |

### Jobs

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/jobs` | JWT | Create & dispatch job |
| GET | `/api/jobs` | JWT | List jobs (admins see all, users see own) |
| GET | `/api/jobs/{id}` | JWT | Get job |
| DELETE | `/api/jobs/{id}` | JWT | Delete job (not if running) |
| POST | `/api/jobs/{id}/cancel` | JWT | Cancel pending/running job |
| POST | `/api/jobs/{id}/retry` | JWT | Retry failed/cancelled job |

### Executions

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/jobs/{jobId}/executions` | JWT | List all executions for a job |
| GET | `/api/jobs/{jobId}/executions/{id}` | JWT | Get execution detail |
| GET | `/api/jobs/{jobId}/executions/{id}/steps` | JWT | List execution steps |
| POST | `/api/jobs/{jobId}/executions/{id}/steps/{stepId}/retry` | JWT | Retry a failed step |

### Results

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/jobs/{jobId}/results` | JWT | List results for a job |
| GET | `/api/jobs/{jobId}/results/{id}` | JWT | Get result |
| GET | `/api/jobs/{jobId}/results/{id}/download` | JWT | Get result + presigned download URL |

### SSE Events

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/jobs/{jobId}/events` | JWT | SSE stream for real-time job updates |

SSE event types: `connected`, `execution.created`, `execution.status`, `step.status`

### Metadata (public)

| Method | Path | Description |
|---|---|---|
| GET | `/api/meta/languages` | Supported languages |
| GET | `/api/meta/aspect-ratios` | Supported aspect ratios |
| GET | `/api/meta/voices?provider=default` | Available TTS voices |
| GET | `/api/meta/fonts` | Available fonts |

### Admin (ROLE_ADMIN only)

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users` | Create user |
| GET | `/api/admin/users/{id}` | Get user |
| PATCH | `/api/admin/users/{id}` | Update role/activation |
| DELETE | `/api/admin/users/{id}` | Delete user |

---

## Authentication Flow

```
POST /api/auth/login
  → { accessToken, refreshToken, expiresIn, user }

Authorization: Bearer <accessToken>  (on all protected endpoints)

POST /api/auth/refresh  { refreshToken }
  → new { accessToken, refreshToken }   (old refresh token is revoked)

POST /api/auth/logout
  → revokes all refresh tokens for the user
```

Access tokens expire in **15 minutes** by default. Refresh tokens expire in **7 days**.

---

## Job Lifecycle

```
CREATE job  →  PENDING
               ↓ (async dispatch)
            RUNNING  →  COMPLETED
                     ↘  FAILED
                     ↘  CANCELLED
```

Each job creates a `JobExecution` with ordered `ExecutionStep` records for:
`INPUT_VALIDATION → ASSET_PREPARATION → TRANSLATION → VOICE_GENERATION → SUBTITLE_GENERATION → RENDER_COMPOSITION → FINALIZATION`

Workers update step/execution status via `JobExecutionService`. SSE events are pushed to subscribers at each transition.

---

## Error Responses

All errors return [RFC 7807 Problem Details](https://datatracker.ietf.org/doc/html/rfc7807):

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Job not found: 42",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Validation errors include a field-level `errors` map:

```json
{
  "title": "Validation Failed",
  "status": 422,
  "errors": {
    "email": "Email must be valid",
    "password": "Password must be at least 8 characters"
  }
}
```

---

## Configuration Reference

All config lives in `application.yml` and can be overridden via env vars:

| Env Var | Default | Description |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/creative_video` | JDBC URL |
| `DB_USERNAME` | `creative` | DB user |
| `DB_PASSWORD` | `creative` | DB password |
| `JWT_SECRET` | (insecure default) | **Change in production** — 256-bit+ secret |
| `JWT_ACCESS_EXPIRY_MS` | `900000` (15m) | Access token TTL |
| `JWT_REFRESH_EXPIRY_MS` | `604800000` (7d) | Refresh token TTL |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,...` | Comma-separated origins |
| `STORAGE_TYPE` | `s3` | Storage backend |
| `STORAGE_ENDPOINT` | (AWS default) | Override for MinIO |
| `STORAGE_REGION` | `us-east-1` | AWS/MinIO region |
| `STORAGE_INPUT_BUCKET` | `creative-input` | Bucket for source uploads |
| `STORAGE_OUTPUT_BUCKET` | `creative-output` | Bucket for rendered output |

---

## Local Dev with MinIO

```bash
# Start MinIO
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Create buckets (MinIO console at http://localhost:9001)
# or use mc:
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/creative-input
mc mb local/creative-output

# Set env vars
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
export STORAGE_ENDPOINT=http://localhost:9000
export STORAGE_REGION=us-east-1
```

---

## Project Structure

```
src/main/java/com/company/creative/
├── config/          # App, Async, JPA, Web (CORS) config
├── domain/          # JPA entities + enums
├── mapper/          # MapStruct mappers
├── repository/      # Spring Data repositories
├── security/        # JWT service, filter, UserPrincipal
├── service/
│   ├── admin/       # AdminService (user CRUD)
│   ├── asset/       # AssetService
│   ├── auth/        # AuthService (login, refresh, logout)
│   ├── event/       # EventService (SSE)
│   ├── job/         # JobService + JobExecutionService
│   ├── storage/     # StorageService (S3 presigned URLs)
│   ├── template/    # TemplateService
│   ├── translation/ # TranslationService (stub)
│   └── tts/         # TtsService (stub)
└── web/
    ├── controller/  # REST controllers
    ├── dto/         # Request/response DTOs
    └── exception/   # GlobalExceptionHandler
```

---

## Extending the Platform

### Wiring real Translation

Replace the stub in `TranslationService.translate()` with an HTTP call to OpenAI's `/v1/chat/completions` or a dedicated translation API (DeepL, Google Translate, etc.).

### Wiring real TTS

Replace `TtsService.generateSpeech()` with a call to ElevenLabs, Azure Cognitive Services TTS, or similar. Update `listVoices()` to query the provider's voice catalog.

### Worker integration

Workers processing jobs should call `JobExecutionService.updateStepStatus()` and `updateExecutionStatus()` as they progress. SSE events are automatically published to any connected frontend subscribers.
