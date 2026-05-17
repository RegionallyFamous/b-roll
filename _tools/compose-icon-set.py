#!/usr/bin/env python3
"""Compose the first-party ODD default desktop icon set.

ODD icon sets are ordinary raster assets passed to Desktop Mode by URL. The
default set targets the visible Desktop Mode desktop shortcuts ODD owns or
themes: ODD, My WordPress, Content Graph, Recycle Bin, and the generic fallback.

    python3 _tools/compose-icon-set.py --extract-base
    python3 _tools/compose-icon-set.py --all

The public `.wp` bundle still contains plain PNG/WebP files. This script is an
authoring tool for slicing the approved source contact sheet, normalizing the
icons, and baking a subtle animated WebP finish into the default set.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ICON_SETS = ROOT / "_tools" / "catalog-sources" / "icon-sets"
GLYPHS = ROOT / "_tools" / "icon-glyphs"
BASE = GLYPHS / "base"

SIZE = 512
EXPORT_LONG_EDGE = 448
CONTACT_COLUMNS = 5
FRAME_COUNT = 6

ICON_KEYS = (
    "odd",
    "my-wordpress",
    "content-graph",
    "recycle-bin",
    "fallback",
)

ICON_DESCRIPTIONS = {
    "odd": "animated arcade-sticker ODD eye launcher",
    "my-wordpress": "animated arcade-sticker WordPress dashboard gauge",
    "content-graph": "animated arcade-sticker content graph nodes",
    "recycle-bin": "animated arcade-sticker recycle bin",
    "fallback": "animated arcade-sticker fallback portal",
}

ICON_ACCENTS = {
    "odd": ("#ff4fa8", "#7ee3ff", "#ffe9a8"),
    "my-wordpress": ("#ff4fa8", "#7ee3ff", "#ffe9a8"),
    "content-graph": ("#b04be1", "#7ee3ff", "#ffd45a"),
    "recycle-bin": ("#ff4fa8", "#4d8cff", "#ffe9a8"),
    "fallback": ("#b04be1", "#42dfff", "#ff5aa8"),
}


def clean_hex(value: str | None, fallback: str) -> str:
    value = (value or "").strip()
    if len(value) == 4 and value.startswith("#"):
        return "#" + "".join(ch * 2 for ch in value[1:])
    if len(value) in (7, 9) and value.startswith("#"):
        try:
            int(value[1:7], 16)
        except ValueError:
            return fallback
        return value[:7]
    return fallback


def rgb(value: str) -> tuple[int, int, int]:
    value = clean_hex(value, "#ffffff").lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def rgba(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    return (*rgb(value), alpha)


def transparent() -> Image.Image:
    return Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))


def load_manifest(slug: str) -> dict:
    path = ICON_SETS / slug / "manifest.json"
    if not path.is_file():
        raise SystemExit(f"missing icon-set manifest: {path}")
    return json.loads(path.read_text())


def icon_paths(manifest: dict, required_keys: tuple[str, ...]) -> dict[str, str]:
    icons = manifest.get("icons")
    if not isinstance(icons, dict):
        raise SystemExit(f"icon-set {manifest.get('slug', '?')}: missing icons map")
    missing = [key for key in required_keys if key not in icons]
    if missing:
        raise SystemExit(f"icon-set {manifest.get('slug', '?')}: missing icons {missing}")
    return {key: icons[key] for key in required_keys}


def source_contact_sheet(src_dir: Path) -> Path:
    source = src_dir / "source-contact-sheet.png"
    if not source.is_file():
        raise SystemExit(f"missing default icon source contact sheet: {source}")
    return source


def contact_cell_boxes(width: int, height: int) -> list[tuple[int, int, int, int]]:
    if width < height * 2:
        raise SystemExit("default icon source contact sheet must be a one-row five-icon sheet")
    boxes = []
    for index in range(CONTACT_COLUMNS):
        left = round(index * width / CONTACT_COLUMNS)
        right = round((index + 1) * width / CONTACT_COLUMNS)
        boxes.append((left, 0, right, height))
    return boxes


def contact_foreground_mask(cell: Image.Image) -> Image.Image:
    rgb_cell = cell.convert("RGB")
    red, green, blue = rgb_cell.split()
    max_channel = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    min_channel = ImageChops.darker(ImageChops.darker(red, green), blue)
    saturation = ImageChops.subtract(max_channel, min_channel)

    bright = max_channel.point(lambda value: 255 if value > 58 else 0)
    colorful = saturation.point(lambda value: 255 if value > 28 else 0)
    not_background = max_channel.point(lambda value: 255 if value > 40 else 0)
    colorful = ImageChops.multiply(colorful, not_background)
    mask = ImageChops.lighter(bright, colorful)

    # The source art has dark rims and shadows. Grow the visible body mask
    # before softening it so those rims survive background removal.
    mask = mask.filter(ImageFilter.MaxFilter(29))
    mask = mask.filter(ImageFilter.GaussianBlur(2.2))
    return mask.point(lambda value: 0 if value < 18 else min(255, round((value - 18) * 1.4)))


def padded_bbox(mask: Image.Image, pad: int = 12) -> tuple[int, int, int, int]:
    bbox = mask.point(lambda value: 255 if value > 20 else 0).getbbox()
    if not bbox:
        raise SystemExit("could not find icon subject in source contact sheet")
    left, top, right, bottom = bbox
    return (
        max(0, left - pad),
        max(0, top - pad),
        min(mask.width, right + pad),
        min(mask.height, bottom + pad),
    )


def normalize_icon(cell: Image.Image) -> Image.Image:
    mask = contact_foreground_mask(cell)
    bbox = padded_bbox(mask)
    crop = cell.convert("RGBA").crop(bbox)
    crop_mask = mask.crop(bbox)
    crop.putalpha(crop_mask)

    longest = max(crop.width, crop.height)
    scale = EXPORT_LONG_EDGE / longest
    resized = crop.resize(
        (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
        Image.Resampling.LANCZOS,
    )
    icon = transparent()
    icon.alpha_composite(resized, ((SIZE - resized.width) // 2, (SIZE - resized.height) // 2))
    return icon


def load_source_icons(src_dir: Path) -> dict[str, Image.Image]:
    with Image.open(source_contact_sheet(src_dir)) as sheet:
        source = sheet.convert("RGB")
    cells = [source.crop(box) for box in contact_cell_boxes(*source.size)]
    return {key: normalize_icon(cells[index]) for index, key in enumerate(ICON_KEYS)}


def draw_star(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    radius: float,
    fill: tuple[int, int, int, int],
) -> None:
    tight = radius * 0.34
    points = [
        (cx, cy - radius),
        (cx + tight, cy - tight),
        (cx + radius, cy),
        (cx + tight, cy + tight),
        (cx, cy + radius),
        (cx - tight, cy + tight),
        (cx - radius, cy),
        (cx - tight, cy - tight),
    ]
    draw.polygon(points, fill=fill)


def alpha_layer(alpha: Image.Image, color: str, limit: int, blur: float, scale: float) -> Image.Image:
    layer = transparent()
    glow_alpha = alpha.filter(ImageFilter.GaussianBlur(blur))
    glow_alpha = glow_alpha.point(lambda value: min(limit, round(value * scale)))
    layer.putalpha(glow_alpha)
    fill = Image.new("RGBA", (SIZE, SIZE), rgba(color, 255))
    fill.putalpha(layer.getchannel("A"))
    return fill


def sheen_layer(alpha: Image.Image, phase: int) -> Image.Image:
    sheen = transparent()
    draw = ImageDraw.Draw(sheen)
    x = -180 + phase * (SIZE + 360) / FRAME_COUNT
    draw.polygon(
        [
            (x, -80),
            (x + 72, -80),
            (x + 252, SIZE + 80),
            (x + 180, SIZE + 80),
        ],
        fill=(255, 255, 255, 30),
    )
    sheen.putalpha(ImageChops.multiply(sheen.getchannel("A"), alpha.filter(ImageFilter.GaussianBlur(0.7))))
    return sheen


def moving_spark_layer(key: str, alpha: Image.Image, phase: int) -> Image.Image:
    bbox = alpha.point(lambda value: 255 if value > 20 else 0).getbbox() or (56, 56, 456, 456)
    left, top, right, bottom = bbox
    cx = (left + right) / 2
    cy = (top + bottom) / 2
    rx = max(92, (right - left) * 0.52)
    ry = max(92, (bottom - top) * 0.48)
    starts = {
        "odd": -0.10,
        "my-wordpress": 0.18,
        "content-graph": 0.42,
        "recycle-bin": 0.66,
        "fallback": 0.88,
    }
    angle = (starts.get(key, 0) + phase / FRAME_COUNT * 0.34) * math.tau
    x = min(SIZE - 34, max(34, cx + math.cos(angle) * rx))
    y = min(SIZE - 34, max(34, cy + math.sin(angle) * ry))
    radius = 13 + (phase % 3 == 1) * 2
    layer = transparent()
    draw = ImageDraw.Draw(layer)
    draw_star(draw, x, y, radius + 7, (7, 5, 15, 230))
    draw_star(draw, x, y, radius, rgba(ICON_ACCENTS[key][2], 236))
    return layer


def compose_frame(key: str, base: Image.Image, phase: int) -> Image.Image:
    accent, secondary, _spark = ICON_ACCENTS[key]
    alpha = base.getchannel("A")
    pulse = 0.82 + 0.18 * math.sin((phase / FRAME_COUNT) * math.tau)
    frame = transparent()
    frame.alpha_composite(alpha_layer(alpha, accent, 58, 14, 0.22 + 0.08 * pulse), (2, 1))
    frame.alpha_composite(alpha_layer(alpha, secondary, 44, 9, 0.18 + 0.06 * (1 - pulse)), (-2, 1))
    frame.alpha_composite(base)
    frame.alpha_composite(sheen_layer(alpha, phase))
    frame.alpha_composite(moving_spark_layer(key, alpha, phase))
    return frame


def animated_frames(key: str, base: Image.Image) -> list[Image.Image]:
    return [compose_frame(key, base, phase).convert("RGBA") for phase in range(FRAME_COUNT)]


def write_source_map(src_dir: Path) -> None:
    source_map = {
        "contract": "desktop-default-raster-source",
        "source": "source-contact-sheet.png via _tools/compose-icon-set.py",
        "icons": ICON_DESCRIPTIONS,
        "keys": list(ICON_KEYS),
    }
    (src_dir / "source-glyph-map.json").write_text(json.dumps(source_map, indent=2) + "\n")


def extract_base(source_slug: str) -> None:
    src_dir = ICON_SETS / source_slug
    BASE.mkdir(parents=True, exist_ok=True)
    icons = load_source_icons(src_dir)
    glyphs = {}
    for key, icon in icons.items():
        mask = icon.getchannel("A")
        mask.save(BASE / f"{key}.png", "PNG", optimize=True)
        glyphs[key] = {
            "mask": f"base/{key}.png",
            "description": ICON_DESCRIPTIONS[key],
        }
    manifest = {
        "name": "ODD Canonical Desktop Icon Glyphs",
        "version": "1.0.0",
        "size": SIZE,
        "source": source_slug,
        "requiredKeys": list(ICON_KEYS),
        "contract": "desktop-default-raster-source",
        "glyphs": glyphs,
    }
    (GLYPHS / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"extracted base masks for {source_slug}", flush=True)


def render_set(slug: str) -> None:
    manifest = load_manifest(slug)
    paths = icon_paths(manifest, ICON_KEYS)
    src_dir = ICON_SETS / slug
    if slug != "odd-default-icons":
        for key, rel in paths.items():
            if not isinstance(rel, str) or not rel.endswith((".webp", ".png")):
                raise SystemExit(f"icon-set {slug}: {key} path must be PNG or WebP")
            if not (src_dir / rel).is_file():
                raise SystemExit(f"icon-set {slug}: missing source raster {rel}")
        print(f"kept source rasters for {slug}", flush=True)
        return

    rendered = load_source_icons(src_dir)
    for key, rel in paths.items():
        if not isinstance(rel, str) or not rel.endswith((".webp", ".png")):
            raise SystemExit(f"icon-set {slug}: {key} path must be PNG or WebP")
        out = src_dir / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        icon = rendered[key]
        if out.suffix.lower() == ".png":
            compose_frame(key, icon, 0).save(out, "PNG", optimize=True)
        elif out.suffix.lower() == ".webp":
            frames = animated_frames(key, icon)
            tmp = out.with_suffix(out.suffix + ".tmp")
            frames[0].save(
                tmp,
                "WEBP",
                save_all=True,
                append_images=frames[1:],
                duration=[140] * FRAME_COUNT,
                loop=0,
                quality=82,
                method=4,
                lossless=False,
            )
            tmp.replace(out)

    write_source_map(src_dir)
    print(f"rendered {slug}", flush=True)


def all_sets() -> list[str]:
    return sorted(path.name for path in ICON_SETS.iterdir() if (path / "manifest.json").is_file())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extract-base", action="store_true", help="Refresh _tools/icon-glyphs/base from the default icon source.")
    parser.add_argument("--source-set", default="odd-default-icons", help="Set used by --extract-base metadata.")
    parser.add_argument("--set", dest="sets", action="append", default=[], help="Render one icon set slug. Repeatable.")
    parser.add_argument("--all", action="store_true", help="Render every first-party icon set.")
    args = parser.parse_args()

    if args.extract_base:
        extract_base(args.source_set)
    targets = all_sets() if args.all else args.sets
    if args.all and "odd-default-icons" in targets:
        targets = ["odd-default-icons"] + [slug for slug in targets if slug != "odd-default-icons"]
    for slug in targets:
        render_set(slug)
    if not args.extract_base and not targets:
        parser.error("choose --extract-base, --set, or --all")


if __name__ == "__main__":
    main()
