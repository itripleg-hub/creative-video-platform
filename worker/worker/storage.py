"""S3-compatible storage integration.

Download source assets and upload rendered outputs.
All paths are S3 keys relative to the configured buckets.
"""

from __future__ import annotations

import os
import shutil
import time
from pathlib import Path
from typing import BinaryIO

import boto3
import structlog
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from worker.config import settings
from worker.errors import AssetNotFoundError, StorageError

log = structlog.get_logger(__name__)

_DOWNLOAD_RETRIES = 3
_UPLOAD_RETRIES = 3
_RETRY_BACKOFF_S = 2.0


def _get_client() -> "boto3.client":  # type: ignore[name-defined]
    kwargs: dict[str, object] = {
        "region_name": settings.s3_region,
        "config": Config(retries={"max_attempts": 3, "mode": "adaptive"}),
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client("s3", **kwargs)


class StorageClient:
    """Thin wrapper around boto3 S3 client for the worker."""

    def __init__(self) -> None:
        self._client = _get_client()

    # ── Downloads ─────────────────────────────────────────────────────────────

    def download_file(
        self,
        bucket: str,
        key: str,
        local_path: Path,
        *,
        allow_missing: bool = False,
    ) -> bool:
        """Download an S3 object to a local file.

        Returns True on success, False if allow_missing=True and object does not exist.
        Raises StorageError on transient errors, AssetNotFoundError on 404 (unless allow_missing).
        """
        local_path.parent.mkdir(parents=True, exist_ok=True)
        log.info("storage.download", bucket=bucket, key=key, dest=str(local_path))

        for attempt in range(1, _DOWNLOAD_RETRIES + 1):
            try:
                self._client.download_file(bucket, key, str(local_path))
                log.debug("storage.download.ok", bucket=bucket, key=key, attempt=attempt)
                return True
            except ClientError as exc:
                code = exc.response.get("Error", {}).get("Code", "")
                if code in ("404", "NoSuchKey"):
                    if allow_missing:
                        return False
                    raise AssetNotFoundError(
                        f"Asset not found: s3://{bucket}/{key}"
                    ) from exc
                log.warning(
                    "storage.download.retry",
                    bucket=bucket,
                    key=key,
                    attempt=attempt,
                    error=str(exc),
                )
                if attempt == _DOWNLOAD_RETRIES:
                    raise StorageError(
                        f"Failed to download s3://{bucket}/{key} after {_DOWNLOAD_RETRIES} attempts: {exc}"
                    ) from exc
            except BotoCoreError as exc:
                if attempt == _DOWNLOAD_RETRIES:
                    raise StorageError(str(exc)) from exc
            time.sleep(_RETRY_BACKOFF_S * attempt)

        return False  # unreachable

    def download_to_memory(self, bucket: str, key: str) -> bytes:
        """Download an S3 object directly into memory."""
        log.debug("storage.download_memory", bucket=bucket, key=key)
        try:
            response = self._client.get_object(Bucket=bucket, Key=key)
            return response["Body"].read()
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("404", "NoSuchKey"):
                raise AssetNotFoundError(f"Asset not found: s3://{bucket}/{key}") from exc
            raise StorageError(str(exc)) from exc

    # ── Uploads ───────────────────────────────────────────────────────────────

    def upload_file(
        self,
        local_path: Path,
        bucket: str,
        key: str,
        *,
        content_type: str | None = None,
        extra_args: dict[str, str] | None = None,
    ) -> str:
        """Upload a local file to S3.  Returns the S3 URI."""
        if not local_path.exists():
            raise StorageError(f"Local file not found for upload: {local_path}")

        args: dict[str, str] = {}
        if content_type:
            args["ContentType"] = content_type
        if extra_args:
            args.update(extra_args)

        log.info("storage.upload", local=str(local_path), bucket=bucket, key=key)
        for attempt in range(1, _UPLOAD_RETRIES + 1):
            try:
                self._client.upload_file(
                    str(local_path),
                    bucket,
                    key,
                    ExtraArgs=args if args else None,
                )
                log.info("storage.upload.ok", bucket=bucket, key=key, attempt=attempt)
                return f"s3://{bucket}/{key}"
            except (ClientError, BotoCoreError) as exc:
                log.warning(
                    "storage.upload.retry",
                    bucket=bucket,
                    key=key,
                    attempt=attempt,
                    error=str(exc),
                )
                if attempt == _UPLOAD_RETRIES:
                    raise StorageError(
                        f"Failed to upload to s3://{bucket}/{key}: {exc}"
                    ) from exc
            time.sleep(_RETRY_BACKOFF_S * attempt)

        return ""  # unreachable

    def upload_bytes(
        self,
        data: bytes,
        bucket: str,
        key: str,
        *,
        content_type: str | None = None,
    ) -> str:
        """Upload bytes directly to S3."""
        log.debug("storage.upload_bytes", bucket=bucket, key=key, size=len(data))
        try:
            kwargs: dict[str, object] = {"Body": data, "Bucket": bucket, "Key": key}
            if content_type:
                kwargs["ContentType"] = content_type
            self._client.put_object(**kwargs)
            return f"s3://{bucket}/{key}"
        except (ClientError, BotoCoreError) as exc:
            raise StorageError(str(exc)) from exc

    def object_exists(self, bucket: str, key: str) -> bool:
        """Check whether an S3 object exists."""
        try:
            self._client.head_object(Bucket=bucket, Key=key)
            return True
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in ("404", "NoSuchKey"):
                return False
            raise StorageError(str(exc)) from exc

    def generate_presigned_url(self, bucket: str, key: str, expires_in: int = 3600) -> str:
        """Generate a presigned download URL."""
        try:
            return self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=expires_in,
            )
        except ClientError as exc:
            raise StorageError(str(exc)) from exc


# ─── Temp directory management ────────────────────────────────────────────────

class TempWorkspace:
    """Manages a temporary working directory for a single job execution."""

    def __init__(self, execution_id: str) -> None:
        self.execution_id = execution_id
        self.root = Path(settings.temp_dir) / execution_id
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, *parts: str) -> Path:
        """Return a path inside the workspace, creating parent dirs."""
        p = self.root.joinpath(*parts)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    def subdir(self, name: str) -> Path:
        """Create and return a named subdirectory."""
        d = self.root / name
        d.mkdir(parents=True, exist_ok=True)
        return d

    def cleanup(self) -> None:
        """Remove the entire workspace."""
        try:
            shutil.rmtree(self.root, ignore_errors=True)
            log.debug("workspace.cleanup", execution_id=self.execution_id)
        except OSError as exc:
            log.warning("workspace.cleanup.failed", execution_id=self.execution_id, error=str(exc))

    def __enter__(self) -> "TempWorkspace":
        return self

    def __exit__(self, *_: object) -> None:
        self.cleanup()
