"""Worker configuration via environment variables."""

from __future__ import annotations

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerConfig(BaseSettings):
    """All runtime configuration for the rendering worker.

    Values are loaded from environment variables (case-insensitive).
    Prefix: WORKER_
    """

    model_config = SettingsConfigDict(
        env_prefix="WORKER_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Storage ──────────────────────────────────────────────────────────────
    s3_endpoint_url: str | None = Field(default=None, description="Override S3 endpoint (localstack, minio)")
    s3_region: str = Field(default="us-east-1")
    input_bucket: str = Field(default="creative-inputs")
    output_bucket: str = Field(default="creative-outputs")
    temp_bucket: str | None = Field(default=None, description="Optional scratch bucket; uses /tmp if unset")

    # ── Rendering ─────────────────────────────────────────────────────────────
    ffmpeg_binary: str = Field(default="ffmpeg")
    ffprobe_binary: str = Field(default="ffprobe")
    ffmpeg_threads: int = Field(default=0, description="0 = auto")
    reference_width: int = Field(default=1920, description="Reference resolution width for font scaling")
    reference_height: int = Field(default=1080, description="Reference resolution height for font scaling")
    fonts_dir: str = Field(default="/usr/share/fonts", description="System fonts directory")

    # ── Temp / scratch ────────────────────────────────────────────────────────
    temp_dir: str = Field(default="/tmp/worker", description="Local temp directory for intermediate files")

    # ── Callbacks ─────────────────────────────────────────────────────────────
    callback_url: str | None = Field(default=None, description="HTTP endpoint to POST completion/failure status")
    callback_timeout_s: float = Field(default=30.0)

    # ── Logging ──────────────────────────────────────────────────────────────
    log_level: str = Field(default="INFO")
    log_format: str = Field(default="json", description="'json' or 'console'")

    # ── Input source ─────────────────────────────────────────────────────────
    # When running as a daemon, the worker polls this queue.
    sqs_queue_url: str | None = Field(default=None)
    sqs_poll_wait_s: int = Field(default=20, description="Long-poll wait time in seconds")
    sqs_visibility_timeout_s: int = Field(default=300)

    @field_validator("log_level")
    @classmethod
    def _upper_log_level(cls, v: str) -> str:
        return v.upper()

    @field_validator("log_format")
    @classmethod
    def _valid_log_format(cls, v: str) -> str:
        if v not in ("json", "console"):
            raise ValueError("log_format must be 'json' or 'console'")
        return v


# Module-level singleton — initialised once on import.
settings = WorkerConfig()
