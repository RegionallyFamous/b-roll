# B-Roll — project notes for Claude

> This file is auto-loaded by Claude Code. It exists so any new session
> can pick up work without re-deriving the architecture.

## What this is

B-Roll is a WordPress plugin that ships canvas wallpapers for [WP Desktop Mode](https://github.com/WordPress/desktop-mode). Each wallpaper is a pop-culture-themed PixiJS scene. The plugin is architected to scale to hundreds of scenes without bundle bloat.

- **Repo:** `RegionallyFamous/b-roll`
- **Live demo:** https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/RegionallyFamous/b-roll/main/blueprint.json
- **Host plugin (required at runtime):** WP Desktop Mode v0.5.0+

## The architecture you need to know

Not monolithic. The plugin is split into two layers:

```
src/
├── index.js            # thin registrar + shared helpers + all preview SVGs
└── scenes/             # one file per scene
    ├── code-rain.js    # self-registers under window.__bRoll.scenes['code-rain']
    ├── hyperspace.js
    └── ...
```

At boot, `index.js`:

1. Attaches shared helpers (`rand`, `lerpColor`, `paintVGradient`, `makeBloomLayer`, etc.) to `window.__bRoll.helpers`.
2. For every scene in the `SCENES` manifest:
   - Calls `wp.desktop.registerModule({ id, url, isReady })` pointing at the scene's `src/scenes/<slug>.js`.
   - Calls `wp.desktop.registerWallpaper({ id, label, type: 'canvas', preview, needs: ['pixijs', 'b-roll-<slug>'], mount })`.
3. The shell only fetches a scene module the moment a user picks that wallpaper.

This means **the `SCENES` array is the only place you add a scene-level registration**. Don't import scene files into `index.js` — they're lazy-fetched by the shell.

## The scene-file contract

Every `src/scenes/<slug>.js` has the same shape:

```javascript
( function () {
    'use strict';
    window.__bRoll = window.__bRoll || {};
    window.__bRoll.scenes = window.__bRoll.scenes || {};
    var h = window.__bRoll.helpers;       // shared helpers

    window.__bRoll.scenes[ '<slug>' ] = {
        setup: function ( env ) {
            // env: { app, PIXI, ctx, helpers }
            // Build Pixi containers/sprites on env.app.stage.
            // Return whatever state you'll mutate each tick.
        },
        tick: function ( state, env ) {
            // env: { app, PIXI, ctx, helpers, dt }
            // dt is frames at 60fps, clamped to 2.5.
        },
        onResize: function ( state, env ) { /* optional */ },
        cleanup: function ( state, env ) { /* optional */ },
    };
} )();
```

The shared mount runner in `src/index.js` handles:
- Creating the Pixi `Application` (`await app.init`, `app.canvas`)
- Styling the canvas (`position: absolute; inset: 0`)
- Calling `tick` once with `dt=0` under `prefersReducedMotion`, then stopping the ticker
- Subscribing to `wp-desktop.wallpaper.visibility` and pausing/resuming
- Destroying the app on teardown (`app.destroy(true, { children: true, texture: true })`)

So scene files **do not** build their own Pixi app, do not listen to visibility themselves, do not need to do teardown cleanup beyond releasing resources they allocated outside the Pixi scene graph (rare).

## The preview CSS gotcha (**important**)

The `preview` value on a wallpaper registration is passed directly to `<wpd-swatch>` and applied as a CSS `background` property. **Raw data URIs are not valid `background` values** — they must be wrapped in `url(...)`.

Use the `preview()` helper in `src/index.js`:

```javascript
preview( svgMarkup, fallbackColor )
// returns: url("data:image/svg+xml;charset=utf-8,<encoded>") center/cover no-repeat, <fallback>
```

Never set `preview: 'data:image/svg+xml,...'` directly — that was the v0.2 bug that rendered everything blank. The fallback color is shown if the SVG fails to load and prevents a flash of blank.

## PixiJS v8 API conventions used throughout

- `new PIXI.Application()` + `await app.init({ ... })` — v7 constructor-options style doesn't work
- `app.canvas`, not `app.view`
- Fluent Graphics: `g.rect(...).fill({...})`, `g.moveTo().lineTo().stroke({...})`
- `app.ticker.add( ticker => { const dt = ticker.deltaTime } )` — callback receives a `Ticker`, not a number
- For bloom/glow: use `makeBloomLayer(PIXI, strength)` helper, which returns a `Container` with `blendMode='add'` and a `BlurFilter`. Draw your "bright" content into it, then draw crisp content in the main layer on top.
- `app.destroy(true, { children: true, texture: true })` in teardown — the shared runner does this

Non-obvious: `ticker.deltaTime` after a backgrounded tab can be huge. The shared runner clamps it to 2.5 before passing to `tick`. If your scene advances state over many frames in one tick and you need a tighter clamp, clamp further inside your own tick.

## No franchise artwork ships in the plugin

Every visual is drawn from Pixi primitives (Graphics polygons, Text glyphs, procedural particles). This keeps the plugin tiny, unambiguous on ownership, and fast. If you're tempted to add a PNG asset, reconsider — the scenes read as recognizable without art because the silhouettes and palettes carry the reference.

## File layout

```
b-roll/
├── b-roll.php              # plugin bootstrap — enqueues src/index.js
├── blueprint.json          # Playground demo (installPlugin steps + updateUserMeta)
├── README.md               # user-facing docs
├── CLAUDE.md               # this file
├── LICENSE                 # GPLv2
├── .gitignore
└── src/
    ├── index.js            # registrar + shared helpers + previews
    └── scenes/
        ├── code-rain.js    (+ 9 others)
        └── ...
```

Version lives in three places — keep in sync on release: the `Version:` header in `b-roll.php`, the `'0.3.0'` string in `wp_enqueue_script`, and the `'version'` value in `wp_localize_script`.

## Workflows

### Test locally via Playground (zero-install)

1. Commit + push your changes to `main`.
2. Wait for the release workflow (or cut a release manually — see below). The blueprint points at `releases/latest/download/b-roll.zip`, so Playground always pulls the newest release.
3. Open the Playground demo URL. First boot takes 20–30s.

For faster iteration, you can install the plugin into a local WordPress install (symlink `b-roll/` into `wp-content/plugins/`, activate, enable desktop mode). No build step required.

### Cut a release

The `/release <version>` slash command (in `.claude/commands/release.md`) automates the full flow. Manually, the shape is:

```bash
# Update version string in b-roll.php (3 places), commit
# Build the zip
cd ..
python3 -c "
import zipfile, os, pathlib
src = pathlib.Path('b-roll')
with zipfile.ZipFile('b-roll.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(src.rglob('*')):
        if '.git' in p.parts: continue
        if p.is_file(): z.write(p, arcname=str(p.relative_to('.')))
"
# Cut release + upload via gh
gh release create v0.X.0 ./b-roll.zip --title "v0.X.0 — <summary>" --notes "<body>"
```

After the release, the Playground demo link auto-refreshes to the new zip on next load (no blueprint edits needed).

### Add a new scene

The `/new-scene` slash command (in `.claude/commands/new-scene.md`) scaffolds the file + manifest entry. Manually:

1. Create `src/scenes/<slug>.js` from the skeleton above. Slug is kebab-case.
2. Add an entry to `SCENES` in `src/index.js`:
   ```javascript
   { id: '<slug>', label: '<Display Name>' },
   ```
3. Add a preview SVG:
   ```javascript
   PREVIEWS[ '<slug>' ] = preview( "<svg ...>...</svg>", '#fallback-color' );
   ```

That's the whole contract. The shell picks up the new scene the next time `wp-desktop.init` fires.

## Gotchas & prior incidents

- **The v0.2 blank-swatch bug** was the `preview` CSS issue above. Every preview must route through the `preview()` helper.
- **GitHub release asset uploads** occasionally return "Error creating policy" right after release creation. The fix is a `sleep 2` + retry, or just wait and re-upload. The release itself is already created.
- **catbox.moe** was used as a temporary host in v0.1 — it's no longer referenced anywhere. Don't reintroduce it; `raw.githubusercontent.com` and GitHub release downloads both serve with `Access-Control-Allow-Origin: *` which is what Playground needs.
- **Playground's `?blueprint-url=`** expects a URL that serves with CORS. If you're hosting the blueprint somewhere new, verify with `curl -H "Origin: https://playground.wordpress.net" -I <url>` that `access-control-allow-origin: *` comes back on a real GET.

## Where things aren't documented yet

- `wp-desktop.wallpaper.visibility` action: the JS reference marks it Stable but doesn't spell out the payload shape. We use `{ id, state: 'hidden' | 'visible' }` based on the recipe example. If that assumption ever breaks, the shared mount's `onVis` handler silently no-ops — no scene crashes.
- **Performance under many concurrent scenes:** untested. The architecture supports it, but we haven't actually benchmarked activating/deactivating lots in rapid succession. When we scale past ~30 scenes, worth a pass.
