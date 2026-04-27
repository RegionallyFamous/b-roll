#!/usr/bin/env python3
"""Rebuild docs/icon-redesign.md + its before/after asset tree.

Run this after `regen-icon-set.py --all` and before committing so the
visual-review doc reflects the current state of the icon sets.

Before assets come from `git show HEAD:` for every icon's pre-
regeneration blob. After assets are copied verbatim from the current
catalog source tree.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SETS_DIR = HERE / "catalog-sources" / "icon-sets"
DOC = REPO / "docs" / "icon-redesign.md"
ASSETS = REPO / "docs" / "icon-redesign-assets"

ROLES = [
    "dashboard", "posts", "pages", "media", "comments",
    "appearance", "plugins", "users", "tools", "settings",
    "profile", "links", "fallback",
]

HEADER = """# Icon redesign — iOS app icon style

Side-by-side review of all 17 ODD icon sets before the rebuilt catalog
ships. Every icon is now a 1024×1024 SVG with the iOS continuous-
curvature squircle baked in (`<clipPath id="sq">`), a full-bleed
background, and one bold centered subject inside the 824×824 safe
rect. Spec: [`../_tools/icon-style-guide.md`](../_tools/icon-style-guide.md).

The "before" thumbnails come from the first 1.1.0 iOS pass. That pass
used the same glyphs across all 17 sets with different colors, which
made the sets feel too similar. The "after" thumbnails are the 1.1.1
regeneration: same 13 metaphors, but distinct set-specific visual
treatments (coin relief, blueprint strokes, PCB traces, cross-stitch,
riso offset, stadium patch stitching, carved wood, and more). GitHub
renders both inline.

> These SVGs ship verbatim in each set's `.wp` bundle. What you see is
> what lands on users' WP-Desktop docks and in the Shop Discover tile.

## Reading the grid

Each row is one role. 13 roles per set:

`dashboard · posts · pages · media · comments · appearance · plugins · users · tools · settings · profile · links · fallback`

Click through to `_tools/catalog-sources/icon-sets/<slug>/` to open
the raw SVG and inspect the source.

---

<style>
.icon-grid { display:grid; grid-template-columns:repeat(13, 1fr); gap:4px; margin:8px 0 20px; }
.icon-grid img { width:100%; aspect-ratio:1/1; background:#1a1a1a; border-radius:14px; }
.set-head { display:flex; align-items:center; gap:14px; margin:28px 0 6px; }
.set-swatch { width:18px; height:18px; border-radius:6px; display:inline-block; border:1px solid rgba(0,0,0,.2); }
.set-meta { color:#888; font-size:12px; }
</style>

<!-- generator:icon-redesign — rebuild by running `python3 _tools/make-icon-redesign.py` -->
"""


def _git_show(path: Path) -> bytes | None:
    rel = path.relative_to(REPO)
    r = subprocess.run(
        ["git", "show", f"HEAD:{rel}"],
        cwd=REPO, capture_output=True,
    )
    if r.returncode != 0:
        return None
    return r.stdout


def _snapshot_assets():
    if ASSETS.exists():
        shutil.rmtree(ASSETS)
    (ASSETS / "before").mkdir(parents=True)
    (ASSETS / "after").mkdir(parents=True)
    for slug_dir in sorted(SETS_DIR.iterdir()):
        if not slug_dir.is_dir():
            continue
        slug = slug_dir.name
        (ASSETS / "before" / slug).mkdir()
        (ASSETS / "after" / slug).mkdir()
        for role in ROLES:
            svg = slug_dir / f"{role}.svg"
            if not svg.is_file():
                continue
            # "after" is always the working-tree copy.
            (ASSETS / "after" / slug / f"{role}.svg").write_bytes(
                svg.read_bytes()
            )
            before = _git_show(svg)
            if before is None:
                # Freshly added icon with no prior version — reuse "after".
                before = svg.read_bytes()
            (ASSETS / "before" / slug / f"{role}.svg").write_bytes(before)


def _set_section(slug: str, m: dict) -> list[str]:
    buf = ["", f"## {m['label']}", "", (
        f'<div class="set-head">'
        f'<span class="set-swatch" style="background:{m["accent"]}"></span>'
        f'<strong>{m["label"]}</strong>'
        f'<span class="set-meta">{m["franchise"]} · accent <code>{m["accent"]}</code> · v{m["version"]}</span>'
        f'</div>'
    ), "", f'_{m["description"]}_', "", "**Before (v1.1.0, same-glyph iOS pass)**", "",
           '<div class="icon-grid">']
    for role in ROLES:
        buf.append(
            f'  <img src="icon-redesign-assets/before/{slug}/{role}.svg" '
            f'alt="{slug} {role} before">'
        )
    buf += ["</div>", "", "**After (v1.1.1, distinct set-specific style)**", "",
            '<div class="icon-grid">']
    for role in ROLES:
        buf.append(
            f'  <img src="icon-redesign-assets/after/{slug}/{role}.svg" '
            f'alt="{slug} {role} after">'
        )
    buf += ["</div>", ""]
    return buf


def main():
    _snapshot_assets()
    lines = [HEADER]
    for d in sorted(SETS_DIR.iterdir()):
        if not d.is_dir():
            continue
        m = json.loads((d / "manifest.json").read_text())
        lines += _set_section(d.name, m)
    DOC.parent.mkdir(parents=True, exist_ok=True)
    DOC.write_text("\n".join(lines) + "\n")
    print(f"wrote {DOC} ({len(lines)} lines)")
    print(f"assets at {ASSETS.relative_to(REPO)}")


if __name__ == "__main__":
    main()
