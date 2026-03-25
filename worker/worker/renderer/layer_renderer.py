"""Layer renderer — renders individual layers to transparent PNG overlays.

Each visible layer is rendered onto its own RGBA image at full canvas size.
The FFmpeg builder then composites these images onto the source video.

Text layers:  fully rendered with Pillow (background box, shadow, stroke, text)
Image layers: loaded and pasted at position
Other types:  currently skipped (future extension point)
"""

from __future__ import annotations

import math
from pathlib import Path

import structlog
from PIL import Image, ImageDraw, ImageFilter

from worker.errors import RenderError
from worker.models import (
    AnchorPoint,
    Layer,
    LayerType,
    OverflowBehavior,
    TextConstraints,
    TextStyle,
)
from worker.text_layout import (
    LayoutResult,
    _draw_text_with_spacing,
    compute_layout_with_constraints,
    draw_rounded_rect,
    draw_text_shadow,
    parse_color,
    scale_dimension,
)

log = structlog.get_logger(__name__)


# ─── Coordinate helpers ───────────────────────────────────────────────────────

def resolve_pixel_bounds(
    layout: "worker.models.LayerLayout",  # type: ignore[name-defined]
    canvas_width: int,
    canvas_height: int,
) -> tuple[int, int, int, int]:
    """Convert normalized layout to pixel (left, top, right, bottom).

    The anchor_point tells us what the (x, y) coordinate refers to.
    """
    from worker.models import LayerLayout

    w = layout.width * canvas_width
    h = layout.height * canvas_height
    cx = layout.x * canvas_width
    cy = layout.y * canvas_height

    anchor = AnchorPoint(layout.anchor_point)

    # Determine top-left corner from anchor
    if anchor in (AnchorPoint.TOP_LEFT, AnchorPoint.CENTER_LEFT, AnchorPoint.BOTTOM_LEFT):
        x0 = cx
    elif anchor in (AnchorPoint.TOP_CENTER, AnchorPoint.CENTER, AnchorPoint.BOTTOM_CENTER):
        x0 = cx - w / 2
    else:  # RIGHT
        x0 = cx - w

    if anchor in (AnchorPoint.TOP_LEFT, AnchorPoint.TOP_CENTER, AnchorPoint.TOP_RIGHT):
        y0 = cy
    elif anchor in (AnchorPoint.CENTER_LEFT, AnchorPoint.CENTER, AnchorPoint.CENTER_RIGHT):
        y0 = cy - h / 2
    else:  # BOTTOM
        y0 = cy - h

    return int(x0), int(y0), int(x0 + w), int(y0 + h)


# ─── Layer renderer ───────────────────────────────────────────────────────────

