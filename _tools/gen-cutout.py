#!/usr/bin/env python3
"""
B-Roll cut-out generator (gpt-image-1.5)
========================================

Generate painted cut-out / drifter subjects on pure matte-black backgrounds
via OpenAI gpt-image-1.5, then pass them through rembg (u2net) to produce
transparent WebPs at the shipped paths.

Batch JSON shape (single source of truth):

    {
      "<key>": {
        "prompt": "...",
        "dst":    "assets/cutouts/code-rain/agent.webp",
        "quality": "high"    // optional
      },
      ...
    }

The `<key>` is only used for raw-PNG filename disambiguation; the final
destination is the `dst` field.

Usage:
    python3 _tools/gen-cutout.py --batch _tools/cutout-prompts.json
    python3 _tools/gen-cutout.py --batch ... --only key1,key2
    python3 _tools/gen-cutout.py --batch ... --skip-existing
    python3 _tools/gen-cutout.py --batch ... --workers 3

The model (default gpt-image-1.5) is overridable via the OPENAI_IMAGE_MODEL
env var, matching _tools/gen-wallpaper.py.
"""
from __future__ import annotations

import argparse
import base64
import concurrent.futures as futures
import io
import json
import os
import sys
import threading
import time
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.stderr.write("error: Pillow is required (pip install pillow)\n")
    sys.exit(2)

try:
    from rembg import remove, new_session
except ImportError:
    sys.stderr.write("error: rembg is required (pip install rembg onnxruntime)\n")
    sys.exit(2)

import urllib.request
import urllib.error


REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = REPO_ROOT / "_tools" / "raw" / "regen"
GEN_W, GEN_H = 1024, 1024
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1.5")
MAX_EDGE = 1024
PAD = 8

_SESSION = None
_SESSION_LOCK = threading.Lock()
_PRINT_LOCK = threading.Lock()


def log(msg: str) -> None:
    with _PRINT_LOCK:
        print(msg, flush=True)


def rembg_session():
    global _SESSION
    with _SESSION_LOCK:
        if _SESSION is None:
            _SESSION = new_session("u2net")
        return _SESSION


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


def call_image_api(prompt: str, quality: str, key: str) -> tuple[bytes, float]:
    body = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "size": f"{GEN_W}x{GEN_H}",
        "quality": quality,
        "n": 1,
    }).encode("utf-8")
    t0 = time.time()
    attempt = 0
    max_attempts = 6
    while True:
        attempt += 1
        req = urllib.request.Request(
            "https://api.openai.com/v1/images/generations",
            data=body,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", errors="replace")
            if e.code == 429 and attempt < max_attempts:
                import re as _re
                m = _re.search(r"try again in (\d+(?:\.\d+)?)s", msg)
                sleep_s = float(m.group(1)) + 2.0 if m else min(30.0, 4.0 * attempt)
                log(f"  429 rate-limit; sleeping {sleep_s:.1f}s (attempt {attempt}/{max_attempts})")
                time.sleep(sleep_s)
                continue
            raise RuntimeError(f"HTTP {e.code}: {msg[:600]}")
        except urllib.error.URLError as e:
            if attempt < max_attempts:
                time.sleep(3.0 * attempt)
                continue
            raise RuntimeError(f"URL error: {e}")
    dt = time.time() - t0
    item = payload["data"][0]
    if "b64_json" in item and item["b64_json"]:
        png = base64.b64decode(item["b64_json"])
    elif "url" in item and item["url"]:
        with urllib.request.urlopen(item["url"], timeout=120) as r:
            png = r.read()
    else:
        raise RuntimeError(f"no image payload: {json.dumps(payload)[:600]}")
    return png, dt


def cutout_to_webp(raw_png: Path, dst: Path) -> tuple[int, int, int]:
    img = Image.open(raw_png).convert("RGBA")
    cut = remove(img, session=rembg_session())
    bbox = cut.getbbox()
    if bbox is None:
        raise RuntimeError(f"empty alpha after rembg for {raw_png.name}")
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - PAD)
    y0 = max(0, y0 - PAD)
    x1 = min(cut.width, x1 + PAD)
    y1 = min(cut.height, y1 + PAD)
    cut = cut.crop((x0, y0, x1, y1))
    if max(cut.size) > MAX_EDGE:
        cut.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.suffix.lower() == ".png":
        dst = dst.with_suffix(".webp")
    cut.save(dst, "WEBP", quality=85, method=6)
    size = dst.stat().st_size
    return cut.width, cut.height, size


