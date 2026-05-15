#!/usr/bin/env python3
"""
Generate the static wallpaper and preview for the `oddling-desktop`
scene.

The scene itself is authored as a Pixi tick function on top of a
painted still-life wallpaper. This script only emits the static scene
artwork:

    * `_tools/catalog-sources/scenes/oddling-desktop/wallpaper.webp`
      1920x1080, painted still-life terrarium background.
    * `_tools/catalog-sources/scenes/oddling-desktop/preview.webp`
      640x360 thumbnail of the same artwork.

Usage:
    python3 _tools/gen-oddling-desktop.py

Idempotent. Intentionally has no arguments: this is the ODD default
scene, so the output is fixed.
"""
from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
SOURCES = HERE / "catalog-sources"
SCENE_DIR = SOURCES / "scenes" / "oddling-desktop"


def mix(
    a: tuple[int, int, int],
    b: tuple[int, int, int],
    t: float,
) -> tuple[int, int, int]:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def paint_wallpaper(w: int = 1920, h: int = 1080) -> Image.Image:
    """Paint a still-life desktop terrarium backdrop.

    The Pixi scene paints hero motion on top; this image only needs to
    establish mood: dark plum horizon, CRT curvature, soft specimen
    haze, and a handful of barely-there creature silhouettes so the
    desktop reads as inhabited even with reduced motion on.
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

    # Distant horizon CRT curve glow.
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

    # Distant specimen drawer silhouette.
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

    # Scattered dim file-tab card silhouettes floating in mid field.
    for _ in range(18):
        cx = rng.randint(80, w - 80)
        cy = rng.randint(int(h * 0.15), int(h * 0.55))
        ww = rng.randint(90, 180)
        hh = int(ww * 0.62)
        a = rng.randint(22, 62)
        tint = rng.choice(
            [
                (56, 232, 255),
                (255, 95, 168),
                (255, 216, 74),
                (178, 102, 255),
            ]
        )
        draw.rounded_rectangle(
            (cx - ww // 2, cy - hh // 2, cx + ww // 2, cy + hh // 2),
            radius=14,
            fill=tint + (a,),
        )

    # A few tiny oddling shapes peeking near the bottom.
    for i, (fx, fy, col) in enumerate(
        [
            (0.22, 0.78, (56, 232, 255)),
            (0.44, 0.83, (255, 95, 168)),
            (0.66, 0.78, (184, 255, 90)),
            (0.82, 0.85, (255, 216, 74)),
        ]
    ):
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

    # CRT scanlines, very subtle.
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
    write_scene_assets()
    # The scene.js and meta.json are hand-authored and live alongside.


if __name__ == "__main__":
    main()
