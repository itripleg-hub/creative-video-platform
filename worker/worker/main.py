"""Main orchestration entry point.

Renders a complete RenderJob: all (language, aspect_ratio) variant combinations.

Pipeline stages per job:
  VALIDATION       — parse and validate the payload
  ASSET_DOWNLOAD   — download source video + assets from S3
  LAYER_RENDER     — render each layer to a PNG overlay (per variant)
  FFMPEG_COMPOSE   — composite overlays + audio + subtitles (per variant)
  OUTPUT_UPLOAD    — upload rendered outputs to S3
  CLEANUP          — remove temp files
  STATUS_REPORT    — HTTP callback to backend

Usage:
  # From CLI (pyproject.toml scripts entry):
  worker '{"executionId": "...", ...}'

  # Or as a module:
  from worker.main import run_job
  run_job(payload_dict)
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any

import httpx
import structlog
import structlog.contextvars

from worker.config import settings
from worker.errors import ValidationError, WorkerError
from worker.logging_setup import configure_logging
from worker.models import (
    RenderJob,
    RenderResult,
    RenderStep,
    StepStatus,
    StepUpdate,
    WorkerCallback,
)
from worker.renderer.asset_manager import AssetManager
from worker.renderer.engine import RenderEngine, VariantResult
from worker.storage import StorageClient, TempWorkspace

log = structlog.get_logger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Step tracking
# ─────────────────────────────────────────────────────────────────────────────

class StepTracker:
    """Accumulates step updates during a job run."""

    def __init__(self, execution_id: str) -> None:
        self.execution_id = execution_id
        self._steps: list[StepUpdate] = []

    def record(
        self,
        step: RenderStep,
        status: StepStatus,
        *,
        message: str | None = None,
        details: dict[str, Any] | None = None,
        duration_ms: int | None = None,
    ) -> None:
        update = StepUpdate(
            executionId=self.execution_id,
            step=step,
            status=status,
            message=message,
            details=details or {},
            durationMs=duration_ms,
        )
        self._steps.append(update)
        log.info(
            "step",
            step=step.value,
            status=status.value,
            message=message,
            duration_ms=duration_ms,
        )

    def steps(self) -> list[StepUpdate]:
        return list(self._steps)


# ─────────────────────────────────────────────────────────────────────────────
# Core pipeline
# ─────────────────────────────────────────────────────────────────────────────

def run_job(payload: dict[str, Any]) -> WorkerCallback:
    """Execute the complete render pipeline for one job.

    Returns a WorkerCallback (success or failure) that is also POSTed to the
    callback URL if configured.
    """
    execution_id = payload.get("executionId", "unknown")

    # Bind execution_id to all log records for this job
    structlog.contextvars.bind_contextvars(execution_id=execution_id)

    log.info("job.start", execution_id=execution_id)

    tracker = StepTracker(execution_id)
    storage = StorageClient()
    workspace = TempWorkspace(execution_id)

    results: list[RenderResult] = []
    error_code: str | None = None
    error_message: str | None = None
    retriable = False

    try:
        # ── VALIDATION ────────────────────────────────────────────────────
        t0 = time.monotonic()
        tracker.record(RenderStep.VALIDATION, StepStatus.RUNNING)
        try:
            job = RenderJob.model_validate(payload)
        except Exception as exc:
            raise ValidationError(f"Payload validation failed: {exc}") from exc
        tracker.record(
            RenderStep.VALIDATION, StepStatus.COMPLETED,
            duration_ms=int((time.monotonic() - t0) * 1000),
        )

        # ── ASSET DOWNLOAD ────────────────────────────────────────────────
        t0 = time.monotonic()
        tracker.record(RenderStep.ASSET_DOWNLOAD, StepStatus.RUNNING)
        asset_manager = AssetManager(storage, workspace)
        asset_paths = asset_manager.download_all_assets(job)
        tracker.record(
            RenderStep.ASSET_DOWNLOAD, StepStatus.COMPLETED,
            details={"asset_count": len(asset_paths)},
            duration_ms=int((time.monotonic() - t0) * 1000),
        )

        # ── PER-VARIANT RENDERING ─────────────────────────────────────────
        for language in job.language_codes:
            for aspect_ratio in job.aspect_ratios:
                variant_results = _render_variant(
                    job=job,
                    workspace=workspace,
                    asset_paths=asset_paths,
                    language_code=language,
                    aspect_ratio=aspect_ratio,
                    storage=storage,
                    tracker=tracker,
                )
                results.extend(variant_results)

    except WorkerError as exc:
        error_code = exc.code
        error_message = str(exc)
        retriable = exc.retriable
        log.error(
            "job.failed",
            code=exc.code,
            retriable=exc.retriable,
            error=error_message,
            exc_info=True,
        )
        tracker.record(
            RenderStep.CLEANUP, StepStatus.RUNNING
        )
        workspace.cleanup()
        tracker.record(RenderStep.CLEANUP, StepStatus.COMPLETED)

    except Exception as exc:
        error_code = "UNEXPECTED_ERROR"
        error_message = str(exc)
        retriable = False
        log.error("job.unexpected_error", error=error_message, exc_info=True)
        workspace.cleanup()

    else:
        # ── CLEANUP (success path) ────────────────────────────────────────
        tracker.record(RenderStep.CLEANUP, StepStatus.RUNNING)
        workspace.cleanup()
        tracker.record(RenderStep.CLEANUP, StepStatus.COMPLETED)

    success = error_code is None
    callback = WorkerCallback(
        executionId=execution_id,
        jobId=job.job_id if "job" in dir() else payload.get("jobId", ""),  # type: ignore[possibly-undefined]
        success=success,
        results=results,
        errorCode=error_code,
        errorMessage=error_message,
        retriable=retriable,
        steps=tracker.steps(),
    )

    # ── STATUS REPORT ──────────────────────────────────────────────────────
    callback_url = (
        payload.get("callbackUrl")
        or settings.callback_url
    )
    if callback_url:
        _send_callback(callback, callback_url)

    log.info("job.complete", success=success, results=len(results))
    structlog.contextvars.clear_contextvars()
    return callback


def _render_variant(
    job: RenderJob,
    workspace: TempWorkspace,
    asset_paths: dict[str, Path],
    language_code: str,
    aspect_ratio: str,
    storage: StorageClient,
    tracker: StepTracker,
) -> list[RenderResult]:
    """Render a single (language, aspect_ratio) variant and upload the output."""
    results: list[RenderResult] = []

    log.info(
        "variant.start",
        language=language_code,
        aspect_ratio=aspect_ratio,
    )

    # ── LAYER RENDER ──────────────────────────────────────────────────────
    t0 = time.monotonic()
    tracker.record(
        RenderStep.LAYER_RENDER, StepStatus.RUNNING,
        message=f"Rendering layers for {language_code}/{aspect_ratio}",
    )
    engine = RenderEngine(
        job=job,
        workspace=workspace,
        asset_paths=asset_paths,
        language_code=language_code,
        aspect_ratio=aspect_ratio,
    )

    try:
        variant: VariantResult = engine.run()
    except WorkerError:
        tracker.record(
            RenderStep.LAYER_RENDER, StepStatus.FAILED,
            duration_ms=int((time.monotonic() - t0) * 1000),
        )
        raise

    tracker.record(
        RenderStep.FFMPEG_COMPOSE, StepStatus.COMPLETED,
        duration_ms=int((time.monotonic() - t0) * 1000),
        details={"language": language_code, "aspect_ratio": aspect_ratio},
    )

    # ── OUTPUT UPLOAD ─────────────────────────────────────────────────────
    t0 = time.monotonic()
    tracker.record(RenderStep.OUTPUT_UPLOAD, StepStatus.RUNNING)

    prefix = job.output_s3_prefix.rstrip("/")
    video_key = f"{prefix}/{job.execution_id}/{language_code}/{aspect_ratio}.mp4"
    thumb_key: str | None = None

    storage.upload_file(
        variant.output_path,
        settings.output_bucket,
        video_key,
        content_type="video/mp4",
    )

    if variant.thumbnail_path and variant.thumbnail_path.exists():
        thumb_key = f"{prefix}/{job.execution_id}/{language_code}/{aspect_ratio}_thumb.jpg"
        storage.upload_file(
            variant.thumbnail_path,
            settings.output_bucket,
            thumb_key,
            content_type="image/jpeg",
        )

    tracker.record(
        RenderStep.OUTPUT_UPLOAD, StepStatus.COMPLETED,
        duration_ms=int((time.monotonic() - t0) * 1000),
        details={"s3_key": video_key},
    )

    from worker.models import get_output_dimensions
    out_w, out_h = get_output_dimensions(aspect_ratio)
    results.append(RenderResult(
        languageCode=language_code,
        aspectRatio=aspect_ratio,
        outputS3Key=video_key,
        thumbnailS3Key=thumb_key,
        durationMs=variant.duration_ms,
        width=out_w,
        height=out_h,
    ))

    return results


def _send_callback(callback: WorkerCallback, url: str) -> None:
    """POST the WorkerCallback payload to the backend callback URL."""
    log.info("callback.sending", url=url, success=callback.success)
    try:
        resp = httpx.post(
            url,
            json=callback.model_dump(by_alias=True),
            timeout=settings.callback_timeout_s,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        log.info("callback.ok", status=resp.status_code)
    except httpx.HTTPStatusError as exc:
        log.error("callback.http_error", status=exc.response.status_code, url=url)
    except httpx.RequestError as exc:
        log.error("callback.request_error", error=str(exc), url=url)


# ─────────────────────────────────────────────────────────────────────────────
# CLI entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    """CLI entry point.  Reads JSON payload from argv[1] or stdin."""
    configure_logging(settings.log_level, settings.log_format)

    if len(sys.argv) > 1:
        raw = sys.argv[1]
    else:
        raw = sys.stdin.read()

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        log.error("cli.invalid_json", error=str(exc))
        sys.exit(1)

    result = run_job(payload)
    print(result.model_dump_json(indent=2, by_alias=True))
    sys.exit(0 if result.success else 1)


if __name__ == "__main__":
    main()
