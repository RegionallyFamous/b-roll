#!/usr/bin/env python3
"""Regenerate ODD icon sets as iOS-style app icons.

Each of the 17 sets is authored by its own render function so the sets
read as genuinely different visual languages, not one glyph system
under 17 palettes. Same 13 metaphors (dashboard = 2x2 blocks, settings
= gear, etc. — see _tools/gen-icon-sets.py SYMBOLS for the archetypes)
but the subject treatment, background texture, stroke vocabulary, and
decorative overlay are each their own thing.

Usage:
    python3 _tools/regen-icon-set.py <slug>
    python3 _tools/regen-icon-set.py --all
    python3 _tools/regen-icon-set.py --print-prompt <slug>

The `--print-prompt` mode emits the LLM brief + per-set fill for
piping to a code-authoring LLM when you want a fresh design pass.

Every generated SVG is run through the catalog validator (viewBox,
squircle clipPath, <=10 KB, no control bytes, no <image>/<script>).
A failing icon blocks the whole set so bad output can't land.

Canvas + shape spec lives in `_tools/icon-style-guide.md`. The
squircle clipPath is baked into `_tools/icon-sets/_base.svg.tmpl`.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SETS_DIR = HERE / "catalog-sources" / "icon-sets"
TEMPLATES_DIR = HERE / "icon-sets"
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

SQ_DEFS = f'<clipPath id="sq"><path d="{SQUIRCLE_PATH}"/></clipPath>'

ICON_KEYS = [
    "dashboard", "posts", "pages", "media", "comments",
    "appearance", "plugins", "users", "tools", "settings",
    "profile", "links", "fallback",
]


# ------------------------------------------------------------------ #
# Metaphor geometry.
#
# Each metaphor returns a dict of named keypoints + shape paths so
# the 17 pens can render the same silhouette in their own visual
# language. Coordinates are in the 1024^2 canvas. Meaningful
# subject content stays inside the 824^2 safe rect (x,y ∈ [100,924]).
# ------------------------------------------------------------------ #


def _bubble_path(x, y, w, h, tail=(322, 732, 262, 852, 362, 732)):
    tx1, ty1, tx2, ty2, tx3, ty3 = tail
    return (
        f"M {x + 80} {y} "
        f"L {x + w - 80} {y} "
        f"Q {x + w} {y} {x + w} {y + 80} "
        f"L {x + w} {y + h - 80} "
        f"Q {x + w} {y + h} {x + w - 80} {y + h} "
        f"L {tx1} {ty1} L {tx2} {ty2} L {tx3} {ty3} "
        f"L {x + 80} {y + h} "
        f"Q {x} {y + h} {x} {y + h - 80} "
        f"L {x} {y + 80} "
        f"Q {x} {y} {x + 80} {y} Z"
    )


def _gear_path(cx, cy, ri, ro, teeth=8, tooth_w=0.18):
    half = math.pi / teeth
    parts = []
    for i in range(teeth):
        a0 = i * 2 * half - half
        a1 = a0 + half * (1 - tooth_w)
        a2 = a0 + half * (1 + tooth_w)
        a3 = a0 + 2 * half
        for ang, rr in (
            (a0, ri), (a1, ri), (a1, ro),
            (a2, ro), (a2, ri), (a3, ri),
        ):
            cmd = "M" if not parts else "L"
            x = cx + rr * math.cos(ang)
            y = cy + rr * math.sin(ang)
            parts.append(f"{cmd} {x:.2f} {y:.2f}")
    return " ".join(parts) + " Z"


def _page_fold_path(x, y, w, h, fold, rx=56):
    """Page with a diagonal top-right fold. Returns (page_d, fold_d)."""
    page = (
        f"M {x + rx} {y} "
        f"L {x + w - fold} {y} "
        f"L {x + w} {y + fold} "
        f"L {x + w} {y + h - rx} "
        f"Q {x + w} {y + h} {x + w - rx} {y + h} "
        f"L {x + rx} {y + h} "
        f"Q {x} {y + h} {x} {y + h - rx} "
        f"L {x} {y + rx} "
        f"Q {x} {y} {x + rx} {y} Z"
    )
    fold_tri = (
        f"M {x + w - fold} {y} "
        f"L {x + w} {y + fold} "
        f"L {x + w - fold} {y + fold} Z"
    )
    return page, fold_tri


def _brush_paths():
    """Dashicons-adjacent paintbrush: (handle, ferrule, bristles, highlight)."""
    # Drawn upright and rotated by the caller. This keeps the mark
    # readable at 64px while still giving each set room for its own
    # texture/color treatment.
    handle = (462, 430, 100, 350, 50)
    ferrule = (410, 306, 204, 144, 36)
    bristles = (
        "M 414 306 "
        "C 424 210 468 136 512 122 "
        "C 556 136 600 210 610 306 Z"
    )
    highlight = "M 512 170 C 490 216 480 254 478 306"
    return handle, ferrule, bristles, highlight


def _plug_rects():
    """(left_prong, right_prong, head_rect, cord_d)."""
    lp = (400, 202, 44, 120)
    rp = (580, 202, 44, 120)
    head = (332, 322, 360, 340, 72)
    cord = "M 512 662 Q 652 782 512 902"
    return lp, rp, head, cord


def _users_pair():
    """Two head+shoulders: (back_head, back_shoulders_d, front_head, front_shoulders_d)."""
    back_head = (624, 372, 82)
    back_sh = (
        "M 544 904 Q 544 472 624 472 Q 774 472 774 904 Z"
    )
    front_head = (440, 382, 92)
    front_sh = (
        "M 260 936 Q 260 484 440 484 Q 620 484 620 936 Z"
    )
    return back_head, back_sh, front_head, front_sh


def _wrench_paths():
    """Dashicons-adjacent wrench: (shaft, handle_ring, handle_hole, head, bite)."""
    shaft = (474, 344, 76, 440, 38)
    handle_ring = (512, 812, 116)
    handle_hole = (512, 812, 46)
    head = (
        "M 414 274 "
        "C 414 172 496 100 598 118 "
        "L 526 190 L 588 252 L 662 182 "
        "C 694 286 624 374 512 374 "
        "C 458 374 414 330 414 274 Z"
    )
    bite = (586, 198, 42)
    return shaft, handle_ring, handle_hole, head, bite


def _profile_paths():
    """(frame_circle, head_circle, shoulders_d)."""
    frame = (512, 520, 282)
    head = (512, 440, 96)
    shoulders = (
        "M 312 802 Q 312 560 512 560 Q 712 560 712 802 Z"
    )
    return frame, head, shoulders


def _link_rings():
    """Two interlocking rounded-rect rings at ~20 degrees."""
    # (cx, cy, w, h, rot, stroke_w)
    return (
        (420, 540, 440, 180, -20),
        (604, 480, 440, 180, 20),
    )


def _mountain_path(x, y, w, h, inset=28):
    base_y = y + h - inset
    peaks = (
        f"M {x + inset} {base_y} "
        f"L {x + 220} {y + h - 260} "
        f"L {x + w // 2 + 30} {y + h - 180} "
        f"L {x + w - 240} {y + h - 300} "
        f"L {x + w - inset} {base_y} Z"
    )
    return peaks


# ------------------------------------------------------------------ #
# Assembly.
# ------------------------------------------------------------------ #


def _svg_shell(defs: str, body: str, label: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" '
        f'width="1024" height="1024" role="img" aria-label="{label}">'
        f"<defs>{SQ_DEFS}{defs}</defs>"
        f'<g clip-path="url(#sq)">{body}</g>'
        f"</svg>\n"
    )


def _bg_linear(uid, c1, c2, direction="v"):
    coords = 'x1="0" y1="0" x2="0" y2="1"' if direction == "v" else 'x1="0" y1="0" x2="1" y2="1"'
    return (
        f'<linearGradient id="bg{uid}" {coords}>'
        f'<stop offset="0" stop-color="{c1}"/>'
        f'<stop offset="1" stop-color="{c2}"/>'
        f"</linearGradient>"
    )


def _bg_rect(uid):
    return f'<rect width="1024" height="1024" fill="url(#bg{uid})"/>'


def _specular_defs(uid, opacity=0.32):
    return (
        f'<radialGradient id="sp{uid}" cx="0.28" cy="0.22" r="0.6">'
        f'<stop offset="0" stop-color="#ffffff" stop-opacity="{opacity}"/>'
        f'<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>'
        f"</radialGradient>"
    )


def _specular_rect(uid):
    return f'<rect width="1024" height="1024" fill="url(#sp{uid})"/>'


def _uid(slug, key):
    return re.sub(r"[^a-zA-Z0-9]", "", f"{slug}{key}")


# ------------------------------------------------------------------ #
# Distinct set renderers.
#
# The first pass of the redesign reused one glyph library with different
# palettes. That made the sets feel like recolors. This pass keeps the
# same WP-Desktop metaphors but gives each set a different "pen":
# relief coin, blueprint strokes, PCB traces, cross-stitch marks,
# risograph offset plates, chenille patch stitching, carved wood, etc.
# ------------------------------------------------------------------ #


def _glyph_fill(key, primary, secondary, accent=None):
    accent = accent or secondary
    parts = []
    if key == "dashboard":
        for x, y, c in (
            (182, 182, primary), (530, 182, secondary),
            (182, 530, secondary), (530, 530, primary),
        ):
            parts.append(f'<rect x="{x}" y="{y}" width="312" height="312" rx="60" fill="{c}"/>')
    elif key == "posts":
        page, _ = _page_fold_path(252, 182, 520, 660, 0, 58)
        parts.append(f'<path d="{page}" fill="{primary}"/>')
        for i, (y, w) in enumerate(((302, 360), (402, 310), (502, 360), (602, 250), (702, 330))):
            parts.append(f'<rect x="332" y="{y}" width="{w}" height="42" rx="21" fill="{secondary}"/>')
    elif key == "pages":
        page, fold = _page_fold_path(252, 182, 520, 660, 142, 58)
        parts.append(f'<path d="{page}" fill="{primary}"/><path d="{fold}" fill="{secondary}" opacity=".62"/>')
        for i, (y, w) in enumerate(((362, 360), (462, 330), (562, 280))):
            parts.append(f'<rect x="332" y="{y}" width="{w}" height="38" rx="19" fill="{secondary}" opacity=".78"/>')
    elif key == "media":
        parts.append(f'<rect x="182" y="242" width="660" height="540" rx="68" fill="{primary}"/>')
        parts.append(f'<rect x="220" y="280" width="584" height="464" rx="44" fill="{secondary}" opacity=".30"/>')
        parts.append(f'<circle cx="664" cy="392" r="54" fill="{accent}"/>')
        parts.append(f'<path d="{_mountain_path(220, 280, 584, 464)}" fill="{secondary}"/>')
    elif key == "comments":
        parts.append(f'<path d="{_bubble_path(182, 222, 660, 510)}" fill="{primary}"/>')
        for x in (392, 512, 632):
            parts.append(f'<circle cx="{x}" cy="472" r="34" fill="{secondary}"/>')
    elif key == "appearance":
        h, f, bristles, highlight = _brush_paths()
        hx, hy, hw, hh, hr = h
        fx, fy, fw, fh, fr = f
        parts.append('<g transform="rotate(-35 512 512)">')
        parts.append(f'<rect x="{hx}" y="{hy}" width="{hw}" height="{hh}" rx="{hr}" fill="{primary}"/>')
        parts.append(f'<rect x="{fx}" y="{fy}" width="{fw}" height="{fh}" rx="{fr}" fill="{secondary}"/>')
        parts.append(f'<path d="{bristles}" fill="{primary}"/>')
        parts.append(f'<path d="{highlight}" fill="none" stroke="{accent}" stroke-width="32" stroke-linecap="round" opacity=".62"/>')
        parts.append('</g>')
    elif key == "plugins":
        lp, rp, head, cord = _plug_rects()
        for x, y, w, h in (lp, rp):
            parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{secondary}"/>')
        x, y, w, h, rx = head
        parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{primary}"/>')
        parts.append(f'<path d="{cord}" fill="none" stroke="{primary}" stroke-width="54" stroke-linecap="round"/>')
    elif key == "users":
        bh, bs, fh, fs = _users_pair()
        parts.append(f'<circle cx="{bh[0]}" cy="{bh[1]}" r="{bh[2]}" fill="{secondary}"/><path d="{bs}" fill="{secondary}"/>')
        parts.append(f'<circle cx="{fh[0]}" cy="{fh[1]}" r="{fh[2]}" fill="{primary}"/><path d="{fs}" fill="{primary}"/>')
    elif key == "tools":
        shaft, ring, hole, head, bite = _wrench_paths()
        sx, sy, sw, sh, sr = shaft
        parts.append('<g transform="rotate(38 512 512)">')
        parts.append(f'<rect x="{sx}" y="{sy}" width="{sw}" height="{sh}" rx="{sr}" fill="{primary}"/>')
        parts.append(f'<circle cx="{ring[0]}" cy="{ring[1]}" r="{ring[2]}" fill="{primary}"/>')
        parts.append(f'<circle cx="{hole[0]}" cy="{hole[1]}" r="{hole[2]}" fill="{secondary}"/>')
        parts.append(f'<path d="{head}" fill="{primary}"/>')
        parts.append(f'<circle cx="{bite[0]}" cy="{bite[1]}" r="{bite[2]}" fill="{secondary}"/>')
        parts.append('</g>')
    elif key == "settings":
        parts.append(f'<path d="{_gear_path(512, 512, 180, 260)}" fill="{primary}"/>')
        parts.append(f'<circle cx="512" cy="512" r="86" fill="{secondary}"/>')
    elif key == "profile":
        frame, head, shoulders = _profile_paths()
        parts.append(f'<circle cx="{frame[0]}" cy="{frame[1]}" r="{frame[2]}" fill="{primary}"/>')
        parts.append(f'<circle cx="{head[0]}" cy="{head[1]}" r="{head[2]}" fill="{secondary}"/><path d="{shoulders}" fill="{secondary}"/>')
    elif key == "links":
        for cx, cy, w, h, rot in _link_rings():
            c = primary if rot < 0 else secondary
            parts.append(f'<g transform="translate({cx} {cy}) rotate({rot})"><rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="{h/2}" fill="none" stroke="{c}" stroke-width="66"/></g>')
    else:
        parts.append(f'<circle cx="512" cy="512" r="260" fill="none" stroke="{secondary}" stroke-width="34" opacity=".46"/>')
        parts.append(f'<circle cx="512" cy="512" r="178" fill="none" stroke="{secondary}" stroke-width="44" opacity=".72"/>')
        parts.append(f'<circle cx="512" cy="512" r="84" fill="{primary}"/>')
    return "".join(parts)


def _glyph_stroke(key, stroke, accent, width=34, dash=None):
    dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
    body = _glyph_fill(key, "none", "none", accent if key == "appearance" else "none")
    # Convert the fill glyph into a chunky outline vocabulary. This is
    # intentionally simple and compact: inherited fill=none + stroke on
    # the wrapper turns rect/circle/path subjects into an outlined set.
    return (
        f'<g fill="none" stroke="{stroke}" stroke-width="{width}" '
        f'stroke-linecap="round" stroke-linejoin="round"{dash_attr}>{body}</g>'
        f'<circle cx="820" cy="210" r="34" fill="{accent}"/>'
    )


def _glow_filter(uid, color, opacity=".72"):
    return (
        f'<filter id="gl{uid}" x="-30%" y="-30%" width="160%" height="160%">'
        f'<feDropShadow dx="0" dy="0" stdDeviation="18" flood-color="{color}" flood-opacity="{opacity}"/>'
        f'</filter>'
    )


def _shadow_filter(uid, y=18, blur=14, opacity=".22"):
    return (
        f'<filter id="sh{uid}" x="-20%" y="-20%" width="140%" height="140%">'
        f'<feDropShadow dx="0" dy="{y}" stdDeviation="{blur}" flood-color="#000" flood-opacity="{opacity}"/>'
        f'</filter>'
    )


def _noise_dots(color, opacity=".22", step=128):
    dots = []
    for i, x in enumerate(range(96, 960, step)):
        for j, y in enumerate(range(96, 960, step)):
            r = 3 + ((i * 7 + j * 5) % 5)
            dots.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}" opacity="{opacity}"/>')
    return "".join(dots)


def _grid_lines(color, opacity=".18", step=96):
    parts = []
    for p in range(0, 1025, step):
        parts.append(f'<path d="M {p} 0 V 1024 M 0 {p} H 1024" stroke="{color}" stroke-width="4" opacity="{opacity}"/>')
    return "".join(parts)


def _stitched_x(x, y, color, size=34, width=8):
    h = size / 2
    return (
        f'<path d="M {x-h} {y-h} L {x+h} {y+h} M {x+h} {y-h} L {x-h} {y+h}" '
        f'stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>'
    )


def _cross_stitches(key, c1, c2):
    # Build each metaphor out of chunky X-stitches placed on a coarse grid.
    pts = []
    if key == "dashboard":
        for ox, oy in ((310, 310), (610, 310), (310, 610), (610, 610)):
            for dx in (-46, 0, 46):
                for dy in (-46, 0, 46):
                    pts.append((ox + dx, oy + dy))
    elif key in ("posts", "pages"):
        for y in (300, 390, 480, 570, 660):
            for x in range(340, 720, 70):
                if x < 675 or y < 620:
                    pts.append((x, y))
        if key == "pages":
            pts += [(680, 240), (735, 295), (680, 295)]
    elif key == "media":
        pts += [(650, 330), (700, 330), (675, 380)]
        pts += [(310, 670), (380, 600), (450, 670), (540, 570), (640, 670)]
    elif key == "comments":
        for x in (390, 512, 634):
            for y in (430, 500):
                pts.append((x, y))
        pts += [(350, 700), (310, 760)]
    elif key == "appearance":
        pts = [(360, 720), (430, 650), (500, 580), (570, 510), (555, 390), (515, 300), (600, 350)]
    elif key == "plugins":
        pts = [(430, 270), (590, 270), (430, 430), (512, 430), (594, 430), (512, 540), (512, 650), (512, 760)]
    elif key == "users":
        pts = [(440, 350), (610, 340), (360, 610), (440, 570), (520, 610), (625, 590), (700, 630)]
    elif key == "tools":
        pts = [(330, 730), (410, 650), (490, 570), (570, 490), (650, 410), (700, 300), (760, 250), (760, 350)]
    elif key == "settings":
        for a in range(0, 360, 45):
            rad = math.radians(a)
            pts.append((512 + 210 * math.cos(rad), 512 + 210 * math.sin(rad)))
        pts += [(512, 512)]
    elif key == "profile":
        pts = [(512, 390), (450, 590), (512, 560), (574, 590), (430, 680), (512, 700), (594, 680)]
    elif key == "links":
        pts = [(360, 520), (430, 490), (500, 515), (570, 505), (640, 475), (710, 500)]
    else:
        for r in (0, 82, 164):
            pts += [(512 + r, 512), (512 - r, 512), (512, 512 + r), (512, 512 - r)]
    return "".join(_stitched_x(x, y, c1 if i % 2 == 0 else c2) for i, (x, y) in enumerate(pts))


def _theme_shell(slug, key, label, bg_defs, bg, subject, extras="", defs_extra=""):
    uid = _uid(slug, key)
    defs = bg_defs + defs_extra
    body = bg + subject + extras
    return _svg_shell(defs, body, label)


def render_set_icon(slug, key, manifest):
    uid = _uid(slug, key)
    label = f"{manifest['label']} {key.title()}"

    if slug == "arcade-tokens":
        defs = _bg_linear(uid, "#6d3c12", "#f4c66d") + _shadow_filter(uid, 10, 10, ".35")
        bg = _bg_rect(uid) + '<circle cx="512" cy="512" r="372" fill="#b07a2a"/><circle cx="512" cy="512" r="318" fill="#f6d27d" opacity=".72"/><circle cx="512" cy="512" r="372" fill="none" stroke="#fff3bf" stroke-width="28" opacity=".6"/>'
        subject = f'<g filter="url(#sh{uid})" transform="translate(512 512) scale(.74) translate(-512 -512)">{_glyph_fill(key, "#7a4a17", "#fff1b8")}</g>'
        extras = '<circle cx="248" cy="248" r="22" fill="#fff1b8" opacity=".45"/><circle cx="776" cy="776" r="22" fill="#5b310f" opacity=".35"/>'
    elif slug == "arctic":
        defs = _bg_linear(uid, "#f4fcff", "#74bce2") + _specular_defs(uid, ".38") + _shadow_filter(uid, 18, 18, ".18")
        bg = _bg_rect(uid) + '<path d="M120 720 L900 250" stroke="#ffffff" stroke-width="38" opacity=".18"/><path d="M160 280 L820 780" stroke="#ffffff" stroke-width="24" opacity=".14"/>'
        subject = f'<g filter="url(#sh{uid})">{_glyph_fill(key, "#ffffff", "#17415d", "#7ddcff")}</g>'
        extras = _specular_rect(uid)
    elif slug == "blueprint":
        defs = _bg_linear(uid, "#0b3763", "#04182c")
        bg = _bg_rect(uid) + _grid_lines("#74d7ff", ".16", 86) + '<path d="M96 830 H928 M190 96 V928" stroke="#f0c96a" stroke-width="8" opacity=".55"/>'
        subject = _glyph_stroke(key, "#7ee4ff", "#f0c96a", 26, "12 18")
        extras = '<path d="M116 116 H252 M116 116 V252" stroke="#f0c96a" stroke-width="10" stroke-linecap="round"/>'
    elif slug == "botanical-plate":
        defs = _bg_linear(uid, "#f5edd8", "#d6c790")
        bg = _bg_rect(uid) + _noise_dots("#6a8f3b", ".10", 116)
        subject = f'<g transform="rotate(-4 512 512)">{_glyph_fill(key, "#2d3822", "#6a8f3b")}</g>'
        extras = '<path d="M166 810 C260 620 300 480 230 250" fill="none" stroke="#6a8f3b" stroke-width="18" opacity=".55"/><path d="M220 500 C315 470 350 392 348 320" fill="none" stroke="#6a8f3b" stroke-width="16" opacity=".45"/>'
    elif slug == "brutalist-stencil":
        defs = _bg_linear(uid, "#ffdf3d", "#ff5f4f", "d")
        bg = _bg_rect(uid) + '<path d="M0 816 H1024 V1024 H0 Z" fill="#111" opacity=".16"/>' + "".join(f'<path d="M{x} 0 L{x-260} 1024" stroke="#111" stroke-width="34" opacity=".10"/>' for x in range(180, 1320, 180))
        subject = f'<g transform="skewX(-6) translate(52 0)">{_glyph_fill(key, "#111111", "#ffffff")}</g>'
        extras = '<path d="M112 120 H912" stroke="#111" stroke-width="24" opacity=".22" stroke-dasharray="42 28"/>'
    elif slug == "circuit-bend":
        defs = _bg_linear(uid, "#0d4329", "#03150d") + _glow_filter(uid, "#2fb37a", ".48")
        bg = _bg_rect(uid) + _grid_lines("#2fb37a", ".12", 128)
        subject = f'<g filter="url(#gl{uid})">{_glyph_stroke(key, "#f4c24c", "#e04a3b", 28)}</g>'
        extras = ''.join(f'<circle cx="{x}" cy="{y}" r="14" fill="#e04a3b"/>' for x, y in ((210, 210), (814, 246), (240, 808), (790, 780)))
    elif slug == "claymation":
        defs = _bg_linear(uid, "#ffd77b", "#ff8a3a") + _shadow_filter(uid, 22, 18, ".26") + _specular_defs(uid, ".28")
        bg = _bg_rect(uid)
        subject = f'<g filter="url(#sh{uid})" transform="rotate(2 512 512)">{_glyph_fill(key, "#fff7e8", "#b24a1a", "#ffcf70")}</g>'
        extras = _specular_rect(uid) + _noise_dots("#ffffff", ".12", 160)
    elif slug == "cross-stitch":
        defs = _bg_linear(uid, "#f6e7d7", "#d9c1a4")
        bg = _bg_rect(uid) + _grid_lines("#8b725d", ".10", 48)
        subject = _cross_stitches(key, "#e87ca7", "#4a4a6a")
        extras = '<rect x="116" y="116" width="792" height="792" rx="92" fill="none" stroke="#8b725d" stroke-width="12" opacity=".22" stroke-dasharray="18 18"/>'
    elif slug == "eyeball-avenue":
        defs = _bg_linear(uid, "#23084d", "#8d2bdd") + _shadow_filter(uid, 14, 16, ".30") + _specular_defs(uid, ".26")
        bg = _bg_rect(uid) + '<ellipse cx="512" cy="512" rx="400" ry="284" fill="#ffffff"/><circle cx="512" cy="512" r="182" fill="#38d7ff"/><circle cx="512" cy="512" r="82" fill="#150320"/>'
        subject = f'<g filter="url(#sh{uid})" transform="translate(512 512) scale(.54) translate(-512 -512)">{_glyph_fill(key, "#ff4fa8", "#ffffff")}</g>'
        extras = _specular_rect(uid)
    elif slug == "filament":
        defs = _bg_linear(uid, "#160d22", "#040206") + _glow_filter(uid, "#ffb000", ".82") + _specular_defs(uid, ".18")
        bg = _bg_rect(uid)
        subject = f'<g filter="url(#gl{uid})">{_glyph_stroke(key, "#ffb000", "#ffe7a6", 24)}</g>'
        extras = _specular_rect(uid)
    elif slug == "fold":
        defs = _bg_linear(uid, "#eee6ff", "#9f82ff") + _shadow_filter(uid, 16, 12, ".24")
        facets = '<path d="M0 0 H1024 L620 360 Z" fill="#ffffff" opacity=".22"/><path d="M1024 1024 H0 L420 650 Z" fill="#4a2c9c" opacity=".18"/>'
        bg = _bg_rect(uid) + facets
        subject = f'<g filter="url(#sh{uid})">{_glyph_fill(key, "#ffffff", "#4a2c9c")}</g>'
        extras = '<path d="M180 220 L830 780" stroke="#ffffff" stroke-width="12" opacity=".28"/>'
    elif slug == "hologram":
        defs = _bg_linear(uid, "#c8e7ff", "#ffd1f5", "d") + _specular_defs(uid, ".40")
        bg = _bg_rect(uid) + '<path d="M86 778 L778 86 H938 V246 L246 938 H86 Z" fill="#ffffff" opacity=".22"/>'
        subject = f'<g transform="rotate(-8 512 512)">{_glyph_fill(key, "#5a7ea8", "#d45fc9", "#9fd0ff")}</g>'
        extras = _specular_rect(uid) + '<path d="M766 116 L908 116 L908 258 Z" fill="#ffffff" opacity=".62"/>'
    elif slug == "lemonade-stand":
        defs = _bg_linear(uid, "#fff174", "#ffbd38")
        gingham = ''.join(f'<rect x="{i}" y="0" width="42" height="1024" fill="#fff" opacity=".12"/><rect x="0" y="{i}" width="1024" height="42" fill="#fff" opacity=".12"/>' for i in range(0, 1024, 126))
        bg = _bg_rect(uid) + gingham
        subject = f'<g transform="rotate(-3 512 512)">{_glyph_stroke(key, "#7a3a0f", "#e84a2a", 36)}</g>'
        extras = _noise_dots("#e84a2a", ".16", 150)
    elif slug == "monoline":
        defs = _bg_linear(uid, "#14d6ff", "#4a5cff", "d") + _shadow_filter(uid, 18, 10, ".22")
        bg = _bg_rect(uid) + '<circle cx="802" cy="182" r="160" fill="#ffffff" opacity=".18"/>'
        subject = f'<g filter="url(#sh{uid})">{_glyph_stroke(key, "#ffffff", "#001f3f", 44)}</g>'
        extras = ''
    elif slug == "risograph":
        defs = _bg_linear(uid, "#f4ecd8", "#eadfca")
        bg = _bg_rect(uid) + _noise_dots("#6d5c4a", ".12", 94)
        subject = f'<g transform="translate(-16 12)" opacity=".84">{_glyph_fill(key, "#14a6cc", "#14a6cc")}</g><g transform="translate(18 -14)" opacity=".86">{_glyph_fill(key, "#ff4fa8", "#ff4fa8")}</g>'
        extras = '<rect width="1024" height="1024" fill="#f4ecd8" opacity=".10"/>'
    elif slug == "stadium":
        defs = _bg_linear(uid, "#a62632", "#610911") + _shadow_filter(uid, 12, 10, ".25")
        bg = _bg_rect(uid) + '<path d="M0 768 H1024 V1024 H0 Z" fill="#ffffff" opacity=".08"/>'
        subject = f'<g filter="url(#sh{uid})">{_glyph_fill(key, "#ffd86a", "#ffffff")}</g>'
        extras = '<rect x="116" y="116" width="792" height="792" rx="116" fill="none" stroke="#ffffff" stroke-width="18" opacity=".56" stroke-dasharray="22 22"/>'
    elif slug == "tiki":
        defs = _bg_linear(uid, "#8a5426", "#311808")
        grain = ''.join(f'<path d="M{x} 0 C{x-80} 260 {x+80} 520 {x} 1024" stroke="#f6dfb4" stroke-width="8" opacity=".10" fill="none"/>' for x in range(120, 1000, 140))
        bg = _bg_rect(uid) + grain + '<rect x="96" y="96" width="832" height="832" rx="112" fill="none" stroke="#f6dfb4" stroke-width="26" opacity=".32"/>'
        subject = f'<g>{_glyph_stroke(key, "#f6dfb4", "#c47a3c", 38, "70 22")}</g>'
        extras = ''
    else:
        defs = _bg_linear(uid, "#222", "#000")
        bg = _bg_rect(uid)
        subject = _glyph_fill(key, "#fff", "#999")
        extras = ""

    return _theme_shell(slug, key, label, defs, bg, subject, extras)


# ------------------------------------------------------------------ #
# Validation + command line.
# ------------------------------------------------------------------ #


CTRL_BYTES = re.compile(rb"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def validate_svg(slug, key, svg):
    data = svg.encode("utf-8")
    if len(data) > 10240:
        raise ValueError(f"{slug}/{key}: {len(data)} bytes exceeds 10240")
    if CTRL_BYTES.search(data):
        raise ValueError(f"{slug}/{key}: contains forbidden control bytes")
    if SQUIRCLE_PATH not in re.sub(r"\s+", " ", svg):
        raise ValueError(f"{slug}/{key}: missing canonical squircle")
    if 'clip-path="url(#sq)"' not in svg:
        raise ValueError(f"{slug}/{key}: missing clip-path wrapper")
    for tag in ("<image", "<script", "<foreignObject"):
        if tag in svg:
            raise ValueError(f"{slug}/{key}: forbidden tag {tag}")
    root = ET.fromstring(svg)
    if root.tag != "{http://www.w3.org/2000/svg}svg":
        raise ValueError(f"{slug}/{key}: root is not SVG")
    if root.attrib.get("viewBox") != "0 0 1024 1024":
        raise ValueError(f"{slug}/{key}: invalid viewBox")


def regenerate_set(slug):
    set_dir = SETS_DIR / slug
    manifest_path = set_dir / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"missing manifest: {manifest_path}")
    manifest = json.loads(manifest_path.read_text())
    for key in ICON_KEYS:
        svg = render_set_icon(slug, key, manifest)
        validate_svg(slug, key, svg)
        (set_dir / manifest["icons"][key]).write_text(svg)
    print(f"{slug}: regenerated {len(ICON_KEYS)} distinct icons")


def build_prompt(slug):
    manifest = json.loads((SETS_DIR / slug / "manifest.json").read_text())
    brief = PROMPT_TEMPLATE.read_text()
    return (
        brief
        + "\n\n## Set fill\n\n"
        + f"SET_SLUG:      {manifest['slug']}\n"
        + f"SET_LABEL:     {manifest['label']}\n"
        + f"SET_FRANCHISE: {manifest['franchise']}\n"
        + f"ACCENT:        {manifest['accent']}\n"
        + f"DESCRIPTION:   {manifest['description']}\n"
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--print-prompt", action="store_true")
    args = ap.parse_args()

    if args.print_prompt:
        if not args.slug:
            raise SystemExit("--print-prompt needs a slug")
        sys.stdout.write(build_prompt(args.slug))
        return

    if args.all:
        slugs = sorted(p.name for p in SETS_DIR.iterdir() if p.is_dir())
    elif args.slug:
        slugs = [args.slug]
    else:
        raise SystemExit("usage: regen-icon-set.py <slug> | --all")

    for slug in slugs:
        regenerate_set(slug)


if __name__ == "__main__":
    main()
