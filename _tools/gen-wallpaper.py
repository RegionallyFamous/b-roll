#!/usr/bin/env python3
"""
ODD wallpaper generator (gpt-image-2)
========================================

Generate a painted ODD wallpaper + matching picker preview from a prompt
using OpenAI's gpt-image-2 model. Reads OPENAI_API_KEY from one of (in order):

  1. process env
  2. <repo>/.env.local
  3. ~/.env.local

Outputs:
  odd/assets/wallpapers/<slug>.webp  (1920x1080, q82, cover-fit)
  odd/assets/previews/<slug>.webp    (640x360,  q80)

Usage:
  python3 _tools/gen-wallpaper.py <slug> "<prompt>" [--quality high|medium|low]
  python3 _tools/gen-wallpaper.py --batch _tools/wallpaper-prompts.json

Batch JSON shape:
  { "<slug>": { "prompt": "...", "quality": "high" }, ... }

Notes:
  - gpt-image-2 supports landscape size 1536x1024; we cover-crop to 1920x1080.
  - quality=high costs noticeably more per image; default is high because
    these go in the repo for the long haul.
  - Subjects are deliberately empty/atmospheric — every ODD scene paints
    its hero motion in Pixi on top of the backdrop. Prompts should say so.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import time
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.stderr.write("error: Pillow is required (pip install pillow)\n")
    sys.exit(2)

try:
    import urllib.request
    import urllib.error
except ImportError:
    sys.stderr.write("error: urllib is required (stdlib)\n")
    sys.exit(2)


REPO_ROOT = Path(__file__).resolve().parent.parent
WALLPAPER_DIR = REPO_ROOT / "odd" / "assets" / "wallpapers"
PREVIEW_DIR = REPO_ROOT / "odd" / "assets" / "previews"
WALLPAPER_W, WALLPAPER_H = 1920, 1080
PREVIEW_W, PREVIEW_H = 640, 360
GEN_W, GEN_H = 1536, 864  # gpt-image-2 16:9 landscape
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2")


def load_api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY")
    if key:
        return key.strip()
    for env_path in (REPO_ROOT / ".env.local", Path.home() / ".env.local"):
        if not env_path.exists():
            continue
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith("OPENAI_API_KEY="):
                v = line.split("=", 1)[1].strip().strip('"').strip("'")
                if v:
                    return v
    raise SystemExit(
        "error: OPENAI_API_KEY not found in env, .env.local, or ~/.env.local"
    )


def call_gpt_image_2(prompt: str, quality: str, key: str) -> bytes:
    """Call /v1/images/generations and return raw PNG bytes."""
    body = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "size": f"{GEN_W}x{GEN_H}",
        "quality": quality,
        "output_format": "png",
        "n": 1,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    t0 = time.time()
    last_err: Exception | None = None
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(req, timeout=600) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            last_err = None
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", errors="replace")
            raise SystemExit(f"openai HTTPError {e.code}: {msg[:1200]}")
        except Exception as e:
            last_err = e
            print(f"  attempt {attempt} failed: {e!r}; retrying...", file=sys.stderr)
            time.sleep(3 * attempt)
    if last_err is not None:
        raise SystemExit(f"openai request failed after retries: {last_err!r}")
    dt = time.time() - t0
    item = payload["data"][0]
    if "b64_json" in item and item["b64_json"]:
        png = base64.b64decode(item["b64_json"])
    elif "url" in item and item["url"]:
        with urllib.request.urlopen(item["url"], timeout=120) as r:
            png = r.read()
    else:
        raise SystemExit(f"openai returned no image payload: {json.dumps(payload)[:600]}")
    print(f"  api: {dt:.1f}s, {len(png)} bytes png")
    return png


def cover_fit(im: Image.Image, target_w: int, target_h: int) -> Image.Image:
    sw, sh = im.size
    scale = max(target_w / sw, target_h / sh)
    nw, nh = int(round(sw * scale)), int(round(sh * scale))
    im_r = im.resize((nw, nh), Image.LANCZOS)
    left = (nw - target_w) // 2
    top = (nh - target_h) // 2
    return im_r.crop((left, top, left + target_w, top + target_h))


def write_pair(slug: str, png: bytes) -> tuple[int, int]:
    WALLPAPER_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    src = Image.open(io.BytesIO(png)).convert("RGB")
    wp = cover_fit(src, WALLPAPER_W, WALLPAPER_H)
    out_wp = WALLPAPER_DIR / f"{slug}.webp"
    wp.save(out_wp, "WEBP", quality=82, method=6)
    pv = wp.resize((PREVIEW_W, PREVIEW_H), Image.LANCZOS)
    out_pv = PREVIEW_DIR / f"{slug}.webp"
    pv.save(out_pv, "WEBP", quality=80, method=6)
    return out_wp.stat().st_size, out_pv.stat().st_size


def gen_one(slug: str, prompt: str, quality: str, key: str) -> None:
    print(f"[{slug}] quality={quality}")
    print(f"  prompt: {prompt[:160]}{'...' if len(prompt) > 160 else ''}")
    png = call_gpt_image_2(prompt, quality, key)
    wp_size, pv_size = write_pair(slug, png)
    print(f"  wrote odd/assets/wallpapers/{slug}.webp ({wp_size:,} B)")
    print(f"  wrote odd/assets/previews/{slug}.webp ({pv_size:,} B)")


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate ODD wallpapers via gpt-image-2.")
    ap.add_argument("slug", nargs="?", help="scene slug (e.g. wasteland)")
    ap.add_argument("prompt", nargs="?", help="prompt text")
    ap.add_argument("--quality", default="high", choices=["low", "medium", "high"])
    ap.add_argument("--batch", help="path to JSON map of {slug: {prompt, quality?}}")
    args = ap.parse_args()

    key = load_api_key()

    if args.batch:
        spec = json.loads(Path(args.batch).read_text())
        ok = 0
        for slug, cfg in spec.items():
            try:
                gen_one(slug, cfg["prompt"], cfg.get("quality", args.quality), key)
                ok += 1
            except SystemExit as e:
                print(f"[{slug}] FAILED: {e}", file=sys.stderr)
        print(f"\nDone: {ok}/{len(spec)} succeeded")
        return 0 if ok == len(spec) else 1

    if not args.slug or not args.prompt:
        ap.error("provide <slug> <prompt> or --batch <file>")
    gen_one(args.slug, args.prompt, args.quality, key)
    return 0


if __name__ == "__main__":
    sys.exit(main())
