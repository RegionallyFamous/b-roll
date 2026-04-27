#!/usr/bin/env python3
"""One-shot migration for ODD 3.0: extract every scene, icon set, widget,
and app out of the plugin into `_tools/catalog-sources/` source folders.

After this script runs, the plugin no longer owns any content. The
catalog builder (`_tools/build-catalog.py`) walks `catalog-sources/`
to emit `site/catalog/v1/{registry.json,bundles/*.wp,icons/*.svg}`.

This script is intended to be run exactly once; the resulting tree is
then committed. The script itself is deleted after the v3.0 cut.

Behaviour:
  - Scenes:      odd/src/wallpaper/scenes/<slug>.js        ->
                  _tools/catalog-sources/scenes/<slug>/{scene.js,meta.json,
                  wallpaper.webp,preview.webp}
                  Every scene.js is normalised so its `backdropUrl()`
                  reads from window.odd.sceneMap[<slug>].wallpaperUrl
                  first (plugin path fallback retained for dev).
  - Icon sets:   odd/assets/icons/<slug>/                   ->
                  _tools/catalog-sources/icon-sets/<slug>/  (copy intact)
  - Widgets:     split odd/src/widgets/index.js into
                  _tools/catalog-sources/widgets/{sticky,eight-ball}/
                  {widget.js,widget.css,manifest.json}
  - Apps:        keep the prebuilt .wp bundles in
                  _tools/catalog-sources/apps/<slug>/bundle.wp and copy
                  the catalog icon alongside.
  - Starter pack: write catalog-sources/starter-pack.json pinning
                  the default scene + icon set.

This script ONLY writes new files under `_tools/catalog-sources/` and
LEAVES the originals in place. A later todo physically deletes the old
trees from the plugin.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
PLUGIN = REPO / "odd"
SOURCES = HERE / "catalog-sources"

SCENES_DIR = PLUGIN / "src" / "wallpaper" / "scenes"
SCENES_JSON = PLUGIN / "src" / "wallpaper" / "scenes.json"
WALLPAPERS_DIR = PLUGIN / "assets" / "wallpapers"
PREVIEWS_DIR = PLUGIN / "assets" / "previews"
ICONS_DIR = PLUGIN / "assets" / "icons"
WIDGETS_INDEX = PLUGIN / "src" / "widgets" / "index.js"
WIDGETS_STYLE = PLUGIN / "src" / "widgets" / "style.css"
APPS_CATALOG = PLUGIN / "apps" / "catalog"

# Every scene's backdropUrl() (and stillFrame's duplicate) ends in the
# same return statement. We rewrite it to prefer sceneMap.wallpaperUrl.
URL_PATTERN = re.compile(
    r"return \( cfg\.pluginUrl \|\| '' \) \+ '/assets/wallpapers/([a-z0-9-]+)\.webp' \+ qs;"
)


def normalise_scene_source(src: str, slug: str) -> str:
    """Rewrite hardcoded wallpaper URL returns to prefer sceneMap."""

    def replace(match: re.Match) -> str:
        scene_slug = match.group(1)
        if scene_slug != slug:
            # Different slug embedded in source — unusual, but preserve
            # behaviour by still rewriting against that slug.
            pass
        return (
            "var sm = cfg.sceneMap || {};\n"
            f"\t\tvar desc = sm[ '{scene_slug}' ] || {{}};\n"
            "\t\tif ( desc.wallpaperUrl ) return desc.wallpaperUrl;\n"
            f"\t\treturn ( cfg.pluginUrl || '' ) + '/assets/wallpapers/{scene_slug}.webp' + qs;"
        )

    new_src, count = URL_PATTERN.subn(replace, src)
    if count == 0:
        print(f"  warn: no URL pattern found in {slug}.js — left untouched")
    else:
        print(f"  {slug}.js: normalised {count} URL site(s)")
    return new_src


def migrate_scenes() -> list[dict]:
    print("\n== scenes ==")
    out = SOURCES / "scenes"
    out.mkdir(parents=True, exist_ok=True)

    manifest_entries = json.loads(SCENES_JSON.read_text())
    by_slug = {row["slug"]: row for row in manifest_entries}

    copied = []
    for slug, row in by_slug.items():
        dest = out / slug
        dest.mkdir(parents=True, exist_ok=True)

        src_js = (SCENES_DIR / f"{slug}.js").read_text()
        (dest / "scene.js").write_text(normalise_scene_source(src_js, slug))

        wallpaper = WALLPAPERS_DIR / f"{slug}.webp"
        preview = PREVIEWS_DIR / f"{slug}.webp"
        if not wallpaper.is_file():
            print(f"  error: missing wallpaper for {slug}")
            sys.exit(1)
        if not preview.is_file():
            print(f"  error: missing preview for {slug}")
            sys.exit(1)
        shutil.copy2(wallpaper, dest / "wallpaper.webp")
        shutil.copy2(preview, dest / "preview.webp")

        meta = {
            "slug": slug,
            "label": row.get("label", slug),
            "franchise": row.get("franchise", "Community"),
            "tags": row.get("tags", []),
            "fallbackColor": row.get("fallbackColor", "#111"),
            "version": "1.0.0",
            "author": "Regionally Famous",
            "description": row.get("description")
            or f"{row.get('label', slug)} — a painted ODD wallpaper scene.",
        }
        (dest / "meta.json").write_text(
            json.dumps(meta, indent=2, sort_keys=False) + "\n"
        )
        copied.append(meta)

    print(f"  migrated {len(copied)} scenes")
    return copied


def migrate_icon_sets() -> list[dict]:
    print("\n== icon sets ==")
    out = SOURCES / "icon-sets"
    out.mkdir(parents=True, exist_ok=True)

    copied = []
    for folder in sorted(ICONS_DIR.iterdir()):
        if not folder.is_dir():
            continue
        slug = folder.name
        manifest = json.loads((folder / "manifest.json").read_text())
        dest = out / slug
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(folder, dest)

        meta = {
            "slug": manifest.get("slug", slug),
            "label": manifest.get("label", slug),
            "franchise": manifest.get("franchise", "Community"),
            "accent": manifest.get("accent", "#888"),
            "preview": manifest.get("preview", "dashboard.svg"),
            "description": manifest.get(
                "description", f"{manifest.get('label', slug)} icon pack."
            ),
            "version": "1.0.0",
            "author": "Regionally Famous",
            "icons": manifest.get("icons", {}),
        }
        (dest / "manifest.json").write_text(
            json.dumps(meta, indent=2, sort_keys=False) + "\n"
        )
        copied.append(meta)
        print(f"  migrated icon set: {slug}")

    print(f"  migrated {len(copied)} icon sets")
    return copied


def split_widgets() -> list[dict]:
    """Split the monolithic src/widgets/index.js into two widget bundles.

    The two widgets share a common prologue (el/ready/__ helpers and the
    reducedMotion() probe). Each extracted widget.js re-includes those
    helpers inline so it's self-contained as an installable bundle.
    """
    print("\n== widgets ==")
    out = SOURCES / "widgets"
    out.mkdir(parents=True, exist_ok=True)

    src = WIDGETS_INDEX.read_text()
    css = WIDGETS_STYLE.read_text() if WIDGETS_STYLE.is_file() else ""

    prologue = r"""( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	var wpI18nW = window.wp && window.wp.i18n;
	function __( s ) {
		return ( wpI18nW && typeof wpI18nW.__ === 'function' ) ? wpI18nW.__( s, 'odd' ) : s;
	}

	function ready( cb ) {
		if ( window.wp && window.wp.desktop && typeof window.wp.desktop.ready === 'function' ) {
			window.wp.desktop.ready( cb );
		} else if ( document.readyState === 'loading' ) {
			document.addEventListener( 'DOMContentLoaded', cb, { once: true } );
		} else {
			cb();
		}
	}

	function el( tag, attrs, children ) {
		var n = document.createElement( tag );
		if ( attrs ) {
			for ( var k in attrs ) {
				if ( ! Object.prototype.hasOwnProperty.call( attrs, k ) ) continue;
				if ( k === 'class' ) n.className = attrs[ k ];
				else if ( k === 'style' ) n.setAttribute( 'style', attrs[ k ] );
				else n.setAttribute( k, attrs[ k ] );
			}
		}
		if ( children ) {
			if ( ! Array.isArray( children ) ) children = [ children ];
			children.forEach( function ( c ) {
				if ( c == null ) return;
				n.appendChild( typeof c === 'string' ? document.createTextNode( c ) : c );
			} );
		}
		return n;
	}

	function reducedMotion() {
		try {
			return window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
		} catch ( e ) { return false; }
	}

	function safeMount( fn, source ) {
		return function ( node, ctx ) {
			try {
				return fn( node, ctx );
			} catch ( err ) {
				if ( window.__odd && window.__odd.events ) {
					try {
						window.__odd.events.emit( 'odd.error', {
							source:   source,
							err:      err,
							severity: 'error',
							message:  err && err.message,
							stack:    err && err.stack,
						} );
					} catch ( e2 ) {}
				}
				if ( window.console ) { try { window.console.error( '[ODD ' + source + ']', err ); } catch ( e3 ) {} }
				return function () {};
			}
		};
	}
"""

    epilogue = "\n} )();\n"

    # --- Sticky --------------------------------------------------------
    sticky_body_start = src.index("var STICKY_KEY")
    sticky_body_end = src.index("// ============", sticky_body_start + 1)
    sticky_body = src[sticky_body_start:sticky_body_end].rstrip()

    sticky_js = (
        prologue
        + "\n\t"
        + sticky_body.replace("\n", "\n\t").rstrip()
        + """

	ready( function () {
		if ( ! window.wp || ! window.wp.desktop || typeof window.wp.desktop.registerWidget !== 'function' ) return;
		window.wp.desktop.registerWidget( {
			id:            'odd/sticky',
			label:         __( 'ODD \u00b7 Sticky Note' ),
			description:   __( 'A tilted handwritten note that auto-saves as you type.' ),
			icon:          'dashicons-welcome-write-blog',
			movable:       true,
			resizable:     true,
			minWidth:      220,
			minHeight:     160,
			defaultWidth:  260,
			defaultHeight: 200,
			mount:         safeMount( mountSticky, 'widget.sticky' ),
		} );
	} );"""
        + epilogue
    )

    # --- 8-Ball --------------------------------------------------------
    eight_body_start = src.index("var EIGHT_ANSWERS")
    eight_body_end = src.index("// ============", eight_body_start + 1)
    eight_body = src[eight_body_start:eight_body_end].rstrip()

    eight_js = (
        prologue
        + "\n\t"
        + eight_body.replace("\n", "\n\t").rstrip()
        + """

	ready( function () {
		if ( ! window.wp || ! window.wp.desktop || typeof window.wp.desktop.registerWidget !== 'function' ) return;
		window.wp.desktop.registerWidget( {
			id:            'odd/eight-ball',
			label:         __( 'ODD \u00b7 Magic 8-Ball' ),
			description:   __( 'A WordPress-flavored magic 8-ball. Click to shake.' ),
			icon:          'dashicons-editor-help',
			movable:       true,
			resizable:     true,
			minWidth:      200,
			minHeight:     220,
			defaultWidth:  240,
			defaultHeight: 260,
			mount:         safeMount( mountEightBall, 'widget.eight-ball' ),
		} );
	} );"""
        + epilogue
    )

    # --- CSS splitting: all the .odd-widget + .odd-sticky__* rules go
    #     to sticky; .odd-eight__* rules go to eight-ball.
    def extract_css_rules(css_text: str, patterns: list[str]) -> str:
        """Extract whole CSS rule blocks matching any of the substrings."""
        out_rules = []
        rules = re.findall(r"([^{}]+)\{([^{}]*)\}", css_text, flags=re.DOTALL)
        for selector, body in rules:
            sel = selector.strip()
            if any(p in sel for p in patterns):
                out_rules.append(f"{sel} {{{body}}}")
        return "\n".join(out_rules) + "\n"

    sticky_css = extract_css_rules(
        css, [".odd-widget--sticky", ".odd-sticky__", ".odd-widget"]
    )
    eight_css = extract_css_rules(
        css, [".odd-widget--eight", ".odd-eight__", ".is-shaking", ".is-fading"]
    )

    widgets_meta = []
    for slug, label, desc, js_body, css_body in [
        (
            "sticky",
            "Sticky Note",
            "A tilted handwritten sticky note that auto-saves as you type.",
            sticky_js,
            sticky_css,
        ),
        (
            "eight-ball",
            "Magic 8-Ball",
            "A WordPress-flavored magic 8-ball. Click to shake for wisdom.",
            eight_js,
            eight_css,
        ),
    ]:
        dest = out / slug
        dest.mkdir(parents=True, exist_ok=True)
        (dest / "widget.js").write_text(js_body)
        if css_body.strip():
            (dest / "widget.css").write_text(css_body)
        meta = {
            "slug": slug,
            "id": f"odd/{slug}",
            "label": label,
            "description": desc,
            "franchise": "ODD Originals",
            "version": "1.0.0",
            "author": "Regionally Famous",
            "entry": "widget.js",
            "css": ["widget.css"] if css_body.strip() else [],
        }
        (dest / "manifest.json").write_text(
            json.dumps(meta, indent=2, sort_keys=False) + "\n"
        )
        widgets_meta.append(meta)
        print(f"  extracted widget: {slug}")

    return widgets_meta


def migrate_apps() -> list[dict]:
    """Copy the prebuilt app .wp bundles + icons into catalog-sources.

    Apps are already-built artifacts; we don't have their build
    toolchain in this repo. The builder treats each app source folder
    as "one prebuilt .wp plus one icon.svg, emit as-is" and reads the
    apps-registry metadata from catalog-sources/apps/<slug>/meta.json.
    """
    print("\n== apps ==")
    registry = json.loads((APPS_CATALOG / "registry.json").read_text())
    out = SOURCES / "apps"
    out.mkdir(parents=True, exist_ok=True)

    copied = []
    for row in registry.get("apps", []):
        slug = row["slug"]
        bundle = APPS_CATALOG / "bundles" / f"{slug}.wp"
        icon = APPS_CATALOG / "icons" / f"{slug}.svg"
        if not bundle.is_file():
            print(f"  error: missing app bundle for {slug}")
            sys.exit(1)

        dest = out / slug
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy2(bundle, dest / "bundle.wp")
        if icon.is_file():
            shutil.copy2(icon, dest / "icon.svg")

        meta = {
            "slug": slug,
            "name": row["name"],
            "description": row["description"],
            "version": row.get("version", "1.0.0"),
            "author": row.get("author", "Regionally Famous"),
            "tags": row.get("tags", []),
        }
        (dest / "meta.json").write_text(
            json.dumps(meta, indent=2, sort_keys=False) + "\n"
        )
        copied.append(meta)
        print(f"  migrated app: {slug}")

    print(f"  migrated {len(copied)} apps")
    return copied


def write_starter_pack() -> None:
    print("\n== starter pack ==")
    starter = {
        "scenes": ["flux"],
        "iconSets": ["filament"],
        "widgets": [],
        "apps": [],
    }
    (SOURCES / "starter-pack.json").write_text(
        json.dumps(starter, indent=2, sort_keys=False) + "\n"
    )
    print(f"  wrote {SOURCES / 'starter-pack.json'}")


def main() -> int:
    SOURCES.mkdir(parents=True, exist_ok=True)

    scenes = migrate_scenes()
    icon_sets = migrate_icon_sets()
    widgets = split_widgets()
    apps = migrate_apps()
    write_starter_pack()

    print("\n== summary ==")
    print(f"  scenes:    {len(scenes)}")
    print(f"  icon-sets: {len(icon_sets)}")
    print(f"  widgets:   {len(widgets)}")
    print(f"  apps:      {len(apps)}")
    print(f"  total:     {len(scenes) + len(icon_sets) + len(widgets) + len(apps)}")
    print(f"\nsources tree at: {SOURCES.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