def process_one(key: str, cfg: dict, key_api: str, default_quality: str) -> tuple[str, bool, str]:
    prompt = cfg["prompt"]
    dst_rel = cfg["dst"]
    dst = (REPO_ROOT / dst_rel).resolve()
    quality = cfg.get("quality", default_quality)

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    safe_key = key.replace("/", "__")
    raw_path = RAW_DIR / f"{safe_key}.png"

    log(f"[{key}] start -> {dst_rel}")
    log(f"[{key}] prompt: {prompt[:140]}{'...' if len(prompt) > 140 else ''}")
    try:
        png, dt = call_image_api(prompt, quality, key_api)
    except Exception as e:
        return key, False, f"api: {e}"
    raw_path.write_bytes(png)
    log(f"[{key}] api ok ({dt:.1f}s, {len(png):,}B) -> {raw_path.relative_to(REPO_ROOT)}")

    try:
        w, h, sz = cutout_to_webp(raw_path, dst)
    except Exception as e:
        return key, False, f"rembg: {e}"
    log(f"[{key}] rembg ok {w}x{h} ({sz:,}B) -> {dst_rel}")
    return key, True, "ok"


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate B-Roll cut-outs via gpt-image-1.5 + rembg.")
    ap.add_argument("--batch", required=True, help="path to JSON batch spec")
    ap.add_argument("--quality", default="high", choices=["low", "medium", "high"])
    ap.add_argument("--workers", type=int, default=3, help="concurrent API workers (default 3)")
    ap.add_argument("--only", default="", help="comma-separated keys to run (substring match)")
    ap.add_argument("--skip-existing", action="store_true",
                    help="skip entries whose dst webp already exists")
    args = ap.parse_args()

    key_api = load_api_key()
    spec = json.loads(Path(args.batch).read_text())
    if not isinstance(spec, dict):
        raise SystemExit("batch JSON must be an object { key: {prompt, dst, quality?} }")

    only_filters = [s.strip() for s in args.only.split(",") if s.strip()]

    items: list[tuple[str, dict]] = []
    for key, cfg in spec.items():
        if key.startswith("__"):
            continue
        if not isinstance(cfg, dict):
            continue
        if only_filters and not any(f in key for f in only_filters):
            continue
        dst_rel = cfg.get("dst")
        if not dst_rel:
            log(f"[{key}] SKIP (missing dst)")
            continue
        if args.skip_existing and (REPO_ROOT / dst_rel).exists():
            log(f"[{key}] skip-existing -> {dst_rel}")
            continue
        if "prompt" not in cfg:
            log(f"[{key}] SKIP (missing prompt)")
            continue
        items.append((key, cfg))

    if not items:
        log("nothing to do")
        return 0

    log(f"model: {MODEL}  workers: {args.workers}  jobs: {len(items)}")
    rembg_session()

    results: list[tuple[str, bool, str]] = []
    t0 = time.time()
    with futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        future_to_key = {
            pool.submit(process_one, key, cfg, key_api, args.quality): key
            for key, cfg in items
        }
        for fut in futures.as_completed(future_to_key):
            try:
                results.append(fut.result())
            except Exception as e:
                key = future_to_key[fut]
                results.append((key, False, f"exception: {e}"))

    ok = [r for r in results if r[1]]
    fail = [r for r in results if not r[1]]
    log("")
    log(f"=== summary: {len(ok)}/{len(results)} ok  ({time.time()-t0:.1f}s) ===")
    for key, _, msg in fail:
        log(f"FAIL {key}: {msg}")
    return 0 if not fail else 1


if __name__ == "__main__":
    raise SystemExit(main())
