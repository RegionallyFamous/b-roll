#!/usr/bin/env python3
"""Build the three Discover-shelf `.wp` bundles plus their catalog icons.

The ODD Shop's Discover shelves (Scenes / Icons / Widgets departments)
pull from `odd/apps/catalog/registry.json#bundles[]`. Every entry there
points at a `.wp` archive and an `.svg` icon under
`odd/apps/catalog/{bundles,icons}/`. Those files are shipped inside the
plugin zip *and* served raw via raw.githubusercontent.com so the
"Install" button can download them from inside WP Desktop Mode.

We previously curated three demo bundles in the registry
(scene-rainfall, iconset-origami, widget-confetti) without ever landing
the matching files on disk, so every Discover → Install click 404'd.
This builder fixes that and is CI-checked by `odd/bin/validate-catalog`.

Run: `python _tools/build-catalog-bundles.py`.
Idempotent. Deterministic: same inputs → byte-identical `.wp` output.
"""

from __future__ import annotations

import io
import json
import shutil
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
PLUGIN = REPO / "odd"
CATALOG = PLUGIN / "apps" / "catalog"
BUNDLES = CATALOG / "bundles"
ICONS = CATALOG / "icons"

# Fixed mtime for every file in every zip so the archives are stable
# across rebuilds. Value is arbitrary — any non-zero Unix time works;
# zero is rejected by some ZIP readers, so we pin to 2025-01-01.
FIXED_DATE = (2025, 1, 1, 0, 0, 0)


def read_bytes(p: Path) -> bytes:
    if not p.is_file():
        raise FileNotFoundError(f"missing input: {p.relative_to(REPO)}")
    return p.read_bytes()


def write_zip(dest: Path, files: dict[str, bytes]) -> None:
    """Write a ZIP at `dest` with deterministic entry ordering + mtimes."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in sorted(files):
            info = zipfile.ZipInfo(name, FIXED_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, files[name])
    dest.write_bytes(buf.getvalue())


def build_scene_rainfall() -> None:
    """Remote copy of Rainfall under slug `rainfall-remote`.

    The plugin-bundled Rainfall scene registers under `rainfall` and
    reads the backdrop from `/assets/wallpapers/rainfall.webp`. Installed
    scene bundles live at `wp-content/odd-scenes/<slug>/wallpaper.webp`
    and the engine exposes the right URL via
    `window.odd.sceneMap['rainfall-remote'].wallpaperUrl`, so we rewrite
    both references in the scene source.
    """
    src = read_bytes(PLUGIN / "src" / "wallpaper" / "scenes" / "rainfall.js").decode("utf-8")

    src = src.replace(
        "window.__odd.scenes.rainfall =",
        "window.__odd.scenes[ 'rainfall-remote' ] =",
    )
    src = src.replace(
        "return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/rainfall.webp' + qs;",
        "var sm = cfg.sceneMap || {};\n"
        "\t\tvar desc = sm[ 'rainfall-remote' ] || {};\n"
        "\t\tif ( desc.wallpaperUrl ) return desc.wallpaperUrl;\n"
        "\t\treturn ( cfg.pluginUrl || '' ) + '/assets/wallpapers/rainfall.webp' + qs;",
    )

    manifest = {
        "$schema": "https://raw.githubusercontent.com/RegionallyFamous/odd/main/docs/schemas/manifest.schema.json",
        "type": "scene",
        "slug": "rainfall-remote",
        "name": "Rainfall (Discover)",
        "label": "Rainfall (Discover)",
        "version": "1.0.0",
        "author": "Regionally Famous",
        "description": "A collision-aware rain scene that respects wallpaper surfaces. Ships as a remote .wp to demonstrate cross-type catalog installs.",
        "franchise": "Atmosphere",
        "tags": ["scene", "atmosphere", "rain"],
        "fallbackColor": "#050811",
        "entry": "scene.js",
        "preview": "preview.webp",
        "wallpaper": "wallpaper.webp",
    }

    write_zip(
        BUNDLES / "scene-rainfall.wp",
        {
            "manifest.json": json.dumps(manifest, indent=2, sort_keys=False).encode("utf-8") + b"\n",
            "scene.js": src.encode("utf-8"),
            "preview.webp": read_bytes(PLUGIN / "assets" / "previews" / "rainfall.webp"),
            "wallpaper.webp": read_bytes(PLUGIN / "assets" / "wallpapers" / "rainfall.webp"),
        },
    )


def build_iconset_origami() -> None:
    """Remote copy of the built-in `fold` icon set under slug `origami-remote`.

    Reuses fold's artwork verbatim — this bundle exists to prove the
    remote-install flow, not to add a new visual identity. Manifest is
    rewritten with the new slug + label + franchise so the panel
    distinguishes it from the bundled one.
    """
    src_dir = PLUGIN / "assets" / "icons" / "fold"
    src_manifest = json.loads(read_bytes(src_dir / "manifest.json"))

    manifest = {
        "$schema": "https://raw.githubusercontent.com/RegionallyFamous/odd/main/docs/schemas/manifest.schema.json",
        "type": "icon-set",
        "slug": "origami-remote",
        "name": "Origami (Discover)",
        "label": "Origami (Discover)",
        "version": "1.0.0",
        "author": "Regionally Famous",
        "description": "Paper-fold icon pack for the WordPress dock. Demonstrates remote icon-set installation from the Discover shelf.",
        "franchise": "Paper Arcade",
        "accent": src_manifest.get("accent", "#7c5cff"),
        "preview": src_manifest.get("preview", "dashboard.svg"),
        "icons": src_manifest["icons"],
    }

    files: dict[str, bytes] = {
        "manifest.json": json.dumps(manifest, indent=2, sort_keys=False).encode("utf-8") + b"\n",
    }
    for rel in set(manifest["icons"].values()):
        files[rel] = read_bytes(src_dir / rel)

    write_zip(BUNDLES / "iconset-origami.wp", files)


def build_widget_confetti() -> None:
    """A tiny button widget that throws CSS confetti on click.

    Self-contained. Registers `odd/confetti-remote` via
    `window.__odd.api.registerWidget`. No network calls, no deps.
    """
    widget_js = r"""/**
 * Confetti (Discover) — ODD widget.
 *
 * Single button. Click it → spawns ~40 CSS-animated confetti pieces in
 * random hues that drift down and fade. Everything is a <span> so the
 * widget can't leave behind DOM, timers, or event listeners after
 * unmount. Pure demo — the point is to prove the remote-install flow,
 * not to be a flagship widget.
 */
