# Creative Video Platform — Python Rendering Worker

## Overview

Renders localized video creatives from a dynamic layer template + source video. Uses Pillow for text layout/measurement and FFmpeg for video composition.

## Stack

- Python 3.11+
- Pillow (text measurement, layer rendering)
- FFmpeg / ffmpeg-python (video composition)
- Pydantic (payload validation)
- boto3 (S3 storage)
- httpx (backend callbacks)
- structlog (structured logging)

## Project Structure

```
worker/
├── config.py           # Environment configuration
├── models.py           # Pydantic models (RenderJob, Layer, TextStyle, etc.)
├── main.py             # Pipeline orchestrator (download → layout → render → upload)
├── text_layout.py      # Text measurement, wrapping, overflow handling
├── storage.py          # S3 download/upload operations
├── subtitle.py         # ASS subtitle generation
├── errors.py           # Custom error types
├── logging_setup.py    # structlog configuration
└── renderer/
    ├── engine.py        # Main render orchestrator
    ├── layer_renderer.py # Render layers to PNG overlays via Pillow
    ├── ffmpeg_builder.py # Build FFmpeg filter complex
    └── asset_manager.py  # Manage temp files and assets
tests/
├── conftest.py
├── test_models.py
├── test_text_layout.py
└── test_ffmpeg_builder.py
```

## Setup

```bash
# Install dependencies
pip install -e ".[dev]"

# Or with pyproject.toml
pip install pydantic boto3 pillow ffmpeg-python httpx structlog pytest

# Ensure FFmpeg is installed
sudo apt install ffmpeg  # Linux
brew install ffmpeg       # macOS
```

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `us-east-1` |
| `INPUT_BUCKET` | S3 bucket for source assets | — |
| `OUTPUT_BUCKET` | S3 bucket for rendered outputs | — |
| `TEMP_DIR` | Local temp directory | `/tmp/render` |
| `BACKEND_CALLBACK_URL` | URL for status callbacks | — |
| `BACKEND_API_KEY` | API key for callbacks | — |
| `FFMPEG_THREADS` | FFmpeg thread count | `0` (auto) |
| `LOG_LEVEL` | Logging level | `INFO` |

## Running

```bash
# Process a single job (for testing)
python -m worker.main --job-file job.json

# In production, the worker polls SQS (see main.py)
python -m worker.main
```

## Testing

```bash
pytest tests/ -v
```

## Rendering Pipeline

1. **Input validation** — Pydantic model validation
2. **Asset download** — Fetch source video + fonts from S3
3. **Text layout** — Compute line wrapping, sizing, overflow handling
4. **Layer rendering** — Generate PNG overlays for each visible layer
5. **FFmpeg composition** — Overlay PNGs onto source video, mix audio
6. **Subtitle burn-in** — Optional ASS subtitle rendering
7. **Output upload** — Upload rendered videos to S3
8. **Status callback** — Notify backend of completion/failure
