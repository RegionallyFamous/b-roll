---
description: Scaffold a new ODD wallpaper scene (file + manifest entry)
argument-hint: <slug> <label> [franchise]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Scaffold a new ODD scene

Parse `$ARGUMENTS` as `<slug> <label> [franchise]`. The slug is kebab-case and matches the filename + the key under `window.__odd.scenes`. If the user didn't supply both a slug and a label, ask for them before proceeding.

Then do all of the following:

## 1. Create `odd/src/wallpaper/scenes/<slug>.js`

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
            var url = window.odd.pluginUrl + '/assets/wallpapers/<slug>.webp?v=' + window.odd.version;
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

## 2. Append an entry to `odd/src/wallpaper/scenes.json`

```json
{
  "slug": "<slug>",
  "label": "<Label>",
  "franchise": "<Franchise>",
  "tags": ["tag1", "tag2"],
  "fallbackColor": "#111111",
  "added": "0.X.Y"
}
```

## 3. Drop the assets

- `odd/assets/previews/<slug>.webp` — 1.6:1, ~640 px wide, WebP q82, ~50–100 KB.
- `odd/assets/wallpapers/<slug>.webp` — 1920×1080, WebP q82, ~300–500 KB.

Run `odd/bin/validate-scenes` — it fails if the manifest doesn't have matching JS + preview + wallpaper files on disk.

## 4. Bump the plugin version in `odd/odd.php`

Two places stay in sync: the `Version:` header and `ODD_VERSION`. Pick the next patch version unless the user specified otherwise, then run `odd/bin/check-version`.

## 5. Report back

Tell the user what was created, what's still placeholder, and suggest next steps — typically: flesh out `tick()`, regenerate the painted assets via `_tools/gen-wallpaper.py`, and run `/release <next-version>` when ready.
