"""FFmpeg filter-complex builder.

Constructs the complete FFmpeg command for:
1. Scaling / cropping the source video to the target aspect ratio
2. Overlaying all rendered layer PNG files
3. Optionally mixing in a TTS audio track
4. Optionally burning in ASS subtitles

We use ffmpeg-python for a fluent, composable API that is easier to test
than raw subprocess string building.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import ffmpeg
import structlog

from worker.config import settings
from worker.errors import FFmpegError
from worker.models import get_output_dimensions

log = structlog.get_logger(__name__)


@dataclass
class OverlaySpec:
    """A rendered PNG overlay to composite onto the video."""
    path: Path
    # Pixel position (top-left) on the output canvas
    x: int
    y: int
    layer_id: str = ""


@dataclass
class FFmpegBuildRequest:
    """Everything the FFmpeg builder needs to construct one render."""
    source_video: Path
    aspect_ratio: str
    output_path: Path

    overlays: list[OverlaySpec] = field(default_factory=list)
    audio_path: Path | None = None
    subtitles_path: Path | None = None

    # If provided, use these exact output dimensions; otherwise derived from aspect_ratio
    output_width: int | None = None
    output_height: int | None = None

    # Encoding settings
    video_codec: str = "libx264"
    audio_codec: str = "aac"
    crf: int = 23
    preset: str = "medium"
    audio_bitrate: str = "192k"
    pixel_format: str = "yuv420p"

    # Extra FFmpeg args (passed through as-is to the output node)
    extra_output_args: dict[str, str] = field(default_factory=dict)

    @property
    def resolved_dimensions(self) -> tuple[int, int]:
        return get_output_dimensions(self.aspect_ratio, self.output_width, self.output_height)


class FFmpegBuilder:
    """Builds and executes an FFmpeg render command."""

    def __init__(self) -> None:
        self._ffmpeg_bin = settings.ffmpeg_binary
        self._threads = settings.ffmpeg_threads

    def build_command(self, req: FFmpegBuildRequest) -> list[str]:
        """Build the complete FFmpeg argument list (not including 'ffmpeg' itself).

        Returns a list of strings that can be passed to subprocess.
        """
        w, h = req.resolved_dimensions
        streams = self._build_filter_graph(req, w, h)
        return streams  # returned as string list

    def run(self, req: FFmpegBuildRequest) -> None:
        """Build and execute the FFmpeg command, raising FFmpegError on failure."""
        w, h = req.resolved_dimensions
        log.info(
            "ffmpeg.run",
            source=str(req.source_video),
            output=str(req.output_path),
            aspect_ratio=req.aspect_ratio,
            dimensions=f"{w}x{h}",
            overlays=len(req.overlays),
            audio=req.audio_path is not None,
            subtitles=req.subtitles_path is not None,
        )

        cmd = self._assemble_ffmpeg_args(req, w, h)
        log.debug("ffmpeg.cmd", cmd=" ".join(str(a) for a in cmd))

        req.output_path.parent.mkdir(parents=True, exist_ok=True)

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            # Log stderr but strip any potentially sensitive tokens from S3 URLs
            safe_stderr = _redact_urls(result.stderr)
            log.error("ffmpeg.failed", returncode=result.returncode, stderr=safe_stderr[-2000:])
            raise FFmpegError(
                f"FFmpeg exited with code {result.returncode}",
                stderr=safe_stderr,
            )

        log.info("ffmpeg.ok", output=str(req.output_path))

    # ── Private: command assembly ─────────────────────────────────────────────

    def _assemble_ffmpeg_args(
        self, req: FFmpegBuildRequest, w: int, h: int
    ) -> list[str]:
        """Produce the complete list of CLI arguments for FFmpeg."""
        args: list[str] = [self._ffmpeg_bin, "-y"]

        # ── Inputs ────────────────────────────────────────────────────────
        args += ["-i", str(req.source_video)]

        # Overlay PNGs (each becomes a separate input)
        for overlay in req.overlays:
            args += ["-i", str(overlay.path)]

        # TTS audio
        audio_input_idx: int | None = None
        if req.audio_path:
            audio_input_idx = 1 + len(req.overlays)
            args += ["-i", str(req.audio_path)]

        # ── Filter complex ────────────────────────────────────────────────
        filter_parts: list[str] = []
        n_overlays = len(req.overlays)

        # Scale/crop source video to target dimensions
        filter_parts.append(
            f"[0:v]scale={w}:{h}:force_original_aspect_ratio=decrease,"
            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1[scaled]"
        )

        # Chain overlay inputs
        current_video_label = "scaled"
        for i, overlay in enumerate(req.overlays):
            input_idx = i + 1  # input 0 is source video
            next_label = f"ov{i}" if i < n_overlays - 1 else "final_v"
            # overlay=x:y, enable PNG alpha (format=yuva420p not needed; ffmpeg handles RGBA PNGs)
            filter_parts.append(
                f"[{current_video_label}][{input_idx}:v]"
                f"overlay={overlay.x}:{overlay.y}:format=auto"
                f"[{next_label}]"
            )
            current_video_label = next_label

        if not req.overlays:
            # No overlays: just rename scaled to final_v
            filter_parts.append(f"[scaled]null[final_v]")

        # Subtitles: burn in using the subtitles filter
        video_out_label = "final_v"
        if req.subtitles_path:
            ass_path_escaped = _escape_ffmpeg_path(str(req.subtitles_path))
            filter_parts.append(
                f"[final_v]subtitles='{ass_path_escaped}':force_style=''"
                f"[subbed_v]"
            )
            video_out_label = "subbed_v"

        filter_complex = ";".join(filter_parts)
        args += ["-filter_complex", filter_complex]

        # Map video output
        args += ["-map", f"[{video_out_label}]"]

        # ── Audio mapping ─────────────────────────────────────────────────
        if audio_input_idx is not None:
            args += ["-map", f"{audio_input_idx}:a"]
            args += ["-c:a", req.audio_codec, "-b:a", req.audio_bitrate]
        else:
            # Keep source audio if present, otherwise no audio
            args += ["-map", "0:a?"]
            args += ["-c:a", "copy"]

        # ── Video encoding ────────────────────────────────────────────────
        args += [
            "-c:v", req.video_codec,
            "-crf", str(req.crf),
            "-preset", req.preset,
            "-pix_fmt", req.pixel_format,
        ]
        if self._threads:
            args += ["-threads", str(self._threads)]

        # Extra output args
        for k, v in req.extra_output_args.items():
            args += [k, v]

        # ── Output ────────────────────────────────────────────────────────
        args.append(str(req.output_path))
        return args

    def _build_filter_graph(self, req: FFmpegBuildRequest, w: int, h: int) -> list[str]:
        """Returns the assembled command args (alias for build_command internals)."""
        return self._assemble_ffmpeg_args(req, w, h)

    # ── Thumbnail extraction ───────────────────────────────────────────────────

    def extract_thumbnail(self, video_path: Path, output_path: Path, at_second: float = 1.0) -> None:
        """Extract a single frame as JPEG thumbnail."""
        cmd = [
            self._ffmpeg_bin, "-y",
            "-ss", str(at_second),
            "-i", str(video_path),
            "-frames:v", "1",
            "-q:v", "2",
            str(output_path),
        ]
        log.debug("ffmpeg.thumbnail", video=str(video_path))
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            log.warning("ffmpeg.thumbnail.failed", stderr=result.stderr[-500:])
            # Non-fatal — thumbnail failure doesn't fail the job


def _escape_ffmpeg_path(path: str) -> str:
    """Escape a filesystem path for use inside an FFmpeg filter string."""
    return path.replace("\\", "\\\\").replace("'", "\\'").replace(":", "\\:")


def _redact_urls(text: str) -> str:
    """Remove query strings from URLs (e.g. presigned S3 URLs) in log output."""
    import re
    return re.sub(r"(https?://[^\s?]+)\?[^\s]*", r"\1?[REDACTED]", text)
