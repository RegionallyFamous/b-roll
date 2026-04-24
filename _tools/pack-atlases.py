"""Pack per-scene cut-outs into a single WebP atlas + JSON manifest.

Cut-outs are stored as individual WebPs under assets/cutouts/<slug>/*.webp.
At runtime, each scene loads its 4-ish cut-outs with separate HTTP
requests. Packing them into one atlas per scene (assets/atlases/<slug>.webp
+ .json) drops per-scene cut-out requests from N -> 1. For all 9
illustrated scenes that is 36 -> 9.

The JSON is written in Pixi v8's spritesheet format so
PIXI.Assets.load(".../<slug>.json") returns a Spritesheet whose
`.textures` dict is keyed by the original cut-out filename (e.g.
"agent.webp"). mountCutouts() then just looks up `sheet.textures[def.file]`
instead of loading each cut-out individually.

Usage:
    python3 _tools/pack-atlases.py

Inputs:  src/scenes.json (the `cutouts` arrays) + assets/cutouts/<slug>/*.webp
Outputs: assets/atlases/<slug>.webp
         assets/atlases/<slug>.json

The packer is a simple shelf algorithm with max_width=2048 — fine for
the 4-cut-out scenes we ship today and still reasonable if a scene grows
to ~10 cut-outs. Atlases are lossy WebP q85 method=6 (same as the
individual files); in practice the packed atlas is within ~5% of the
sum of the per-file sizes since WebP's entropy coder handles both
layouts similarly.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parents[1]
SCENES_JSON = REPO / "src" / "scenes.json"
CUTOUTS_DIR = REPO / "assets" / "cutouts"
ATLAS_DIR = REPO / "assets" / "atlases"

MAX_ATLAS_W = 2048
GUTTER = 2  # 2px transparent gutter between frames to avoid bleed


def pack_shelf(sizes, max_w=MAX_ATLAS_W):
    """Shelf packer. `sizes` is [(name, w, h)]. Returns (placements, atlas_w,
    atlas_h) where placements is [(name, x, y, w, h)]. Sorts tallest first
    so rows don't waste as much vertical space.
    """
    ordered = sorted(sizes, key=lambda s: (-s[2], -s[1]))
    placements = []
    cur_x = 0
    cur_y = 0
    row_h = 0
    used_w = 0
    for name, w, h in ordered:
        if cur_x + w + GUTTER > max_w and cur_x > 0:
            cur_y += row_h + GUTTER
            cur_x = 0
            row_h = 0
        placements.append((name, cur_x, cur_y, w, h))
        cur_x += w + GUTTER
        used_w = max(used_w, cur_x)
        row_h = max(row_h, h)
    atlas_h = cur_y + row_h
    # Keep width tight — no sense reserving 2048px if we only used 1100.
    atlas_w = min(max_w, used_w) if used_w > 0 else 1
    atlas_h = atlas_h if atlas_h > 0 else 1
    return placements, atlas_w, atlas_h


def build_atlas(slug: str, cutout_files: list[str]) -> bool:
    src_dir = CUTOUTS_DIR / slug
    imgs = []
    for fname in cutout_files:
        path = src_dir / fname
        if not path.exists():
            print(f"[skip] {slug}: missing {path.relative_to(REPO)}", file=sys.stderr)
            return False
        img = Image.open(path).convert("RGBA")
        imgs.append((fname, img))

    sizes = [(name, im.width, im.height) for name, im in imgs]
    placements, W, H = pack_shelf(sizes)

    atlas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    frames: dict[str, dict] = {}
    by_name = {n: im for n, im in imgs}
    for name, x, y, w, h in placements:
        atlas.paste(by_name[name], (x, y), by_name[name])
        frames[name] = {
            "frame": {"x": x, "y": y, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }

    ATLAS_DIR.mkdir(parents=True, exist_ok=True)
    png_out = ATLAS_DIR / f"{slug}.webp"
    atlas.save(png_out, "WEBP", quality=85, method=6)

    manifest = {
        "frames": frames,
        "meta": {
            "app": "b-roll atlas packer",
            "version": "1",
            "image": f"{slug}.webp",
            "format": "RGBA8888",
            "size": {"w": W, "h": H},
            "scale": "1",
        },
    }
    (ATLAS_DIR / f"{slug}.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    total_raw = sum((im.width * im.height) for _, im in imgs)
    print(
        f"[ok]   {slug}: {len(imgs)} frames -> {W}x{H} "
        f"(raw pixels {total_raw:,}; file {png_out.stat().st_size/1024:.1f} KB)"
    )
    return True


def main() -> int:
    scenes = json.loads(SCENES_JSON.read_text(encoding="utf-8"))
    built = 0
    for scene in scenes:
        slug = scene.get("slug")
        cutouts = scene.get("cutouts") or []
        if not slug or not cutouts:
            continue
        files = [c.get("file") for c in cutouts if c.get("file")]
        if not files:
            continue
        if build_atlas(slug, files):
            built += 1
    print(f"\nbuilt {built} atlas(es) into {ATLAS_DIR.relative_to(REPO)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