( function () {
	'use strict';
	var api = window.__odd && window.__odd.api;
	if ( ! api || typeof api.registerWidget !== 'function' ) {
		return;
	}

	var HUES = [ 330, 18, 48, 168, 200, 268 ];

	function burst( host ) {
		var rect = host.getBoundingClientRect();
		var stage = document.createElement( 'span' );
		stage.className = 'odd-confetti__stage';
		host.appendChild( stage );
		var n = 42;
		for ( var i = 0; i < n; i++ ) {
			var p = document.createElement( 'span' );
			p.className = 'odd-confetti__bit';
			var hue = HUES[ i % HUES.length ];
			var dx = ( Math.random() - 0.5 ) * rect.width * 1.8;
			var dy = rect.height * ( 1.4 + Math.random() * 1.2 );
			var rot = Math.floor( Math.random() * 540 - 270 );
			p.style.setProperty( '--dx', dx.toFixed( 0 ) + 'px' );
			p.style.setProperty( '--dy', dy.toFixed( 0 ) + 'px' );
			p.style.setProperty( '--rot', rot + 'deg' );
			p.style.setProperty( '--hue', hue + 'deg' );
			p.style.animationDelay = ( Math.random() * 0.08 ).toFixed( 2 ) + 's';
			stage.appendChild( p );
		}
		setTimeout( function () {
			if ( stage && stage.parentNode ) {
				stage.parentNode.removeChild( stage );
			}
		}, 1400 );
	}

	api.registerWidget( {
		id:    'odd/confetti-remote',
		label: 'Confetti (Discover)',
		mount: function ( root ) {
			var host = document.createElement( 'div' );
			host.className = 'odd-confetti';
			var btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.className = 'odd-confetti__btn';
			btn.textContent = 'Throw confetti';
			btn.setAttribute( 'aria-label', 'Throw confetti' );
			btn.addEventListener( 'click', function () { burst( host ); } );
			host.appendChild( btn );
			root.appendChild( host );
			return function unmount() {
				btn.replaceWith( btn.cloneNode( true ) );
				if ( host.parentNode ) {
					host.parentNode.removeChild( host );
				}
			};
		},
	} );
} )();
"""

    widget_css = r""".odd-confetti{
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 18px 20px;
	min-width: 160px;
	min-height: 84px;
	overflow: visible;
}