class LayerRenderer:
    """Renders a single layer to a transparent PNG at full canvas size."""

    def __init__(self, canvas_width: int, canvas_height: int) -> None:
        self.canvas_width = canvas_width
        self.canvas_height = canvas_height

    def render_layer(
        self,
        layer: Layer,
        aspect_ratio: str,
        output_path: Path,
        image_asset_path: Path | None = None,
    ) -> Path | None:
        """Render a layer to a transparent PNG overlay.

        Returns the output path on success, None if layer should be skipped.
        """
        if not layer.visible:
            return None

        resolved_layout = layer.resolve_layout(aspect_ratio)
        resolved_style = layer.resolve_style(aspect_ratio)

        log.debug(
            "layer_renderer.render",
            layer_id=layer.layer_id,
            layer_type=layer.type,
            opacity=layer.opacity,
        )

        if layer.type == LayerType.TEXT:
            if not isinstance(resolved_style, TextStyle):
                log.warning("layer_renderer.skip_non_text_style", layer_id=layer.layer_id)
                return None
            return self._render_text_layer(
                layer, resolved_layout, resolved_style, output_path
            )

        elif layer.type == LayerType.IMAGE:
            if image_asset_path is None:
                log.warning("layer_renderer.no_asset", layer_id=layer.layer_id)
                return None
            return self._render_image_layer(
                layer, resolved_layout, image_asset_path, output_path
            )

        else:
            log.debug("layer_renderer.skip_type", layer_id=layer.layer_id, type=layer.type)
            return None

    # ── Text layer ────────────────────────────────────────────────────────────

    def _render_text_layer(
        self,
        layer: Layer,
        layout: "worker.models.LayerLayout",  # type: ignore[name-defined]
        style: TextStyle,
        output_path: Path,
    ) -> Path:
        text = layer.content.text or ""
        constraints = layer.constraints

        x0, y0, x1, y1 = resolve_pixel_bounds(layout, self.canvas_width, self.canvas_height)
        box_w = float(x1 - x0)
        box_h = float(y1 - y0)

        # Create full-canvas transparent image
        canvas = Image.new("RGBA", (self.canvas_width, self.canvas_height), (0, 0, 0, 0))

        # Compute text layout
        lr = compute_layout_with_constraints(
            text=text,
            style=style,
            box_width_px=box_w,
            box_height_px=box_h,
            canvas_width=self.canvas_width,
            max_lines=constraints.max_lines,
            overflow=OverflowBehavior(constraints.overflow_behavior),
            auto_fit=constraints.auto_fit,
        )

        # Render the layer onto an intermediate RGBA image (same size as the box)
        layer_img = self._render_text_onto_box(text, style, lr, box_w, box_h)

        # Apply opacity
        if layer.opacity < 1.0:
            layer_img = self._apply_opacity(layer_img, layer.opacity)

        # Apply rotation
        if layout.rotation != 0.0:
            layer_img = self._apply_rotation(layer_img, layout.rotation)

        # Paste onto full canvas at (x0, y0)
        canvas.paste(layer_img, (x0, y0), layer_img)

        # Save
        output_path.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(str(output_path), "PNG")
        log.debug("layer_renderer.text.saved", path=str(output_path))
        return output_path

    def _render_text_onto_box(
        self,
        text: str,
        style: TextStyle,
        lr: LayoutResult,
        box_w: float,
        box_h: float,
    ) -> Image.Image:
        """Render the full text layer (background + text) onto a box-sized RGBA image."""
        img = Image.new("RGBA", (int(box_w), int(box_h)), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # ── Background box ─────────────────────────────────────────────────
        if style.background_color:
            bg_color = parse_color(style.background_color)

            # Content area for the background box (padded)
            # The box spans the full layer width by default, height adapts to content
            bg_x0 = 0.0
            bg_y0 = 0.0
            bg_x1 = box_w
            bg_y1 = box_h

            shadow_cfg = style.shadow
            if shadow_cfg:
                shadow_color = parse_color(shadow_cfg.color)
                sx = scale_dimension(shadow_cfg.x, self.canvas_width)
                sy = scale_dimension(shadow_cfg.y, self.canvas_width)
                # Simple shadow: draw a slightly offset blurred version of the box
                shadow_img = Image.new("RGBA", (int(box_w), int(box_h)), (0, 0, 0, 0))
                shadow_draw = ImageDraw.Draw(shadow_img)
                draw_rounded_rect(
                    shadow_draw,
                    bg_x0 + sx, bg_y0 + sy,
                    bg_x1 + sx, bg_y1 + sy,
                    float(style.border_radius or 0),
                    fill=shadow_color,
                )
                blur_r = max(1, int(scale_dimension(shadow_cfg.blur, self.canvas_width) / 4))
                shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(radius=blur_r))
                img.alpha_composite(shadow_img)

            # Background fill
            border_color_rgba: tuple[int, int, int, int] | None = None
            border_w = 0
            if style.border_color and style.border_width:
                border_color_rgba = parse_color(style.border_color)
                border_w = int(scale_dimension(style.border_width, self.canvas_width))

            draw_rounded_rect(
                draw,
                bg_x0, bg_y0, bg_x1, bg_y1,
                float(style.border_radius or 0),
                fill=bg_color,
                outline=border_color_rgba,
                outline_width=border_w,
            )
            # Re-bind draw after potential alpha_composite
            draw = ImageDraw.Draw(img)

        # ── Per-line text rendering ────────────────────────────────────────
        text_color = parse_color(style.text_color)
        stroke_rgba: tuple[int, int, int, int] | None = None
        stroke_w = 0
        if style.stroke_color and style.stroke_width:
            stroke_rgba = parse_color(style.stroke_color)
            stroke_w = max(1, int(scale_dimension(style.stroke_width, self.canvas_width)))

        ls = scale_dimension(style.letter_spacing, self.canvas_width)
        font = lr.font

        for line in lr.lines:
            lx, ly = line.x, line.y

            # Drop shadow for text
            if style.shadow:
                shadow_cfg = style.shadow
                sx = scale_dimension(shadow_cfg.x, self.canvas_width)
                sy = scale_dimension(shadow_cfg.y, self.canvas_width)
                shadow_color = parse_color(shadow_cfg.color)
                _draw_text_with_spacing(draw, lx + sx, ly + sy, line.text, font, shadow_color, ls)

            # Actual text
            _draw_text_with_spacing(
                draw, lx, ly, line.text, font, text_color, ls,
                stroke_fill=stroke_rgba,
                stroke_width=stroke_w,
            )

        return img

    # ── Image layer ───────────────────────────────────────────────────────────

    def _render_image_layer(
        self,
        layer: Layer,
        layout: "worker.models.LayerLayout",  # type: ignore[name-defined]
        asset_path: Path,
        output_path: Path,
    ) -> Path:
        x0, y0, x1, y1 = resolve_pixel_bounds(layout, self.canvas_width, self.canvas_height)
        box_w, box_h = x1 - x0, y1 - y0

        canvas = Image.new("RGBA", (self.canvas_width, self.canvas_height), (0, 0, 0, 0))

        try:
            asset_img = Image.open(str(asset_path)).convert("RGBA")
        except OSError as exc:
            raise RenderError(f"Cannot open image asset {asset_path}: {exc}") from exc

        # Fit / contain
        asset_img.thumbnail((box_w, box_h), Image.LANCZOS)

        if layer.opacity < 1.0:
            asset_img = self._apply_opacity(asset_img, layer.opacity)

        if layout.rotation != 0.0:
            asset_img = self._apply_rotation(asset_img, layout.rotation)

        # Center within box
        paste_x = x0 + (box_w - asset_img.width) // 2
        paste_y = y0 + (box_h - asset_img.height) // 2
        canvas.paste(asset_img, (paste_x, paste_y), asset_img)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(str(output_path), "PNG")
        return output_path

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _apply_opacity(img: Image.Image, opacity: float) -> Image.Image:
        """Multiply the alpha channel by opacity (0.0–1.0)."""
        img = img.copy()
        r, g, b, a = img.split()
        a = a.point(lambda p: int(p * opacity))
        return Image.merge("RGBA", (r, g, b, a))

    @staticmethod
    def _apply_rotation(img: Image.Image, degrees: float) -> Image.Image:
        """Rotate image by degrees (expands canvas to avoid clipping)."""
        return img.rotate(-degrees, expand=True, resample=Image.BICUBIC)
