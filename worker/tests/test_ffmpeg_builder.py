"""Tests for FFmpeg command generation.

We test command construction without actually running FFmpeg.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from worker.renderer.ffmpeg_builder import (
    FFmpegBuildRequest,
    FFmpegBuilder,
    OverlaySpec,
    _escape_ffmpeg_path,
    _redact_urls,
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def builder() -> FFmpegBuilder:
    return FFmpegBuilder()


@pytest.fixture
def minimal_request(tmp_path: Path) -> FFmpegBuildRequest:
    source = tmp_path / "source.mp4"
    source.touch()
    return FFmpegBuildRequest(
        source_video=source,
        aspect_ratio="16:9",
        output_path=tmp_path / "output.mp4",
    )


@pytest.fixture
def request_with_overlays(tmp_path: Path) -> FFmpegBuildRequest:
    source = tmp_path / "source.mp4"
    source.touch()
    overlay1 = tmp_path / "layer_000.png"
    overlay1.touch()
    overlay2 = tmp_path / "layer_001.png"
    overlay2.touch()
    return FFmpegBuildRequest(
        source_video=source,
        aspect_ratio="9:16",
        output_path=tmp_path / "output.mp4",
        overlays=[
            OverlaySpec(path=overlay1, x=0, y=0, layer_id="hero"),
            OverlaySpec(path=overlay2, x=0, y=0, layer_id="sub"),
        ],
    )


# ─── Command assembly ─────────────────────────────────────────────────────────

class TestFFmpegCommandGeneration:
    def test_contains_source_input(self, builder, minimal_request):
        cmd = builder.build_command(minimal_request)
        assert str(minimal_request.source_video) in cmd

    def test_contains_output_path(self, builder, minimal_request):
        cmd = builder.build_command(minimal_request)
        assert str(minimal_request.output_path) in cmd

    def test_overwrite_flag_present(self, builder, minimal_request):
        cmd = builder.build_command(minimal_request)
        assert "-y" in cmd

    def test_video_codec_present(self, builder, minimal_request):
        cmd = builder.build_command(minimal_request)
        assert "-c:v" in cmd
        idx = cmd.index("-c:v")
        assert cmd[idx + 1] == "libx264"

    def test_pix_fmt_present(self, builder, minimal_request):
        cmd = builder.build_command(minimal_request)
        assert "-pix_fmt" in cmd

    def test_filter_complex_present(self, builder, minimal_request):
        cmd = builder.build_command(minimal_request)
        assert "-filter_complex" in cmd

    def test_scale_filter_in_filter_complex(self, builder, minimal_request):
        cmd = builder.build_command(minimal_request)
        fc_idx = cmd.index("-filter_complex")
        filter_complex = cmd[fc_idx + 1]
        assert "scale=" in filter_complex

    def test_16x9_dimensions(self, builder, minimal_request):
        w, h = minimal_request.resolved_dimensions
        assert w == 1920
        assert h == 1080

    def test_9x16_dimensions(self, builder, request_with_overlays):
        w, h = request_with_overlays.resolved_dimensions
        assert w == 1080
        assert h == 1920

    def test_overlay_inputs_added(self, builder, request_with_overlays):
        cmd = builder.build_command(request_with_overlays)
        # Each overlay PNG should appear as an -i argument
        overlay_paths = [str(o.path) for o in request_with_overlays.overlays]
        for path in overlay_paths:
            assert path in cmd

    def test_overlay_filter_in_filter_complex(self, builder, request_with_overlays):
        cmd = builder.build_command(request_with_overlays)
        fc_idx = cmd.index("-filter_complex")
        filter_complex = cmd[fc_idx + 1]
        assert "overlay=" in filter_complex

    def test_audio_input_added_when_present(self, tmp_path, builder):
        source = tmp_path / "source.mp4"
        source.touch()
        audio = tmp_path / "audio.mp3"
        audio.touch()
        req = FFmpegBuildRequest(
            source_video=source,
            aspect_ratio="16:9",
            output_path=tmp_path / "out.mp4",
            audio_path=audio,
        )
        cmd = builder.build_command(req)
        assert str(audio) in cmd

    def test_subtitle_filter_added_when_present(self, tmp_path, builder):
        source = tmp_path / "source.mp4"
        source.touch()
        subs = tmp_path / "subs.ass"
        subs.touch()
        req = FFmpegBuildRequest(
            source_video=source,
            aspect_ratio="16:9",
            output_path=tmp_path / "out.mp4",
            subtitles_path=subs,
        )
        cmd = builder.build_command(req)
        fc_idx = cmd.index("-filter_complex")
        filter_complex = cmd[fc_idx + 1]
        assert "subtitles=" in filter_complex

    def test_crf_configurable(self, tmp_path, builder):
        source = tmp_path / "source.mp4"
        source.touch()
        req = FFmpegBuildRequest(
            source_video=source,
            aspect_ratio="16:9",
            output_path=tmp_path / "out.mp4",
            crf=18,
        )
        cmd = builder.build_command(req)
        assert "-crf" in cmd
        idx = cmd.index("-crf")
        assert cmd[idx + 1] == "18"

    def test_preset_configurable(self, tmp_path, builder):
        source = tmp_path / "source.mp4"
        source.touch()
        req = FFmpegBuildRequest(
            source_video=source,
            aspect_ratio="16:9",
            output_path=tmp_path / "out.mp4",
            preset="fast",
        )
        cmd = builder.build_command(req)
        assert "fast" in cmd

    def test_extra_output_args_included(self, tmp_path, builder):
        source = tmp_path / "source.mp4"
        source.touch()
        req = FFmpegBuildRequest(
            source_video=source,
            aspect_ratio="16:9",
            output_path=tmp_path / "out.mp4",
            extra_output_args={"-movflags": "+faststart"},
        )
        cmd = builder.build_command(req)
        assert "-movflags" in cmd
        assert "+faststart" in cmd


# ─── Resolved dimensions ─────────────────────────────────────────────────────

class TestResolvedDimensions:
    def test_1_1_square(self, tmp_path):
        req = FFmpegBuildRequest(
            source_video=tmp_path / "s.mp4",
            aspect_ratio="1:1",
            output_path=tmp_path / "out.mp4",
        )
        assert req.resolved_dimensions == (1080, 1080)

    def test_explicit_override(self, tmp_path):
        req = FFmpegBuildRequest(
            source_video=tmp_path / "s.mp4",
            aspect_ratio="16:9",
            output_path=tmp_path / "out.mp4",
            output_width=1280,
            output_height=720,
        )
        assert req.resolved_dimensions == (1280, 720)


# ─── Utility functions ────────────────────────────────────────────────────────

class TestUtilities:
    def test_escape_colon_in_path(self):
        result = _escape_ffmpeg_path("/path/to:file.ass")
        assert "\\:" in result

    def test_escape_single_quote_in_path(self):
        result = _escape_ffmpeg_path("/path/to/my's/file.ass")
        assert "\\'" in result

    def test_redact_urls_removes_query_string(self):
        input_text = "Error at https://example.com/file.mp4?X-Amz-Signature=abc123&X-Amz-Expires=3600"
        result = _redact_urls(input_text)
        assert "abc123" not in result
        assert "[REDACTED]" in result
        assert "https://example.com/file.mp4" in result

    def test_redact_non_url_unchanged(self):
        text = "Normal log line without URLs"
        assert _redact_urls(text) == text