.odd-confetti__btn{
	font: 700 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	letter-spacing: .04em;
	text-transform: uppercase;
	color: #1a0b2e;
	background: linear-gradient( 135deg, #ffd166 0%, #ff70a6 50%, #8a5cff 100% );
	padding: 10px 16px;
	border: 0;
	border-radius: 12px;
	box-shadow: 0 4px 14px -4px rgba( 138, 92, 255, .55 ), 0 0 0 2px rgba( 255, 255, 255, .25 ) inset;
	cursor: pointer;
	transition: transform .15s ease, box-shadow .15s ease;
}
.odd-confetti__btn:hover{ transform: translateY( -1px ) rotate( -1deg ); }
.odd-confetti__btn:active{ transform: translateY( 1px ) scale( .98 ); }

.odd-confetti__stage{
	position: absolute;
	inset: 0;
	pointer-events: none;
	overflow: visible;
}

.odd-confetti__bit{
	position: absolute;
	left: 50%;
	top: 50%;
	width: 8px;
	height: 12px;
	border-radius: 2px;
	background: hsl( var( --hue ), 90%, 60% );
	transform: translate3d( -50%, -50%, 0 );
	animation: odd-confetti-fly 1.3s cubic-bezier( .22, .65, .32, 1 ) forwards;
	opacity: .95;
}

@keyframes odd-confetti-fly{
	0% {
		transform: translate3d( -50%, -50%, 0 ) rotate( 0deg );
		opacity: 1;
	}
	100% {
		transform: translate3d( calc( -50% + var( --dx ) ), calc( -50% + var( --dy ) ), 0 ) rotate( var( --rot ) );
		opacity: 0;
	}
}

@media ( prefers-reduced-motion: reduce ){
	.odd-confetti__bit{ animation-duration: .01s; }
}
"""

    manifest = {
        "$schema": "https://raw.githubusercontent.com/RegionallyFamous/odd/main/docs/schemas/manifest.schema.json",
        "type": "widget",
        "slug": "confetti-remote",
        "name": "Confetti (Discover)",
        "label": "Confetti (Discover)",
        "version": "1.0.0",
        "author": "Regionally Famous",
        "description": "A tiny desktop widget that throws confetti when you click it. First remote widget example.",
        "franchise": "Community",
        "entry": "widget.js",
        "css": ["widget.css"],
    }

    write_zip(
        BUNDLES / "widget-confetti.wp",
        {
            "manifest.json": json.dumps(manifest, indent=2, sort_keys=False).encode("utf-8") + b"\n",
            "widget.js": widget_js.encode("utf-8"),
            "widget.css": widget_css.encode("utf-8"),
        },
    )


# ---------------------------------------------------------------------
# Catalog icons — the small 64x64 SVG tiles shown next to each bundle
# in the Discover shelf. All three reuse the ODD Memphis palette so
# they read as a family.
# ---------------------------------------------------------------------

SCENE_RAINFALL_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Rainfall">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1b2744"/>
      <stop offset="100%" stop-color="#0a1020"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="64" height="64" rx="14" ry="14" fill="url(#sky)"/>
  <ellipse cx="20" cy="20" rx="14" ry="7" fill="#3a4a78"/>
  <ellipse cx="34" cy="22" rx="18" ry="8" fill="#4a5e92"/>
  <ellipse cx="46" cy="18" rx="10" ry="6" fill="#3a4a78"/>
  <g stroke="#9ad4ff" stroke-width="1.4" stroke-linecap="round" opacity=".9">
    <line x1="14" y1="32" x2="11" y2="42"/>
    <line x1="22" y1="30" x2="19" y2="40"/>
    <line x1="30" y1="34" x2="27" y2="44"/>
    <line x1="38" y1="30" x2="35" y2="40"/>
    <line x1="46" y1="34" x2="43" y2="44"/>
    <line x1="54" y1="30" x2="51" y2="40"/>
    <line x1="18" y1="44" x2="15" y2="54"/>
    <line x1="34" y1="46" x2="31" y2="56"/>
    <line x1="50" y1="44" x2="47" y2="54"/>
  </g>
  <path d="M4 58 L60 58" stroke="#5aa7ff" stroke-width="2" stroke-linecap="round" opacity=".6"/>
</svg>
"""

ICONSET_ORIGAMI_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Origami icon set">
  <rect x="0" y="0" width="64" height="64" rx="14" ry="14" fill="#fdf7ee"/>
  <path d="M32 8 L52 28 L32 48 L12 28 Z" fill="#7c5cff"/>
  <path d="M32 8 L52 28 L32 28 Z" fill="#b9a9ff" opacity=".85"/>
  <path d="M32 8 L32 28 L12 28 Z" fill="#5a3dff" opacity=".55"/>
  <path d="M12 28 L32 28 L32 48 Z" fill="#3f28cc" opacity=".7"/>
  <path d="M32 28 L52 28 L32 48 Z" fill="#2a1b99" opacity=".6"/>
  <circle cx="48" cy="50" r="6" fill="#ff70a6"/>
  <circle cx="16" cy="50" r="5" fill="#ffd166"/>
</svg>
"""

WIDGET_CONFETTI_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Confetti widget">
  <rect x="0" y="0" width="64" height="64" rx="14" ry="14" fill="#1a0b2e"/>
  <g>
    <rect x="10" y="14" width="6" height="10" rx="1.5" fill="#ff70a6" transform="rotate(-18 13 19)"/>
    <rect x="22" y="10" width="5" height="9" rx="1.2" fill="#ffd166" transform="rotate(12 24 14)"/>
    <rect x="34" y="12" width="6" height="10" rx="1.5" fill="#7cf3c0" transform="rotate(-22 37 17)"/>
    <rect x="46" y="10" width="5" height="9" rx="1.2" fill="#8a5cff" transform="rotate(18 48 14)"/>
    <rect x="12" y="30" width="5" height="9" rx="1.2" fill="#5aa7ff" transform="rotate(24 14 34)"/>
    <rect x="26" y="28" width="6" height="10" rx="1.5" fill="#ff70a6" transform="rotate(-14 29 33)"/>
    <rect x="40" y="30" width="5" height="9" rx="1.2" fill="#ffd166" transform="rotate(20 42 34)"/>
    <rect x="50" y="28" width="6" height="10" rx="1.5" fill="#7cf3c0" transform="rotate(-16 53 33)"/>
  </g>
  <rect x="14" y="42" width="36" height="14" rx="7" fill="url(#btn)" />
  <defs>
    <linearGradient id="btn" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffd166"/>
      <stop offset="50%" stop-color="#ff70a6"/>
      <stop offset="100%" stop-color="#8a5cff"/>
    </linearGradient>
  </defs>
</svg>
"""

CATALOG_ICONS = {
    "scene-rainfall.svg":   SCENE_RAINFALL_SVG,
    "iconset-origami.svg":  ICONSET_ORIGAMI_SVG,
    "widget-confetti.svg":  WIDGET_CONFETTI_SVG,
}


def write_icons() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    for name, body in CATALOG_ICONS.items():
        (ICONS / name).write_text(body, encoding="utf-8")


def main() -> int:
    if not CATALOG.is_dir():
        print(f"error: {CATALOG} not found", file=sys.stderr)
        return 1

    BUNDLES.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)

    build_scene_rainfall()
    build_iconset_origami()
    build_widget_confetti()
    write_icons()

    print("  built:")
    for name in ("scene-rainfall.wp", "iconset-origami.wp", "widget-confetti.wp"):
        p = BUNDLES / name
        size = p.stat().st_size
        print(f"    {p.relative_to(REPO)}  ({size:,} bytes)")
    for name in CATALOG_ICONS:
        p = ICONS / name
        print(f"    {p.relative_to(REPO)}  ({p.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
