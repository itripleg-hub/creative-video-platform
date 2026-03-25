"""Rendering engine — top-level orchestrator for a single render variant.

A "variant" is one (language, aspect_ratio) combination.  The RenderEngine
receives a resolved job (assets already downloaded, text already localised)
and produces a single output video file.

Steps:
  1. Compute text layouts for all text layers
  2. Render each visible layer to a transparent PNG overlay
  3. Generate ASS subtitles if required
  4. Assemble FFmpeg command and execute
  5. Extract thumbnail
  6. Return output paths

The main orchestrator (engine.py's caller) calls this for each variant.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import NamedTuple

import structlog

from worker.errors import RenderError
from worker.models import (
    Layer,
    LayerType,
    OverflowBehavior,
    RenderJob,
    SubtitleSettings,
    TextConstraints,
    get_output_dimensions,
)
from worker.renderer.ffmpeg_builder import FFmpegBuildRequest, FFmpegBuilder, OverlaySpec
from worker.renderer.layer_renderer import LayerRenderer, resolve_pixel_bounds
from worker.storage import StorageClient, TempWorkspace
from worker.subtitle import ASSBuilder, SubtitleEvent, srt_to_ass
from worker.text_layout import compute_layout_with_constraints

log = structlog.get_logger(__name__)


class VariantResult(NamedTuple):
    language_code: str
    aspect_ratio: str
    output_path: Path
    thumbnail_path: Path | None
    duration_ms: int


class RenderEngine:
    """Renders a single (language, aspect_ratio) variant."""

    def __init__(
        self,
        job: RenderJob,
        workspace: TempWorkspace,
        asset_paths: dict[str, Path],
        language_code: str,
        aspect_ratio: str,
    ) -> None:
        self._job = job
        self._workspace = workspace
        self._assets = asset_paths
        self._language = language_code
        self._aspect_ratio = aspect_ratio

        self._w, self._h = get_output_dimensions(aspect_ratio)
        self._layer_renderer = LayerRenderer(self._w, self._h)
        self._ffmpeg_builder = FFmpegBuilder()

    # ── Public ────────────────────────────────────────────────────────────────

    def run(self) -> VariantResult:
        """Execute the full render pipeline for this variant."""
        start = time.monotonic()
        log.info(
            "engine.run",
            language=self._language,
            aspect_ratio=self._aspect_ratio,
            dimensions=f"{self._w}x{self._h}",
        )

        # 1. Render layers to PNG overlays
        overlay_specs = self._render_layers()

        # 2. Generate subtitles
        subtitles_path = self._generate_subtitles()

        # 3. Build and run FFmpeg
        output_path = self._compose_video(overlay_specs, subtitles_path)

        # 4. Thumbnail
        thumbnail_path = self._extract_thumbnail(output_path)

        duration_ms = int((time.monotonic() - start) * 1000)
        log.info(
            "engine.done",
            language=self._language,
            aspect_ratio=self._aspect_ratio,
            output=str(output_path),
            duration_ms=duration_ms,
        )
        return VariantResult(
            language_code=self._language,
            aspect_ratio=self._aspect_ratio,
            output_path=output_path,
            thumbnail_path=thumbnail_path,
            duration_ms=duration_ms,
        )

    # ── Layer rendering ───────────────────────────────────────────────────────

    def _render_layers(self) -> list[OverlaySpec]:
        overlays_dir = self._workspace.subdir(f"overlays/{self._language}/{self._aspect_ratio}")
        overlay_specs: list[OverlaySpec] = []

        for i, layer in enumerate(self._job.visible_layers):
            png_path = overlays_dir / f"layer_{i:03d}_{layer.layer_id}.png"
            asset_key = f"layer:{layer.layer_id}"
            asset_path = self._assets.get(asset_key)

            rendered = self._layer_renderer.render_layer(
                layer=layer,
                aspect_ratio=self._aspect_ratio,
                output_path=png_path,
                image_asset_path=asset_path,
            )

            if rendered is None:
                log.debug("engine.layer_skipped", layer_id=layer.layer_id)
                continue

            # The overlay position is always (0, 0) because each PNG is full-canvas size
            overlay_specs.append(OverlaySpec(
                path=rendered,
                x=0,
                y=0,
                layer_id=layer.layer_id,
            ))

        log.info("engine.layers_rendered", count=len(overlay_specs))
        return overlay_specs

    # ── Subtitles ─────────────────────────────────────────────────────────────

    def _generate_subtitles(self) -> Path | None:
        if not self._job.subtitle_settings.enabled:
            return None

        # If backend pre-generated an ASS file, use it directly
        if self._job.subtitle_settings.ass_s3_key and "subtitles" in self._assets:
            log.info("engine.subtitles_pregenerated")
            return self._assets["subtitles"]

        # Otherwise generate a placeholder ASS (subtitles come from an SRT asset that
        # the backend would normally have included as an asset path)
        ass_path = self._workspace.path(
            f"subtitles/{self._language}/{self._aspect_ratio}.ass"
        )
        builder = ASSBuilder(self._w, self._h, self._job.subtitle_settings)
        builder.write(ass_path)
        return ass_path

    # ── FFmpeg composition ────────────────────────────────────────────────────

    def _compose_video(
        self,
        overlays: list[OverlaySpec],
        subtitles_path: Path | None,
    ) -> Path:
        source = self._assets.get("source_video")
        if not source:
            raise RenderError("source_video asset path missing from asset map")

        audio_path = self._assets.get("audio")
        output_path = self._workspace.path(
            f"output/{self._language}/{self._aspect_ratio}.mp4"
        )

        req = FFmpegBuildRequest(
            source_video=source,
            aspect_ratio=self._aspect_ratio,
            output_path=output_path,
            overlays=overlays,
            audio_path=audio_path,
            subtitles_path=subtitles_path,
            output_width=self._w,
            output_height=self._h,
        )

        self._ffmpeg_builder.run(req)
        return output_path

    # ── Thumbnail ─────────────────────────────────────────────────────────────

    def _extract_thumbnail(self, video_path: Path) -> Path | None:
        thumb_path = self._workspace.path(
            f"thumbnails/{self._language}/{self._aspect_ratio}.jpg"
        )
        try:
            self._ffmpeg_builder.extract_thumbnail(video_path, thumb_path)
            return thumb_path if thumb_path.exists() else None
        except Exception as exc:
            log.warning("engine.thumbnail_failed", error=str(exc))
            return None
