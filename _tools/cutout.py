"""Batch background-remove generated PNGs into transparent cut-outs.

Usage:
    python3 _tools/cutout.py pair <src_png> <dst_png>
    python3 _tools/cutout.py batch <pairs.txt>        # one "src dst" per line

Post-processing:
- runs rembg (u2net) on the source
- trims transparent borders to a tight bounding box with 8px padding
- clamps long edge to 1024px
- saves WebP q85 method=6 (typical ~15% of the equivalent PNG at the
  same visual quality; all modern browsers render transparent WebP)
"""
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

_SESSION = None

def session():
    global _SESSION
    if _SESSION is None:
        _SESSION = new_session("u2net")
    return _SESSION

MAX_EDGE = 1024
PAD = 8

def process(src: Path, dst: Path) -> None:
    img = Image.open(src).convert("RGBA")
    cut = remove(img, session=session())
    bbox = cut.getbbox()
    if bbox is None:
        raise SystemExit(f"cutout produced empty alpha for {src}")
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - PAD); y0 = max(0, y0 - PAD)
    x1 = min(cut.width, x1 + PAD); y1 = min(cut.height, y1 + PAD)
    cut = cut.crop((x0, y0, x1, y1))
    if max(cut.size) > MAX_EDGE:
        cut.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    # If the caller passed a .png dst, coerce it to .webp so the batch
    # file from earlier drops remain compatible.
    if dst.suffix.lower() == ".png":
        dst = dst.with_suffix(".webp")
    cut.save(dst, "WEBP", quality=85, method=6)
    print(f"ok {src.name} -> {dst} ({cut.width}x{cut.height})")

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    mode = sys.argv[1]
    if mode == "pair":
        process(Path(sys.argv[2]), Path(sys.argv[3]))
    elif mode == "batch":
        for line in Path(sys.argv[2]).read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"): continue
            src, dst = line.split()
            process(Path(src), Path(dst))
    else:
        print(__doc__); sys.exit(1)

if __name__ == "__main__":
    main()
