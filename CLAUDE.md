# B-Roll — project notes for Claude

> This file is auto-loaded by Claude Code. It exists so any new session
> can pick up work without re-deriving the architecture.

## What this is

B-Roll is a WordPress plugin that ships canvas wallpapers for [WP Desktop Mode](https://github.com/WordPress/desktop-mode). Each wallpaper is a pop-culture-themed PixiJS scene rendered on top of a painted 1920×1080 JPG backdrop.

Since v0.6.0 the plugin exposes **one** wallpaper card to the WP Desktop shell — "B-Roll" — and scene selection lives in an **in-canvas picker** (a gear button injected over the wallpaper) that the plugin owns. The plugin is architected on three scaling pillars: a data-driven manifest (scenes are rows in JSON, not code), lazy-everything at boot (only `src/index.js` loads eagerly; the picker, per-scene JS, backdrops, and thumbnails load on-demand), and a search-first picker UI that stays usable at hundreds of scenes.

- **Repo:** `RegionallyFamous/odd`
- **Live demo:** https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/RegionallyFamous/odd/main/blueprint.json
- **Host plugin (required at runtime):** WP Desktop Mode v0.5.0+

## The architecture you need to know

```
src/
├── index.js            # registrar + shared helpers + mount runner + lazy loaders + prefs
├── picker.js           # in-canvas picker overlay (loaded on first gear click)
├── easter-eggs.js      # Konami + keyword + corner-peek trigger (loaded on mount)
├── audio.js            # opt-in Web Audio analyser (loaded on first mic toggle)
├── drifters.json       # shared drifter library — any scene can opt in
├── scenes.json         # canonical scene manifest — single source of truth
└── scenes/             # one file per scene; lazy-loaded when selected
    ├── code-rain.js    # self-registers under window.__bRoll.scenes['code-rain']
    ├── hyperspace.js
    └── ...
```

At boot, `index.js`:

1. Attaches shared helpers (`rand`, `lerpColor`, `paintVGradient`, `makeBloomLayer`, etc.) to `window.__bRoll.helpers`.
2. Reads the hydrated bundle on `window.bRoll` (set by `wp_localize_script`): `pluginUrl`, `version`, `scenes` (the full manifest array), `scene` (user's current pick), `favorites`, `recents`, `restUrl`, `restNonce`.
3. Registers **one** wallpaper via `wp.desktop.registerWallpaper({ id: 'b-roll', label: 'B-Roll', type: 'canvas', preview: <brand swatch>, needs: ['pixijs'], mount: mountBRoll })`. No per-scene registrations.
4. Exposes `window.__bRoll.prefs` (with `get/save/recordRecent/toggleFavorite`) for the picker module to consume.

The mount runner (`mountBRoll`) runs when the user activates the wallpaper:

1. Creates a single `PIXI.Application` (`await app.init`).
2. Loads the initial scene via `loadScene(slug)` — a `<script>` injection that resolves when the scene self-registers under `window.__bRoll.scenes[slug]`.
3. Runs the scene's `setup` → wires `tick` + `onResize` → starts the ticker (or tick once + stop under `prefersReducedMotion`).
4. Injects a gear button into the container; clicking it calls `loadPicker()` (injects `src/picker.js` on first click) and then `window.__bRoll.picker.open(...)`.
5. `swap(slug)` **reuses the same Pixi app**: current scene's `cleanup` → `app.stage.removeChildren()` → load new scene JS if needed → new scene's `setup` → new `tick`. Errors on load or setup keep the previous scene running and surface via `console.error`.

This means **adding a scene does not touch `index.js`**. It's a new row in `src/scenes.json` plus three asset files.

## The scene manifest — `src/scenes.json`

Single source of truth for scene metadata. Each entry:

```json
{
    "slug": "rainbow-road",
    "label": "Rainbow Road",
    "franchise": "Mario Kart",
    "tags": ["space", "neon", "racing", "retro"],
    "fallbackColor": "#0a001e",
    "added": "0.1.0"
}
```

PHP loads it via `b_roll_scenes()` (in `b-roll.php`) to validate REST input and compute the default scene. JS receives the same array inlined as `window.bRoll.scenes` — zero extra round trip. The picker reads `franchise` + `tags` for filter chips and search, `fallbackColor` fills a card while its thumb loads, and `added` is available for a future "New in vX" badge.

## Per-user persistence — `POST /b-roll/v1/prefs`

One REST route, registered in `b-roll.php`, accepts any subset of `{ scene?, favorites?, recents?, shuffle?, audioReactive? }` and writes the corresponding user meta:

- `b_roll_scene` — string, current scene slug.
- `b_roll_favorites` — array of slugs, capped to 50, validated against the manifest.
- `b_roll_recents` — array of slugs, capped to 12, validated against the manifest.
- `b_roll_shuffle` — `{ enabled: bool, minutes: int }` (v0.10+). When `enabled`, the shared mount runner cycles the wallpaper through the user's favorites (or all scenes if there are <2 favorites) every `minutes` minutes via the normal `swap()` path — the same one chained `transitionOut`/`transitionIn` hooks run through. Reduced-motion users never see the shuffle timer fire.
- `b_roll_audio_reactive` — bool (v0.10+). Remembered intent for audio-reactive mode. The mic permission prompt itself only runs on an explicit user gesture in the picker toolbar; this flag just lets us silently re-enable on reload if the origin already has a persistent grant.

Permission: `is_user_logged_in()`. The JS prefs helper (`window.__bRoll.prefs.save(patch)`) mirrors every write to `localStorage` (`b-roll:prefs:v1`) so offline users still get a consistent picker; the next successful server save flushes through.

## Painted backdrop + Pixi motion overlay (v0.5.0+)

Every scene's `setup()` is `async` and starts by loading a high-res painted backdrop:

```javascript
var url = window.bRoll.pluginUrl + '/assets/wallpapers/<slug>.jpg?v=' + window.bRoll.version;
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
```

`onResize(state, env)` then re-runs `state.fitBackdrop()`. The painting carries everything that was static (gradients, silhouettes, sigils, vignettes); Pixi carries everything that moves (rain, glyphs, sprites, lightning). Don't redraw a `bg` Graphics gradient in `setup` — it's superseded by the painting. Don't re-add static silhouettes (Saturn, city skyline, Lumon mark, Piltover) — they're baked in. Animated layers stay in Pixi and render on top of the backdrop with no logic changes.

Backdrop assets are 1920×1080 JPG q80, ~300–500 KB each, stored in `assets/wallpapers/<slug>.jpg`. Cover-fit (`Math.max(scaleX, scaleY)`) handles 16:10 / 21:9 / 4:3 by cropping edges, never letterboxing.

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
            // Required. env shape below. Return whatever state
            // you'll mutate each tick.
        },
        tick: function ( state, env ) {
            // Required. env.dt is frames at 60fps, clamped to 2.5.
        },
        onResize:      function ( state, env )        { /* optional */ },
        cleanup:       function ( state, env )        { /* optional */ },
        stillFrame:    function ( state, env )        { /* optional (v0.10+) — reduced-motion hand-picked moment */ },
        transitionOut: function ( state, env, done )  { /* optional (v0.10+) — animate outro, then call done() */ },
        transitionIn:  function ( state, env )        { /* optional (v0.10+) — fire-and-forget intro */ },
        onAudio:       function ( state, env )        { /* optional (v0.10+) — only called when env.audio.enabled */ },
        onEgg:         function ( name, state, env )  { /* optional — 'festival' | 'reveal' | 'peek' */ },
    };
} )();
```

### `env` shape

```
env = {
    app, PIXI, ctx, helpers,
    dt,                         // frames at 60fps, clamped to 2.5
    parallax: { x, y },         // -1..1 normalized pointer offset, eased
    reducedMotion,              // boolean; scenes should gate heavy motion on this
    tod:      'dawn' | 'day' | 'dusk' | 'night',
    todPhase: 0..1,             // progress through the current band
    season:   'spring' | 'summer' | 'autumn' | 'winter' | 'halloween' | 'newYear',
    audio: {                    // always populated; zero until the user grants mic
        enabled,                // false until the picker toggles audio-reactive on
        level, bass, mid, high, // 0..1, smoothed with fast attack / slow decay
    },
    perfTier: 'high' | 'normal' | 'low',  // auto-dim tier from a rolling FPS sampler
}
```

Scenes that ignore the new fields are unaffected; scenes that read them can tint at night, spawn seasonal drifters, pulse on bass, or halve particle counts under `'low'` perfTier.

### Transition contract

On scene swap, the runner now runs this sequence:

1. Outgoing scene's `transitionOut(state, env, done)` runs against the still-live Pixi stage. When the scene calls `done()` (or after a 1.1s timeout) the runner proceeds. Reduced-motion skips outros.
2. The runner snapshots the canvas to a DOM overlay (unchanged crossfade) and tears down the old scene.
3. The new scene's `setup` runs on the same reused Pixi app.
4. The new scene's `transitionIn(state, env)` fires once, fire-and-forget.
5. Under reduced-motion, `stillFrame(state, env)` paints a hand-picked frame (fallback: one `tick` with `dt=0`).

The shared mount runner in `src/index.js` handles:
- Creating the Pixi `Application` (`await app.init`, `app.canvas`) — **once per wallpaper activation, reused across scene swaps**
- Styling the canvas (`position: absolute; inset: 0`)
- Calling `stillFrame` or `tick` once with `dt=0` under `prefersReducedMotion`, then stopping the ticker
- Subscribing to `wp-desktop.wallpaper.visibility` and pausing/resuming
- Maintaining `env.tod` / `env.todPhase` (recomputed once per minute) and `env.perfTier` (rolling 120-frame FPS sampler with a 2s dwell before de-rating)
- Sampling the audio analyser into `env.audio` every frame when enabled and dispatching `impl.onAudio` if defined
- Invoking `transitionOut` → snapshot crossfade → `transitionIn` on every swap
- Running the shuffle scheduler (`b_roll_shuffle` user meta) which routes through the normal `swap()` path so transitions apply
- On wallpaper teardown: destroying the app (`app.destroy(true, { children: true, texture: true })`), clearing shuffle, disabling audio

So scene files **do not** build their own Pixi app, do not listen to visibility themselves, and do not need teardown cleanup beyond releasing resources they allocated outside the Pixi scene graph (rare).

**Swap-in-place contract** (v0.6.0+): because the same `PIXI.Application` is reused across scene swaps, every scene's `setup` must tolerate being called on a fresh-but-reused app whose `app.stage` was just cleared. In practice this means: never cache anything module-level that you depend on across swaps (closures returned from `setup` are fine because `setup` is called anew); if your scene allocates things outside the Pixi scene graph (timers, listeners on `window`), release them in `cleanup`. Everything on `app.stage` is removed by the runner before your `setup` runs.

## The preview CSS gotcha (**important**)

The `preview` value on a wallpaper registration is passed directly to `<wpd-swatch>` and applied as a CSS `background` property. **A bare URL is not a valid `background` value** — it must be wrapped in `url(...)` shorthand and ideally paired with a fallback color so a brief network hitch doesn't render a blank tile.

In v0.6.0+, the shell only sees one wallpaper card whose `preview` is a 3×3 collage (`assets/previews/b-roll.jpg`) generated by `tools/build-b-roll-swatch.py`. The per-scene preview JPGs in `assets/previews/<slug>.jpg` are now consumed by `src/picker.js` (with `<img loading="lazy" decoding="async">` and a `fallbackColor` underlay per card), not by the WP Desktop shell. Adding a new scene still requires shipping its `assets/previews/<slug>.jpg` (1.6:1 aspect, ~640px wide, JPG q75 keeps each ~50–100 KB) so the picker card renders.

## The in-canvas picker — `src/picker.js`

Loaded lazily on first gear click. Exposes `window.__bRoll.picker = { open(opts), close() }`.

`opts` shape:

```javascript
{
    host: HTMLElement,                 // where to append the overlay (wallpaper container)
    currentSlug: 'rainbow-road',
    prefersReducedMotion: false,
    onSelect( slug )   { /* user picked a scene */ },
    onClose()          { /* overlay dismissed */ },
}
```

Invariants the picker holds:

- Reads scenes from `window.__bRoll.config.scenes` (the manifest hydrated by PHP).
- Reads + writes favorites/recents through `window.__bRoll.prefs` — the picker never hits REST directly; `prefs.toggleFavorite` / `savePrefs` route through `POST /b-roll/v1/prefs` with `localStorage` fallback.
- Renders once per open; re-renders only when the query or tag filter changes (request-animation-frame throttled).
- Virtualizes via CSS `content-visibility: auto` + `contain-intrinsic-size: 220px 140px` on each card — no windowing library.
- Thumbnails `<img loading="lazy" decoding="async">`. Before load, the card background is `fallbackColor` from the manifest.
- Keyboard-first: `/` focuses search, arrows navigate (grid-aware — Down moves a full row), Enter selects, `f` on a focused card toggles favorite, Esc closes. Focus restores to the previously-focused element (the gear) on close.
- Accessible: `role="dialog" aria-modal="true"`, cards are `<button>` with `aria-pressed` reflecting the current selection.

If you add new preference-driven UI, wire it through `window.__bRoll.prefs` so it gets the same REST + localStorage behavior for free. The v0.10 picker toolbar already hosts a **mic** toggle (audio-reactive mode) and a **shuffle** toggle (alt-click cycles interval presets 5/10/15/30/60m) — see the `onAudioToggle` / `onShuffleChange` callbacks in `src/index.js`.

## Shared drifter library — `src/drifters.json`

Per-scene cutouts live under `assets/cutouts/<slug>/*` and are declared inline in `scenes.json`. As the scene count grows, several motifs recur (leaf, crow, firefly swarm, comet, lantern, snowflake, firework) — so there's also a shared library at `assets/drifters/*.webp` catalogued in `src/drifters.json`. Any scene can opt in via:

```javascript
var shared = await h.mountSharedDrifters( app, PIXI, [ 'crow', 'lantern' ], fg );
// shared is a drifters[] compatible with h.tickDrifters( shared, env ).
```

Drifter defs use the same `motion` / `period` / `scale` / `z` shape as scene cutouts — `motionUpdate` in `src/index.js` is the single path. The shared library is also what seasonal overlays (winter snowflakes, autumn leaves, NYE fireworks) pull from so scenes don't each ship redundant assets.

### Chaos cast (v0.11+)

Drifter defs in `src/drifters.json` may carry an extra `weird: true` flag. The mount runner picks `chaosCount` (default 2) of these at random per scene swap and mounts them on a top-of-stage container ABOVE the scene's own cut-outs — every wallpaper gets a small dose of absurdism without touching `scenes.json`. Helpers exposed:

- `h.pickWeird( count, exclude? )` — returns a Promise resolving to `count` weird-tagged names, randomly shuffled, optionally excluding any.
- `__bRoll.setChaos( n )` — devtools knob, clamped to 0–5; rerolls immediately on the active scene.
- Per-impl opt-out: set `impl.skipChaos = true` (static) or `state.skipChaos = true` (dynamic) inside `setup()` for scenes whose visual identity would clash with the weird overlay.
- `prefersReducedMotion` skips chaos entirely.

Adding a new weird drifter is `_tools/cutout.py path/to/raw.png assets/drifters/foo.webp` then a JSON entry with `weird: true`. No scene edits needed.

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
├── .eslintrc.json          # ESLint config (dev-only; excluded from the zip)
├── package.json            # ESLint + @wp-playground/cli dev deps
├── composer.json           # PHPCS + WPCS dev deps
├── phpcs.xml.dist          # PHPCS ruleset (dev-only; excluded from the zip)
├── .github/workflows/
│   ├── ci.yml              # PR + push checks; callable from release.yml
│   └── release.yml         # v* tag -> build zip + cut GitHub release
├── .claude/commands/       # /release, /new-scene slash commands
├── bin/
│   ├── new-scene           # scaffold a new scene (scene JS + manifest row)
│   ├── validate-scenes     # manifest vs. asset files
│   ├── check-version       # b-roll.php version strings must agree
│   ├── check-blueprint     # blueprint.json structure + optional URL probe
│   ├── build-zip           # dist/b-roll.zip + size budget
│   ├── lint-php            # php -l on every *.php
│   ├── lint-js             # node --check + eslint on src/
│   └── smoke-playground    # @wp-playground/cli activation smoke test
├── ci/
│   └── smoke.blueprint.json  # blueprint used by bin/smoke-playground
├── tools/
│   ├── build-b-roll-swatch.py  # regenerate assets/previews/b-roll.webp collage
│   └── build-placeholders.py   # regenerate v0.10 scene backdrops + shared drifters
├── assets/
│   ├── previews/           # painterly raster swatches (incl. b-roll.webp brand swatch)
│   ├── wallpapers/         # painted 1920×1080 backdrops loaded per-scene
│   ├── cutouts/            # per-scene transparent cut-outs (motion profile in scenes.json)
│   └── drifters/           # shared drifter library (src/drifters.json)
├── src/
│   ├── index.js            # registrar + shared mount + lazy loaders + prefs + env mechanics
│   ├── picker.js           # in-canvas picker overlay (loaded on first gear click)
│   ├── audio.js            # opt-in Web Audio analyser (loaded on first mic toggle)
│   ├── easter-eggs.js      # Konami + keyword + corner-peek triggers
│   ├── drifters.json       # shared drifter library manifest
│   ├── scenes.json         # canonical scene manifest
│   └── scenes/
│       ├── code-rain.js    (+ 13 others)
│       └── ...
└── b-roll-icons/           # sibling plugin (independent activation + versioning)
    ├── b-roll-icons.php    # plugin bootstrap
    ├── includes/           # registry.php, dock-filter.php, rest.php, enqueue.php
    ├── src/picker.js       # floating pill picker (vanilla DOM, no build step)
    ├── sets/<slug>/        # one dir per icon set: manifest.json + 1..13 SVGs
    └── bin/validate-sets
```

**Sibling plugin: b-roll-icons (v0.1.0+).** Lives in-repo under `b-roll-icons/` but has its own plugin header, its own version, its own REST namespace (`/b-roll-icons/v1/prefs`), its own user_meta key (`b_roll_icons_set`), and ships to WordPress.org as its own plugin zip. The wiring is a PHP filter on WP Desktop Mode's `wp_desktop_dock_items` + `wp_desktop_icons` that swaps each dock/desktop item's `icon` field to the URL of the active set's SVG, keyed by admin menu slug (`edit.php` → `posts.svg`, `upload.php` → `media.svg`, …). Picks are independent from b-roll — users can mix a Matrix icon set with the Outrun wallpaper. Adding a new set is a new directory under `sets/<slug>/` with a `manifest.json` + SVGs; `bin/validate-sets` gates JSON + SVG XML validity. See `b-roll-icons/README.md` for the full contract.

Version lives in three places — keep in sync on release: the `Version:` header in `b-roll.php`, the version string in `wp_enqueue_script`, and the `'version'` value in `wp_localize_script`.

## Workflows

### Test locally via Playground (zero-install)

1. Commit + push your changes to `main`.
2. Wait for the release workflow (or cut a release manually — see below). The blueprint points at `releases/latest/download/b-roll.zip`, so Playground always pulls the newest release.
3. Open the Playground demo URL. First boot takes 20–30s.

For faster iteration, you can install the plugin into a local WordPress install (symlink `b-roll/` into `wp-content/plugins/`, activate, enable desktop mode). No build step required.

### Cut a release

Releases are tag-driven. Push a `v*` tag and `.github/workflows/release.yml` builds the zip and publishes the GitHub release automatically.

The `/release <version>` slash command (in `.claude/commands/release.md`) walks the flow. The shape is:

```bash
# 1. Bump the 3 version strings in b-roll.php
# 2. Sanity-check they agree:
bin/check-version --expect 0.X.0
# 3. Commit, push main, push the tag:
git commit -am "chore: bump version to v0.X.0"
git push origin main
git tag v0.X.0 && git push origin v0.X.0
```

On tag push, `release.yml`:
1. Reruns the full `ci.yml` suite.
2. Asserts the tag matches `b-roll.php`'s version via `bin/check-version --expect`.
3. Runs `bin/build-zip` -> `dist/b-roll.zip`.
4. Runs `gh release create "$tag" dist/b-roll.zip --generate-notes` (auto-notes from commits since the previous tag), retrying once after 3s if the asset upload 409s.
5. Verifies `releases/latest/download/b-roll.zip` resolves.

After the release, the Playground demo link auto-refreshes to the new zip on next load (no blueprint edits needed).

### CI suite

`.github/workflows/ci.yml` runs on every PR + push to `main`, and is also called from `release.yml` as `workflow_call`. Jobs run in parallel:

- `validate-scenes` — `bin/validate-scenes` (every manifest entry has JS + preview + wallpaper).
- `check-version` — three version strings in `b-roll.php` must agree.
- `json-valid` — `blueprint.json`, `src/scenes.json`, `package.json`, `composer.json`, `ci/smoke.blueprint.json`, `.eslintrc.json` all parse; `bin/check-blueprint` asserts blueprint structure.
- `php-lint` — matrix on PHP 7.4 + 8.3; `php -l` on every `*.php`, then PHPCS with `WordPress-Extra` on 8.3.
- `js-lint` — `node --check` on every `src/**.js`, then ESLint.
- `zip-budget` — `bin/build-zip` with a 7 MB cap; uploads `b-roll.zip` as a workflow artifact for download-and-test.
- `playground-smoke` — `bin/smoke-playground` boots the plugin under `@wp-playground/cli` with the desktop-mode dep + activation step, catching PHP fatals and REST registration regressions.

Every CI step is a `bin/` script a developer can run locally with the same exit semantics — "green on laptop" matches "green on CI".

### Add a new scene

Scaffold with `bin/new-scene`:

```bash
bin/new-scene vaporwave "Vaporwave" "Aesthetic" sunset,retro,neon,pink '#1a0033'
```

That writes `src/scenes/vaporwave.js` (prefilled with the painted-backdrop loader) and appends a row to `src/scenes.json`. Then you still need:

1. A painterly preview at `assets/previews/vaporwave.jpg` (1.6:1, ~640px wide, JPG q75, ~50–100 KB).
2. A painted backdrop at `assets/wallpapers/vaporwave.jpg` (1920×1080, JPG q80, ~300–500 KB).

Validate with `bin/validate-scenes` — it fails CI if any manifest entry is missing an asset.

No JS edit is needed anywhere: `index.js` reads the manifest at runtime, and the picker picks up the new row automatically. The new scene appears in the picker grid the next time a user opens it.

## Gotchas & prior incidents

- **The v0.2 blank-swatch bug** was the `preview` CSS issue above. Any CSS `background` string you return for a wallpaper's `preview` must use `url(...)` + a fallback color. The v0.6 brand swatch uses `previewBg('b-roll')` in `src/index.js` for exactly this reason.
- **v0.5 → v0.6 migration**: when users upgrade, their shell-stored wallpaper pick (`b-roll/code-rain` or similar) stops matching because the shell only knows one `b-roll` card now. They pick "B-Roll" once and their scene selection afterward persists via user meta. Not worth writing a shim.
- **GitHub release asset uploads** occasionally return "Error creating policy" right after release creation. The fix is a `sleep 2` + retry, or just wait and re-upload. The release itself is already created.
- **catbox.moe** was used as a temporary host in v0.1 — it's no longer referenced anywhere. Don't reintroduce it; `raw.githubusercontent.com` and GitHub release downloads both serve with `Access-Control-Allow-Origin: *` which is what Playground needs.
- **Playground's `?blueprint-url=`** expects a URL that serves with CORS. If you're hosting the blueprint somewhere new, verify with `curl -H "Origin: https://playground.wordpress.net" -I <url>` that `access-control-allow-origin: *` comes back on a real GET.

## Where things aren't documented yet

- `wp-desktop.wallpaper.visibility` action: the JS reference marks it Stable but doesn't spell out the payload shape. We use `{ id, state: 'hidden' | 'visible' }` based on the recipe example. If that assumption ever breaks, the shared mount's `onVis` handler silently no-ops — no scene crashes.
- **Performance under many concurrent scenes:** untested. The architecture supports it, but we haven't actually benchmarked activating/deactivating lots in rapid succession. When we scale past ~30 scenes, worth a pass.
