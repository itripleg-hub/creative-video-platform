"""Structured error hierarchy for the rendering worker."""

from __future__ import annotations


class WorkerError(Exception):
    """Base class for all worker errors."""

    #: Whether the operation can be safely retried.
    retriable: bool = False
    #: Short machine-readable error code.
    code: str = "WORKER_ERROR"

    def __init__(self, message: str, *, code: str | None = None, retriable: bool | None = None) -> None:
        super().__init__(message)
        if code is not None:
            self.code = code
        if retriable is not None:
            self.retriable = retriable


# ─── Fatal (non-retriable) errors ────────────────────────────────────────────

class ValidationError(WorkerError):
    """Invalid or incomplete render payload."""
    retriable = False
    code = "VALIDATION_ERROR"


class AssetNotFoundError(WorkerError):
    """A required asset could not be located in storage."""
    retriable = False
    code = "ASSET_NOT_FOUND"


class FontNotFoundError(WorkerError):
    """A requested font file could not be loaded."""
    retriable = False
    code = "FONT_NOT_FOUND"


class RenderError(WorkerError):
    """Generic render-time failure (Pillow/FFmpeg)."""
    retriable = False
    code = "RENDER_ERROR"


class FFmpegError(WorkerError):
    """FFmpeg process returned a non-zero exit code."""
    retriable = False
    code = "FFMPEG_ERROR"

    def __init__(self, message: str, *, stderr: str = "", **kwargs: object) -> None:
        super().__init__(message, **kwargs)  # type: ignore[arg-type]
        self.stderr = stderr


# ─── Retriable errors ─────────────────────────────────────────────────────────

class StorageError(WorkerError):
    """S3 / object-storage I/O failure."""
    retriable = True
    code = "STORAGE_ERROR"


class CallbackError(WorkerError):
    """HTTP callback to backend failed."""
    retriable = True
    code = "CALLBACK_ERROR"


class TransientError(WorkerError):
    """Catch-all retriable failure (network, transient upstream)."""
    retriable = True
    code = "TRANSIENT_ERROR"
