#!/usr/bin/env python3
"""Compose assets/previews/b-roll.jpg from the existing painted previews.

A 3x3 collage of up to nine scene thumbnails with a soft center vignette
and a "B-ROLL" wordmark. Derived deterministically from source previews
so the swatch stays in sync when previews change.

Usage:
    python3 tools/build-b-roll-swatch.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
except ImportError:
    sys.stderr.write("Pillow is required: pip install Pillow\n")
    sys.exit(1)


ROOT = Path(__file__).resolve().parent.parent
PREVIEWS = ROOT / "assets" / "previews"
MANIFEST = ROOT / "src" / "scenes.json"
OUT = PREVIEWS / "b-roll.webp"

# Output dims mirror the per-scene previews (~640 wide, 1.6:1).
W, H = 960, 600
COLS, ROWS = 3, 3


def load_manifest() -> list[dict]:
    return json.loads(MANIFEST.read_text())


def pick_slugs(manifest: list[dict]) -> list[str]:
    slugs = [s["slug"] for s in manifest]
    # Fill 9 cells by repeating if we have fewer scenes.
    if not slugs:
        return []
    while len(slugs) < COLS * ROWS:
        slugs.append(slugs[len(slugs) % len(slugs)])
    return slugs[: COLS * ROWS]


def load_tile(slug: str, tw: int, th: int) -> Image.Image:
    path = PREVIEWS / f"{slug}.webp"
    if not path.exists():
        tile = Image.new("RGB", (tw, th), "#111")
    else:
        tile = Image.open(path).convert("RGB")
    # Cover-fit then center crop to (tw, th).
    sw, sh = tile.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale + 0.5), int(sh * scale + 0.5)
    tile = tile.resize((nw, nh), Image.LANCZOS)
    x = (nw - tw) // 2
    y = (nh - th) // 2
    return tile.crop((x, y, x + tw, y + th))


def center_vignette(size: tuple[int, int]) -> Image.Image:
    w, h = size
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    cx, cy = w / 2, h / 2
    rmax = (cx**2 + cy**2) ** 0.5
    steps = 64
    for i in range(steps):
        t = i / (steps - 1)
        r = rmax * (0.25 + 0.85 * t)
        alpha = int(255 * t * 0.55)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=alpha)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=w * 0.04))
    dark = Image.new("RGB", size, (0, 0, 0))
    return Image.composite(dark, Image.new("RGB", size, (255, 255, 255, 0)), mask)


def load_font(px: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Supplemental/Avenir Next.ttc",
        "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, px)
            except OSError:
                continue
    return ImageFont.load_default()


def draw_wordmark(img: Image.Image) -> None:
    draw = ImageDraw.Draw(img, "RGBA")
    text = "B-ROLL"
    font = load_font(110)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    cx = img.width // 2
    cy = img.height // 2
    x = cx - tw // 2 - bbox[0]
    y = cy - th // 2 - bbox[1]
    # Shadow halo
    for dx, dy, a in [(0, 3, 180), (0, 6, 80)]:
        draw.text((x + dx, y + dy), text, font=font, fill=(0, 0, 0, a))
    draw.text((x, y), text, font=font, fill=(248, 248, 252, 255))


def main() -> int:
    manifest = load_manifest()
    slugs = pick_slugs(manifest)
    if not slugs:
        print("No scenes in manifest; nothing to build.", file=sys.stderr)
        return 1

    tw = W // COLS
    th = H // ROWS
    canvas = Image.new("RGB", (W, H), "#0a0a12")
    for i, slug in enumerate(slugs):
        r, c = divmod(i, COLS)
        tile = load_tile(slug, tw, th)
        canvas.paste(tile, (c * tw, r * th))

    # Subtle grid lines to sell the "collage" without feeling busy.
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for c in range(1, COLS):
        od.line([(c * tw, 0), (c * tw, H)], fill=(0, 0, 0, 70), width=2)
    for r in range(1, ROWS):
        od.line([(0, r * th), (W, r * th)], fill=(0, 0, 0, 70), width=2)
    canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")

    vignette = center_vignette((W, H))
    canvas = Image.blend(canvas, vignette, 0.42)

    draw_wordmark(canvas)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, "WEBP", quality=82, method=6)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes, {W}x{H})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
