#!/usr/bin/env python3
"""
ODD icon set generator
======================

Emits the three reboot icon sets — `filament`, `arctic`, `fold` — under
odd/assets/icons/<set>/ from a single source of truth. Each icon is one
of 13 stable WP-Desktop keys (dashboard, posts, …, fallback) and shares
its silhouette across sets so the visual language differs but the
metaphors stay consistent.

Each set has its own renderer that wraps shared symbol drawing
primitives in its visual treatment:

  filament  — a single hair-thin glowing stroke on a transparent base.
              Designed to read as one unbroken filament of light.

  arctic    — frost-blue thin-line icons with a tiny accent dot.
              Dock tinting via currentColor on the main stroke.

  fold      — flat folded-paper icons: two-tone faces with one visible
              crease and a soft drop shadow. Tactile + minimalist.

Usage:
  python3 _tools/gen-icon-sets.py

Idempotent — overwrites existing icons. Run it any time the silhouette
catalog changes; commit the rendered SVGs.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ICONS_ROOT = REPO / "odd" / "assets" / "icons"

SIZE = 64                # SVG canvas (also viewBox)
PAD = 8                  # interior padding for symbol drawing
INNER = SIZE - PAD * 2   # 48px usable

# ------------------------------------------------------------------ #
# Shared symbol catalog. Each entry is a list of "primitives" the
# renderers know how to emit: ('line', x1, y1, x2, y2),
# ('rect', x, y, w, h), ('circle', cx, cy, r), ('poly', [(x,y),...]).
# Coordinates are in 0..INNER space; renderers translate by PAD.
# ------------------------------------------------------------------ #

I = INNER  # local alias

SYMBOLS = {
    # Dashboard — 2x2 grid of squares (the WP "blocks" archetype).
    "dashboard": [
        ("rect",  4,  4, I/2 - 8, I/2 - 8),
        ("rect",  I/2 + 4,  4, I/2 - 8, I/2 - 8),
        ("rect",  4,  I/2 + 4, I/2 - 8, I/2 - 8),
        ("rect",  I/2 + 4,  I/2 + 4, I/2 - 8, I/2 - 8),
    ],
    # Posts — stacked horizontal lines on a page corner.
    "posts": [
        ("rect",  4,  6, I - 8, I - 12),
        ("line",  10, 16, I - 10, 16),
        ("line",  10, 24, I - 10, 24),
        ("line",  10, 32, I - 14, 32),
        ("line",  10, 40, I - 18, 40),
    ],
    # Pages — single page with a folded corner.
    "pages": [
        ("poly", [(8, 4), (I - 14, 4), (I - 4, 14), (I - 4, I - 4), (8, I - 4)]),
        ("poly", [(I - 14, 4), (I - 14, 14), (I - 4, 14)]),
        ("line", 14, 22, I - 12, 22),
        ("line", 14, 30, I - 12, 30),
        ("line", 14, 38, I - 18, 38),
    ],
    # Media — landscape with sun + horizon (image archetype).
    "media": [
        ("rect", 4, 8, I - 8, I - 16),
        ("circle", I - 16, 18, 4),
        ("poly", [(4, I - 8), (16, I - 22), (28, I - 12), (40, I - 24), (I - 4, I - 8)]),
    ],
    # Comments — speech bubble with tail.
    "comments": [
        ("poly", [
            (4, 6), (I - 4, 6), (I - 4, I - 14),
            (I - 18, I - 14), (I - 24, I - 4), (I - 26, I - 14),
            (4, I - 14)
        ]),
        ("line", 12, 16, I - 12, 16),
        ("line", 12, 24, I - 16, 24),
    ],
    # Appearance — paint roller / brush abstract: rectangle handle + tip.
    "appearance": [
        ("rect", 4, 6, I - 8, 10),
        ("rect", I/2 - 4, 16, 8, 8),
        ("poly", [(I/2 - 10, 24), (I/2 + 10, 24), (I/2 + 6, I - 4), (I/2 - 6, I - 4)]),
    ],
    # Plugins — power plug silhouette.
    "plugins": [
        ("rect", I/2 - 12, 4, 24, 18),
        ("line", I/2 - 6, 0, I/2 - 6, 6),
        ("line", I/2 + 6, 0, I/2 + 6, 6),
        ("rect", I/2 - 8, 22, 16, 10),
        ("line", I/2, 32, I/2, I - 4),
    ],
    # Users — two overlapping head-and-shoulders silhouettes.
    "users": [
        ("circle", I/2 - 8, 16, 7),
        ("circle", I/2 + 8, 16, 7),
        ("poly", [(I/2 - 18, I - 4), (I/2 - 14, 28), (I/2 - 2, 28), (I/2 + 2, I - 4)]),
        ("poly", [(I/2 - 2, I - 4), (I/2 + 2, 28), (I/2 + 14, 28), (I/2 + 18, I - 4)]),
    ],
    # Tools — wrench (diagonal handle + open end).
    "tools": [
        ("poly", [(I - 6, 4), (I - 14, 4), (I - 14, 14), (I - 6, 14)]),
        ("line", I - 14, 14, 8, I - 8),
        ("circle", 8, I - 8, 4),
    ],
    # Settings — gear (8-tooth rosette + center hole).
    "settings": [
        ("circle", I/2, I/2, 14),
        ("circle", I/2, I/2, 5),
        # Gear teeth as 8 small rects radiating outward.
        ("rect", I/2 - 2, 0, 4, 6),
        ("rect", I/2 - 2, I - 6, 4, 6),
        ("rect", 0, I/2 - 2, 6, 4),
        ("rect", I - 6, I/2 - 2, 6, 4),
        ("poly", [(I/2 + 12, I/2 - 14), (I/2 + 16, I/2 - 12), (I/2 + 12, I/2 - 8), (I/2 + 8, I/2 - 12)]),
        ("poly", [(I/2 - 12, I/2 - 14), (I/2 - 8, I/2 - 12), (I/2 - 12, I/2 - 8), (I/2 - 16, I/2 - 12)]),
        ("poly", [(I/2 + 12, I/2 + 14), (I/2 + 16, I/2 + 12), (I/2 + 12, I/2 + 8), (I/2 + 8, I/2 + 12)]),
        ("poly", [(I/2 - 12, I/2 + 14), (I/2 - 8, I/2 + 12), (I/2 - 12, I/2 + 8), (I/2 - 16, I/2 + 12)]),
    ],
    # Profile — single user portrait (head + circle frame).
    "profile": [
        ("circle", I/2, I/2, I/2 - 4),
        ("circle", I/2, I/2 - 4, 7),
        ("poly", [(I/2 - 14, I - 8), (I/2 - 8, 22), (I/2 + 8, 22), (I/2 + 14, I - 8)]),
    ],
    # Links — two interlocking chain ovals at 30° angle.
    "links": [
        ("poly", [
            (4, I/2), (10, I/2 - 10), (I/2 - 4, I/2 - 14),
            (I/2 + 2, I/2 - 4), (I/2 - 4, I/2), (10, I/2 + 4)
        ]),
        ("poly", [
            (I - 4, I/2), (I - 10, I/2 + 10), (I/2 + 4, I/2 + 14),
            (I/2 - 2, I/2 + 4), (I/2 + 4, I/2), (I - 10, I/2 - 4)
        ]),
    ],
    # Fallback — three concentric pulses (works for any unmapped key).
    "fallback": [
        ("circle", I/2, I/2, 4),
        ("circle", I/2, I/2, 12),
        ("circle", I/2, I/2, 20),
    ],
}


# ------------------------------------------------------------------ #
# Renderers
# ------------------------------------------------------------------ #

def _xy(x, y):
    return f"{round(x + PAD, 2)} {round(y + PAD, 2)}"


def _render_filament(prims):
    """Hair-thin glowing line on transparent. Dock tints via currentColor."""
    parts = []
    for p in prims:
        kind = p[0]
        if kind == "line":
            parts.append(
                f'<line x1="{p[1]+PAD}" y1="{p[2]+PAD}" x2="{p[3]+PAD}" y2="{p[4]+PAD}" />'
            )
        elif kind == "rect":
            parts.append(
                f'<rect x="{p[1]+PAD}" y="{p[2]+PAD}" width="{p[3]}" height="{p[4]}" '
                f'rx="2" />'
            )
        elif kind == "circle":
            parts.append(
                f'<circle cx="{p[1]+PAD}" cy="{p[2]+PAD}" r="{p[3]}" />'
            )
        elif kind == "poly":
            pts = " ".join(_xy(x, y) for x, y in p[1])
            parts.append(f'<polygon points="{pts}" />')
    body = "\n  ".join(parts)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" '
        f'fill="none" stroke="currentColor" stroke-width="2" '
        f'stroke-linecap="round" stroke-linejoin="round">\n  '
        f'{body}\n</svg>\n'
    )


def _render_arctic(prims):
    """Frost-blue thin lines + a small magenta accent dot in the corner."""
    parts = []
    for p in prims:
        kind = p[0]
        if kind == "line":
            parts.append(
                f'<line x1="{p[1]+PAD}" y1="{p[2]+PAD}" x2="{p[3]+PAD}" y2="{p[4]+PAD}" />'
            )
        elif kind == "rect":
            parts.append(
                f'<rect x="{p[1]+PAD}" y="{p[2]+PAD}" width="{p[3]}" height="{p[4]}" '
                f'rx="3" />'
            )
        elif kind == "circle":
            parts.append(
                f'<circle cx="{p[1]+PAD}" cy="{p[2]+PAD}" r="{p[3]}" />'
            )
        elif kind == "poly":
            pts = " ".join(_xy(x, y) for x, y in p[1])
            parts.append(f'<polygon points="{pts}" />')
    body = "\n  ".join(parts)
    accent = (
        f'<circle cx="{SIZE - 9}" cy="9" r="2.5" '
        f'fill="#c87cff" stroke="none" />'
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" '
        f'fill="none" stroke="currentColor" stroke-width="1.6" '
        f'stroke-linecap="round" stroke-linejoin="round">\n  '
        f'{body}\n  {accent}\n</svg>\n'
    )


def _render_fold(prims):
    """Two-tone folded-paper: every shape gets a face fill + a darker
    'shadow' triangle along one edge to read as a crease. Strokes are
    omitted to keep the look flat. A soft offset drop shadow sits under
    each shape to give the paper some lift."""
    face = "#fffaf0"        # paper face
    shadow = "#d6b48a"      # crease + drop shadow
    parts = []
    drop_parts = []
    for p in prims:
        kind = p[0]
        if kind == "line":
            # Render lines as thin rounded rects so they have weight.
            x1, y1, x2, y2 = p[1] + PAD, p[2] + PAD, p[3] + PAD, p[4] + PAD
            parts.append(
                f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
                f'stroke="{shadow}" stroke-width="2" stroke-linecap="round" />'
            )
            drop_parts.append(
                f'<line x1="{x1+1.2}" y1="{y1+1.6}" x2="{x2+1.2}" y2="{y2+1.6}" '
                f'stroke="rgba(0,0,0,0.10)" stroke-width="2" stroke-linecap="round" />'
            )
        elif kind == "rect":
            x, y, w, h = p[1] + PAD, p[2] + PAD, p[3], p[4]
            drop_parts.append(
                f'<rect x="{x+1.4}" y="{y+1.8}" width="{w}" height="{h}" '
                f'rx="2" fill="rgba(0,0,0,0.12)" />'
            )
            parts.append(
                f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2" fill="{face}" />'
            )
            # Crease: a darker triangle from top-right corner to
            # bottom-right, suggesting one folded edge.
            parts.append(
                f'<polygon points="{x+w*0.55} {y} {x+w} {y} {x+w} {y+h*0.55}" '
                f'fill="{shadow}" opacity="0.55" />'
            )
        elif kind == "circle":
            cx, cy, r = p[1] + PAD, p[2] + PAD, p[3]
            drop_parts.append(
                f'<circle cx="{cx+1.4}" cy="{cy+1.8}" r="{r}" fill="rgba(0,0,0,0.12)" />'
            )
            parts.append(
                f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{face}" />'
            )
            # Crease: a half-disc on one side, faked with a rotated path.
            parts.append(
                f'<path d="M {cx} {cy-r} A {r} {r} 0 0 1 {cx} {cy+r} Z" '
                f'fill="{shadow}" opacity="0.45" />'
            )
        elif kind == "poly":
            pts = " ".join(_xy(x, y) for x, y in p[1])
            drop_pts = " ".join(_xy(x + 1.4 - PAD, y + 1.8 - PAD) for x, y in p[1])
            # The drop shadow is offset by the same amount in viewBox space;
            # _xy already added PAD, so we reverse that and re-add inside.
            drop_pts = " ".join(
                f"{round(x + PAD + 1.4, 2)} {round(y + PAD + 1.8, 2)}" for x, y in p[1]
            )
            drop_parts.append(
                f'<polygon points="{drop_pts}" fill="rgba(0,0,0,0.12)" />'
            )
            parts.append(
                f'<polygon points="{pts}" fill="{face}" />'
            )
            # Crease: pick the first three points, halve to mid, fill darker.
            if len(p[1]) >= 3:
                a = p[1][0]
                b = p[1][len(p[1]) // 2]
                mx = sum(x for x, _ in p[1]) / len(p[1])
                my = sum(y for _, y in p[1]) / len(p[1])
                crease_pts = f"{_xy(*a)} {_xy(*b)} {_xy(mx, my)}"
                parts.append(
                    f'<polygon points="{crease_pts}" fill="{shadow}" opacity="0.45" />'
                )
    body = "\n  ".join(drop_parts + parts)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">\n  '
        f'{body}\n</svg>\n'
    )


SETS = {
    "filament": {
        "label": "Filament",
        "franchise": "Generative",
        "accent": "#9be6ff",
        "description": (
            "Hair-thin single-stroke icons that read as one unbroken "
            "filament of light. Pairs with the Flux wallpaper but "
            "looks great on any dark dock."
        ),
        "render": _render_filament,
    },
    "arctic": {
        "label": "Arctic",
        "franchise": "Atmosphere",
        "accent": "#a3d9ff",
        "description": (
            "Crisp frost-blue line icons with a tiny magenta accent "
            "dot — the same palette as the Aurora wallpaper. Reads "
            "well on light or dark docks."
        ),
        "render": _render_arctic,
    },
    "fold": {
        "label": "Fold",
        "franchise": "Paper",
        "accent": "#d6b48a",
        "description": (
            "Folded-paper icons in cream and warm tan, each with a "
            "single visible crease and a soft drop shadow. Pairs "
            "with the Origami wallpaper."
        ),
        "render": _render_fold,
    },
}


KEYS = (
    "dashboard", "posts", "pages", "media", "comments", "appearance",
    "plugins", "users", "tools", "settings", "profile", "links", "fallback",
)


def _slug_to_filename(key: str) -> str:
    return f"{key}.svg"


def main() -> int:
    if not ICONS_ROOT.is_dir():
        ICONS_ROOT.mkdir(parents=True, exist_ok=True)

    for slug, spec in SETS.items():
        set_dir = ICONS_ROOT / slug
        set_dir.mkdir(parents=True, exist_ok=True)
        manifest = {
            "slug": slug,
            "label": spec["label"],
            "franchise": spec["franchise"],
            "accent": spec["accent"],
            "description": spec["description"],
            "preview": "dashboard.svg",
            "icons": {k: _slug_to_filename(k) for k in KEYS},
        }
        # Strip any pre-existing SVGs so renamed/removed icons don't
        # linger as orphans (the validator flags those as warnings).
        for old in set_dir.glob("*.svg"):
            old.unlink()
        for key in KEYS:
            svg = spec["render"](SYMBOLS[key])
            (set_dir / _slug_to_filename(key)).write_text(svg)
        (set_dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2) + "\n"
        )
        print(f"  wrote {slug}/ ({len(KEYS)} icons + manifest)")

    print(f"OK: {len(SETS)} icon set(s) generated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
