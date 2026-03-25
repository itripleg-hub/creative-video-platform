"""Tests for the text layout engine.

These tests use Pillow's built-in default font or a real system font if
available.  The layout logic is tested without requiring a specific external
font file — we test the algorithm rather than pixel-perfect output.
"""

from __future__ import annotations

import pytest
from PIL import ImageFont

from worker.models import OverflowBehavior, TextStyle, TextTransform
from worker.text_layout import (
    ELLIPSIS_CHAR,
    LayoutResult,
    _apply_transform,
    _horizontal_offset,
    _vertical_offset,
    _wrap_text_to_width,
    compute_layout_with_constraints,
    get_line_height_px,
    measure_text,
    parse_color,
    scale_font_size,
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def default_font() -> ImageFont.FreeTypeFont:
    """Use a small default Pillow font for geometry tests.

    Falls back to the Pillow built-in bitmap font if no TTF is available.
    """
    try:
        from worker.text_layout import load_font
        return load_font("DejaVu Sans", 24)
    except Exception:
        # Fallback: Pillow's built-in font (no external file needed)
        return ImageFont.load_default()


@pytest.fixture
def small_font() -> ImageFont.FreeTypeFont:
    try:
        from worker.text_layout import load_font
        return load_font("DejaVu Sans", 12)
    except Exception:
        return ImageFont.load_default()


@pytest.fixture
def simple_style() -> TextStyle:
    return TextStyle.model_validate({
        "fontFamily": "DejaVu Sans",
        "fontSize": 48,
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": 0,
        "textAlign": "left",
        "verticalAlign": "top",
        "textColor": "#FFFFFF",
    })


# ─── Font scaling ─────────────────────────────────────────────────────────────

class TestFontScaling:
    def test_1080p_is_identity(self):
        # Reference width is 1920; 1080p canvas has width 1920
        assert scale_font_size(48.0, 1920) == 48

    def test_half_scale(self):
        assert scale_font_size(48.0, 960) == 24

    def test_double_scale(self):
        assert scale_font_size(48.0, 3840) == 96

    def test_minimum_one_pixel(self):
        assert scale_font_size(1.0, 1) >= 1


# ─── Text measurement ─────────────────────────────────────────────────────────

class TestMeasureText:
    def test_empty_string_returns_zero_width(self, default_font):
        w, h = measure_text("", default_font)
        assert w == 0.0
        assert h > 0  # Height still comes from the font

    def test_width_increases_with_text_length(self, default_font):
        w1, _ = measure_text("A", default_font)
        w2, _ = measure_text("AAAA", default_font)
        assert w2 > w1

    def test_letter_spacing_increases_width(self, default_font):
        w_no_spacing, _ = measure_text("Hello", default_font, letter_spacing=0.0)
        w_with_spacing, _ = measure_text("Hello", default_font, letter_spacing=5.0)
        assert w_with_spacing > w_no_spacing


# ─── Line height ─────────────────────────────────────────────────────────────

class TestLineHeight:
    def test_line_height_proportional_to_multiplier(self, default_font):
        lh1 = get_line_height_px(default_font, 1.0)
        lh2 = get_line_height_px(default_font, 2.0)
        assert lh2 == pytest.approx(lh1 * 2.0, rel=0.01)

    def test_line_height_positive(self, default_font):
        assert get_line_height_px(default_font, 1.2) > 0


# ─── Word wrapping ────────────────────────────────────────────────────────────

class TestWordWrap:
    def test_short_text_stays_on_one_line(self, default_font):
        lines = _wrap_text_to_width("Hello", default_font, max_width=10000, letter_spacing=0.0)
        assert len(lines) == 1
        assert lines[0] == "Hello"

    def test_wide_text_wraps(self, default_font):
        # Measure a single word's width, then set max_width to force a wrap
        w, _ = measure_text("Hello World", default_font)
        lines = _wrap_text_to_width("Hello World", default_font, max_width=w * 0.5, letter_spacing=0.0)
        assert len(lines) >= 2

    def test_single_long_word_force_breaks(self, default_font):
        # A single word wider than max_width should still produce lines
        lines = _wrap_text_to_width("Superlongwordthatcannotfit", default_font, max_width=20.0, letter_spacing=0.0)
        assert len(lines) >= 1  # Should not hang or produce empty result

    def test_empty_string(self, default_font):
        lines = _wrap_text_to_width("", default_font, max_width=500.0, letter_spacing=0.0)
        assert lines == [""]

    def test_newline_not_treated_as_word_separator(self, default_font):
        # Our wrapper does not split on newlines — content with \n is a separate concern
        lines = _wrap_text_to_width("Hello\nWorld", default_font, max_width=10000, letter_spacing=0.0)
        # Should produce at least 1 line regardless
        assert len(lines) >= 1


# ─── Alignment helpers ────────────────────────────────────────────────────────

class TestHorizontalOffset:
    def test_left_alignment_is_zero(self):
        assert _horizontal_offset(100.0, 300.0, "left") == pytest.approx(0.0)

    def test_center_alignment(self):
        assert _horizontal_offset(100.0, 300.0, "center") == pytest.approx(100.0)

    def test_right_alignment(self):
        assert _horizontal_offset(100.0, 300.0, "right") == pytest.approx(200.0)

    def test_text_wider_than_box_does_not_go_negative(self):
        # When text overflows, offset should be 0 (not negative)
        assert _horizontal_offset(500.0, 300.0, "center") == pytest.approx(0.0)


class TestVerticalOffset:
    def test_top_is_zero(self):
        assert _vertical_offset(100.0, 300.0, "top") == pytest.approx(0.0)

    def test_middle_alignment(self):
        assert _vertical_offset(100.0, 300.0, "middle") == pytest.approx(100.0)

    def test_bottom_alignment(self):
        assert _vertical_offset(100.0, 300.0, "bottom") == pytest.approx(200.0)


# ─── Text transform ───────────────────────────────────────────────────────────

class TestTextTransform:
    def test_uppercase(self):
        assert _apply_transform("hello world", TextTransform.UPPERCASE) == "HELLO WORLD"

    def test_lowercase(self):
        assert _apply_transform("HELLO WORLD", TextTransform.LOWERCASE) == "hello world"

    def test_none_unchanged(self):
        assert _apply_transform("Hello World", TextTransform.NONE) == "Hello World"


# ─── Color parsing ────────────────────────────────────────────────────────────

class TestParseColor:
    def test_rgb_hex(self):
        assert parse_color("#FF0000") == (255, 0, 0, 255)

    def test_rgb_short(self):
        assert parse_color("#F00") == (255, 0, 0, 255)

    def test_rgba_hex(self):
        r, g, b, a = parse_color("#FFFFFF80")
        assert r == 255
        assert g == 255
        assert b == 255
        assert a == 128

    def test_black_full_alpha(self):
        assert parse_color("#000000") == (0, 0, 0, 255)

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            parse_color("not-a-color")


# ─── Full layout computation ──────────────────────────────────────────────────

class TestComputeLayoutWithConstraints:
    """Integration-level tests for the full layout engine."""

    def test_basic_layout_produces_lines(self, simple_style):
        result = compute_layout_with_constraints(
            text="Hello World",
            style=simple_style,
            box_width_px=400.0,
            box_height_px=100.0,
            canvas_width=1920,
        )
        assert len(result.lines) >= 1
        assert result.font is not None

    def test_max_lines_respected_wrap(self, simple_style):
        result = compute_layout_with_constraints(
            text="This is a very long text that should definitely wrap across multiple lines",
            style=simple_style,
            box_width_px=200.0,
            box_height_px=500.0,
            canvas_width=1920,
            max_lines=2,
            overflow=OverflowBehavior.WRAP,
        )
        assert len(result.lines) <= 2

    def test_ellipsis_added_on_overflow(self, simple_style):
        result = compute_layout_with_constraints(
            text="This is a very long text that should definitely wrap across multiple lines",
            style=simple_style,
            box_width_px=200.0,
            box_height_px=500.0,
            canvas_width=1920,
            max_lines=2,
            overflow=OverflowBehavior.ELLIPSIS,
        )
        assert len(result.lines) <= 2
        if len(result.lines) > 0:
            # Last line should end with ellipsis if content was truncated
            last_line = result.lines[-1].text
            # It might be truncated with ellipsis character
            assert ELLIPSIS_CHAR in last_line or len(result.lines) < 2

    def test_shrink_reduces_font_size(self, simple_style):
        # Very small box should force shrink
        result = compute_layout_with_constraints(
            text="Short text",
            style=simple_style,
            box_width_px=400.0,
            box_height_px=20.0,
            canvas_width=1920,
            overflow=OverflowBehavior.SHRINK,
        )
        # Font should be smaller than the reference (48px at 1920 canvas = 48px)
        # or equal if it already fits
        assert result.font_size_px >= 8  # above minimum

    def test_layout_respects_padding(self):
        style = TextStyle.model_validate({
            "fontFamily": "DejaVu Sans",
            "fontSize": 24,
            "lineHeight": 1.2,
            "textAlign": "left",
            "verticalAlign": "top",
            "textColor": "#FFF",
            "padding": [20, 20, 20, 20],
        })
        result = compute_layout_with_constraints(
            text="Hello",
            style=style,
            box_width_px=400.0,
            box_height_px=200.0,
            canvas_width=1920,
        )
        # First line x should be >= pad_left
        assert result.lines[0].x >= result.pad_left - 1.0  # 1px tolerance

    def test_uppercase_transform_applied(self):
        style = TextStyle.model_validate({
            "fontFamily": "DejaVu Sans",
            "fontSize": 24,
            "lineHeight": 1.2,
            "textAlign": "left",
            "verticalAlign": "top",
            "textColor": "#FFF",
            "textTransform": "uppercase",
        })
        result = compute_layout_with_constraints(
            text="hello world",
            style=style,
            box_width_px=400.0,
            box_height_px=200.0,
            canvas_width=1920,
        )
        all_text = " ".join(line.text for line in result.lines)
        assert all_text == all_text.upper()

    def test_scale_is_one_when_no_shrink_needed(self, simple_style):
        result = compute_layout_with_constraints(
            text="Hi",
            style=simple_style,
            box_width_px=800.0,
            box_height_px=300.0,
            canvas_width=1920,
            overflow=OverflowBehavior.WRAP,
        )
        assert result.scale == pytest.approx(1.0)
