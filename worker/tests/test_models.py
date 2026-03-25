"""Tests for Pydantic model validation (payload contract)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from worker.models import (
    AnchorPoint,
    Layer,
    LayerLayout,
    LayerType,
    OverflowBehavior,
    RenderJob,
    TextConstraints,
    TextStyle,
    get_output_dimensions,
)
from tests.conftest import make_render_job, make_text_layer


# ─── RenderJob ────────────────────────────────────────────────────────────────

class TestRenderJobValidation:
    def test_valid_job_parses(self, minimal_job_payload):
        job = RenderJob.model_validate(minimal_job_payload)
        assert job.execution_id == "exec-001"
        assert job.job_id == "job-001"
        assert len(job.layers) == 2
        assert job.aspect_ratios == ["16:9"]
        assert job.language_codes == ["en"]

    def test_execution_id_required(self):
        payload = make_render_job()
        del payload["executionId"]
        with pytest.raises(ValidationError):
            RenderJob.model_validate(payload)

    def test_empty_aspect_ratios_rejected(self):
        payload = make_render_job(aspectRatios=[])
        with pytest.raises(ValidationError):
            RenderJob.model_validate(payload)

    def test_empty_language_codes_rejected(self):
        payload = make_render_job(languageCodes=[])
        with pytest.raises(ValidationError):
            RenderJob.model_validate(payload)

    def test_visible_layers_sorted_by_z_index(self, minimal_job_payload):
        job = RenderJob.model_validate(minimal_job_payload)
        z_indices = [l.z_index for l in job.visible_layers]
        assert z_indices == sorted(z_indices)

    def test_invisible_layers_excluded_from_visible(self):
        payload = make_render_job()
        payload["layers"][0]["visible"] = False
        job = RenderJob.model_validate(payload)
        assert len(job.visible_layers) == 1

    def test_text_layers_filtered(self, minimal_job_payload):
        job = RenderJob.model_validate(minimal_job_payload)
        text_layers = job.text_layers()
        assert all(l.type == LayerType.TEXT for l in text_layers)

    def test_multi_aspect_ratio_and_language(self, multi_variant_job_payload):
        job = RenderJob.model_validate(multi_variant_job_payload)
        assert len(job.aspect_ratios) == 2
        assert len(job.language_codes) == 2


# ─── Layer ────────────────────────────────────────────────────────────────────

class TestLayerValidation:
    def test_text_layer_parses(self):
        data = make_text_layer()
        layer = Layer.model_validate(data)
        assert layer.type == LayerType.TEXT
        assert layer.layer_id == "hero-title"

    def test_opacity_clamped(self):
        data = make_text_layer()
        data["opacity"] = 1.5
        with pytest.raises(ValidationError):
            Layer.model_validate(data)

    def test_opacity_negative_rejected(self):
        data = make_text_layer()
        data["opacity"] = -0.1
        with pytest.raises(ValidationError):
            Layer.model_validate(data)

    def test_text_style_coerced(self):
        data = make_text_layer()
        layer = Layer.model_validate(data)
        assert isinstance(layer.style, TextStyle)

    def test_get_text_style_ok(self):
        layer = Layer.model_validate(make_text_layer())
        style = layer.get_text_style()
        assert style.font_family == "DejaVu Sans"

    def test_aspect_ratio_layout_override(self):
        data = make_text_layer()
        data["aspectRatioOverrides"] = {
            "9:16": {"x": 0.05, "y": 0.05, "width": 0.9, "height": 0.15}
        }
        layer = Layer.model_validate(data)
        resolved = layer.resolve_layout("9:16")
        assert resolved.x == pytest.approx(0.05)
        assert resolved.width == pytest.approx(0.9)

    def test_no_override_returns_base_layout(self):
        data = make_text_layer(x=0.1, y=0.1)
        layer = Layer.model_validate(data)
        resolved = layer.resolve_layout("16:9")
        assert resolved.x == pytest.approx(0.1)

    def test_unknown_layer_type_rejected(self):
        data = make_text_layer()
        data["type"] = "UNKNOWN_TYPE"
        with pytest.raises(ValidationError):
            Layer.model_validate(data)


# ─── TextStyle ────────────────────────────────────────────────────────────────

class TestTextStyle:
    def test_padding_normalised_scalar(self):
        style = TextStyle.model_validate({"fontFamily": "Arial", "padding": 10})
        assert style.effective_padding() == (10.0, 10.0, 10.0, 10.0)

    def test_padding_normalised_two_values(self):
        style = TextStyle.model_validate({"fontFamily": "Arial", "padding": [8, 16]})
        assert style.effective_padding() == (8.0, 16.0, 8.0, 16.0)

    def test_padding_normalised_four_values(self):
        style = TextStyle.model_validate({"fontFamily": "Arial", "padding": [1, 2, 3, 4]})
        assert style.effective_padding() == (1.0, 2.0, 3.0, 4.0)

    def test_padding_none_gives_zeros(self):
        style = TextStyle.model_validate({"fontFamily": "Arial"})
        assert style.effective_padding() == (0.0, 0.0, 0.0, 0.0)

    def test_shadow_config_parses(self):
        style = TextStyle.model_validate({
            "fontFamily": "Arial",
            "shadow": {"x": 2, "y": 4, "blur": 8, "color": "#00000080"},
        })
        assert style.shadow is not None
        assert style.shadow.blur == 8.0


# ─── TextConstraints ─────────────────────────────────────────────────────────

class TestTextConstraints:
    def test_defaults(self):
        c = TextConstraints.model_validate({})
        assert c.overflow_behavior == OverflowBehavior.WRAP
        assert c.auto_fit is False
        assert c.safe_area is True
        assert c.max_lines is None

    def test_max_lines_must_be_positive(self):
        with pytest.raises(ValidationError):
            TextConstraints.model_validate({"maxLines": 0})


# ─── Dimension helpers ────────────────────────────────────────────────────────

class TestGetOutputDimensions:
    def test_known_16_9(self):
        assert get_output_dimensions("16:9") == (1920, 1080)

    def test_known_9_16(self):
        assert get_output_dimensions("9:16") == (1080, 1920)

    def test_known_1_1(self):
        assert get_output_dimensions("1:1") == (1080, 1080)

    def test_explicit_override(self):
        assert get_output_dimensions("16:9", width=1280, height=720) == (1280, 720)

    def test_free_form_ratio(self):
        w, h = get_output_dimensions("2:1")
        assert w == h * 2

    def test_unknown_ratio_raises(self):
        with pytest.raises(ValueError):
            get_output_dimensions("not-a-ratio")
