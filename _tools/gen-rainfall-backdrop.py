#!/usr/bin/env python3
"""Generate the painted backdrop + preview for the Rainfall scene.

The Rainfall scene draws animated drops + splashes on top of this
plate, so the plate only needs to feel like a stormy night: deep
navy gradient, a slightly warmer city-light haze along the bottom
edge, and very faint diagonal streak texture to sell wetness.

Outputs two WebPs (1920×1080 @ q82, 640×360 @ q80).
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


HERE = Path(__file__).resolve().parent
PLUGIN = HERE.parent / "odd"
WALL_DIR = PLUGIN / "assets" / "wallpapers"
PREV_DIR = PLUGIN / "assets" / "previews"
WALL_DIR.mkdir(parents=True, exist_ok=True)
PREV_DIR.mkdir(parents=True, exist_ok=True)


def lerp_rgb(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def paint(width: int, height: int) -> Image.Image:
    img = Image.new("RGB", (width, height), (8, 10, 18))
    px = img.load()

    # Deterministic per-output seed so runs are reproducible per size.
    rng = random.Random(f"rainfall-{width}x{height}")

    # Sky gradient: deep ink at the top, slight navy warmth mid, with
    # an orange-tinted haze at the bottom (city lights behind rain).
    top = (4, 6, 14)
    mid = (9, 14, 32)
    low = (22, 28, 52)
    warm = (58, 40, 44)       # city-light bloom (muted, not red)
    for y in range(height):
        t = y / (height - 1)
        if t < 0.55:
            col = lerp_rgb(top, mid, t / 0.55)
        elif t < 0.82:
            col = lerp_rgb(mid, low, (t - 0.55) / 0.27)
        else:
            col = lerp_rgb(low, warm, (t - 0.82) / 0.18 * 0.7)
        for x in range(width):
            px[x, y] = col

    draw = ImageDraw.Draw(img, "RGBA")

    # Distant city light glow — a soft blurred horizontal band near the
    # bottom. Drawn onto its own layer so we can blur-composite.
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    band_y = int(height * 0.88)
    for _ in range(28):
        cx = rng.randint(-50, width + 50)
        cy = band_y + rng.randint(-20, 30)
        r = rng.randint(int(width * 0.04), int(width * 0.11))
        alpha = rng.randint(40, 95)
        col = rng.choice([
            (220, 140, 70, alpha),    # sodium
            (200, 160, 100, alpha),
            (150, 180, 220, alpha),   # cool LED
            (180, 130, 90, alpha),
        ])
        gdraw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col)
    glow = glow.filter(ImageFilter.GaussianBlur(radius=int(width * 0.03)))
    img.paste(glow, (0, 0), glow)

    # Thin cloud veil — low-contrast horizontal streaks in the upper
    # third. Keeps the sky from reading as a flat gradient.
    veil = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(veil)
    for _ in range(40):
        y = rng.randint(int(height * 0.05), int(height * 0.55))
        thickness = rng.randint(2, 7)
        length = rng.randint(int(width * 0.2), int(width * 0.6))
        x0 = rng.randint(-int(width * 0.2), width)
        alpha = rng.randint(10, 26)
        vdraw.rectangle((x0, y, x0 + length, y + thickness), fill=(160, 170, 190, alpha))
    veil = veil.filter(ImageFilter.GaussianBlur(radius=int(width * 0.008)))
    img.paste(veil, (0, 0), veil)

    # Faint diagonal rain streaks — very low contrast, just enough
    # texture so the painted plate reads as wet when animated drops
    # land on top.
    streaks = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(streaks)
    count = int((width * height) / 4500)
    for _ in range(count):
        x = rng.randint(0, width)
        y = rng.randint(0, height)
        length = rng.randint(8, 26)
        dx = -2
        dy = length
        alpha = rng.randint(18, 38)
        sdraw.line((x, y, x + dx, y + dy), fill=(200, 215, 240, alpha), width=1)
    streaks = streaks.filter(ImageFilter.GaussianBlur(radius=0.4))
    img.paste(streaks, (0, 0), streaks)

    # Corner vignette so the eye lands center-ish.
    vign = Image.new("L", (width, height), 0)
    vdraw2 = ImageDraw.Draw(vign)
    max_r = int(math.hypot(width, height) * 0.52)
    for r in range(0, max_r, 2):
        t = r / max_r
        vdraw2.ellipse(
            (width // 2 - r, height // 2 - r, width // 2 + r, height // 2 + r),
            outline=int(255 * t * 0.65),
        )
    vign = vign.filter(ImageFilter.GaussianBlur(radius=int(width * 0.06)))
    vign_rgba = Image.merge("RGBA", (
        Image.new("L", (width, height), 0),
        Image.new("L", (width, height), 0),
        Image.new("L", (width, height), 0),
        vign,
    ))
    img.paste(vign_rgba, (0, 0), vign_rgba)

    return img


def main() -> int:
    full = paint(1920, 1080)
    full.save(WALL_DIR / "rainfall.webp", "webp", quality=82, method=6)
    preview = paint(640, 360)
    preview.save(PREV_DIR / "rainfall.webp", "webp", quality=80, method=6)
    print(f"wrote {WALL_DIR / 'rainfall.webp'}")
    print(f"wrote {PREV_DIR / 'rainfall.webp'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
