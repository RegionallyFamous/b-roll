#!/usr/bin/env python3
"""Generate placeholder backdrop + preview + shared-drifter WebP files.

The 5 v0.10 scenes (Beacon Hills, Entry Plug, Wasteland, Attract Mode,
Outrun) ship with programmatically-painted gradient backdrops so the
bundle is self-contained for first-run. Each scene's JS already
layers the real animation on top; the painted JPG (now WebP) is only
the frozen first-paint JPG that flashes before Pixi boots and a
fallback for reduced-motion still-life previews.

This also emits simple vector-ish drifter cutouts for the shared
drifter library (src/drifters.json). They are transparent and
intentionally minimal — more of a line-art silhouette than art
direction — so they read as accents rather than stealing focus.

Run:
    python3 tools/build-placeholders.py

Re-run idempotently; existing files are overwritten.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent.parent
WALLPAPERS = ROOT / "assets" / "wallpapers"
PREVIEWS = ROOT / "assets" / "previews"
DRIFTERS = ROOT / "assets" / "drifters"

WALLPAPER_SIZE = (1920, 1080)
PREVIEW_SIZE = (640, 360)


def lerp(a, b, t):
    return int(a + (b - a) * t)


def vgradient(size, stops):
    """Vertical gradient. `stops` is a list of (t, (r,g,b)) in 0..1 order."""
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                local = (t - t0) / max(1e-6, t1 - t0)
                c = (
                    lerp(c0[0], c1[0], local),
                    lerp(c0[1], c1[1], local),
                    lerp(c0[2], c1[2], local),
                )
                break
        else:
            c = stops[-1][1]
        for x in range(w):
            px[x, y] = c
    return img


def paint_beacon_hills(size):
    # Pre-dawn Misty Mountains: deep blue to pale violet to a
    # suggestion of amber near horizon.
    img = vgradient(
        size,
        [
            (0.0, (6, 10, 18)),
            (0.45, (22, 34, 58)),
            (0.7, (60, 58, 84)),
            (0.9, (130, 90, 76)),
            (1.0, (30, 18, 20)),
        ],
    )
    d = ImageDraw.Draw(img, "RGBA")
    w, h = size
    # Stepped mountain silhouettes receding into fog. Drawn as
    # back-to-front jagged polys, each row darker + hazier.
    rng = random.Random(8821)
    layers = [
        (0.58, (34, 44, 64), 18),
        (0.66, (22, 32, 52), 28),
        (0.74, (12, 20, 36), 40),
        (0.82, (6, 10, 22), 56),
    ]
    for y_ratio, color, jag in layers:
        base_y = int(h * y_ratio)
        pts = [(0, h)]
        x = 0
        while x < w:
            dx = rng.randint(60, 200)
            peak = base_y - rng.randint(0, jag * 2)
            pts.append((x, peak))
            x += dx
        pts.append((w, base_y))
        pts.append((w, h))
        d.polygon(pts, fill=color)
    # Near stone-wall band.
    d.rectangle([0, int(h * 0.86), w, h], fill=(8, 8, 12))
    return img


def paint_nerv(size):
    # Amber LCL with refraction streaks.
    img = vgradient(
        size,
        [
            (0.0, (48, 18, 10)),
            (0.5, (160, 80, 24)),
            (1.0, (92, 36, 12)),
        ],
    )
    d = ImageDraw.Draw(img, "RGBA")
    w, h = size
    # Subtle horizontal refraction stripes
    rng = random.Random(4012)
    for _ in range(80):
        y = rng.randint(0, h)
        alpha = rng.randint(12, 40)
        d.rectangle([0, y, w, y + rng.randint(2, 6)], fill=(255, 210, 140, alpha))
    # A faint cruciform shadow in the center so the cross knows
    # where to live.
    cx, cy = w // 2, h // 2
    d.rectangle([cx - 6, cy - int(h * 0.35), cx + 6, cy + int(h * 0.35)], fill=(60, 20, 8, 120))
    d.rectangle([cx - int(w * 0.35), cy - 6, cx + int(w * 0.35), cy + 6], fill=(60, 20, 8, 120))
    img = img.filter(ImageFilter.GaussianBlur(radius=1.4))
    return img


def paint_wasteland(size):
    img = vgradient(
        size,
        [
            (0.0, (58, 20, 8)),
            (0.35, (180, 82, 24)),
            (0.55, (210, 120, 48)),
            (1.0, (60, 28, 16)),
        ],
    )
    d = ImageDraw.Draw(img, "RGBA")
    w, h = size
    # Cracked-earth horizon silhouette.
    d.rectangle([0, int(h * 0.58), w, int(h * 0.62)], fill=(40, 18, 10))
    # Rust bluff in mid-ground.
    d.polygon(
        [(0, int(h * 0.7)), (int(w * 0.4), int(h * 0.55)),
         (int(w * 0.55), int(h * 0.62)), (int(w * 0.8), int(h * 0.58)),
         (w, int(h * 0.72)), (w, h), (0, h)],
        fill=(86, 36, 16),
    )
    # Painted vanishing road: two converging lines.
    vpx, vpy = w // 2, int(h * 0.58)
    for dx in (-6, 6):
        d.polygon(
            [(vpx + dx, vpy), (vpx + dx * 60, h), (vpx + dx * 60 + 4, h), (vpx + dx + 2, vpy)],
            fill=(210, 170, 90),
        )
    return img


def paint_attract(size):
    # Black void with a subtle phosphor halo and a corner high-score.
    img = Image.new("RGB", size, (2, 2, 6))
    d = ImageDraw.Draw(img, "RGBA")
    w, h = size
    # Vignette toward center
    cx, cy = w // 2, h // 2
    max_r = int(math.hypot(cx, cy))
    for r in range(max_r, 0, -40):
        t = 1 - r / max_r
        d.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(int(6 * t), int(10 * t), int(18 * t)),
        )
    # Implied maze contour band along the bottom third (simple
    # rectangle outline + a few gaps so pellets can ride it).
    d.rectangle(
        [int(w * 0.08), int(h * 0.78), int(w * 0.92), int(h * 0.88)],
        outline=(70, 50, 200), width=3,
    )
    # CRT bezel edge (soft rounded rectangle border).
    border = 14
    d.rounded_rectangle(
        [border, border, w - border, h - border],
        outline=(40, 40, 60), width=6, radius=40,
    )
    # Corner "HIGH SCORE 999950" painted glyph-bars (we can't ship a
    # font, so approximate with little rectangles arranged like a
    # 7-segment display).
    for i, ch in enumerate("999950"):
        px = int(w * 0.06) + i * 26
        py = int(h * 0.09)
        for seg in range(7):
            sx = px + (seg % 2) * 16
            sy = py + (seg // 2) * 10
            d.rectangle([sx, sy, sx + 12, sy + 6], fill=(180, 255, 160, 140))
    return img


def paint_outrun(size):
    # Violet-orange sunset + triangular mountains + palm silhouettes.
    img = vgradient(
        size,
        [
            (0.0, (18, 6, 44)),
            (0.35, (90, 20, 90)),
            (0.55, (220, 90, 120)),
            (0.7, (255, 160, 100)),
            (0.78, (40, 12, 48)),
            (1.0, (8, 4, 22)),
        ],
    )
    d = ImageDraw.Draw(img, "RGBA")
    w, h = size
    # Triangular mountains behind the horizon.
    peaks = [
        (0.1, 0.45), (0.22, 0.38), (0.32, 0.46), (0.45, 0.36),
        (0.58, 0.42), (0.72, 0.34), (0.86, 0.44), (0.98, 0.4),
    ]
    pts = [(0, int(h * 0.6))]
    for px, py in peaks:
        pts.append((int(w * px), int(h * py)))
    pts.extend([(w, int(h * 0.6)), (w, int(h * 0.78)), (0, int(h * 0.78))])
    d.polygon(pts, fill=(26, 10, 42))
    # Palm silhouettes.
    for px in (0.08, 0.92):
        x = int(w * px)
        d.rectangle([x - 3, int(h * 0.4), x + 3, int(h * 0.78)], fill=(6, 2, 14))
        for k in range(-3, 4):
            fx = x + k * 18
            fy = int(h * 0.4) + abs(k) * 6
            d.polygon(
                [(x, int(h * 0.4)), (fx, fy - 12), (fx, fy + 6)],
                fill=(6, 2, 14),
            )
    return img


def save_webp(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=82, method=5)


def emit_scene_assets():
    painters = {
        "beacon-hills":   paint_beacon_hills,
        "nerv-entry-plug": paint_nerv,
        "wasteland":      paint_wasteland,
        "attract-mode":   paint_attract,
        "outrun":         paint_outrun,
    }
    for slug, paint in painters.items():
        wall = paint(WALLPAPER_SIZE)
        save_webp(wall, WALLPAPERS / f"{slug}.webp")
        preview = wall.resize(PREVIEW_SIZE, Image.LANCZOS)
        save_webp(preview, PREVIEWS / f"{slug}.webp")


# --- Shared drifter cutouts -------------------------------------- #


def make_transparent(size):
    return Image.new("RGBA", size, (0, 0, 0, 0))


def drifter_leaf():
    img = make_transparent((180, 200))
    d = ImageDraw.Draw(img)
    d.polygon(
        [(90, 10), (150, 80), (140, 170), (90, 190), (40, 170), (30, 80)],
        fill=(210, 120, 40, 230),
    )
    d.line([(90, 10), (90, 190)], fill=(120, 60, 20, 255), width=4)
    for y in range(30, 180, 18):
        d.line([(90, y), (60 + (y % 2) * 20, y + 10)], fill=(140, 70, 24, 200), width=2)
        d.line([(90, y), (120 - (y % 2) * 20, y + 10)], fill=(140, 70, 24, 200), width=2)
    return img


def drifter_comet():
    img = make_transparent((300, 120))
    d = ImageDraw.Draw(img)
    for i in range(260, 0, -2):
        a = int(255 * (i / 260) * 0.65)
        d.ellipse([40 + i, 52, 50 + i, 62], fill=(200, 220, 255, a))
    d.ellipse([260, 45, 295, 80], fill=(255, 255, 240, 255))
    return img


def drifter_lantern():
    img = make_transparent((140, 220))
    d = ImageDraw.Draw(img)
    d.line([(70, 0), (70, 40)], fill=(80, 50, 10, 255), width=3)
    d.rectangle([20, 40, 120, 180], fill=(220, 80, 60, 230))
    d.rectangle([30, 50, 110, 170], outline=(250, 180, 100, 200), width=3)
    d.rectangle([10, 180, 130, 195], fill=(80, 50, 10, 255))
    d.rectangle([10, 30, 130, 45], fill=(80, 50, 10, 255))
    return img


def drifter_crow():
    img = make_transparent((240, 120))
    d = ImageDraw.Draw(img)
    # Simple "M"-shaped seagull silhouette.
    d.polygon(
        [(20, 80), (60, 40), (100, 70), (120, 55), (140, 70), (180, 40), (220, 80),
         (180, 65), (140, 78), (120, 65), (100, 78), (60, 65)],
        fill=(10, 10, 14, 230),
    )
    return img


def drifter_firefly_swarm():
    img = make_transparent((260, 200))
    rng = random.Random(912)
    d = ImageDraw.Draw(img)
    for _ in range(60):
        cx = rng.randint(10, 250)
        cy = rng.randint(10, 190)
        r = rng.randint(2, 5)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(220, 255, 160, 200))
    # Soft halo pass.
    img = img.filter(ImageFilter.GaussianBlur(radius=2))
    return img


def drifter_snowflake():
    img = make_transparent((80, 80))
    d = ImageDraw.Draw(img)
    cx, cy = 40, 40
    for a in range(0, 360, 60):
        rad = math.radians(a)
        dx = math.cos(rad) * 34
        dy = math.sin(rad) * 34
        d.line([(cx, cy), (cx + dx, cy + dy)], fill=(235, 245, 255, 230), width=3)
        # little side whiskers
        nx = cx + dx * 0.55
        ny = cy + dy * 0.55
        wx = math.cos(rad + math.pi / 2) * 10
        wy = math.sin(rad + math.pi / 2) * 10
        d.line([(nx - wx, ny - wy), (nx + wx, ny + wy)], fill=(235, 245, 255, 180), width=2)
    return img


def drifter_firework():
    img = make_transparent((260, 260))
    d = ImageDraw.Draw(img)
    cx, cy = 130, 130
    colors = [(255, 90, 120), (255, 220, 120), (120, 200, 255), (200, 255, 180)]
    rng = random.Random(4200)
    for i in range(60):
        ang = rng.random() * 2 * math.pi
        rr = 60 + rng.random() * 60
        x2 = cx + math.cos(ang) * rr
        y2 = cy + math.sin(ang) * rr
        color = rng.choice(colors) + (200,)
        d.line([(cx, cy), (x2, y2)], fill=color, width=2)
    img = img.filter(ImageFilter.GaussianBlur(radius=1.2))
    return img


def emit_drifter_assets():
    makers = {
        "leaf.webp":           drifter_leaf,
        "comet.webp":          drifter_comet,
        "lantern.webp":        drifter_lantern,
        "crow.webp":           drifter_crow,
        "firefly-swarm.webp":  drifter_firefly_swarm,
        "snowflake.webp":      drifter_snowflake,
        "firework.webp":       drifter_firework,
    }
    for name, make in makers.items():
        img = make()
        save_webp(img, DRIFTERS / name)


def main():
    emit_scene_assets()
    emit_drifter_assets()
    print(f"wrote 5 scenes + {len(list(DRIFTERS.glob('*.webp')))} drifters")


if __name__ == "__main__":
    main()
