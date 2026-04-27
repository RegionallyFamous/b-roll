#!/usr/bin/env python3
"""Regenerate one ODD icon set as iOS-style app icons.

Usage:
    python3 _tools/regen-icon-set.py <slug>       # regenerate one set
    python3 _tools/regen-icon-set.py --all        # regenerate all 17 sets
    python3 _tools/regen-icon-set.py --print-prompt <slug>
                                                   # print the LLM brief for a set

The default (deterministic) path renders 13 SVGs using a glyph library
and a per-set theme profile distilled from each set's manifest.json.
The glyphs were AI-authored once (the iOS app icon style decisions
live in the `GLYPHS` and `THEMES` tables below) so rerunning produces
byte-identical output.

The `--print-prompt` mode emits the LLM brief + per-set fill for
piping to a code-authoring LLM when you want a fresh design pass.

Every generated SVG goes through the same hard validator the catalog
build uses. A failing icon blocks the whole set so a bad generation
can never land on disk.

Canvas + shape spec lives in `_tools/icon-style-guide.md`. The
squircle clipPath is baked into `_tools/icon-sets/_base.svg.tmpl`.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SETS_DIR = HERE / "catalog-sources" / "icon-sets"
TEMPLATES_DIR = HERE / "icon-sets"
BASE_TEMPLATE = TEMPLATES_DIR / "_base.svg.tmpl"
PROMPT_TEMPLATE = TEMPLATES_DIR / "__prompt__.md"

# The squircle path is the contract. Every SVG must contain it verbatim.
SQUIRCLE_PATH = (
    "M 350.06 0 L 673.94 0 C 774.74 0 825.13 0 879.39 17.15 "
    "L 879.39 17.15 C 938.62 38.71 985.29 85.38 1006.85 144.61 "
    "C 1024 198.87 1024 249.26 1024 350.06 L 1024 673.94 "
    "C 1024 774.74 1024 825.13 1006.85 879.39 L 1006.85 879.39 "
    "C 985.29 938.62 938.62 985.29 879.39 1006.85 "
    "C 825.13 1024 774.74 1024 673.94 1024 L 350.06 1024 "
    "C 249.26 1024 198.87 1024 144.61 1006.85 L 144.61 1006.85 "
    "C 85.38 985.29 38.71 938.62 17.15 879.39 "
    "C 0 825.13 0 774.74 0 673.94 L 0 350.06 "
    "C 0 249.26 0 198.87 17.15 144.61 L 17.15 144.61 "
    "C 38.71 85.38 85.38 38.71 144.61 17.15 "
    "C 198.87 0 249.26 0 350.06 0 Z"
)

ICON_KEYS = [
    "dashboard", "posts", "pages", "media", "comments",
    "appearance", "plugins", "users", "tools", "settings",
    "profile", "links", "fallback",
]

# Subject safe rect: 824×824 centered on the 1024 canvas, so x/y ∈ [100, 924].
SAFE_X0 = 100
SAFE_Y0 = 100
SAFE_SIZE = 824
# Most glyphs are composed inside a slightly inset 660×660 "subject" box
# centered on (512, 512). This leaves iOS-like breathing room and keeps
# strokes safely inside the squircle at 64 px dock size.
SUBJ_SIZE = 660
SUBJ_X0 = 512 - SUBJ_SIZE // 2  # 182
SUBJ_Y0 = 512 - SUBJ_SIZE // 2  # 182


# ------------------------------------------------------------------ #
# Glyph library — one function per WP-Desktop role.
#
# Each returns a block of SVG markup rendered in the 1024 coordinate
# space, using the theme's subject/stroke palette. Shapes are bold,
# full-bleed within the subject box, no thin strokes — designed to
# stay legible at the 64 px dock tile.
# ------------------------------------------------------------------ #


def _subject_palette(theme):
    """Return (primary_fill, secondary_fill, stroke) for subject glyphs."""
    return theme["subject"], theme.get("accent", theme["subject"]), theme.get("stroke", theme["subject"])


def glyph_dashboard(theme):
    # 2×2 grid of rounded tiles (classic "blocks" metaphor).
    p, s, _ = _subject_palette(theme)
    # Tile coords within the 660×660 subject box.
    g = 36  # gap
    tile = (SUBJ_SIZE - g) // 2  # ≈ 312
    x0 = SUBJ_X0
    y0 = SUBJ_Y0
    rx = 60
    return (
        f'<rect x="{x0}" y="{y0}" width="{tile}" height="{tile}" rx="{rx}" fill="{p}"/>'
        f'<rect x="{x0 + tile + g}" y="{y0}" width="{tile}" height="{tile}" rx="{rx}" fill="{s}"/>'
        f'<rect x="{x0}" y="{y0 + tile + g}" width="{tile}" height="{tile}" rx="{rx}" fill="{s}"/>'
        f'<rect x="{x0 + tile + g}" y="{y0 + tile + g}" width="{tile}" height="{tile}" rx="{rx}" fill="{p}"/>'
    )


def glyph_posts(theme):
    # Stacked horizontal lines on a page.
    p, s, st = _subject_palette(theme)
    x0, y0 = SUBJ_X0 + 40, SUBJ_Y0
    w, h = SUBJ_SIZE - 80, SUBJ_SIZE
    parts = [f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="56" fill="{p}"/>']
    bar_x = x0 + 60
    bar_w_full = w - 120
    rows = [
        (y0 + 120, bar_w_full),
        (y0 + 220, bar_w_full - 40),
        (y0 + 320, bar_w_full),
        (y0 + 420, bar_w_full - 80),
        (y0 + 520, bar_w_full - 20),
    ]
    for by, bw in rows:
        parts.append(
            f'<rect x="{bar_x}" y="{by}" width="{bw}" height="42" rx="21" fill="{s}"/>'
        )
    return "".join(parts)


def glyph_pages(theme):
    # Page with folded top-right corner.
    p, s, _ = _subject_palette(theme)
    x0, y0 = SUBJ_X0 + 50, SUBJ_Y0
    w, h = SUBJ_SIZE - 100, SUBJ_SIZE
    fold = 140
    # Main page path (rect with a diagonal cut top-right).
    page = (
        f"M {x0 + 60} {y0} "
        f"L {x0 + w - fold} {y0} "
        f"L {x0 + w} {y0 + fold} "
        f"L {x0 + w} {y0 + h - 60} "
        f"Q {x0 + w} {y0 + h} {x0 + w - 60} {y0 + h} "
        f"L {x0 + 60} {y0 + h} "
        f"Q {x0} {y0 + h} {x0} {y0 + h - 60} "
        f"L {x0} {y0 + 60} "
        f"Q {x0} {y0} {x0 + 60} {y0} Z"
    )
    fold_path = (
        f"M {x0 + w - fold} {y0} "
        f"L {x0 + w} {y0 + fold} "
        f"L {x0 + w - fold} {y0 + fold} Z"
    )
    bar_x = x0 + 70
    bar_w = w - 140
    bars = []
    for i, dy in enumerate((180, 280, 380, 480)):
        bw = bar_w if i != 3 else bar_w - 90
        bars.append(
            f'<rect x="{bar_x}" y="{y0 + dy}" width="{bw}" height="36" rx="18" fill="{s}"/>'
        )
    return (
        f'<path d="{page}" fill="{p}"/>'
        f'<path d="{fold_path}" fill="{s}" fill-opacity="0.55"/>'
        + "".join(bars)
    )


def glyph_media(theme):
    # Picture frame: mountain + sun.
    p, s, _ = _subject_palette(theme)
    x0, y0 = SUBJ_X0, SUBJ_Y0 + 60
    w, h = SUBJ_SIZE, SUBJ_SIZE - 120
    # Frame.
    frame = f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="64" fill="{p}"/>'
    # Inside background.
    inner_pad = 28
    inner = (
        f'<rect x="{x0 + inner_pad}" y="{y0 + inner_pad}" '
        f'width="{w - inner_pad * 2}" height="{h - inner_pad * 2}" '
        f'rx="40" fill="{s}" fill-opacity="0.28"/>'
    )
    # Sun.
    sun_cx = x0 + w - 170
    sun_cy = y0 + 150
    sun = f'<circle cx="{sun_cx}" cy="{sun_cy}" r="50" fill="{s}"/>'
    # Mountain silhouette (two peaks).
    base_y = y0 + h - inner_pad
    peak1_x = x0 + 200
    peak1_y = y0 + 260
    peak2_x = x0 + w - 260
    peak2_y = y0 + 320
    mid_x = x0 + w // 2 + 20
    mid_y = y0 + 380
    mountain = (
        f'<path d="M {x0 + inner_pad} {base_y} '
        f"L {peak1_x} {peak1_y} "
        f"L {mid_x} {mid_y} "
        f"L {peak2_x} {peak2_y} "
        f"L {x0 + w - inner_pad} {base_y} Z\" "
        f'fill="{s}"/>'
    )
    return frame + inner + sun + mountain


def glyph_comments(theme):
    # Speech bubble with tail at bottom-left.
    p, s, _ = _subject_palette(theme)
    x0, y0 = SUBJ_X0, SUBJ_Y0 + 40
    w, h = SUBJ_SIZE, SUBJ_SIZE - 180
    bubble = (
        f"M {x0 + 80} {y0} "
        f"L {x0 + w - 80} {y0} "
        f"Q {x0 + w} {y0} {x0 + w} {y0 + 80} "
        f"L {x0 + w} {y0 + h - 80} "
        f"Q {x0 + w} {y0 + h} {x0 + w - 80} {y0 + h} "
        f"L {x0 + 240} {y0 + h} "
        f"L {x0 + 160} {y0 + h + 120} "
        f"L {x0 + 200} {y0 + h} "
        f"L {x0 + 80} {y0 + h} "
        f"Q {x0} {y0 + h} {x0} {y0 + h - 80} "
        f"L {x0} {y0 + 80} "
        f"Q {x0} {y0} {x0 + 80} {y0} Z"
    )
    dots_y = y0 + h // 2 - 20
    dx = x0 + w // 2
    dots = (
        f'<circle cx="{dx - 120}" cy="{dots_y}" r="32" fill="{s}"/>'
        f'<circle cx="{dx}" cy="{dots_y}" r="32" fill="{s}"/>'
        f'<circle cx="{dx + 120}" cy="{dots_y}" r="32" fill="{s}"/>'
    )
    return f'<path d="{bubble}" fill="{p}"/>' + dots


def glyph_appearance(theme):
    # Paint brush angled from bottom-left to top-right.
    p, s, _ = _subject_palette(theme)
    # Brush ferrule + handle + tip angled across subject.
    handle = (
        f"M {SUBJ_X0 + 80} {SUBJ_Y0 + SUBJ_SIZE - 80} "
        f"L {SUBJ_X0 + 380} {SUBJ_Y0 + 220} "
        f"L {SUBJ_X0 + 510} {SUBJ_Y0 + 350} "
        f"L {SUBJ_X0 + 210} {SUBJ_Y0 + SUBJ_SIZE + 50} Z"
    )
    ferrule = (
        f"M {SUBJ_X0 + 380} {SUBJ_Y0 + 220} "
        f"L {SUBJ_X0 + 490} {SUBJ_Y0 + 110} "
        f"L {SUBJ_X0 + 620} {SUBJ_Y0 + 240} "
        f"L {SUBJ_X0 + 510} {SUBJ_Y0 + 350} Z"
    )
    tip = (
        f"M {SUBJ_X0 + 490} {SUBJ_Y0 + 110} "
        f"L {SUBJ_X0 + 640} {SUBJ_Y0 - 40} "
        f"L {SUBJ_X0 + 760} {SUBJ_Y0 + 80} "
        f"L {SUBJ_X0 + 620} {SUBJ_Y0 + 240} Z"
    )
    splash = (
        f'<circle cx="{SUBJ_X0 + 150}" cy="{SUBJ_Y0 + 120}" r="26" fill="{s}"/>'
        f'<circle cx="{SUBJ_X0 + 230}" cy="{SUBJ_Y0 + 60}" r="18" fill="{s}"/>'
    )
    return (
        f'<path d="{handle}" fill="{p}"/>'
        f'<path d="{ferrule}" fill="{s}"/>'
        f'<path d="{tip}" fill="{p}"/>'
        + splash
    )


def glyph_plugins(theme):
    # Electrical plug: head + 2 prongs + cord coming out the bottom.
    p, s, _ = _subject_palette(theme)
    cx = 512
    head_w = 360
    head_h = 340
    hx = cx - head_w // 2
    hy = SUBJ_Y0 + 140
    parts = []
    # Prongs.
    prong_w = 44
    prong_h = 120
    parts.append(
        f'<rect x="{cx - 90 - prong_w // 2}" y="{hy - prong_h}" '
        f'width="{prong_w}" height="{prong_h}" rx="18" fill="{s}"/>'
    )
    parts.append(
        f'<rect x="{cx + 90 - prong_w // 2}" y="{hy - prong_h}" '
        f'width="{prong_w}" height="{prong_h}" rx="18" fill="{s}"/>'
    )
    # Head.
    parts.append(
        f'<rect x="{hx}" y="{hy}" width="{head_w}" height="{head_h}" rx="72" fill="{p}"/>'
    )
    # Cord.
    cord_top = hy + head_h
    parts.append(
        f'<path d="M {cx} {cord_top} '
        f"Q {cx + 140} {cord_top + 120} {cx} {cord_top + 240}\" "
        f'fill="none" stroke="{p}" stroke-width="54" stroke-linecap="round"/>'
    )
    return "".join(parts)


def glyph_users(theme):
    # Two overlapping head+shoulders silhouettes.
    p, s, _ = _subject_palette(theme)
    cx1, cx2 = 440, 584
    head_cy = SUBJ_Y0 + 200
    head_r = 90
    # Back user (slightly smaller, behind).
    parts = [
        f'<circle cx="{cx2 + 40}" cy="{head_cy - 10}" r="{head_r - 8}" fill="{s}"/>',
        f'<path d="M {cx2 - 40} {SUBJ_Y0 + SUBJ_SIZE - 20} '
        f"Q {cx2 - 40} {head_cy + 100} {cx2 + 40} {head_cy + 100} "
        f"Q {cx2 + 190} {head_cy + 100} {cx2 + 190} {SUBJ_Y0 + SUBJ_SIZE - 20} Z\" "
        f'fill="{s}"/>',
    ]
    # Front user.
    parts.append(
        f'<circle cx="{cx1}" cy="{head_cy}" r="{head_r}" fill="{p}"/>'
    )
    parts.append(
        f'<path d="M {cx1 - 180} {SUBJ_Y0 + SUBJ_SIZE + 20} '
        f"Q {cx1 - 180} {head_cy + 120} {cx1} {head_cy + 120} "
        f"Q {cx1 + 180} {head_cy + 120} {cx1 + 180} {SUBJ_Y0 + SUBJ_SIZE + 20} Z\" "
        f'fill="{p}"/>'
    )
    return "".join(parts)


def glyph_tools(theme):
    # Wrench: open head top-right, diagonal handle, rounded tail bottom-left.
    p, s, _ = _subject_palette(theme)
    # Handle: a thick diagonal rounded rectangle via path.
    handle = (
        f"M {SUBJ_X0 + 140} {SUBJ_Y0 + SUBJ_SIZE - 140} "
        f"L {SUBJ_X0 + 440} {SUBJ_Y0 + 240} "
        f"L {SUBJ_X0 + 560} {SUBJ_Y0 + 360} "
        f"L {SUBJ_X0 + 260} {SUBJ_Y0 + SUBJ_SIZE - 20} "
        f"Q {SUBJ_X0 + 140} {SUBJ_Y0 + SUBJ_SIZE + 100} "
        f"{SUBJ_X0 + 40} {SUBJ_Y0 + SUBJ_SIZE - 80} "
        f"Q {SUBJ_X0 - 20} {SUBJ_Y0 + SUBJ_SIZE - 260} "
        f"{SUBJ_X0 + 140} {SUBJ_Y0 + SUBJ_SIZE - 140} Z"
    )
    # Open wrench head top-right.
    head = (
        f"M {SUBJ_X0 + 440} {SUBJ_Y0 + 240} "
        f"L {SUBJ_X0 + 560} {SUBJ_Y0 + 120} "
        f"L {SUBJ_X0 + 660} {SUBJ_Y0 + 120} "
        f"L {SUBJ_X0 + 760} {SUBJ_Y0 + 220} "
        f"L {SUBJ_X0 + 640} {SUBJ_Y0 + 340} "
        f"L {SUBJ_X0 + 560} {SUBJ_Y0 + 360} Z"
    )
    # Bite (negative space in the head) — same colour as background-ish,
    # but we can't know the bg colour from here, so draw it as a small
    # circle in the secondary colour to read as depth.
    bite = f'<circle cx="{SUBJ_X0 + 610}" cy="{SUBJ_Y0 + 230}" r="36" fill="{s}"/>'
    return (
        f'<path d="{handle}" fill="{p}"/>'
        f'<path d="{head}" fill="{p}"/>'
        + bite
    )


def glyph_settings(theme):
    # Gear: 8-tooth rosette + center hole.
    p, s, _ = _subject_palette(theme)
    cx, cy = 512, 512
    import math
    r_in = 180   # gear body radius
    r_out = 260  # tooth tip radius
    teeth = 8
    tooth_w = 0.18  # fraction of half-period
    # Build gear path by walking angles.
    half = math.pi / teeth
    d = []
    for i in range(teeth):
        a0 = i * 2 * half - half
        a1 = a0 + half * (1 - tooth_w)
        a2 = a0 + half * (1 + tooth_w)
        a3 = a0 + 2 * half
        # inner → tooth rise
        for (ang, rr) in ((a0, r_in), (a1, r_in), (a1, r_out),
                          (a2, r_out), (a2, r_in), (a3, r_in)):
            x = cx + rr * math.cos(ang)
            y = cy + rr * math.sin(ang)
            d.append(f"{'M' if not d else 'L'} {x:.2f} {y:.2f}")
    gear = f'<path d="{" ".join(d)} Z" fill="{p}"/>'
    hole = f'<circle cx="{cx}" cy="{cy}" r="82" fill="{s}"/>'
    return gear + hole


def glyph_profile(theme):
    # Single head+shoulders inside a rounded frame.
    p, s, _ = _subject_palette(theme)
    cx, cy = 512, 520
    frame_r = 280
    parts = [
        f'<circle cx="{cx}" cy="{cy}" r="{frame_r}" fill="{p}"/>'
    ]
    # Head.
    parts.append(
        f'<circle cx="{cx}" cy="{cy - 80}" r="100" fill="{s}"/>'
    )
    # Shoulders (chip of a circle clipped by the frame circle).
    parts.append(
        f'<path d="M {cx - 180} {cy + frame_r} '
        f"Q {cx - 180} {cy + 80} {cx} {cy + 80} "
        f"Q {cx + 180} {cy + 80} {cx + 180} {cy + frame_r} Z\" "
        f'fill="{s}"/>'
    )
    return "".join(parts)


def glyph_links(theme):
    # Two interlocking rounded-rectangle link loops at ~30°.
    p, s, _ = _subject_palette(theme)
    # We build each link as two concentric rounded rects using a
    # fill-rule="evenodd" path, rotated, translated.
    def link_path(angle_deg, tx, ty, colour):
        # Build path with outer + inner rects for the ring.
        outer = (
            "M -200 -100 "
            "Q -260 -100 -260 -40 "
            "L -260 40 "
            "Q -260 100 -200 100 "
            "L 200 100 "
            "Q 260 100 260 40 "
            "L 260 -40 "
            "Q 260 -100 200 -100 Z"
        )
        inner = (
            "M -200 -40 "
            "Q -200 -40 -200 -40 "  # (kept as-is; rings are drawn separately)
            "Z"
        )
        # Simpler: two concentric rounded rects via two <rect> overlays.
        return (
            f'<g transform="translate({tx} {ty}) rotate({angle_deg})">'
            f'<rect x="-260" y="-100" width="520" height="200" rx="100" fill="{colour}"/>'
            f'<rect x="-200" y="-40" width="400" height="80" rx="40" fill="#0000"/>'
            f"</g>"
        )
    # We can't use "#0000" reliably across renderers; punch holes via mask
    # instead by layering with the background colour. Simpler: draw each
    # link as a stroked rounded rect so the middle stays empty.
    stroke_w = 64
    parts = []
    for angle, tx, ty, colour in (
        (-20, 430, 520, p),
        (20, 620, 480, s),
    ):
        parts.append(
            f'<g transform="translate({tx} {ty}) rotate({angle})">'
            f'<rect x="-220" y="-90" width="440" height="180" rx="90" '
            f'fill="none" stroke="{colour}" stroke-width="{stroke_w}"/>'
            f"</g>"
        )
    return "".join(parts)


def glyph_fallback(theme):
    # Three concentric pulses.
    p, s, _ = _subject_palette(theme)
    cx, cy = 512, 512
    return (
        f'<circle cx="{cx}" cy="{cy}" r="260" fill="none" stroke="{s}" stroke-width="32" opacity="0.45"/>'
        f'<circle cx="{cx}" cy="{cy}" r="180" fill="none" stroke="{s}" stroke-width="40" opacity="0.7"/>'
        f'<circle cx="{cx}" cy="{cy}" r="80" fill="{p}"/>'
    )


GLYPHS = {
    "dashboard":  glyph_dashboard,
    "posts":      glyph_posts,
    "pages":      glyph_pages,
    "media":      glyph_media,
    "comments":   glyph_comments,
    "appearance": glyph_appearance,
    "plugins":    glyph_plugins,
    "users":      glyph_users,
    "tools":      glyph_tools,
    "settings":   glyph_settings,
    "profile":    glyph_profile,
    "links":      glyph_links,
    "fallback":   glyph_fallback,
}


# ------------------------------------------------------------------ #
# Per-set themes.
#
# Each theme describes:
#   bg        list of linearGradient stops (2) for the background, OR a
#             single solid colour string.
#   bg_dir    "v" (top-to-bottom) or "d" (top-left to bottom-right).
#   subject   fill for the primary subject shape.
#   accent    fill for secondary subject accents.
#   stroke    stroke colour when a glyph uses stroke-only shapes (links).
#   specular  True/False — whether to render a Liquid Glass highlight.
#
# Palettes are derived from each set's manifest description. The
# background always covers the full 1024² rect; the subject always
# draws inside the 824×824 safe rect via the GLYPHS functions.
# ------------------------------------------------------------------ #


THEMES = {
    "arcade-tokens": {
        "bg": ["#f7d08a", "#8c5518"],  "bg_dir": "v",
        "subject": "#fff0b8", "accent": "#b07a2a", "stroke": "#fff0b8",
        "specular": True,
    },
    "arctic": {
        "bg": ["#cff0ff", "#3a7fb8"],  "bg_dir": "v",
        "subject": "#ffffff", "accent": "#0e3b5a", "stroke": "#ffffff",
        "specular": True,
    },
    "blueprint": {
        "bg": ["#0f3a66", "#072138"],  "bg_dir": "v",
        "subject": "#7ec8ff", "accent": "#f0c96a", "stroke": "#7ec8ff",
        "specular": False,
    },
    "botanical-plate": {
        "bg": ["#f2ecd4", "#d4c88a"],  "bg_dir": "v",
        "subject": "#2d3a22", "accent": "#6a8f3b", "stroke": "#2d3a22",
        "specular": False,
    },
    "brutalist-stencil": {
        "bg": ["#ffeb4a", "#ff5f4f"],  "bg_dir": "d",
        "subject": "#111111", "accent": "#ffffff", "stroke": "#111111",
        "specular": False,
    },
    "circuit-bend": {
        "bg": ["#0f3f24", "#04180e"],  "bg_dir": "v",
        "subject": "#f4c24c", "accent": "#e04a3b", "stroke": "#f4c24c",
        "specular": False,
    },
    "claymation": {
        "bg": ["#ffd87a", "#ff8a3a"],  "bg_dir": "v",
        "subject": "#ffffff", "accent": "#b14a1a", "stroke": "#ffffff",
        "specular": True,
    },
    "cross-stitch": {
        "bg": ["#f6e6d4", "#d9c2a4"],  "bg_dir": "v",
        "subject": "#e87ca7", "accent": "#4a4a6a", "stroke": "#e87ca7",
        "specular": False,
    },
    "eyeball-avenue": {
        "bg": ["#2a0a55", "#8a2dd4"],  "bg_dir": "v",
        "subject": "#ffffff", "accent": "#ff4fa8", "stroke": "#ffffff",
        "specular": True,
    },
    "filament": {
        "bg": ["#181022", "#050308"],  "bg_dir": "v",
        "subject": "#ffb000", "accent": "#ffe7a6", "stroke": "#ffb000",
        "specular": True,
    },
    "fold": {
        "bg": ["#eee6ff", "#9d7cff"],  "bg_dir": "v",
        "subject": "#ffffff", "accent": "#4a2c9c", "stroke": "#ffffff",
        "specular": True,
    },
    "hologram": {
        "bg": ["#cbe6ff", "#ffd1f5"],  "bg_dir": "d",
        "subject": "#5a7ea8", "accent": "#d4a4e0", "stroke": "#5a7ea8",
        "specular": True,
    },
    "lemonade-stand": {
        "bg": ["#ffef7a", "#ffb43a"],  "bg_dir": "v",
        "subject": "#7a3a0f", "accent": "#e84a2a", "stroke": "#7a3a0f",
        "specular": False,
    },
    "monoline": {
        "bg": ["#14d6ff", "#4a5cff"],  "bg_dir": "d",
        "subject": "#ffffff", "accent": "#001f3f", "stroke": "#ffffff",
        "specular": True,
    },
    "risograph": {
        "bg": "#f4ecd8", "bg_dir": "v",
        "subject": "#ff4fa8", "accent": "#14a6cc", "stroke": "#ff4fa8",
        "specular": False,
    },
    "stadium": {
        "bg": ["#a62632", "#6a0b13"],  "bg_dir": "v",
        "subject": "#ffd86a", "accent": "#ffffff", "stroke": "#ffd86a",
        "specular": False,
    },
    "tiki": {
        "bg": ["#8a5a2a", "#3a1f0e"],  "bg_dir": "v",
        "subject": "#f6dfb4", "accent": "#c47a3c", "stroke": "#f6dfb4",
        "specular": True,
    },
}


# ------------------------------------------------------------------ #
# SVG rendering.
# ------------------------------------------------------------------ #


CLIPPATH_BLOCK = (
    f'<clipPath id="sq"><path d="{SQUIRCLE_PATH}"/></clipPath>'
)


def _background_defs(theme, uid):
    bg = theme["bg"]
    if isinstance(bg, str):
        return "", f'<rect x="0" y="0" width="1024" height="1024" fill="{bg}"/>'
    a, b = bg
    if theme.get("bg_dir") == "d":
        coords = 'x1="0" y1="0" x2="1" y2="1"'
    else:
        coords = 'x1="0" y1="0" x2="0" y2="1"'
    defs = (
        f'<linearGradient id="bg{uid}" {coords}>'
        f'<stop offset="0" stop-color="{a}"/>'
        f'<stop offset="1" stop-color="{b}"/>'
        f"</linearGradient>"
    )
    rect = f'<rect x="0" y="0" width="1024" height="1024" fill="url(#bg{uid})"/>'
    return defs, rect


def _specular_defs(theme, uid):
    if not theme.get("specular"):
        return "", ""
    defs = (
        f'<radialGradient id="sp{uid}" cx="0.28" cy="0.22" r="0.55">'
        f'<stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>'
        f'<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>'
        f"</radialGradient>"
    )
    rect = (
        f'<rect x="0" y="0" width="1024" height="1024" fill="url(#sp{uid})"/>'
    )
    return defs, rect


def _drop_shadow_filter(uid):
    return (
        f'<filter id="ds{uid}" x="-10%" y="-10%" width="120%" height="120%">'
        f'<feDropShadow dx="0" dy="18" stdDeviation="14" '
        f'flood-color="#000" flood-opacity="0.22"/>'
        f"</filter>"
    )


def render_icon(slug, key, theme):
    """Return the SVG source string for one icon."""
    uid = f"{slug}-{key}"
    # Sanitize UID for use inside XML ids.
    uid = re.sub(r"[^a-zA-Z0-9]", "", uid)
    bg_defs, bg_rect = _background_defs(theme, uid)
    sp_defs, sp_rect = _specular_defs(theme, uid)
    shadow_defs = _drop_shadow_filter(uid)
    subject = GLYPHS[key](theme)
    label = key.replace("-", " ").title()
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" '
        f'width="1024" height="1024" role="img" aria-label="{label}">'
        f"<defs>{CLIPPATH_BLOCK}{bg_defs}{sp_defs}{shadow_defs}</defs>"
        f'<g clip-path="url(#sq)">'
        f"{bg_rect}"
        f'<g filter="url(#ds{uid})">{subject}</g>'
        f"{sp_rect}"
        f"</g></svg>\n"
    )
    return svg


# ------------------------------------------------------------------ #
# Validator.
# ------------------------------------------------------------------ #


SAFE_PAT = re.compile(rb"[^\t\n\r\x20-\x7e\x80-\xff]")


def validate_svg(slug, key, svg):
    """Raise on any rule the build-catalog validator will reject."""
    if len(svg.encode("utf-8")) > 10240:
        raise ValueError(f"{slug}/{key}: SVG exceeds 10240 bytes")
    if SAFE_PAT.search(svg.encode("utf-8")):
        raise ValueError(f"{slug}/{key}: SVG contains control bytes")
    if SQUIRCLE_PATH not in svg:
        raise ValueError(f"{slug}/{key}: missing canonical squircle path")
    if 'clip-path="url(#sq)"' not in svg:
        raise ValueError(f"{slug}/{key}: missing clip-path=url(#sq) on main group")
    if '<image' in svg or '<script' in svg or '<foreignObject' in svg:
        raise ValueError(f"{slug}/{key}: forbidden tag (image/script/foreignObject)")
    try:
        root = ET.fromstring(svg)
    except ET.ParseError as exc:
        raise ValueError(f"{slug}/{key}: invalid XML: {exc}")
    if root.tag != "{http://www.w3.org/2000/svg}svg":
        raise ValueError(f"{slug}/{key}: root is not <svg>")
    vb = root.attrib.get("viewBox", "").strip()
    if vb != "0 0 1024 1024":
        raise ValueError(f"{slug}/{key}: viewBox must be 0 0 1024 1024, got {vb!r}")


# ------------------------------------------------------------------ #
# Regen entrypoints.
# ------------------------------------------------------------------ #


def regen_set(slug):
    set_dir = SETS_DIR / slug
    manifest_path = set_dir / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"no manifest.json at {manifest_path}")
    manifest = json.loads(manifest_path.read_text())
    if slug not in THEMES:
        raise SystemExit(f"no theme profile for set {slug!r} in THEMES")
    theme = THEMES[slug]

    written = []
    for key in ICON_KEYS:
        svg = render_icon(slug, key, theme)
        validate_svg(slug, key, svg)
        out_name = manifest["icons"][key]
        (set_dir / out_name).write_text(svg)
        written.append(out_name)
    print(f"{slug}: wrote {len(written)} icons ({manifest['label']})")


def build_prompt_for_set(slug):
    set_dir = SETS_DIR / slug
    manifest = json.loads((set_dir / "manifest.json").read_text())
    brief = PROMPT_TEMPLATE.read_text()
    fill = (
        f"\n\n## Set fill\n\n"
        f"SET_SLUG:      {manifest['slug']}\n"
        f"SET_LABEL:     {manifest['label']}\n"
        f"SET_FRANCHISE: {manifest['franchise']}\n"
        f"ACCENT:        {manifest['accent']}\n"
        f"DESCRIPTION:   {manifest['description']}\n"
    )
    return brief + fill


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--all", action="store_true", help="regenerate every set")
    ap.add_argument("--print-prompt", action="store_true",
                    help="print the LLM brief for the given slug and exit")
    args = ap.parse_args()

    if args.print_prompt:
        if not args.slug:
            raise SystemExit("--print-prompt needs a slug")
        sys.stdout.write(build_prompt_for_set(args.slug))
        return

    if args.all:
        slugs = sorted(p.name for p in SETS_DIR.iterdir() if p.is_dir())
    elif args.slug:
        slugs = [args.slug]
    else:
        raise SystemExit("usage: regen-icon-set.py <slug> | --all")

    for slug in slugs:
        regen_set(slug)


if __name__ == "__main__":
    main()
