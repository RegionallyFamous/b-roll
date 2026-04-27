#!/usr/bin/env python3
"""Build the ODD remote catalog.

Walks `_tools/catalog-sources/` and emits:

    site/catalog/v1/
        registry.json           one catalog manifest for everything
        registry.schema.json    JSON schema for validators
        bundles/*.wp            one .wp archive per bundle
        icons/<slug>.svg        64x64 Discover tile per bundle

The plugin (3.0.0+) fetches `registry.json` over HTTPS and installs
listed bundles through `odd_bundle_install()`. Every content change
is a commit to this repo; GitHub Pages republishes `site/` on push,
which takes `odd.regionallyfamous.com/catalog/v1/` live with the new
content — no plugin release required.

Determinism:
    * Every file inside every .wp uses a fixed mtime (2025-01-01).
    * Inputs are walked in sorted order.
    * Zip entries are ZIP_DEFLATED at default compression level.
    * Re-running without source changes produces byte-identical zips
      (enforced by CI: `validate-catalog` fails if rebuild leaves the
      tree dirty).

Bundle types:
    scene       source: catalog-sources/scenes/<slug>/{scene.js,
                meta.json, wallpaper.webp, preview.webp}
    icon-set    source: catalog-sources/icon-sets/<slug>/ (manifest
                + SVGs)
    widget      source: catalog-sources/widgets/<slug>/{widget.js,
                widget.css?, manifest.json}
    app         source: catalog-sources/apps/<slug>/{bundle.wp, icon.svg,
                meta.json} — app .wp is prebuilt, we just publish it.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import shutil
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SOURCES = HERE / "catalog-sources"
OUT_ROOT = REPO / "site" / "catalog" / "v1"
OUT_BUNDLES = OUT_ROOT / "bundles"
OUT_ICONS = OUT_ROOT / "icons"

FIXED_DATE = (2025, 1, 1, 0, 0, 0)
CATALOG_BASE = "https://odd.regionallyfamous.com/catalog/v1"
SCHEMA_URL = f"{CATALOG_BASE}/registry.schema.json"

# The iOS-style icons must all carry this exact squircle path (see
# `_tools/icon-style-guide.md` and `_tools/icon-sets/_base.svg.tmpl`).
# The validator matches on a normalized whitespace-collapsed version
# so authors can wrap the path onto multiple lines without failing.
ICON_SQUIRCLE_PATH = (
    "M 350.06 0 L 673.94 0 C 774.74 0 825.13 0 879.39 17.15 "
    "L 879.39 17.15 C 938.62 38.71 985.29 85.38 1006.85 144.61 "
    "C 1024 198.87 1024 249.26 1024 350.06 L 1024 673.94 "
    "C 1024 774.74 1024 825.13 1006.85 879.39 L 1006.85 879.39 "
    "C 985.29 938.62 938.62 985.29 879.39 1006.85 "
    "C 825.13 1024 774.74 1024 673.94 1024 L 350.06 1024 "
    "C 249.26 1024 198.87 1024 144.61 1006.85 L 144.61 1006.85 "
    "C 85.38 985.29 38.71 938.62 17.15 879.39 "
    "C 0 825.13 0 774.74 0 673.94 L 0 350.06 "
    "C 0 249.26 0 198.87 17.15 144.61 L 17.15 144.61 "
    "C 38.71 85.38 85.38 38.71 144.61 17.15 "
    "C 198.87 0 249.26 0 350.06 0 Z"
)
ICON_SIZE_BUDGET = 10240  # bytes per SVG

_ICON_CTRL = re.compile(rb"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_ICON_WS = re.compile(r"\s+")


def _validate_icon_svg(slug: str, rel: str, data: bytes) -> None:
    """Fail-loud check applied to every icon-set SVG before zipping.

    Enforces the iOS-app-icon contract spec'd in
    `_tools/icon-style-guide.md`:
    - viewBox="0 0 1024 1024"
    - contains the canonical squircle clipPath verbatim
    - root <g> (or descendant) carries clip-path="url(#sq)"
    - ≤ 10 KB uncompressed
    - no forbidden tags (<image>, <script>, <foreignObject>)
    - no control bytes outside \t \n \r
    """
    label = f"icon-set {slug}: {rel}"

    if len(data) > ICON_SIZE_BUDGET:
        raise SystemExit(
            f"{label}: {len(data)} bytes exceeds {ICON_SIZE_BUDGET} budget"
        )
    if _ICON_CTRL.search(data):
        raise SystemExit(f"{label}: SVG contains forbidden control bytes")

    text = data.decode("utf-8", errors="replace")
    for tag in ("<image", "<script", "<foreignObject"):
        if tag in text:
            raise SystemExit(f"{label}: contains forbidden element {tag!r}")
    if 'clip-path="url(#sq)"' not in text:
        raise SystemExit(
            f"{label}: missing clip-path=\"url(#sq)\" wrapper"
        )
    normalized = _ICON_WS.sub(" ", text)
    if ICON_SQUIRCLE_PATH not in normalized:
        raise SystemExit(
            f"{label}: missing canonical iOS squircle <clipPath id=\"sq\">"
        )

    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        raise SystemExit(f"{label}: invalid XML: {exc}")
    if root.tag != "{http://www.w3.org/2000/svg}svg":
        raise SystemExit(f"{label}: root element is not <svg>")
    viewbox = (root.attrib.get("viewBox") or "").strip()
    if viewbox != "0 0 1024 1024":
        raise SystemExit(
            f"{label}: viewBox must be \"0 0 1024 1024\", got {viewbox!r}"
        )


# ---------------------------------------------------------------- #
# Deterministic zip.
# ---------------------------------------------------------------- #


def write_zip(dest: Path, files: dict[str, bytes]) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in sorted(files):
            info = zipfile.ZipInfo(name, FIXED_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            zf.writestr(info, files[name])
    dest.write_bytes(buf.getvalue())


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------- #
# Discover tile icons.
#
# Every catalog row needs a 64x64 SVG tile. For scenes we derive one
# from the fallbackColor + slug label (no external dependencies). For
# icon-sets we reuse the set's preview SVG. For widgets we hand-author
# a tile. For apps we copy the .wp bundle's icon.svg alongside.
# ---------------------------------------------------------------- #


def scene_tile(slug: str, label: str, fallback: str) -> str:
    initial = (label or slug).strip()[:1].upper() or "?"
    text_color = "#ffffff" if _is_dark(fallback) else "#10121a"
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"'
        f' role="img" aria-label="{label}">\n'
        f'  <rect x="0" y="0" width="64" height="64" rx="14" ry="14" fill="{fallback}"/>\n'
        '  <circle cx="48" cy="16" r="8" fill="#ffffff" opacity="0.18"/>\n'
        '  <circle cx="14" cy="52" r="6" fill="#ffffff" opacity="0.12"/>\n'
        '  <text x="32" y="42" text-anchor="middle"'
        ' font-family="Inter, system-ui, -apple-system, sans-serif"'
        f' font-size="28" font-weight="800" fill="{text_color}">{initial}</text>\n'
        "</svg>\n"
    )


def _is_dark(hex_color: str) -> bool:
    c = hex_color.lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    if len(c) < 6:
        return True
    try:
        r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
    except ValueError:
        return True
    return (0.299 * r + 0.587 * g + 0.114 * b) < 128


def widget_tile(slug: str, label: str) -> str:
    # Keep widget tiles on brand with the ODD Memphis palette.
    palette = {
        "sticky": "#ffd166",
        "eight-ball": "#1a0b2e",
    }
    accent = palette.get(slug, "#8a5cff")
    initial = (label or slug).strip()[:1].upper() or "?"
    text_color = "#ffffff" if _is_dark(accent) else "#10121a"
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"'
        f' role="img" aria-label="{label}">\n'
        f'  <rect x="0" y="0" width="64" height="64" rx="14" ry="14" fill="{accent}"/>\n'
        '  <circle cx="16" cy="16" r="6" fill="#ffffff" opacity="0.28"/>\n'
        '  <rect x="40" y="10" width="14" height="14" rx="3" fill="#ffffff" opacity="0.2" transform="rotate(12 47 17)"/>\n'
        '  <text x="32" y="44" text-anchor="middle"'
        ' font-family="Inter, system-ui, -apple-system, sans-serif"'
        f' font-size="28" font-weight="800" fill="{text_color}">{initial}</text>\n'
        "</svg>\n"
    )


# ---------------------------------------------------------------- #
# Per-type bundle builders.
# ---------------------------------------------------------------- #


def build_scene(slug: str, src_dir: Path) -> dict:
    meta = json.loads((src_dir / "meta.json").read_text())
    scene_js = (src_dir / "scene.js").read_bytes()
    wallpaper = (src_dir / "wallpaper.webp").read_bytes()
    preview = (src_dir / "preview.webp").read_bytes()

    manifest = {
        "$schema": "../../manifest.schema.json",
        "type": "scene",
        "slug": meta["slug"],
        "name": meta["label"],
        "label": meta["label"],
        "version": meta.get("version", "1.0.0"),
        "author": meta.get("author", "Regionally Famous"),
        "description": meta.get("description", ""),
        "franchise": meta.get("franchise", "Community"),
        "tags": meta.get("tags", []),
        "fallbackColor": meta.get("fallbackColor", "#111"),
        "entry": "scene.js",
        "preview": "preview.webp",
        "wallpaper": "wallpaper.webp",
    }
    bundle = OUT_BUNDLES / f"scene-{slug}.wp"
    write_zip(
        bundle,
        {
            "manifest.json": json.dumps(manifest, indent=2).encode() + b"\n",
            "scene.js": scene_js,
            "preview.webp": preview,
            "wallpaper.webp": wallpaper,
        },
    )

    # Use the painted preview.webp as the Discover tile. The generated
    # "first initial on a flat swatch" SVG fallback looked identical
    # for every scene whose label started with the same letter — and
    # we already ship the real art. Still emit the SVG fallback on
    # disk for legacy clients / validators but point `icon_url` at the
    # webp so the Shop renders the actual scene imagery.
    icon_svg_name = f"scene-{slug}.svg"
    (OUT_ICONS / icon_svg_name).write_text(
        scene_tile(slug, meta["label"], meta.get("fallbackColor", "#111"))
    )
    icon_webp_name = f"scene-{slug}.webp"
    (OUT_ICONS / icon_webp_name).write_bytes(preview)

    return {
        "type": "scene",
        "slug": slug,
        "name": meta["label"],
        "version": manifest["version"],
        "author": manifest["author"],
        "description": manifest["description"],
        "franchise": manifest["franchise"],
        "tags": manifest["tags"],
        "icon_url": f"{CATALOG_BASE}/icons/{icon_webp_name}",
        "download_url": f"{CATALOG_BASE}/bundles/{bundle.name}",
        "sha256": sha256_file(bundle),
        "size": bundle.stat().st_size,
    }


def build_iconset(slug: str, src_dir: Path) -> dict:
    meta = json.loads((src_dir / "manifest.json").read_text())

    files: dict[str, bytes] = {}
    manifest = {
        "$schema": "../../manifest.schema.json",
        "type": "icon-set",
        "slug": meta["slug"],
        "name": meta["label"],
        "label": meta["label"],
        "version": meta.get("version", "1.0.0"),
        "author": meta.get("author", "Regionally Famous"),
        "description": meta.get("description", ""),
        "franchise": meta.get("franchise", "Community"),
        "accent": meta.get("accent", "#888"),
        "preview": meta.get("preview", "dashboard.svg"),
        "icons": meta["icons"],
    }
    files["manifest.json"] = json.dumps(manifest, indent=2).encode() + b"\n"
    for rel in sorted(set(meta["icons"].values())):
        svg_path = src_dir / rel
        if not svg_path.is_file():
            raise SystemExit(f"icon-set {slug}: missing {rel}")
        data = svg_path.read_bytes()
        _validate_icon_svg(slug, rel, data)
        files[rel] = data

    bundle = OUT_BUNDLES / f"iconset-{slug}.wp"
    write_zip(bundle, files)

    # Use the set's preview SVG as the Discover tile.
    icon_name = f"iconset-{slug}.svg"
    preview_src = src_dir / meta.get("preview", "dashboard.svg")
    if preview_src.is_file():
        (OUT_ICONS / icon_name).write_bytes(preview_src.read_bytes())
    else:
        (OUT_ICONS / icon_name).write_text(
            widget_tile(slug, meta["label"])
        )

    return {
        "type": "icon-set",
        "slug": slug,
        "name": meta["label"],
        "version": manifest["version"],
        "author": manifest["author"],
        "description": manifest["description"],
        "franchise": manifest["franchise"],
        "accent": manifest["accent"],
        "icon_url": f"{CATALOG_BASE}/icons/{icon_name}",
        "download_url": f"{CATALOG_BASE}/bundles/{bundle.name}",
        "sha256": sha256_file(bundle),
        "size": bundle.stat().st_size,
    }


def build_widget(slug: str, src_dir: Path) -> dict:
    meta = json.loads((src_dir / "manifest.json").read_text())
    widget_js = (src_dir / "widget.js").read_bytes()
    css_rel = meta.get("css") or []
    if isinstance(css_rel, str):
        css_rel = [css_rel]

    files: dict[str, bytes] = {}
    manifest = {
        "$schema": "../../manifest.schema.json",
        "type": "widget",
        "slug": meta["slug"],
        "id": meta.get("id", f"odd/{slug}"),
        "name": meta["label"],
        "label": meta["label"],
        "version": meta.get("version", "1.0.0"),
        "author": meta.get("author", "Regionally Famous"),
        "description": meta.get("description", ""),
        "franchise": meta.get("franchise", "Community"),
        "entry": "widget.js",
        "css": css_rel,
    }
    files["manifest.json"] = json.dumps(manifest, indent=2).encode() + b"\n"
    files["widget.js"] = widget_js
    for rel in css_rel:
        p = src_dir / rel
        if p.is_file():
            files[rel] = p.read_bytes()

    bundle = OUT_BUNDLES / f"widget-{slug}.wp"
    write_zip(bundle, files)

    icon_name = f"widget-{slug}.svg"
    (OUT_ICONS / icon_name).write_text(widget_tile(slug, meta["label"]))

    return {
        "type": "widget",
        "slug": slug,
        "name": meta["label"],
        "version": manifest["version"],
        "author": manifest["author"],
        "description": manifest["description"],
        "franchise": manifest["franchise"],
        "icon_url": f"{CATALOG_BASE}/icons/{icon_name}",
        "download_url": f"{CATALOG_BASE}/bundles/{bundle.name}",
        "sha256": sha256_file(bundle),
        "size": bundle.stat().st_size,
    }


def build_app(slug: str, src_dir: Path) -> dict:
    meta = json.loads((src_dir / "meta.json").read_text())
    bundle_src = src_dir / "bundle.wp"
    icon_src = src_dir / "icon.svg"
    if not bundle_src.is_file():
        raise SystemExit(f"app {slug}: missing bundle.wp")

    bundle_dest = OUT_BUNDLES / f"{slug}.wp"
    shutil.copy2(bundle_src, bundle_dest)

    icon_name = f"{slug}.svg"
    if icon_src.is_file():
        shutil.copy2(icon_src, OUT_ICONS / icon_name)
    else:
        (OUT_ICONS / icon_name).write_text(widget_tile(slug, meta["name"]))

    return {
        "type": "app",
        "slug": slug,
        "name": meta["name"],
        "version": meta.get("version", "1.0.0"),
        "author": meta.get("author", "Regionally Famous"),
        "description": meta.get("description", ""),
        "tags": meta.get("tags", []),
        "icon_url": f"{CATALOG_BASE}/icons/{icon_name}",
        "download_url": f"{CATALOG_BASE}/bundles/{bundle_dest.name}",
        "sha256": sha256_file(bundle_dest),
        "size": bundle_dest.stat().st_size,
    }


# ---------------------------------------------------------------- #
# Registry schema + assembly.
# ---------------------------------------------------------------- #


SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": SCHEMA_URL,
    "title": "ODD Catalog Registry",
    "type": "object",
    "required": ["version", "bundles"],
    "properties": {
        "$schema": {"type": "string"},
        "version": {"type": "integer", "const": 1},
        "generated_at": {"type": "string"},
        "starter_pack": {
            "type": "object",
            "properties": {
                "scenes": {"type": "array", "items": {"type": "string"}},
                "iconSets": {"type": "array", "items": {"type": "string"}},
                "widgets": {"type": "array", "items": {"type": "string"}},
                "apps": {"type": "array", "items": {"type": "string"}},
            },
        },
        "bundles": {
            "type": "array",
            "items": {
                "type": "object",
                "required": [
                    "type",
                    "slug",
                    "name",
                    "version",
                    "download_url",
                    "sha256",
                ],
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["scene", "icon-set", "widget", "app"],
                    },
                    "slug": {"type": "string"},
                    "name": {"type": "string"},
                    "version": {"type": "string"},
                    "author": {"type": "string"},
                    "description": {"type": "string"},
                    "franchise": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "icon_url": {"type": "string"},
                    "download_url": {"type": "string"},
                    "sha256": {
                        "type": "string",
                        "pattern": "^[0-9a-f]{64}$",
                    },
                    "size": {"type": "integer"},
                    "accent": {"type": "string"},
                },
            },
        },
    },
}


def main() -> int:
    if not SOURCES.is_dir():
        print(f"error: {SOURCES} not found", file=sys.stderr)
        return 1

    # Wipe and recreate outputs so stale bundles can't linger.
    if OUT_ROOT.exists():
        shutil.rmtree(OUT_ROOT)
    OUT_BUNDLES.mkdir(parents=True, exist_ok=True)
    OUT_ICONS.mkdir(parents=True, exist_ok=True)

    all_rows: list[dict] = []

    scenes_dir = SOURCES / "scenes"
    if scenes_dir.is_dir():
        for folder in sorted(scenes_dir.iterdir()):
            if not folder.is_dir():
                continue
            all_rows.append(build_scene(folder.name, folder))

    iconsets_dir = SOURCES / "icon-sets"
    if iconsets_dir.is_dir():
        for folder in sorted(iconsets_dir.iterdir()):
            if not folder.is_dir():
                continue
            all_rows.append(build_iconset(folder.name, folder))

    widgets_dir = SOURCES / "widgets"
    if widgets_dir.is_dir():
        for folder in sorted(widgets_dir.iterdir()):
            if not folder.is_dir():
                continue
            all_rows.append(build_widget(folder.name, folder))

    apps_dir = SOURCES / "apps"
    if apps_dir.is_dir():
        for folder in sorted(apps_dir.iterdir()):
            if not folder.is_dir():
                continue
            all_rows.append(build_app(folder.name, folder))

    starter_path = SOURCES / "starter-pack.json"
    starter = json.loads(starter_path.read_text()) if starter_path.is_file() else {}

    registry = {
        "$schema": SCHEMA_URL,
        "version": 1,
        # Deterministic by default; CI sets ODD_CATALOG_GENERATED_AT for stamped releases.
        "generated_at": "",
        "starter_pack": {
            "scenes": starter.get("scenes", []),
            "iconSets": starter.get("iconSets", []),
            "widgets": starter.get("widgets", []),
            "apps": starter.get("apps", []),
        },
        "bundles": all_rows,
    }

    (OUT_ROOT / "registry.json").write_text(
        json.dumps(registry, indent=2) + "\n"
    )
    (OUT_ROOT / "registry.schema.json").write_text(
        json.dumps(SCHEMA, indent=2) + "\n"
    )

    # Summary.
    types: dict[str, int] = {}
    total_size = 0
    for row in all_rows:
        types[row["type"]] = types.get(row["type"], 0) + 1
        total_size += row["size"]
    print("built catalog:")
    for t, n in sorted(types.items()):
        print(f"  {t:<10} {n}")
    print(f"  bundles    {len(all_rows)}")
    print(f"  total size {total_size:,} bytes "
          f"({total_size / (1024 * 1024):.1f} MB)")
    print(f"  out:       {OUT_ROOT.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
