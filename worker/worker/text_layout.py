"""Text layout engine for the rendering worker.

This module computes how text renders inside a bounding box, mirroring the
CSS/canvas behaviour in the React frontend as closely as possible.

The algorithm:
1. Apply textTransform
2. Load font (with size scaled to output resolution)
3. Tokenise text into words
4. Greedily wrap words into lines respecting the box width and letterSpacing
5. Apply maxLines + overflowBehavior (WRAP / CLIP / ELLIPSIS / SHRINK)
6. Compute total rendered height
7. Compute vertical offset from verticalAlign
8. Return a LayoutResult that the layer renderer can use directly
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import structlog
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from worker.config import settings
from worker.errors import FontNotFoundError
from worker.models import (
    OverflowBehavior,
    TextAlign,
    TextStyle,
    TextTransform,
    VerticalAlign,
)

log = structlog.get_logger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

ELLIPSIS_CHAR = "…"
FONT_FALLBACK_CHAIN = [
    "DejaVuSans.ttf",
    "DejaVuSans-Bold.ttf",
    "LiberationSans-Regular.ttf",
    "Arial.ttf",
    "Helvetica.ttf",
]

# Resolution at which font sizes in the layer model are specified
REFERENCE_WIDTH = settings.reference_width
REFERENCE_HEIGHT = settings.reference_height


# ─── Font cache ───────────────────────────────────────────────────────────────

_font_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def _find_font_file(family: str, weight: int = 400, italic: bool = False) -> str:
    """Locate a font file by family name.

    Search order:
    1. worker/fonts/ directory (bundled fonts)
    2. Settings fonts_dir (system fonts)
    3. Fallback chain

    Returns the path to a loadable font file.
    """
    # Build candidate filenames
    candidates: list[str] = []
    weight_suffix = "-Bold" if weight >= 600 else ""
    italic_suffix = "Italic" if italic else ""
    base = family.replace(" ", "")

    candidates.extend([
        f"{base}{weight_suffix}{italic_suffix}.ttf",
        f"{base}{weight_suffix}{italic_suffix}.otf",
        f"{base}-{weight_suffix}{italic_suffix}.ttf",
        f"{family.replace(' ', '-')}{weight_suffix}{italic_suffix}.ttf",
        f"{family}{weight_suffix}{italic_suffix}.ttf",
    ])
    if weight >= 600:
        candidates.append(f"{base}Bold{italic_suffix}.ttf")
    if italic:
        candidates.append(f"{base}Oblique.ttf")
    # Also try the plain family name
    candidates.extend([f"{base}.ttf", f"{base}.otf"])

    search_dirs: list[Path] = [
        Path(__file__).parent / "fonts",
        Path(settings.fonts_dir),
        Path("/usr/share/fonts/truetype"),
        Path("/usr/share/fonts/truetype/dejavu"),
        Path("/usr/share/fonts/truetype/liberation"),
        Path("/System/Library/Fonts"),
        Path("/Library/Fonts"),
        Path(os.path.expanduser("~/Library/Fonts")),
    ]

    for directory in search_dirs:
        if not directory.exists():
            continue
        # Exact candidate search
        for candidate in candidates:
            p = directory / candidate
            if p.exists():
                return str(p)
        # Recursive search for any file containing the family name
        for font_file in directory.rglob("*.ttf"):
            if family.lower().replace(" ", "") in font_file.stem.lower().replace(" ", ""):
                return str(font_file)
        for font_file in directory.rglob("*.otf"):
            if family.lower().replace(" ", "") in font_file.stem.lower().replace(" ", ""):
                return str(font_file)

    # Last resort: any known fallback
    for directory in search_dirs:
        if not directory.exists():
            continue
        for fallback in FONT_FALLBACK_CHAIN:
            p = directory / fallback
            if p.exists():
                log.warning("font_fallback", requested=family, using=str(p))
                return str(p)

    raise FontNotFoundError(
        f"Cannot find font for family={family!r}. Install fonts or add them to worker/fonts/."
    )


def load_font(family: str, size_px: int, weight: int = 400, italic: bool = False) -> ImageFont.FreeTypeFont:
    """Load (or retrieve from cache) a PIL font at the given pixel size."""
    key = (f"{family}:{weight}:{'i' if italic else 'n'}", size_px)
    if key in _font_cache:
        return _font_cache[key]
    path = _find_font_file(family, weight, italic)
    try:
        font = ImageFont.truetype(path, size=size_px)
    except OSError as exc:
        raise FontNotFoundError(f"Failed to load font file {path!r}: {exc}") from exc
    _font_cache[key] = font
    return font


# ─── Font scaling ─────────────────────────────────────────────────────────────

def scale_font_size(font_size_ref: float, canvas_width: int) -> int:
    """Scale a font size specified at reference resolution to actual canvas width."""
    scale = canvas_width / REFERENCE_WIDTH
    return max(1, round(font_size_ref * scale))


def scale_dimension(value_ref: float, canvas_width: int) -> float:
    """Scale any reference-resolution dimension (padding, spacing…) to canvas pixels."""
    return value_ref * (canvas_width / REFERENCE_WIDTH)


# ─── Text measurement ─────────────────────────────────────────────────────────

def measure_text(text: str, font: ImageFont.FreeTypeFont, letter_spacing: float = 0.0) -> tuple[float, float]:
    """Measure the pixel bounding box of a single text string.

    Returns (width, height).  When letter_spacing != 0 we add it between each
    character (matching CSS letter-spacing semantics — it is added AFTER each
    character, including the last in CSS, but we skip the trailing space here
    for more accurate box sizing).
    """
    if not text:
        # Return height of a space character for empty lines
        bbox = font.getbbox(" ")
        return 0.0, float(bbox[3] - bbox[1])

    if letter_spacing == 0.0:
        bbox = font.getbbox(text)
        return float(bbox[2] - bbox[0]), float(bbox[3] - bbox[1])

    # Manual character-by-character measurement with letter spacing
    total_width = 0.0
    max_height = 0.0
    for i, char in enumerate(text):
        bbox = font.getbbox(char)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        total_width += w
        if i < len(text) - 1:
            total_width += letter_spacing
        max_height = max(max_height, h)
    return total_width, max_height


def get_line_height_px(font: ImageFont.FreeTypeFont, line_height_multiplier: float) -> float:
    """Compute line height in pixels from the font metrics + multiplier."""
    # Use the ascent+descent as the natural line height baseline
    ascent, descent = font.getmetrics()
    natural = ascent + abs(descent)
    return natural * line_height_multiplier


# ─── Line wrapping ────────────────────────────────────────────────────────────

def _wrap_text_to_width(
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: float,
    letter_spacing: float,
) -> list[str]:
    """Greedy word-wrap a single paragraph into lines that fit max_width.

    Mirrors CSS word-wrap: break-word behaviour.
    """
    words = text.split(" ")
    lines: list[str] = []
    current_line = ""

    for word in words:
        # Try adding word to current line
        candidate = f"{current_line} {word}".lstrip() if current_line else word
        w, _ = measure_text(candidate, font, letter_spacing)
        if w <= max_width:
            current_line = candidate
        else:
            # Word doesn't fit — flush current line and start a new one
            if current_line:
                lines.append(current_line)
            # Check if the word itself exceeds width (force character break)
            word_w, _ = measure_text(word, font, letter_spacing)
            if word_w <= max_width:
                current_line = word
            else:
                # Force-break the word character by character
                partial = ""
                for char in word:
                    trial = partial + char
                    trial_w, _ = measure_text(trial, font, letter_spacing)
                    if trial_w <= max_width:
                        partial = trial
                    else:
                        if partial:
                            lines.append(partial)
                        partial = char
                current_line = partial

    if current_line:
        lines.append(current_line)

    return lines if lines else [""]


def _apply_ellipsis(
    lines: list[str],
    max_lines: int,
    font: ImageFont.FreeTypeFont,
    max_width: float,
    letter_spacing: float,
) -> list[str]:
    """Truncate to max_lines and append ellipsis on the last line."""
    if len(lines) <= max_lines:
        return lines
    truncated = lines[:max_lines]
    last = truncated[-1]
    # Shorten last line until "…" fits
    while last:
        candidate = last.rstrip() + ELLIPSIS_CHAR
        w, _ = measure_text(candidate, font, letter_spacing)
        if w <= max_width:
            truncated[-1] = candidate
            return truncated
        last = last[:-1]
    truncated[-1] = ELLIPSIS_CHAR
    return truncated


# ─── Layout result ────────────────────────────────────────────────────────────

@dataclass
class LineLayout:
    text: str
    x: float          # Left edge of the line (box-relative)
    y: float          # Top edge of the line (box-relative)
    width: float      # Rendered width of text (for underline etc.)
    height: float     # Rendered height of this line


@dataclass
class LayoutResult:
    """Full layout computation result.  Used directly by the layer renderer."""
    lines: list[LineLayout]
    box_width: float         # Final content box width (pixels)
    box_height: float        # Final content box height (pixels)
    content_height: float    # Total text block height (px)
    font_size_px: int        # Actual font size used (possibly shrunk)
    font: ImageFont.FreeTypeFont  # Loaded font at final size
    scale: float             # Scale factor applied (1.0 unless shrunk)
    text_align: TextAlign
    vertical_align: VerticalAlign
    # Padding resolved to pixel values at render scale
    pad_top: float
    pad_right: float
    pad_bottom: float
    pad_left: float


def compute_layout(
    text: str,
    style: TextStyle,
    box_width_px: float,
    box_height_px: float,
    canvas_width: int,
    *,
    min_font_size_px: int = 8,
) -> LayoutResult:
    """Compute the full text layout for a layer.

    Parameters
    ----------
    text:
        The text content to layout.
    style:
        The TextStyle configuration.
    box_width_px, box_height_px:
        Pixel dimensions of the layer bounding box at render resolution.
    canvas_width:
        The output canvas width (for scaling reference-resolution values).
    min_font_size_px:
        Minimum font size when SHRINK is used.

    Returns
    -------
    LayoutResult
        All information needed to paint text onto a Pillow image.
    """
    # 1. Text transform
    display_text = _apply_transform(text, style.text_transform)

    # 2. Scale reference-resolution values to canvas
    pad_top, pad_right, pad_bottom, pad_left = [
        scale_dimension(p, canvas_width) for p in style.effective_padding()
    ]
    ls = scale_dimension(style.letter_spacing, canvas_width)

    content_w = box_width_px - pad_left - pad_right
    content_h = box_height_px - pad_top - pad_bottom
    content_w = max(content_w, 1.0)
    content_h = max(content_h, 1.0)

    # 3. Font size
    font_size_px = scale_font_size(style.font_size, canvas_width)
    is_italic = style.font_style == "italic"

    # 4. Handle autoFit / SHRINK by iterating font sizes downward
    overflow = OverflowBehavior(style.constraints.overflow_behavior) if hasattr(style, "constraints") else OverflowBehavior.WRAP
    # Note: constraints are on the Layer, not TextStyle — caller must pass them in if needed.
    # We accept them via the style object's parent layer. For standalone use, default to WRAP.

    max_lines: int | None = None  # Filled by caller if needed

    font, lines, font_size_px, scale = _layout_with_font(
        display_text,
        style,
        font_size_px,
        content_w,
        ls,
        max_lines,
        overflow,
        is_italic,
        min_font_size_px,
        canvas_width,
    )

    line_h = get_line_height_px(font, style.line_height)
    total_text_h = line_h * len(lines)

    # 5. Vertical alignment offset within content area
    v_offset = _vertical_offset(total_text_h, content_h, style.vertical_align)

    # 6. Build per-line layout
    line_layouts: list[LineLayout] = []
    y_cursor = pad_top + v_offset
    for line_text in lines:
        w, h = measure_text(line_text, font, ls)
        x = _horizontal_offset(w, content_w, style.text_align) + pad_left
        line_layouts.append(LineLayout(
            text=line_text,
            x=x,
            y=y_cursor,
            width=w,
            height=h,
        ))
        y_cursor += line_h

    return LayoutResult(
        lines=line_layouts,
        box_width=box_width_px,
        box_height=box_height_px,
        content_height=total_text_h,
        font_size_px=font_size_px,
        font=font,
        scale=scale,
        text_align=TextAlign(style.text_align),
        vertical_align=VerticalAlign(style.vertical_align),
        pad_top=pad_top,
        pad_right=pad_right,
        pad_bottom=pad_bottom,
        pad_left=pad_left,
    )


def compute_layout_with_constraints(
    text: str,
    style: TextStyle,
    box_width_px: float,
    box_height_px: float,
    canvas_width: int,
    max_lines: int | None = None,
    overflow: OverflowBehavior = OverflowBehavior.WRAP,
    auto_fit: bool = False,
    min_font_size_px: int = 8,
) -> LayoutResult:
    """Full layout computation with constraint handling."""
    display_text = _apply_transform(text, style.text_transform)

    pad_top, pad_right, pad_bottom, pad_left = [
        scale_dimension(p, canvas_width) for p in style.effective_padding()
    ]
    ls = scale_dimension(style.letter_spacing, canvas_width)

    content_w = max(box_width_px - pad_left - pad_right, 1.0)
    content_h = max(box_height_px - pad_top - pad_bottom, 1.0)

    font_size_px = scale_font_size(style.font_size, canvas_width)
    is_italic = style.font_style == "italic"

    # Auto-fit: start from the reference size, shrink until text fits in height
    if auto_fit or overflow == OverflowBehavior.SHRINK:
        font, lines, font_size_px, scale = _shrink_to_fit(
            display_text, style, font_size_px, content_w, content_h,
            ls, max_lines, is_italic, min_font_size_px, canvas_width,
        )
    else:
        font = load_font(style.font_family, font_size_px, style.font_weight, is_italic)
        lines = _wrap_text_to_width(display_text, font, content_w, ls)
        scale = 1.0

        # Apply max_lines truncation
        if max_lines and len(lines) > max_lines:
            if overflow == OverflowBehavior.CLIP:
                lines = lines[:max_lines]
            elif overflow == OverflowBehavior.ELLIPSIS:
                lines = _apply_ellipsis(lines, max_lines, font, content_w, ls)
            else:  # WRAP — just allow wrapping but cap at max_lines
                lines = lines[:max_lines]

    line_h = get_line_height_px(font, style.line_height)
    total_text_h = line_h * len(lines)
    v_offset = _vertical_offset(total_text_h, content_h, style.vertical_align)

    line_layouts: list[LineLayout] = []
    y_cursor = pad_top + v_offset
    for line_text in lines:
        w, h = measure_text(line_text, font, ls)
        x = _horizontal_offset(w, content_w, style.text_align) + pad_left
        line_layouts.append(LineLayout(text=line_text, x=x, y=y_cursor, width=w, height=h))
        y_cursor += line_h

    return LayoutResult(
        lines=line_layouts,
        box_width=box_width_px,
        box_height=box_height_px,
        content_height=total_text_h,
        font_size_px=font_size_px,
        font=font,
        scale=scale,
        text_align=TextAlign(style.text_align),
        vertical_align=VerticalAlign(style.vertical_align),
        pad_top=pad_top,
        pad_right=pad_right,
        pad_bottom=pad_bottom,
        pad_left=pad_left,
    )


# ─── Private helpers ──────────────────────────────────────────────────────────

def _apply_transform(text: str, transform: str | TextTransform) -> str:
    t = TextTransform(transform) if isinstance(transform, str) else transform
    if t == TextTransform.UPPERCASE:
        return text.upper()
    if t == TextTransform.LOWERCASE:
        return text.lower()
    return text


def _horizontal_offset(text_width: float, content_width: float, align: str | TextAlign) -> float:
    a = TextAlign(align) if isinstance(align, str) else align
    if a == TextAlign.CENTER:
        return max((content_width - text_width) / 2.0, 0.0)
    if a == TextAlign.RIGHT:
        return max(content_width - text_width, 0.0)
    return 0.0  # LEFT


def _vertical_offset(text_height: float, content_height: float, align: str | VerticalAlign) -> float:
    a = VerticalAlign(align) if isinstance(align, str) else align
    if a == VerticalAlign.MIDDLE:
        return max((content_height - text_height) / 2.0, 0.0)
    if a == VerticalAlign.BOTTOM:
        return max(content_height - text_height, 0.0)
    return 0.0  # TOP


def _layout_with_font(
    text: str,
    style: TextStyle,
    font_size_px: int,
    content_w: float,
    ls: float,
    max_lines: int | None,
    overflow: OverflowBehavior,
    is_italic: bool,
    min_font_size_px: int,
    canvas_width: int,
) -> tuple[ImageFont.FreeTypeFont, list[str], int, float]:
    font = load_font(style.font_family, font_size_px, style.font_weight, is_italic)
    lines = _wrap_text_to_width(text, font, content_w, ls)
    if max_lines and len(lines) > max_lines:
        if overflow == OverflowBehavior.ELLIPSIS:
            lines = _apply_ellipsis(lines, max_lines, font, content_w, ls)
        else:
            lines = lines[:max_lines]
    return font, lines, font_size_px, 1.0


def _shrink_to_fit(
    text: str,
    style: TextStyle,
    font_size_px: int,
    content_w: float,
    content_h: float,
    ls: float,
    max_lines: int | None,
    is_italic: bool,
    min_font_size_px: int,
    canvas_width: int,
) -> tuple[ImageFont.FreeTypeFont, list[str], int, float]:
    """Iteratively reduce font size until text fits within content_h."""
    original_size = font_size_px
    current_size = font_size_px

    while current_size >= min_font_size_px:
        font = load_font(style.font_family, current_size, style.font_weight, is_italic)
        scaled_ls = ls * (current_size / original_size) if original_size else ls
        lines = _wrap_text_to_width(text, font, content_w, scaled_ls)

        if max_lines and len(lines) > max_lines:
            lines = lines[:max_lines]

        line_h = get_line_height_px(font, style.line_height)
        total_h = line_h * len(lines)

        if total_h <= content_h:
            scale = current_size / original_size if original_size else 1.0
            return font, lines, current_size, scale

        current_size -= 1

    # Fallback: use minimum size, clip lines
    font = load_font(style.font_family, min_font_size_px, style.font_weight, is_italic)
    lines = _wrap_text_to_width(text, font, content_w, ls)
    if max_lines:
        lines = lines[:max_lines]
    scale = min_font_size_px / original_size if original_size else 1.0
    return font, lines, min_font_size_px, scale


# ─── Background box helper ────────────────────────────────────────────────────

def parse_color(color_str: str) -> tuple[int, int, int, int]:
    """Parse a hex color string (with optional alpha) into RGBA tuple.

    Supported formats:
    - "#RGB"
    - "#RRGGBB"
    - "#RRGGBBAA"
    - "#AARRGGBB"  (CSS hex with leading alpha — rare but seen in some editors)
    """
    c = color_str.lstrip("#")
    if len(c) == 3:
        r, g, b = (int(x * 2, 16) for x in c)
        return r, g, b, 255
    if len(c) == 6:
        r = int(c[0:2], 16)
        g = int(c[2:4], 16)
        b = int(c[4:6], 16)
        return r, g, b, 255
    if len(c) == 8:
        # Treat as RRGGBBAA (matches CSS convention)
        r = int(c[0:2], 16)
        g = int(c[2:4], 16)
        b = int(c[4:6], 16)
        a = int(c[6:8], 16)
        return r, g, b, a
    raise ValueError(f"Cannot parse color: {color_str!r}")


def draw_rounded_rect(
    draw: ImageDraw.ImageDraw,
    x0: float, y0: float, x1: float, y1: float,
    radius: float,
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int] | None = None,
    outline_width: int = 0,
) -> None:
    """Draw a filled rounded rectangle onto a PIL ImageDraw context."""
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    r = int(min(radius, (x1 - x0) / 2, (y1 - y0) / 2))

    if r <= 0:
        draw.rectangle([x0, y0, x1, y1], fill=fill, outline=outline, width=outline_width)
        return

    # Main rects
    draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    draw.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    # Corner circles
    draw.ellipse([x0, y0, x0 + 2 * r, y0 + 2 * r], fill=fill)
    draw.ellipse([x1 - 2 * r, y0, x1, y0 + 2 * r], fill=fill)
    draw.ellipse([x0, y1 - 2 * r, x0 + 2 * r, y1], fill=fill)
    draw.ellipse([x1 - 2 * r, y1 - 2 * r, x1, y1], fill=fill)

    if outline and outline_width > 0:
        draw.rounded_rectangle(
            [x0, y0, x1, y1],
            radius=r,
            outline=outline,
            width=outline_width,
        )


def draw_text_shadow(
    draw: ImageDraw.ImageDraw,
    x: float, y: float,
    text: str,
    font: ImageFont.FreeTypeFont,
    shadow_x: float,
    shadow_y: float,
    shadow_color: tuple[int, int, int, int],
    letter_spacing: float = 0.0,
) -> None:
    """Draw a drop shadow behind text."""
    _draw_text_with_spacing(
        draw, x + shadow_x, y + shadow_y, text, font, shadow_color, letter_spacing
    )


def _draw_text_with_spacing(
    draw: ImageDraw.ImageDraw,
    x: float,
    y: float,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    letter_spacing: float = 0.0,
    stroke_fill: tuple[int, int, int, int] | None = None,
    stroke_width: int = 0,
) -> None:
    """Draw text with optional letter spacing and stroke."""
    if letter_spacing == 0.0:
        draw.text(
            (x, y), text, font=font, fill=fill,
            stroke_fill=stroke_fill, stroke_width=stroke_width,
        )
        return

    cursor_x = x
    for char in text:
        draw.text(
            (cursor_x, y), char, font=font, fill=fill,
            stroke_fill=stroke_fill, stroke_width=stroke_width,
        )
        bbox = font.getbbox(char)
        cursor_x += (bbox[2] - bbox[0]) + letter_spacing
