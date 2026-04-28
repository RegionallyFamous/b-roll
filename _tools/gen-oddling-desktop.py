#!/usr/bin/env python3
"""
Generate the ODD default bundle: the `oddlings` icon set and the
`oddling-desktop` wallpaper/preview artwork.

The `oddling-desktop` scene is authored as a Pixi tick function on top
of a painted still-life wallpaper. This script emits the static pieces
deterministically so a fresh clone can rebuild them without any
external tooling:

    * `_tools/catalog-sources/icon-sets/oddlings/*.svg`
      thirteen specimen-badge admin icons, each a recognizable
      Dashicons-style glyph wearing a single Oddling creature trait
      (eye, teeth, antennae, eyelid, tongue, etc.) inside the canonical
      1024x1024 squircle clipPath.
    * `_tools/catalog-sources/icon-sets/oddlings/manifest.json`
    * `_tools/catalog-sources/scenes/oddling-desktop/wallpaper.webp`
      1920x1080, painted still-life terrarium background.
    * `_tools/catalog-sources/scenes/oddling-desktop/preview.webp`
      640x360 cover-cropped thumbnail of the same artwork.

Usage:
    python3 _tools/gen-oddling-desktop.py

Idempotent. Intentionally has no arguments — this bundle is the ODD
default, so the output is fixed.
"""
from __future__ import annotations

import io
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
SOURCES = HERE / "catalog-sources"
ICONS_DIR = SOURCES / "icon-sets" / "oddlings"
SCENE_DIR = SOURCES / "scenes" / "oddling-desktop"

