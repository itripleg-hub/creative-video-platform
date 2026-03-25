"""Shared test fixtures."""

from __future__ import annotations

import pytest
from pydantic import ValidationError as PydanticValidationError

from worker.models import (
    Layer,
    LayerContent,
    LayerLayout,
    LayerType,
    OverflowBehavior,
    RenderJob,
    SubtitleSettings,
    TextConstraints,
    TextStyle,
    VoiceSettings,
)


# ─── Payload factory helpers ──────────────────────────────────────────────────

def make_text_layer(
    layer_id: str = "hero-title",
    text: str = "Hello World",
    x: float = 0.1,
    y: float = 0.1,
    width: float = 0.8,
    height: float = 0.2,
    z_index: int = 10,
    **style_overrides: object,
) -> dict:
    style = {
        "fontFamily": "DejaVu Sans",
        "fontSize": 64,
        "fontWeight": 700,
        "lineHeight": 1.2,
        "letterSpacing": 0,
        "textAlign": "center",
        "verticalAlign": "middle",
        "textColor": "#FFFFFF",
        **style_overrides,
    }
    return {
        "layerId": layer_id,
        "type": "TEXT",
        "name": layer_id,
        "editable": True,
        "translatable": True,
        "visible": True,
        "locked": False,
        "zIndex": z_index,
        "opacity": 1.0,
        "layout": {
            "x": x, "y": y,
            "width": width, "height": height,
            "rotation": 0.0,
            "anchorPoint": "TOP_LEFT",
        },
        "style": style,
        "content": {"text": text},
        "constraints": {
            "maxLines": 3,
            "overflowBehavior": "WRAP",
            "autoFit": False,
            "safeArea": True,
        },
    }


def make_render_job(**overrides: object) -> dict:
    job = {
        "executionId": "exec-001",
        "jobId": "job-001",
        "sourceVideoS3Key": "inputs/test-video.mp4",
        "templateId": "tmpl-001",
        "templateVersion": 1,
        "layers": [
            make_text_layer("hero-title", "Main Headline"),
            make_text_layer("subtitle", "A subtitle line", y=0.35, height=0.12, z_index=9),
        ],
        "aspectRatios": ["16:9"],
        "languageCodes": ["en"],
        "voiceSettings": {"enabled": False},
        "subtitleSettings": {"enabled": False},
        "outputS3Prefix": "outputs",
    }
    job.update(overrides)
    return job


@pytest.fixture
def minimal_job_payload() -> dict:
    return make_render_job()


@pytest.fixture
def multi_variant_job_payload() -> dict:
    return make_render_job(
        aspectRatios=["16:9", "9:16"],
        languageCodes=["en", "de"],
    )
