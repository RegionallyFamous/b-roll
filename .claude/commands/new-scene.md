---
description: Scaffold a new B-Roll wallpaper scene (file + manifest entry + preview placeholder)
argument-hint: <slug> <label> [franchise]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Scaffold a new B-Roll scene

Parse `$ARGUMENTS` as `<slug> <label> [franchise]`. The slug is kebab-case and matches the filename + the key under `window.__bRoll.scenes`. If the user didn't supply both a slug and a label, ask for them before proceeding.

Then do all of the following:

## 1. Create `src/scenes/<slug>.js`

Use this skeleton. Fill in a 1–3 line header comment describing the visual (franchise + what the scene depicts). Set `fromColor` / `toColor` to a palette that fits the theme — dark dramatic for cyberpunk, pastel for cute, etc.

```javascript
/**
 * B-Roll scene: <Label> (<Franchise>)
 * ---------------------------------------------------------------
 * <One-line description of the visual motif.>
 */
( function () {
    'use strict';
    window.__bRoll = window.__bRoll || {};
    window.__bRoll.scenes = window.__bRoll.scenes || {};
    var h = window.__bRoll.helpers;

    window.__bRoll.scenes[ '<slug>' ] = {
        setup: function ( env ) {
            var PIXI = env.PIXI, app = env.app;

            var bg = new PIXI.Graphics();
            app.stage.addChild( bg );
            h.paintVGradient( bg, app.renderer.width, app.renderer.height, 0x111111, 0x000000, 12 );

            // TODO: build your scene's containers, sprites, graphics.

            return {
                bg: bg,
                // ... your mutable state here
            };
        },
        onResize: function ( state, env ) {
            h.paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x111111, 0x000000, 12 );
        },
        tick: function ( state, env ) {
            // TODO: animate. env.dt is frames @60fps clamped to 2.5.
        },
    };
} )();
```

## 2. Add the manifest entry in `src/index.js`

Find the `SCENES` array and append:

```javascript
{ id: '<slug>', label: '<Label>' },
```

Keep the order consistent with how you want scenes to appear in the picker.

## 3. Add a preview swatch in `src/index.js`

Find the `// --- Preview swatches ---` region and add a new block before the `SCENES` array:

```javascript
// --- <Label> ------------------------------------------------- //
PREVIEWS[ '<slug>' ] = preview( [
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='xMidYMid slice'>",
        // TODO: compose a recognizable mini-illustration. Use <defs> for
        // gradients and filters. See neon-rain or shimmer for rich examples.
        "<rect width='160' height='100' fill='#111'/>",
        "<text x='80' y='54' fill='#fff' text-anchor='middle' font-family='sans-serif' font-size='14'><Label></text>",
    "</svg>",
].join( '' ), '#111' );
```

Draft a better placeholder if you can think of an obvious motif right away.

## 4. Bump the plugin version in `b-roll.php`

There are three string literals to update (the plugin header `Version:`, the `wp_enqueue_script` version arg, and the `version` entry in `wp_localize_script`). Pick the next patch version unless the user specified otherwise.

## 5. Report back

Tell the user what was created, what's still placeholder, and suggest next steps — typically: flesh out `tick()`, design the preview SVG, and run `/release <next-version>` when ready.
