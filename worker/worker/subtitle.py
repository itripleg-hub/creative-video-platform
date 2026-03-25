"""ASS subtitle file generator.

Generates a well-formed Advanced SubStation Alpha (ASS v4+) subtitle file
with configurable styling, font, and positioning.

The positioning is driven by the SubtitleSettings on the job, which defines
a normalized region (x, y, width, height) for safe-area-aware placement.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import structlog

from worker.models import SubtitleSettings

log = structlog.get_logger(__name__)


# ─── ASS colour helpers ───────────────────────────────────────────────────────

def hex_to_ass_color(hex_color: str) -> str:
    """Convert #RRGGBB[AA] → &HAABBGGRR& (ASS BGR + alpha, inverted alpha)."""
    c = hex_color.lstrip("#")
    if len(c) == 6:
        r, g, b, a = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 0
    elif len(c) == 8:
        r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
        # CSS alpha (00=transparent, FF=opaque) → ASS alpha (00=opaque, FF=transparent)
        css_a = int(c[6:8], 16)
        a = 255 - css_a
    else:
        return "&H00FFFFFF&"
    return f"&H{a:02X}{b:02X}{g:02X}{r:02X}&"


def ass_bold(weight: int) -> int:
    return -1 if weight >= 600 else 0


# ─── Subtitle event ───────────────────────────────────────────────────────────

@dataclass
class SubtitleEvent:
    start_ms: int
    end_ms: int
    text: str
    layer: int = 0
    style: str = "Default"

    def _fmt_time(self, ms: int) -> str:
        """Format ms as H:MM:SS.cc (ASS time format)."""
        total_cs = ms // 10
        h = total_cs // 360000
        m = (total_cs % 360000) // 6000
        s = (total_cs % 6000) // 100
        cs = total_cs % 100
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    def to_ass_line(self) -> str:
        start = self._fmt_time(self.start_ms)
        end = self._fmt_time(self.end_ms)
        return f"Dialogue: {self.layer},{start},{end},{self.style},,0,0,0,,{self.text}"


# ─── ASS file builder ─────────────────────────────────────────────────────────

class ASSBuilder:
    """Builds an ASS subtitle file from events and styling config."""

    def __init__(
        self,
        canvas_width: int,
        canvas_height: int,
        settings: SubtitleSettings,
    ) -> None:
        self.canvas_width = canvas_width
        self.canvas_height = canvas_height
        self.settings = settings
        self._events: list[SubtitleEvent] = []

    def add_event(self, event: SubtitleEvent) -> None:
        self._events.append(event)

    def add_events(self, events: list[SubtitleEvent]) -> None:
        self._events.extend(events)

    def _resolve_position(self) -> tuple[int, int]:
        """Return pixel (x, y) for the subtitle alignment anchor.

        We target the centre of the subtitle region for horizontal centering,
        and the top of the region for vertical anchoring (alignment = 8 → top-center).
        """
        cx = int((self.settings.region_x + self.settings.region_width / 2) * self.canvas_width)
        cy = int(self.settings.region_y * self.canvas_height)
        return cx, cy

    def _build_script_info(self) -> str:
        return (
            "[Script Info]\n"
            "ScriptType: v4.00+\n"
            f"PlayResX: {self.canvas_width}\n"
            f"PlayResY: {self.canvas_height}\n"
            "Collisions: Normal\n"
            "ScaledBorderAndShadow: yes\n"
        )

    def _build_styles(self) -> str:
        s = self.settings
        cx, cy = self._resolve_position()
        text_color = (
            s.text_color
            if s.text_color.startswith("&H")
            else hex_to_ass_color(s.text_color)
        )
        outline_color = (
            s.outline_color
            if s.outline_color.startswith("&H")
            else hex_to_ass_color(s.outline_color)
        )
        # Alignment 2 = bottom-center (most common for subtitles)
        # We use \pos override so alignment here is mainly the fallback
        alignment = 2

        lines = [
            "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
            "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
            "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
            "Alignment, MarginL, MarginR, MarginV, Encoding",
            (
                f"Style: Default,{s.font_family},{s.font_size},"
                f"{text_color},&H000000FF&,{outline_color},&H00000000&,"
                f"0,0,0,0,100,100,0,0,1,{s.outline_width:.1f},0,"
                f"{alignment},10,10,10,1"
            ),
        ]
        return "\n".join(lines)

    def _build_events(self) -> str:
        cx, cy = self._resolve_position()
        lines = [
            "[Events]",
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
        ]
        sorted_events = sorted(self._events, key=lambda e: e.start_ms)
        for event in sorted_events:
            # Inject \pos override so every subtitle line respects the region
            text_with_pos = f"{{\\pos({cx},{cy})}}{event.text}"
            e = SubtitleEvent(
                start_ms=event.start_ms,
                end_ms=event.end_ms,
                text=text_with_pos,
                layer=event.layer,
                style=event.style,
            )
            lines.append(e.to_ass_line())
        return "\n".join(lines)

    def build(self) -> str:
        """Return the full ASS file contents as a string."""
        sections = [
            self._build_script_info(),
            self._build_styles(),
            self._build_events(),
        ]
        return "\n\n".join(sections) + "\n"

    def write(self, path: Path) -> None:
        """Write the ASS file to disk."""
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.build(), encoding="utf-8")
        log.info("subtitle.wrote", path=str(path), events=len(self._events))


# ─── SRT → ASS event parser ───────────────────────────────────────────────────

def _srt_time_to_ms(time_str: str) -> int:
    """Convert SRT timestamp (HH:MM:SS,mmm) to milliseconds."""
    h, m, rest = time_str.split(":")
    s, ms = rest.split(",")
    return int(h) * 3600000 + int(m) * 60000 + int(s) * 1000 + int(ms)


def parse_srt(srt_content: str) -> list[SubtitleEvent]:
    """Parse SRT subtitle content into a list of SubtitleEvents."""
    events: list[SubtitleEvent] = []
    blocks = re.split(r"\n\n+", srt_content.strip())
    for block in blocks:
        lines_in_block = block.strip().splitlines()
        if len(lines_in_block) < 3:
            continue
        # Line 0: sequence number (ignored)
        # Line 1: timestamps
        # Lines 2+: text
        try:
            start_str, _, end_str = lines_in_block[1].partition(" --> ")
            start_ms = _srt_time_to_ms(start_str.strip())
            end_ms = _srt_time_to_ms(end_str.strip())
            text = " ".join(lines_in_block[2:]).replace("\n", "\\N")
            events.append(SubtitleEvent(start_ms=start_ms, end_ms=end_ms, text=text))
        except (ValueError, IndexError):
            log.warning("subtitle.parse_srt.skip_block", block=block[:80])
    return events


def srt_to_ass(
    srt_content: str,
    output_path: Path,
    canvas_width: int,
    canvas_height: int,
    subtitle_settings: SubtitleSettings,
) -> None:
    """Convert SRT subtitle content to an ASS file."""
    events = parse_srt(srt_content)
    builder = ASSBuilder(canvas_width, canvas_height, subtitle_settings)
    builder.add_events(events)
    builder.write(output_path)
    log.info(
        "subtitle.srt_to_ass",
        events=len(events),
        output=str(output_path),
    )


def generate_placeholder_ass(
    output_path: Path,
    canvas_width: int,
    canvas_height: int,
    subtitle_settings: SubtitleSettings,
) -> None:
    """Write an empty (no events) ASS file for use when subtitles are disabled."""
    builder = ASSBuilder(canvas_width, canvas_height, subtitle_settings)
    builder.write(output_path)