# The canonical squircle clipPath. Every icon must contain this verbatim
# (whitespace-collapsed) or the catalog validator rejects it.
SQUIRCLE = (
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

# Rotating role accent so the set feels specimen-like, not monochrome.
# Each entry is (fill, stroke, secondary).
ACCENTS = {
    "dashboard":  ("#38e8ff", "#0a2a33", "#ffd84a"),
    "posts":      ("#ff5fa8", "#3a0820", "#ffe26a"),
    "pages":      ("#b8ff5a", "#11240a", "#38e8ff"),
    "media":      ("#ffd84a", "#2c1d00", "#ff5fa8"),
    "comments":   ("#38e8ff", "#082233", "#ff5fa8"),
    "appearance": ("#ff8bc7", "#2d0820", "#b8ff5a"),
    "plugins":    ("#b266ff", "#180a2d", "#ffd84a"),
    "users":      ("#ffe26a", "#2e1b05", "#ff5fa8"),
    "tools":      ("#5aeacc", "#07281f", "#ffd84a"),
    "settings":   ("#ff9d5c", "#2b0c02", "#38e8ff"),
    "profile":    ("#c7f25a", "#17240c", "#ff5fa8"),
    "links":      ("#8bd5ff", "#0a1f33", "#ffd84a"),
    "fallback":   ("#ff5fa8", "#14062c", "#38e8ff"),
}


def svg_header(label: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        'viewBox="0 0 1024 1024" width="1024" height="1024" '
        f'role="img" aria-label="Oddlings {label}">'
    )


def defs_block(uid: str, accent: tuple[str, str, str]) -> str:
    fill, stroke, secondary = accent
    return (
        "<defs>"
        f'<clipPath id="sq"><path d="{SQUIRCLE}"/></clipPath>'
        f'<linearGradient id="bg{uid}" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#22123d"/>'
        '<stop offset="1" stop-color="#080212"/>'
        "</linearGradient>"
        f'<radialGradient id="sp{uid}" cx=".3" cy=".22" r=".65">'
        '<stop offset="0" stop-color="#ffffff" stop-opacity=".22"/>'
        '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>'
        "</radialGradient>"
        f'<radialGradient id="gl{uid}" cx=".5" cy=".5" r=".6">'
        f'<stop offset="0" stop-color="{fill}" stop-opacity=".9"/>'
        f'<stop offset="1" stop-color="{fill}" stop-opacity="0"/>'
        "</radialGradient>"
        f'<filter id="sh{uid}" x="-20%" y="-20%" width="140%" height="140%">'
        '<feDropShadow dx="0" dy="14" stdDeviation="18" '
        'flood-color="#000" flood-opacity=".45"/>'
        "</filter>"
        "</defs>"
    )


def eye(cx: int, cy: int, r: int, iris: str, pupil: str = "#140420") -> str:
    return (
        f'<g><circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff7ea"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{int(r * 0.58)}" fill="{iris}"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{int(r * 0.28)}" fill="{pupil}"/>'
        f'<circle cx="{cx - int(r * 0.35)}" cy="{cy - int(r * 0.35)}" '
        f'r="{max(3, int(r * 0.16))}" fill="#fff"/></g>'
    )


def closing(uid: str) -> str:
    return (
        f'<rect width="1024" height="1024" fill="url(#sp{uid})"/>'
        "</g></svg>\n"
    )


# ------------------------------------------------------------------ #
# Per-icon renderers.
# Each returns the body SVG fragment to drop inside
# <g clip-path="url(#sq)"><rect fill=bg/>...<rect fill=sp/></g>.
# ------------------------------------------------------------------ #

def render_dashboard(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    s = (
        f'<g filter="url(#sh{uid})">'
        # Four jelly panes.
        f'<rect x="192" y="192" width="304" height="304" rx="64" '
        f'fill="{fill}"/>'
        f'<rect x="528" y="192" width="304" height="304" rx="64" '
        f'fill="{sec}" opacity=".85"/>'
        f'<rect x="192" y="528" width="304" height="304" rx="64" '
        f'fill="{sec}" opacity=".85"/>'
        f'<rect x="528" y="528" width="304" height="304" rx="64" '
        f'fill="{fill}"/>'
        "</g>"
        # Gelatin highlights.
        '<path d="M 220 240 Q 300 200 380 250" stroke="#fff" '
        'stroke-width="18" stroke-linecap="round" opacity=".45" fill="none"/>'
        '<path d="M 556 576 Q 636 540 716 590" stroke="#fff" '
        'stroke-width="18" stroke-linecap="round" opacity=".35" fill="none"/>'
    )
    s += eye(672, 348, 46, stroke)
    return s


def render_posts(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    s = (
        f'<g filter="url(#sh{uid})">'
        # Back sheet.
        f'<rect x="268" y="240" width="512" height="624" rx="32" '
        f'fill="{sec}" opacity=".55"/>'
        # Middle sheet.
        f'<rect x="232" y="200" width="512" height="624" rx="32" '
        f'fill="{sec}" opacity=".75"/>'
        # Front sheet.
        f'<rect x="192" y="160" width="512" height="624" rx="36" '
        f'fill="{fill}"/>'
        "</g>"
        # Lines of text.
        f'<g stroke="{stroke}" stroke-width="28" stroke-linecap="round">'
        '<line x1="260" y1="300" x2="620" y2="300"/>'
        '<line x1="260" y1="380" x2="580" y2="380"/>'
        '<line x1="260" y1="460" x2="636" y2="460"/>'
        '<line x1="260" y1="540" x2="520" y2="540"/>'
        "</g>"
        # Little teeth along the bottom edge.
        f'<g fill="{fill}">'
        '<polygon points="220,784 260,820 300,784"/>'
        '<polygon points="320,784 360,820 400,784"/>'
        '<polygon points="420,784 460,820 500,784"/>'
        '<polygon points="520,784 560,820 600,784"/>'
        '<polygon points="620,784 660,820 700,784"/>'
        "</g>"
    )
    s += eye(604, 640, 38, stroke)
    return s


def render_pages(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    s = (
        f'<g filter="url(#sh{uid})">'
        # Main page with folded corner.
        f'<path d="M 240 180 L 720 180 L 840 300 L 840 844 '
        f'Q 840 884 800 884 L 280 884 Q 240 884 240 844 Z" '
        f'fill="{fill}"/>'
        f'<path d="M 720 180 L 840 300 L 720 300 Z" fill="{stroke}" '
        f'opacity=".6"/>'
        "</g>"
        # Antennae poking out of the top.
        f'<g stroke="{sec}" stroke-width="14" stroke-linecap="round" '
        f'fill="none">'
        '<path d="M 360 180 Q 340 120 300 100"/>'
        '<path d="M 620 180 Q 640 120 680 100"/>'
        "</g>"
        f'<circle cx="300" cy="100" r="18" fill="{sec}"/>'
        f'<circle cx="680" cy="100" r="18" fill="{sec}"/>'
        # Text lines.
        f'<g stroke="{stroke}" stroke-width="26" stroke-linecap="round" '
        f'opacity=".85">'
        '<line x1="300" y1="400" x2="760" y2="400"/>'
        '<line x1="300" y1="480" x2="700" y2="480"/>'
        '<line x1="300" y1="560" x2="740" y2="560"/>'
        "</g>"
    )
    s += eye(540, 720, 50, stroke)
    return s


def render_media(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    s = (
        f'<g filter="url(#sh{uid})">'
        # Film strip.
        f'<rect x="168" y="240" width="688" height="544" rx="52" '
        f'fill="{fill}"/>'
        f'<rect x="240" y="312" width="544" height="400" rx="24" '
        f'fill="{stroke}"/>'
        "</g>"
        # Mountain/sun in frame.
        f'<g fill="{sec}">'
        '<circle cx="360" cy="440" r="60"/>'
        '<polygon points="260,680 440,480 560,620 680,500 780,680"/>'
        "</g>"
        # Sprocket-hole eyes along top and bottom.
        + "".join(
            eye(240 + i * 136, 272, 22, stroke)
            for i in range(5)
        )
        + "".join(
            eye(240 + i * 136, 752, 22, stroke)
            for i in range(5)
        )
    )
    return s


def render_comments(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    s = (
        f'<g filter="url(#sh{uid})">'
        # Speech bubble body.
        f'<path d="M 192 232 Q 192 168 256 168 L 768 168 '
        f'Q 832 168 832 232 L 832 616 Q 832 680 768 680 L 480 680 '
        f'L 360 820 L 400 680 L 256 680 Q 192 680 192 616 Z" '
        f'fill="{fill}"/>'
        "</g>"
        # Dots inside.
        f'<g fill="{stroke}">'
        '<circle cx="360" cy="420" r="36"/>'
        '<circle cx="512" cy="420" r="36"/>'
        '<circle cx="664" cy="420" r="36"/>'
        "</g>"
        # Tongue poking out of the tail.
        f'<path d="M 360 820 L 400 680 L 430 780 Z" fill="{sec}"/>'
    )
    s += eye(300, 300, 36, stroke)
    return s


def render_appearance(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    s = (
        f'<g filter="url(#sh{uid})" '
        f'transform="rotate(-25 512 560)">'
        # Brush handle.
        f'<rect x="470" y="220" width="84" height="460" rx="42" '
        f'fill="{stroke}"/>'
        # Ferrule.
        f'<rect x="452" y="640" width="120" height="72" rx="16" '
        f'fill="{sec}"/>'
        # Bristle bulb.
        f'<path d="M 434 700 Q 394 880 512 920 Q 630 880 590 700 Z" '
        f'fill="{fill}"/>'
        "</g>"
        # Paint drip trail.
        f'<path d="M 640 800 Q 700 840 680 900" stroke="{sec}" '
        f'stroke-width="18" stroke-linecap="round" fill="none"/>'
        # Eye stalk on handle.
        f'<path d="M 420 210 Q 380 170 340 180" stroke="{sec}" '
        f'stroke-width="14" stroke-linecap="round" fill="none"/>'
    )
    s += eye(332, 180, 40, stroke)
    return s


def render_plugins(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    s = (
        f'<g filter="url(#sh{uid})">'
        # Plug body.
        f'<rect x="312" y="300" width="400" height="360" rx="56" '
        f'fill="{fill}"/>'
        # Prongs.
        f'<rect x="388" y="200" width="60" height="120" rx="18" '
        f'fill="{sec}"/>'
        f'<rect x="576" y="200" width="60" height="120" rx="18" '
        f'fill="{sec}"/>'
        "</g>"
        # Hairy legs.
        f'<g stroke="{sec}" stroke-width="16" stroke-linecap="round" '
        f'fill="none">'
        '<path d="M 340 660 L 300 780"/>'
        '<path d="M 412 660 L 400 800"/>'
        '<path d="M 484 660 L 496 800"/>'
        '<path d="M 556 660 L 580 800"/>'
        '<path d="M 628 660 L 660 780"/>'
        '<path d="M 700 660 L 740 760"/>'
        "</g>"
    )
    s += eye(440, 440, 44, stroke)
    s += eye(584, 440, 44, stroke)
    return s


def render_users(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    # Two peeking creatures behind a "ground" line.
    s = (
        f'<g filter="url(#sh{uid})">'
        # Back head.
        f'<circle cx="640" cy="500" r="200" fill="{sec}"/>'
        # Front head.
        f'<circle cx="384" cy="540" r="220" fill="{fill}"/>'
        "</g>"
        # Antennae for back head.
        f'<g stroke="{sec}" stroke-width="14" stroke-linecap="round" '
        f'fill="none">'
        '<path d="M 580 320 Q 560 260 600 220"/>'
        '<path d="M 700 320 Q 720 260 680 220"/>'
        "</g>"
        f'<circle cx="600" cy="220" r="16" fill="{sec}"/>'
        f'<circle cx="680" cy="220" r="16" fill="{sec}"/>'
        # Ground shadow line.
        f'<rect x="120" y="816" width="784" height="32" rx="16" '
        f'fill="#060112" opacity=".6"/>'
    )
    s += eye(328, 520, 48, stroke)
    s += eye(440, 520, 48, stroke)
    s += eye(604, 500, 40, stroke)
    s += eye(696, 500, 40, stroke)
    return s


def render_tools(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    s = (
        f'<g filter="url(#sh{uid})" transform="rotate(-35 512 512)">'
        # Wrench shaft.
        f'<rect x="460" y="280" width="104" height="520" rx="44" '
        f'fill="{fill}"/>'
        # Head of wrench.
        f'<path d="M 380 220 Q 380 140 512 140 Q 644 140 644 220 '
        f'L 644 300 Q 644 340 600 340 L 560 340 '
        f'L 560 380 L 464 380 L 464 340 L 424 340 '
        f'Q 380 340 380 300 Z" fill="{fill}"/>'
        # Jaw hole.
        f'<rect x="484" y="180" width="56" height="120" rx="20" '
        f'fill="{stroke}"/>'
        "</g>"
        # Antennae springing off the handle base.
        f'<g stroke="{sec}" stroke-width="14" stroke-linecap="round" '
        f'fill="none">'
        '<path d="M 760 800 Q 800 760 860 780"/>'
        '<path d="M 720 840 Q 720 900 780 920"/>'
        "</g>"
        f'<circle cx="860" cy="780" r="16" fill="{sec}"/>'
        f'<circle cx="780" cy="920" r="16" fill="{sec}"/>'
    )
    s += eye(470, 540, 38, stroke)
    return s


def render_settings(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    # Hand-authored 8-tooth gear so the generator has no runtime
    # dependency on the metaphor helpers.
    r_out, r_in = 360, 280
    cx, cy = 512, 512
    pts = []
    teeth = 8
    for i in range(teeth * 2):
        r = r_out if i % 2 == 0 else r_in
        a = (i / (teeth * 2)) * math.tau - math.tau / (teeth * 4)
        pts.append(
            f"{cx + int(math.cos(a) * r)},{cy + int(math.sin(a) * r)}"
        )
    gear = "M " + " L ".join(pts) + " Z"
    s = (
        f'<g filter="url(#sh{uid})">'
        f'<path d="{gear}" fill="{fill}"/>'
        f'<circle cx="{cx}" cy="{cy}" r="160" fill="{stroke}"/>'
        "</g>"
        # Slit pupil.
        f'<ellipse cx="{cx}" cy="{cy}" rx="120" ry="60" fill="#fff7ea"/>'
        f'<ellipse cx="{cx}" cy="{cy}" rx="42" ry="60" fill="{sec}"/>'
        f'<ellipse cx="{cx}" cy="{cy}" rx="14" ry="46" fill="#140420"/>'
    )
    return s


def render_profile(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    s = (
        f'<g filter="url(#sh{uid})">'
        # Shoulder silhouette.
        f'<path d="M 168 900 Q 168 656 400 600 Q 512 572 624 600 '
        f'Q 856 656 856 900 Z" fill="{fill}"/>'
        # Big creature head.
        f'<circle cx="512" cy="420" r="248" fill="{fill}"/>'
        "</g>"
        # Single dominant eye.
        + eye(512, 420, 112, stroke)
        + f'<path d="M 300 360 Q 360 320 420 360" stroke="{sec}" '
        f'stroke-width="18" stroke-linecap="round" fill="none"/>'
        + f'<path d="M 604 360 Q 664 320 724 360" stroke="{sec}" '
        f'stroke-width="18" stroke-linecap="round" fill="none"/>'
    )
    return s


def render_links(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    s = (
        f'<g filter="url(#sh{uid})" '
        f'stroke="{fill}" stroke-width="72" fill="none" '
        f'stroke-linejoin="round">'
        # Two interlocked rings.
        f'<rect x="172" y="372" width="356" height="280" rx="128"/>'
        f'<rect x="496" y="372" width="356" height="280" rx="128"/>'
        "</g>"
        # Rivet eyes.
        + eye(288, 512, 38, stroke)
        + eye(736, 512, 38, stroke)
        # Glow.
        + f'<circle cx="512" cy="512" r="60" fill="{sec}" opacity=".5"/>'
    )
    return s


def render_fallback(uid: str, acc: tuple[str, str, str]) -> str:
    fill, stroke, sec = acc
    s = (
        f'<g filter="url(#sh{uid})">'
        # Asymmetric blob.
        f'<path d="M 248 488 Q 236 284 432 228 Q 624 176 760 304 '
        f'Q 884 432 812 636 Q 740 840 520 856 Q 272 872 248 648 Z" '
        f'fill="{fill}"/>'
        "</g>"
        # Teeth along bottom.
        f'<g fill="#fff7ea">'
        '<polygon points="396,780 420,830 444,780"/>'
        '<polygon points="460,790 484,840 508,790"/>'
        '<polygon points="524,790 548,840 572,790"/>'
        '<polygon points="588,780 612,830 636,780"/>'
        "</g>"
        # Antenna.
        f'<path d="M 620 230 Q 680 170 740 180" stroke="{sec}" '
        f'stroke-width="16" stroke-linecap="round" fill="none"/>'
        f'<circle cx="740" cy="180" r="18" fill="{sec}"/>'
    )
    s += eye(468, 468, 96, stroke)
    return s


RENDERERS = {
    "dashboard":  render_dashboard,
    "posts":      render_posts,
    "pages":      render_pages,
    "media":      render_media,
    "comments":   render_comments,
    "appearance": render_appearance,
    "plugins":    render_plugins,
    "users":      render_users,
    "tools":      render_tools,
    "settings":   render_settings,
    "profile":    render_profile,
    "links":      render_links,
    "fallback":   render_fallback,
}


def write_icons() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    for key, render in RENDERERS.items():
        uid = f"oddlings{key}"
        accent = ACCENTS[key]
        body = render(uid, accent)
        svg = (
            svg_header(key.title())
            + defs_block(uid, accent)
            + f'<g clip-path="url(#sq)">'
            + f'<rect width="1024" height="1024" fill="url(#bg{uid})"/>'
            + body
            + closing(uid)
        )
        path = ICONS_DIR / f"{key}.svg"
        path.write_text(svg, encoding="utf-8")

    manifest = {
        "slug": "oddlings",
        "label": "Oddlings",
        "franchise": "ODD Defaults",
        "accent": "#38e8ff",
        "preview": "dashboard.svg",
        "description": (
            "Dashicons-readable admin icons wearing little creature traits: "
            "peeking eyes, teeth, antennae, and gelatin highlights on a "
            "specimen-plum glass base."
        ),
        "version": "1.0.0",
        "author": "Regionally Famous",
        "icons": {k: f"{k}.svg" for k in RENDERERS},
    }
    (ICONS_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


# ------------------------------------------------------------------ #
# Wallpaper + preview.
# ------------------------------------------------------------------ #

def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def paint_wallpaper(w: int = 1920, h: int = 1080) -> Image.Image:
    """A still-life "desktop terrarium" backdrop.

    The Pixi scene paints hero motion on top; this image only needs to
    establish mood: dark plum horizon, CRT curvature, soft specimen
    haze, and a handful of barely-there creature silhouettes so the
    desktop reads as "inhabited" even with reduced motion on.
    """
    rng = random.Random(20260427)

    # Base vertical gradient: ink top, bruised plum horizon, deep base.
    top = (18, 6, 40)
    mid = (60, 18, 92)
    low = (8, 2, 20)
    img = Image.new("RGB", (w, h), low)
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        if t < 0.55:
            col = mix(top, mid, t / 0.55)
        else:
            col = mix(mid, low, (t - 0.55) / 0.45)
        for x in range(w):
            px[x, y] = col

    draw = ImageDraw.Draw(img, "RGBA")

    # Distant "horizon" CRT curve glow.
    hr = h * 0.62
    for i in range(220):
        alpha = int(90 * (1 - i / 220))
        draw.ellipse(
            (-200 - i * 2, hr - 40 - i, w + 200 + i * 2, hr + 260 + i),
            outline=(56, 232, 255, alpha),
            width=2,
        )

    # Soft plum haze bands.
    for i in range(9):
        y = int(h * (0.15 + i * 0.09))
        draw.rectangle(
            (0, y, w, y + 2),
            fill=(180, 102, 255, 24),
        )

    # Distant specimen "drawer" silhouette.
    drawer = (int(w * 0.08), int(h * 0.58), int(w * 0.92), int(h * 0.9))
    draw.rounded_rectangle(
        drawer, radius=42, fill=(22, 8, 44, 180),
    )
    draw.rounded_rectangle(
        drawer, radius=42, outline=(120, 70, 200, 140), width=4,
    )
    # Drawer shelves.
    for i in range(1, 4):
        sy = drawer[1] + int((drawer[3] - drawer[1]) * i / 4)
        draw.line(
            (drawer[0] + 24, sy, drawer[2] - 24, sy),
            fill=(120, 70, 200, 90),
            width=3,
        )

    # Scattered dim "file-tab" card silhouettes floating in mid field.
    for _ in range(18):
        cx = rng.randint(80, w - 80)
        cy = rng.randint(int(h * 0.15), int(h * 0.55))
        ww = rng.randint(90, 180)
        hh = int(ww * 0.62)
        a = rng.randint(22, 62)
        tint = rng.choice([
            (56, 232, 255),
            (255, 95, 168),
            (255, 216, 74),
            (178, 102, 255),
        ])
        draw.rounded_rectangle(
            (cx - ww // 2, cy - hh // 2, cx + ww // 2, cy + hh // 2),
            radius=14,
            fill=tint + (a,),
        )

    # A few tiny "oddling" shapes peeking near the bottom.
    for i, (fx, fy, col) in enumerate([
        (0.22, 0.78, (56, 232, 255)),
        (0.44, 0.83, (255, 95, 168)),
        (0.66, 0.78, (184, 255, 90)),
        (0.82, 0.85, (255, 216, 74)),
    ]):
        cx = int(w * fx)
        cy = int(h * fy)
        r = 34 + (i % 3) * 6
        draw.ellipse(
            (cx - r, cy - r, cx + r, cy + r),
            fill=(20, 6, 40, 220),
        )
        # Two pinprick eyes.
        draw.ellipse(
            (cx - r // 2 - 3, cy - 4, cx - r // 2 + 5, cy + 4),
            fill=col + (255,),
        )
        draw.ellipse(
            (cx + r // 2 - 5, cy - 4, cx + r // 2 + 3, cy + 4),
            fill=col + (255,),
        )

    # CRT scanlines (very subtle).
    scanlayer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(scanlayer)
    for y in range(0, h, 3):
        sdraw.line((0, y, w, y), fill=(0, 0, 0, 18))
    img = Image.alpha_composite(img.convert("RGBA"), scanlayer).convert(
        "RGB"
    )

    # Vignette.
    vignette = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette)
    max_inset = min(w, h) // 2 - 4
    for i in range(40):
        inset = min(max_inset, i * 28)
        if inset * 2 >= min(w, h):
            break
        a = int(4 + i * 2.0)
        vdraw.rectangle(
            (inset, inset, w - inset, h - inset),
            outline=(0, 0, 0, a),
            width=1,
        )
    img = Image.alpha_composite(img.convert("RGBA"), vignette).convert(
        "RGB"
    )

    # Final soft blur so the whole thing reads painted, not drawn.
    img = img.filter(ImageFilter.GaussianBlur(radius=1.2))
    return img


def write_scene_assets() -> None:
    SCENE_DIR.mkdir(parents=True, exist_ok=True)
    wallpaper = paint_wallpaper(1920, 1080)
    wp_path = SCENE_DIR / "wallpaper.webp"
    wallpaper.save(wp_path, format="WEBP", quality=82, method=6)

    preview = wallpaper.resize((640, 360), Image.LANCZOS)
    pv_path = SCENE_DIR / "preview.webp"
    preview.save(pv_path, format="WEBP", quality=80, method=6)


def main() -> None:
    write_icons()
    write_scene_assets()
    # The scene.js and meta.json are hand-authored and live alongside.


if __name__ == "__main__":
    main()
