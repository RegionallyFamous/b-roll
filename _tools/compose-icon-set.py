#!/usr/bin/env python3
"""Compose the first-party ODD default icon set from Dashicons.

ODD icon sets are ordinary raster assets passed to Desktop Mode by URL. This
tool keeps the default set reproducible from Dashicons; themed non-default
sets are source-owned raster files and are not rewritten here:

    python3 _tools/compose-icon-set.py --extract-base
    python3 _tools/compose-icon-set.py --all

The public `.wp` bundle still contains ordinary PNG/WebP files. This script is
only an authoring tool for catalog sources.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ICON_SETS = ROOT / "_tools" / "catalog-sources" / "icon-sets"
GLYPHS = ROOT / "_tools" / "icon-glyphs"
BASE = GLYPHS / "base"
SIZE = 512
DASHICONS_FONT = ROOT / "vendor" / "wp-phpunit" / "wp-phpunit" / "data" / "uploads" / "dashicons.woff"
DASHICON_SOURCE_SIZE = 480
DASHICON_DEFAULT_TARGET = 400
DASHICON_BASE_TARGET = 400

ICON_KEYS = (
    "dashboard",
    "posts",
    "pages",
    "media",
    "comments",
    "appearance",
    "plugins",
    "users",
    "tools",
    "settings",
    "profile",
    "links",
    "recycle-bin",
    "fallback",
)

DEFAULT_DASHICONS = {
    "dashboard": "dashicons-dashboard",
    "posts": "dashicons-admin-post",
    "pages": "dashicons-admin-page",
    "media": "dashicons-admin-media",
    "comments": "dashicons-admin-comments",
    "appearance": "dashicons-admin-appearance",
    "plugins": "dashicons-buddicons-replies",
    "users": "dashicons-admin-users",
    "tools": "dashicons-admin-tools",
    "settings": "dashicons-admin-settings",
    "profile": "dashicons-businessman",
    "links": "dashicons-admin-links",
    "recycle-bin": "dashicons-trash",
    "fallback": "dashicons-admin-generic",
}

DEFAULT_CODEPOINTS = {
    "dashboard": "f226",
    "posts": "f109",
    "pages": "f105",
    "media": "f104",
    "comments": "f101",
    "appearance": "f100",
    "plugins": "f451",
    "users": "f110",
    "tools": "f107",
    "settings": "f108",
    "profile": "f338",
    "links": "f103",
    "recycle-bin": "f182",
    "fallback": "f111",
}

def rgb(value: str) -> tuple[int, int, int]:
    value = clean_hex(value, "#ffffff").lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


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


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


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


def load_mask(key: str) -> Image.Image:
    path = BASE / f"{key}.png"
    if not path.is_file():
        raise SystemExit(f"missing canonical glyph mask: {path}")
    mask = Image.open(path).convert("L")
    if mask.size != (SIZE, SIZE):
        mask = mask.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    return mask


def render_dashicon_mask(
    key: str,
    codepoints: dict[str, str] | None = None,
    *,
    target: int,
) -> Image.Image:
    if not DASHICONS_FONT.is_file():
        raise SystemExit(f"missing Dashicons font: {DASHICONS_FONT}")
    raw = (codepoints or DEFAULT_CODEPOINTS).get(key, DEFAULT_CODEPOINTS[key])
    try:
        codepoint = int(str(raw), 16)
    except ValueError as exc:
        raise SystemExit(f"invalid Dashicon codepoint for {key}: {raw!r}") from exc

    font = ImageFont.truetype(str(DASHICONS_FONT), DASHICON_SOURCE_SIZE)
    scratch = Image.new("L", (SIZE * 2, SIZE * 2), 0)
    draw = ImageDraw.Draw(scratch)
    char = chr(codepoint)
    bbox = draw.textbbox((0, 0), char, font=font)
    draw.text((-bbox[0] + 32, -bbox[1] + 32), char, font=font, fill=255)
    glyph_box = scratch.getbbox()
    if glyph_box is None:
        raise SystemExit(f"Dashicon {key} rendered empty")

    crop = scratch.crop(glyph_box)
    scale = target / max(crop.size)
    new_size = (
        max(1, round(crop.width * scale)),
        max(1, round(crop.height * scale)),
    )
    crop = crop.resize(new_size, Image.Resampling.LANCZOS)
    mask = Image.new("L", (SIZE, SIZE), 0)
    mask.paste(crop, ((SIZE - new_size[0]) // 2, (SIZE - new_size[1]) // 2))
    return mask.filter(ImageFilter.GaussianBlur(0.18))


def material() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for y in range(SIZE):
        t = y / (SIZE - 1)
        draw.line((0, y, SIZE, y), fill=(*mix((255, 255, 255), (226, 243, 255), t), 255))
    return img.filter(ImageFilter.GaussianBlur(0.25))


def compose_icon(mask: Image.Image, base_material: Image.Image, accent_hex: str, secondary_hex: str, spark_hex: str) -> Image.Image:
    accent = rgb(accent_hex)
    secondary = rgb(secondary_hex)
    spark = rgb(spark_hex)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    shadow_mask = mask.filter(ImageFilter.GaussianBlur(8)).point(lambda p: min(110, p))
    shadow = Image.new("RGBA", (SIZE, SIZE), (5, 4, 10, 0))
    shadow.putalpha(shadow_mask)
    shifted_shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shifted_shadow.alpha_composite(shadow, (0, 8))
    out.alpha_composite(shifted_shadow)

    glow_a = Image.new("RGBA", (SIZE, SIZE), (*accent, 0))
    glow_a.putalpha(mask.filter(ImageFilter.GaussianBlur(16)).point(lambda p: min(84, p)))
    out.alpha_composite(glow_a)
    glow_b = Image.new("RGBA", (SIZE, SIZE), (*secondary, 0))
    glow_b.putalpha(mask.filter(ImageFilter.GaussianBlur(5)).point(lambda p: min(62, p)))
    shifted_b = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shifted_b.alpha_composite(glow_b, (-2, 1))
    out.alpha_composite(shifted_b)

    expanded = mask.filter(ImageFilter.MaxFilter(9))
    rim_mask = ImageChops.subtract(expanded, mask).point(lambda p: min(210, p * 2))
    rim = Image.new("RGBA", (SIZE, SIZE), (8, 5, 17, 0))
    rim.putalpha(rim_mask)
    out.alpha_composite(rim)

    body = base_material.copy()
    body.putalpha(mask)
    out.alpha_composite(body)

    shine_mask = mask.filter(ImageFilter.GaussianBlur(1)).point(lambda p: int(p * 0.28))
    shine = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 0))
    shine.putalpha(shine_mask)
    top_clip = Image.new("L", (SIZE, SIZE), 0)
    td = ImageDraw.Draw(top_clip)
    td.ellipse((42, 28, 330, 180), fill=255)
    shine.putalpha(ImageChops.multiply(shine.getchannel("A"), top_clip))
    out.alpha_composite(shine)

    spark_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(spark_layer)
    for x, y, r in ((404, 95, 6), (438, 128, 3), (78, 414, 4)):
        sd.ellipse((x - r, y - r, x + r, y + r), fill=(*spark, 160))
    out.alpha_composite(spark_layer)
    return out


def compose_default_icon(mask: Image.Image, base_material: Image.Image, accent_hex: str, secondary_hex: str, spark_hex: str) -> Image.Image:
    accent = rgb(accent_hex)
    secondary = rgb(secondary_hex)
    spark = rgb(spark_hex)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    shadow_mask = mask.filter(ImageFilter.GaussianBlur(7)).point(lambda p: min(96, p))
    shadow = Image.new("RGBA", (SIZE, SIZE), (5, 4, 10, 0))
    shadow.putalpha(shadow_mask)
    shifted_shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shifted_shadow.alpha_composite(shadow, (0, 7))
    out.alpha_composite(shifted_shadow)

    for color, blur, limit, offset in (
        (accent, 14, 72, (-2, 1)),
        (secondary, 10, 56, (2, 1)),
        (spark, 18, 32, (0, 0)),
    ):
        glow = Image.new("RGBA", (SIZE, SIZE), (*color, 0))
        glow.putalpha(mask.filter(ImageFilter.GaussianBlur(blur)).point(lambda p: min(limit, p)))
        shifted = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        shifted.alpha_composite(glow, offset)
        out.alpha_composite(shifted)

    expanded = mask.filter(ImageFilter.MaxFilter(9))
    rim_mask = ImageChops.subtract(expanded, mask).point(lambda p: min(210, p * 2))
    rim = Image.new("RGBA", (SIZE, SIZE), (32, 34, 47, 0))
    rim.putalpha(rim_mask)
    out.alpha_composite(rim)

    body = base_material.copy()
    body.putalpha(mask)
    out.alpha_composite(body)
    return out


def extract_base(source_slug: str) -> None:
    source = ICON_SETS / source_slug
    source_map = source / "source-glyph-map.json"
    data = json.loads(source_map.read_text()) if source_map.is_file() else {}
    BASE.mkdir(parents=True, exist_ok=True)
    glyphs = {}
    for key in ICON_KEYS:
        # Keep the canonical source as the actual Dashicon glyph, not a
        # thresholded copy of a rendered icon with glow/shadow already baked in.
        mask = render_dashicon_mask(key, data.get("codepoints"), target=DASHICON_BASE_TARGET)
        mask.save(BASE / f"{key}.png")
        glyphs[key] = {
            "mask": f"base/{key}.png",
            "dashicon": (data.get("icons") or DEFAULT_DASHICONS).get(key, DEFAULT_DASHICONS[key]),
            "codepoint": (data.get("codepoints") or DEFAULT_CODEPOINTS).get(key, DEFAULT_CODEPOINTS[key]),
        }
    manifest = {
        "name": "ODD Canonical Icon Glyphs",
        "version": "1.0.0",
        "size": SIZE,
        "source": source_slug,
        "requiredKeys": list(ICON_KEYS),
        "contract": "default-dashicon-raster-source",
        "glyphs": glyphs,
    }
    (GLYPHS / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


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
    accent = clean_hex(manifest.get("accent"), "#38e8ff")
    secondary = "#ff44b5"
    spark = "#9556ff"
    base_material = material()
    source_map_path = src_dir / "source-glyph-map.json"
    source_map = json.loads(source_map_path.read_text()) if source_map_path.is_file() else {}
    codepoints = source_map.get("codepoints") if isinstance(source_map.get("codepoints"), dict) else DEFAULT_CODEPOINTS
    for key, rel in paths.items():
        if not isinstance(rel, str) or not rel.endswith((".webp", ".png")):
            raise SystemExit(f"icon-set {slug}: {key} path must be PNG or WebP")
        mask = render_dashicon_mask(key, codepoints, target=DASHICON_DEFAULT_TARGET)
        icon = compose_default_icon(mask, base_material, accent, secondary, spark)
        out = src_dir / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        if out.suffix.lower() == ".png":
            icon.save(out, "PNG", optimize=True)
        else:
            icon.save(out, "WEBP", quality=88, method=4)
    print(f"rendered {slug}", flush=True)


def all_sets() -> list[str]:
    return sorted(path.name for path in ICON_SETS.iterdir() if (path / "manifest.json").is_file())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extract-base", action="store_true", help="Refresh _tools/icon-glyphs/base from the default set.")
    parser.add_argument("--source-set", default="odd-default-icons", help="Set used by --extract-base.")
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
