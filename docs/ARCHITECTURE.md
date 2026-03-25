# Architecture Decisions

## Canvas Editor: react-konva (Konva.js)
- Native React component bindings
- Built-in Transformer for drag/resize/rotate handles
- Event system with bubbling, click/tap, drag-and-drop
- Serialization to/from JSON (maps cleanly to our layer model)
- Good performance for 10-50 layer compositions

## Backend: Spring Boot 3.x + SseEmitter
- SseEmitter for real-time job progress (unidirectional, perfect for monitoring)
- Spring Security with JWT filter chain
- Spring Data JPA + PostgreSQL with JSON columns for dynamic layer data
- Liquibase for schema migrations
- Async job dispatch via internal queue (can swap to SQS later)

## Rendering: Pillow + FFmpeg
- Pillow for text measurement, line wrapping, font metrics (shared layout logic with frontend)
- FFmpeg for final video composition via overlay filter complex
- Approach: render text layers as PNG images with Pillow → overlay onto video with FFmpeg
- ASS subtitles for styled subtitle rendering
- ffmpeg-python library for fluent pipeline construction

## Coordinate System
- Normalized coordinates (0.0-1.0 relative to canvas)
- Both frontend and worker resolve to pixel coords at render time
- Anchor points for alignment semantics

## Storage
- S3-compatible object storage
- Presigned URLs for upload/download (no proxy through backend)
- Separate buckets: input assets, output renders, temp working

## Infrastructure
- Terragrunt wrapping Terraform modules
- ECS/Fargate for worker tasks
- SQS for job dispatch
- Environment separation: dev/staging/prod
