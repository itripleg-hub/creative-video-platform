"""Pydantic models for the rendering worker payload.

These types mirror the canonical layer contract defined in LAYER-MODEL.md.
All fields are validated on ingestion; unknown fields are silently ignored
so that the worker stays forward-compatible with new backend fields.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ─────────────────────────────────────────────────────────────────────────────
# Enumerations
# ─────────────────────────────────────────────────────────────────────────────

class LayerType(str, Enum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    SUBTITLE = "SUBTITLE"
    SHAPE = "SHAPE"
    VIDEO_REGION = "VIDEO_REGION"


class AnchorPoint(str, Enum):
    TOP_LEFT = "TOP_LEFT"
    TOP_CENTER = "TOP_CENTER"
    TOP_RIGHT = "TOP_RIGHT"
    CENTER_LEFT = "CENTER_LEFT"
    CENTER = "CENTER"
    CENTER_RIGHT = "CENTER_RIGHT"
    BOTTOM_LEFT = "BOTTOM_LEFT"
    BOTTOM_CENTER = "BOTTOM_CENTER"
    BOTTOM_RIGHT = "BOTTOM_RIGHT"


class TextAlign(str, Enum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"


class VerticalAlign(str, Enum):
    TOP = "top"
    MIDDLE = "middle"
    BOTTOM = "bottom"


class OverflowBehavior(str, Enum):
    WRAP = "WRAP"
    SHRINK = "SHRINK"
    CLIP = "CLIP"
    ELLIPSIS = "ELLIPSIS"


class TextDecoration(str, Enum):
    NONE = "none"
    UNDERLINE = "underline"
    LINE_THROUGH = "line-through"


class TextTransform(str, Enum):
    NONE = "none"
    UPPERCASE = "uppercase"
    LOWERCASE = "lowercase"


class FontStyle(str, Enum):
    NORMAL = "normal"
    ITALIC = "italic"


class AspectRatio(str, Enum):
    """Well-known aspect ratios. Free-form strings are also accepted."""
    RATIO_16_9 = "16:9"
    RATIO_9_16 = "9:16"
    RATIO_1_1 = "1:1"
    RATIO_4_5 = "4:5"
    RATIO_4_3 = "4:3"


# ─────────────────────────────────────────────────────────────────────────────
# Sub-models
# ─────────────────────────────────────────────────────────────────────────────

class _BaseModel(BaseModel):
    """Shared config: ignore extra fields, use enum values."""
    model_config = ConfigDict(extra="ignore", use_enum_values=True)


class ShadowConfig(_BaseModel):
    x: float = 0.0
    y: float = 4.0
    blur: float = 12.0
    color: str = "#00000066"


class LayerLayout(_BaseModel):
    """Normalized (0.0–1.0) position and size relative to canvas."""
    x: float = Field(..., ge=0.0, description="Normalized x anchor position")
    y: float = Field(..., ge=0.0, description="Normalized y anchor position")
    width: float = Field(..., gt=0.0, le=2.0, description="Normalized width (may exceed 1 for bleed)")
    height: float = Field(..., gt=0.0, le=2.0, description="Normalized height")
    rotation: float = Field(default=0.0, description="Degrees, counter-clockwise")
    anchor_point: AnchorPoint = Field(default=AnchorPoint.TOP_LEFT, alias="anchorPoint")


class TextStyle(_BaseModel):
    font_family: str = Field(default="DejaVu Sans", alias="fontFamily")
    font_size: float = Field(default=48.0, gt=0, alias="fontSize", description="px at 1080p reference")
    font_weight: int = Field(default=400, alias="fontWeight")
    font_style: FontStyle = Field(default=FontStyle.NORMAL, alias="fontStyle")
    line_height: float = Field(default=1.2, alias="lineHeight")
    letter_spacing: float = Field(default=0.0, alias="letterSpacing", description="px at reference resolution")
    text_align: TextAlign = Field(default=TextAlign.LEFT, alias="textAlign")
    vertical_align: VerticalAlign = Field(default=VerticalAlign.TOP, alias="verticalAlign")
    text_color: str = Field(default="#FFFFFF", alias="textColor")
    background_color: str | None = Field(default=None, alias="backgroundColor")
    padding: list[float] | None = Field(default=None, description="[top, right, bottom, left] px at reference")
    border_radius: float | None = Field(default=None, alias="borderRadius")
    border_width: float | None = Field(default=None, alias="borderWidth")
    border_color: str | None = Field(default=None, alias="borderColor")
    shadow: ShadowConfig | None = None
    stroke_color: str | None = Field(default=None, alias="strokeColor")
    stroke_width: float | None = Field(default=None, alias="strokeWidth")
    text_decoration: TextDecoration = Field(default=TextDecoration.NONE, alias="textDecoration")
    text_transform: TextTransform = Field(default=TextTransform.NONE, alias="textTransform")

    @field_validator("padding", mode="before")
    @classmethod
    def _normalise_padding(cls, v: Any) -> list[float] | None:
        """Accept int, float, or list[1-4]."""
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return [float(v)] * 4
        if isinstance(v, list):
            if len(v) == 1:
                return [float(v[0])] * 4
            if len(v) == 2:
                return [float(v[0]), float(v[1]), float(v[0]), float(v[1])]
            if len(v) == 3:
                return [float(v[0]), float(v[1]), float(v[2]), float(v[1])]
            if len(v) == 4:
                return [float(x) for x in v]
        raise ValueError(f"padding must be a number or list of 1-4 numbers, got {v!r}")

    def effective_padding(self) -> tuple[float, float, float, float]:
        """Return (top, right, bottom, left) with safe defaults."""
        p = self.padding or [0.0, 0.0, 0.0, 0.0]
        return (p[0], p[1], p[2], p[3])


class ImageStyle(_BaseModel):
    object_fit: str = Field(default="contain", alias="objectFit")
    tint_color: str | None = Field(default=None, alias="tintColor")


class TextConstraints(_BaseModel):
    max_lines: int | None = Field(default=None, alias="maxLines", ge=1)
    overflow_behavior: OverflowBehavior = Field(default=OverflowBehavior.WRAP, alias="overflowBehavior")
    auto_fit: bool = Field(default=False, alias="autoFit")
    safe_area: bool = Field(default=True, alias="safeArea")


class TextContent(_BaseModel):
    text: str = ""


class ImageContent(_BaseModel):
    src: str = Field(..., description="S3 key or presigned URL")
    alt: str = ""


class SubtitleContent(_BaseModel):
    """Placeholder content for subtitle region layers."""
    language: str = "en"


class LayerContent(_BaseModel):
    """Union-like content container. Fields relevant to layer type are populated."""
    text: str | None = None
    src: str | None = None
    alt: str | None = None
    language: str | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Main Layer model
# ─────────────────────────────────────────────────────────────────────────────

class Layer(_BaseModel):
    layer_id: str = Field(..., alias="layerId")
    type: LayerType
    name: str = ""
    editable: bool = True
    translatable: bool = False
    visible: bool = True
    locked: bool = False
    z_index: int = Field(default=0, alias="zIndex")
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)

    layout: LayerLayout
    style: TextStyle | ImageStyle | dict[str, Any] = Field(default_factory=dict)
    content: LayerContent = Field(default_factory=LayerContent)
    constraints: TextConstraints = Field(default_factory=TextConstraints)

    # Per-aspect-ratio layout/style overrides keyed by ratio string ("9:16", etc.)
    aspect_ratio_overrides: dict[str, dict[str, Any]] = Field(
        default_factory=dict, alias="aspectRatioOverrides"
    )

    @model_validator(mode="before")
    @classmethod
    def _coerce_style(cls, data: Any) -> Any:
        """Coerce the style dict into the correct typed sub-model based on layer type."""
        if not isinstance(data, dict):
            return data
        layer_type = data.get("type", "TEXT")
        style = data.get("style", {})
        if isinstance(style, dict):
            if layer_type == LayerType.TEXT or layer_type == "TEXT":
                data["style"] = TextStyle.model_validate(style)
            elif layer_type in (LayerType.IMAGE, "IMAGE", LayerType.SHAPE, "SHAPE"):
                data["style"] = ImageStyle.model_validate(style)
        return data

    def get_text_style(self) -> TextStyle:
        """Return TextStyle, raising if layer is not a text layer."""
        if not isinstance(self.style, TextStyle):
            raise TypeError(f"Layer {self.layer_id!r} is not a TEXT layer")
        return self.style

    def resolve_layout(self, aspect_ratio: str) -> LayerLayout:
        """Return layout with aspect-ratio overrides applied."""
        if aspect_ratio not in self.aspect_ratio_overrides:
            return self.layout
        override = self.aspect_ratio_overrides[aspect_ratio]
        base = self.layout.model_dump(by_alias=False)
        base.update(override)
        return LayerLayout.model_validate(base)

    def resolve_style(self, aspect_ratio: str) -> TextStyle | ImageStyle | dict[str, Any]:
        """Return style with aspect-ratio overrides applied."""
        if aspect_ratio not in self.aspect_ratio_overrides:
            return self.style
        override = self.aspect_ratio_overrides[aspect_ratio]
        if isinstance(self.style, (TextStyle, ImageStyle)):
            base = self.style.model_dump(by_alias=False)
        else:
            base = dict(self.style)
        base.update(override)
        if self.type == LayerType.TEXT:
            return TextStyle.model_validate(base)
        return base


# ─────────────────────────────────────────────────────────────────────────────
# Voice / subtitle settings
# ─────────────────────────────────────────────────────────────────────────────

class VoiceSettings(_BaseModel):
    enabled: bool = False
    voice_id: str | None = Field(default=None, alias="voiceId")
    language_code: str = Field(default="en-US", alias="languageCode")
    speech_rate: float = Field(default=1.0, alias="speechRate", ge=0.25, le=4.0)
    audio_s3_key: str | None = Field(default=None, alias="audioS3Key")


class SubtitleSettings(_BaseModel):
    enabled: bool = False
    language_code: str = Field(default="en", alias="languageCode")
    font_family: str = Field(default="DejaVu Sans", alias="fontFamily")
    font_size: int = Field(default=36, alias="fontSize")
    text_color: str = Field(default="&H00FFFFFF&", alias="textColor")
    outline_color: str = Field(default="&H00000000&", alias="outlineColor")
    outline_width: float = Field(default=2.0, alias="outlineWidth")
    # Where the subtitle region sits (normalized coords)
    region_x: float = Field(default=0.05, alias="regionX")
    region_y: float = Field(default=0.82, alias="regionY")
    region_width: float = Field(default=0.90, alias="regionWidth")
    region_height: float = Field(default=0.15, alias="regionHeight")
    ass_s3_key: str | None = Field(default=None, alias="assS3Key")


# ─────────────────────────────────────────────────────────────────────────────
# Output dimensions
# ─────────────────────────────────────────────────────────────────────────────

class OutputDimensions(_BaseModel):
    aspect_ratio: str = Field(..., alias="aspectRatio")
    width: int
    height: int


STANDARD_OUTPUT_DIMENSIONS: dict[str, tuple[int, int]] = {
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
    "4:5": (1080, 1350),
    "4:3": (1440, 1080),
}


def get_output_dimensions(aspect_ratio: str, width: int | None = None, height: int | None = None) -> tuple[int, int]:
    """Resolve pixel dimensions for a named aspect ratio."""
    if width and height:
        return width, height
    if aspect_ratio in STANDARD_OUTPUT_DIMENSIONS:
        return STANDARD_OUTPUT_DIMENSIONS[aspect_ratio]
    # Parse free-form "W:H"
    try:
        w_part, h_part = aspect_ratio.split(":")
        ratio = float(w_part) / float(h_part)
        base = 1080
        return (int(base * ratio), base)
    except Exception as exc:
        raise ValueError(f"Cannot resolve dimensions for aspect ratio {aspect_ratio!r}") from exc


# ─────────────────────────────────────────────────────────────────────────────
# Top-level render job
# ─────────────────────────────────────────────────────────────────────────────

class RenderJob(_BaseModel):
    """The complete input payload for a single render execution."""

    execution_id: str = Field(..., alias="executionId")
    job_id: str = Field(..., alias="jobId")

    # Source video
    source_video_s3_key: str = Field(..., alias="sourceVideoS3Key")

    # Template identity
    template_id: str = Field(..., alias="templateId")
    template_version: int = Field(..., alias="templateVersion")

    # Layers
    layers: list[Layer]

    # Output targets
    aspect_ratios: list[str] = Field(..., alias="aspectRatios", min_length=1)
    language_codes: list[str] = Field(..., alias="languageCodes", min_length=1)

    # Optional
    voice_settings: VoiceSettings = Field(default_factory=VoiceSettings, alias="voiceSettings")
    subtitle_settings: SubtitleSettings = Field(default_factory=SubtitleSettings, alias="subtitleSettings")

    # Output destination prefix in output_bucket
    output_s3_prefix: str = Field(default="", alias="outputS3Prefix")

    # Callback
    callback_url: str | None = Field(default=None, alias="callbackUrl")

    @property
    def visible_layers(self) -> list[Layer]:
        """Layers that should actually be rendered, sorted by zIndex."""
        return sorted(
            [l for l in self.layers if l.visible],
            key=lambda l: l.z_index,
        )

    def text_layers(self, aspect_ratio: str | None = None) -> list[Layer]:
        """Return visible TEXT layers, optionally applying aspect-ratio filter."""
        layers = [l for l in self.visible_layers if l.type == LayerType.TEXT]
        return layers

    def subtitle_layer(self) -> Layer | None:
        """Return the first SUBTITLE layer if any."""
        for layer in self.visible_layers:
            if layer.type == LayerType.SUBTITLE:
                return layer
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Worker status callback models
# ─────────────────────────────────────────────────────────────────────────────

class StepStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class RenderStep(str, Enum):
    VALIDATION = "VALIDATION"
    ASSET_DOWNLOAD = "ASSET_DOWNLOAD"
    TEXT_LAYOUT = "TEXT_LAYOUT"
    LAYER_RENDER = "LAYER_RENDER"
    FFMPEG_COMPOSE = "FFMPEG_COMPOSE"
    SUBTITLE_GEN = "SUBTITLE_GEN"
    OUTPUT_UPLOAD = "OUTPUT_UPLOAD"
    CLEANUP = "CLEANUP"


class StepUpdate(_BaseModel):
    execution_id: str = Field(..., alias="executionId")
    step: RenderStep
    status: StepStatus
    message: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    duration_ms: int | None = Field(default=None, alias="durationMs")


class RenderResult(_BaseModel):
    language_code: str = Field(..., alias="languageCode")
    aspect_ratio: str = Field(..., alias="aspectRatio")
    output_s3_key: str = Field(..., alias="outputS3Key")
    thumbnail_s3_key: str | None = Field(default=None, alias="thumbnailS3Key")
    duration_ms: int | None = Field(default=None, alias="durationMs")
    width: int | None = None
    height: int | None = None


class WorkerCallback(_BaseModel):
    execution_id: str = Field(..., alias="executionId")
    job_id: str = Field(..., alias="jobId")
    success: bool
    results: list[RenderResult] = Field(default_factory=list)
    error_code: str | None = Field(default=None, alias="errorCode")
    error_message: str | None = Field(default=None, alias="errorMessage")
    retriable: bool = False
    steps: list[StepUpdate] = Field(default_factory=list)
