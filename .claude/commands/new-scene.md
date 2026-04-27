---
description: Scaffold a new ODD wallpaper scene (file + manifest entry)
argument-hint: <slug> <label> [franchise]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Scaffold a new ODD scene

Parse `$ARGUMENTS` as `<slug> <label> [franchise]`. The slug is kebab-case and matches the filename + the key under `window.__odd.scenes`. If the user didn't supply both a slug and a label, ask for them before proceeding.

Then do all of the following:

## 1. Create `_tools/catalog-sources/scenes/<slug>/scene.js`

Use this skeleton. Fill in a 1–3 line header comment describing the visual (franchise + what the scene depicts). Match the scene's palette to the theme — dark dramatic for cyberpunk, pastel for cute, etc.

```javascript
/**
 * ODD scene: <Label> (<Franchise>)
 * ---------------------------------------------------------------
 * <One-line description of the visual motif.>
 */
( function () {
    'use strict';
    window.__odd = window.__odd || {};
    window.__odd.scenes = window.__odd.scenes || {};
    var h = window.__odd.helpers;

    window.__odd.scenes[ '<slug>' ] = {
        setup: async function ( env ) {
            var PIXI = env.PIXI, app = env.app;

            // Painted backdrop — cover-fit, re-run on resize.
            var sceneMap = ( window.odd && window.odd.sceneMap ) || {};
            var descriptor = sceneMap[ '<slug>' ] || {};
            var url = descriptor.wallpaperUrl || ( ( window.odd && window.odd.pluginUrl ) + '/assets/wallpapers/<slug>.webp?v=' + window.odd.version );
            var tex = await PIXI.Assets.load( url );
            var backdrop = new PIXI.Sprite( tex );
            app.stage.addChild( backdrop );
            function fitBackdrop() {
                var s = Math.max( app.renderer.width / tex.width, app.renderer.height / tex.height );
                backdrop.scale.set( s );
                backdrop.x = ( app.renderer.width  - tex.width  * s ) / 2;
                backdrop.y = ( app.renderer.height - tex.height * s ) / 2;
            }
            fitBackdrop();

            // TODO: build your Pixi motion layers on top of the backdrop.

            return {
                fitBackdrop: fitBackdrop,
                // ... your mutable state here
            };
        },
        onResize: function ( state, env ) {
            state.fitBackdrop();
        },
        tick: function ( state, env ) {
            // TODO: animate. env.dt is frames @60fps clamped to 2.5.
        },
    };
} )();
```

## 2. Drop a `meta.json` next to `scene.js` in `_tools/catalog-sources/scenes/<slug>/`

```json
{
  "slug": "<slug>",
  "label": "<Label>",
  "franchise": "<Franchise>",
  "tags": ["tag1", "tag2"],
  "fallbackColor": "#111111",
  "added": "X.Y.Z"
}
```

The builder populates `previewUrl` + `wallpaperUrl` from the files on disk.

## 3. Drop the assets next to `meta.json`

- `_tools/catalog-sources/scenes/<slug>/preview.webp` — 1.6:1, ~640 px wide, WebP q82, ~50–100 KB.
- `_tools/catalog-sources/scenes/<slug>/wallpaper.webp` — 1920×1080, WebP q82, ~300–500 KB.

Run `python3 _tools/build-catalog.py && odd/bin/validate-catalog` — the builder rejects broken source trees and the validator refuses catalogs with missing bundles / hash mismatches / bad manifests.

## 4. Bump the plugin version in `odd/odd.php`

Two places stay in sync: the `Version:` header and `ODD_VERSION`. Pick the next patch version unless the user specified otherwise, then run `odd/bin/check-version`.

## 5. Report back

Tell the user what was created, what's still placeholder, and suggest next steps — typically: flesh out `tick()`, regenerate the painted assets via `_tools/gen-wallpaper.py`, and run `/release <next-version>` when ready.
