# ODD — project notes for agents

> Auto-loaded by Claude Code / Cursor. Exists so any new session can pick
> up work without re-deriving the architecture.

## What this is

ODD (**Outlandish Desktop Decorator**) is a WordPress plugin that layers on top of [WP Desktop Mode](https://github.com/WordPress/desktop-mode). It ships three decorators in one plugin:

1. **A canvas wallpaper** — generative PixiJS scenes rendered on top of painted 1920×1080 WebP backdrops, switched from inside the plugin's own control panel.
2. **Icon sets** — themed SVG packs that re-skin the WP Desktop dock and desktop-shortcut icons via the `wp_desktop_dock_item` + `wp_desktop_icons` filters.
3. **Apps** — self-contained sandboxed HTML/CSS/JS bundles that get their own desktop icon and native window. Install via upload, the curated catalog, or `odd_apps_install()`. Replaces the standalone Bazaar plugin — see `odd/includes/apps/` and `docs/building-on-odd.md`.

All three are managed from a single native WP Desktop Mode window (the **ODD Shop** — a Mac App Store-style browsing surface, previously the "ODD Control Panel") opened from the desktop shortcut icon, the `/odd-panel` slash command, or any widget that routes through `api.openPanel()`. Internally the window id stays `odd` — tests, commands, and the WP Desktop Mode session state still reference it by that id — so "Control Panel" references in `odd_icons_*` helpers, `wp-desktop.wallpaper.visibility` comments, and extension docs describe the same window.

- **Repo:** `RegionallyFamous/odd`
- **Live demo:** https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/RegionallyFamous/odd/main/blueprint.json
- **Host plugin (required at runtime):** WP Desktop Mode v0.5.0+

ODD currently ships ~19 scenes across four franchises (Generative / Atmosphere / Paper / ODD Originals) and 17 icon sets. The reboot shipped three of each (Flux / Aurora / Origami and Filament / Arctic / Fold) — every visual is original: painted backdrops generated from neutral atmospheric prompts (now usually via GPT Image 2 for ODD Originals), motion layers built from Pixi primitives, icons rendered programmatically from one shared symbol catalog. Since v1.3.0 the panel has screensaver, click-to-preview (wallpaper + icons), and Rainfall, a collision-aware scene that uses `wp.desktop.getWallpaperSurfaces()`. Since v1.4.0 ODD ships two desktop widgets: `odd/sticky` and `odd/eight-ball`.

## Architecture at a glance

```
odd/
├── odd.php                        bootstrap: ODD_VERSION + require_once list
├── includes/
│   ├── enqueue.php                odd-api, odd, odd-panel, odd-widgets, odd-commands script handles
│   ├── rest.php                   /odd/v1/prefs (GET+POST)
│   ├── native-window.php          wp_register_desktop_window('odd', …)
│   ├── wallpaper/
│   │   ├── registry.php           scenes.json reader + slug helpers
│   │   └── prefs.php              odd_wallpaper_* user-meta helpers
│   └── icons/
│       ├── registry.php           scans assets/icons/*/manifest.json
│       └── dock-filter.php        wp_desktop_dock_item + wp_desktop_icons @ priority 20
├── src/
│   ├── shared/
│   │   └── api.js                 window.__odd.api — setScene / setIconSet / shuffle / openPanel / toast
│   ├── widgets/
│   │   ├── index.js               registerWidget × 2 (Sticky Note, Magic 8-Ball)
│   │   └── style.css              scoped widget styles
│   ├── commands/
│   │   └── index.js               registerCommand × 4 (/odd, /odd-icons, /shuffle, /odd-panel)
│   ├── panel/
│   │   └── index.js               native-window render callback (sidebar + sections)
│   └── wallpaper/
│       ├── index.js               registerWallpaper('odd', …) + scene mount runner
│       ├── picker.js              legacy in-canvas picker (hidden; kept for fallback)
│       ├── audio.js  easter-eggs.js
│       ├── scenes.json  drifters.json
│       └── scenes/
│           ├── flux.js            ribbon particles in a vector field
│           ├── aurora.js          stars + procedural aurora curtains
│           └── origami.js         drifting paper cranes + folds
├── assets/
│   ├── wallpapers/  previews/     3 painted backdrops + thumbnails
│   └── icons/
│       ├── filament/              manifest.json + 13 SVGs
│       ├── arctic/                manifest.json + 13 SVGs
│       └── fold/                  manifest.json + 13 SVGs
└── bin/
    ├── build-zip                  → dist/odd.zip (~350 KB, 35 MB budget)
    ├── validate-scenes
    ├── validate-icon-sets
    └── check-version
```

### Single-window contract

The desktop icon registered in `includes/native-window.php` and the `/odd-panel` slash command both call `wp.desktop.registerWindow({ id: 'odd', … })` (via `window.__odd.api.openPanel()`). WP Desktop Mode's window manager reuses any window with a matching `baseId`, so there's always at most one Control Panel instance on screen.

The panel body is rendered by `window.wpDesktopNativeWindows.odd = body => { … }` in `src/panel/index.js`. Layout is a fixed-width sidebar (Wallpaper / Icons / About) plus a scrollable content pane. All state flows through REST.

### Single REST namespace

`POST /wp-json/odd/v1/prefs` accepts any subset of:
- `wallpaper` — scene slug; validated against `odd_wallpaper_scene_slugs()`; written to `odd_wallpaper`.
- `favorites` — slug[] capped to 50; written to `odd_favorites`.
- `recents` — slug[] capped to 12; written to `odd_recents`.
- `shuffle` — `{ enabled: bool, minutes: int 1..240 }`; written to `odd_shuffle`.
- `audioReactive` — bool; written to `odd_audio_reactive`.
- `iconSet` — set slug (or `"none"`); written to `odd_icon_set`.

`GET /wp-json/odd/v1/prefs` returns the current user's prefs plus the catalog of installed scenes and icon sets so the panel can hydrate without re-fetching.

Permission callback is `is_user_logged_in`. The panel also ships the same state inlined via `wp_localize_script( 'odd-panel', 'odd', … )` so first paint doesn't wait on a round-trip.

### Live scene swaps

Panel clicks fire `wp.hooks.doAction( 'odd/pickScene', slug )` in parallel with the REST POST. The wallpaper engine subscribes to this hook (`odd/wallpaper` namespace) and swaps the scene immediately through its `swap()` path — no reload needed.

### Icons swap → soft reload

Icon-set changes trigger a 180 ms fade + `window.location.reload()` after the POST succeeds. Re-render happens server-side through the two filters in `includes/icons/dock-filter.php`:

- `wp_desktop_dock_item` priority 20, two-arg: per-tile swap keyed by `odd_icons_slug_to_key( $menu_slug )` (e.g. `edit.php` → `posts`). Falls back to the set's `fallback` icon when a set ships no specific match.
- `wp_desktop_icons` priority 20: re-skins desktop shortcuts by the same key logic, but **skips** the ODD Control Panel icon itself so it stays recognizable regardless of the active set.

Server-side mapping is canonical; client-side live-swap via JS DOM surgery proved unreliable in earlier iterations and shouldn't be revisited.

## Scene file contract

Every `odd/src/wallpaper/scenes/<slug>.js` self-registers:

```javascript
( function () {
    'use strict';
    window.__odd = window.__odd || {};
    window.__odd.scenes = window.__odd.scenes || {};
    var h = window.__odd.helpers;

    window.__odd.scenes[ '<slug>' ] = {
        setup: function ( env ) { /* required */ },
        tick: function ( state, env ) { /* required; env.dt clamped to 2.5 */ },
        onResize: function ( state, env ) { /* optional */ },
        cleanup: function ( state, env ) { /* optional */ },
        stillFrame: function ( state, env ) { /* optional — reduced-motion pose */ },
        transitionOut: function ( state, env, done ) { /* optional */ },
        transitionIn: function ( state, env ) { /* optional */ },
        onAudio: function ( state, env ) { /* optional — only when env.audio.enabled */ },
        onEgg: function ( name, state, env ) { /* 'festival' | 'reveal' | 'peek' */ },
    };
} )();
```

`env` carries `{ app, PIXI, ctx, helpers, dt, parallax: {x,y}, reducedMotion, tod, todPhase, season, audio: {enabled, level, bass, mid, high}, perfTier: 'high'|'normal'|'low' }`. Scenes that ignore the new fields are unaffected.

The shared mount runner in `src/wallpaper/index.js` owns Pixi app creation (`await app.init`, `app.canvas`), the visibility hook (`wp-desktop.wallpaper.visibility`), the `document.visibilitychange` pause, per-minute `env.tod` recompute, the rolling-FPS `env.perfTier` sampler, the chaos-cast overlay (two random `weird: true` drifters from `drifters.json` per swap — currently a no-op since the shared library is empty), the shuffle scheduler (every `odd_shuffle.minutes`), and audio analyser sampling. Scenes don't build their own Pixi app or register visibility listeners.

**Swap-in-place** — the same `PIXI.Application` is reused across scene swaps. `app.stage.removeChildren()` runs between swaps; scenes must tolerate a fresh-but-reused app. Anything allocated outside the Pixi scene graph (timers, `window` listeners) belongs in `cleanup`.

## Pixi v8 conventions

- `new PIXI.Application()` + `await app.init({ … })` — v7 constructor options don't work.
- `app.canvas`, not `app.view`.
- Fluent Graphics: `g.rect(…).fill({…})`, `g.moveTo().lineTo().stroke({…})`.
- `app.ticker.add( ticker => { const dt = ticker.deltaTime } )` — callback receives a `Ticker`, not a number.
- Bloom layers: `h.makeBloomLayer(PIXI, strength)` returns a `Container` with `blendMode='add'` + `BlurFilter`.
- Teardown: `app.destroy(true, { children: true, texture: true })` — the shared runner does this.

`ticker.deltaTime` after a backgrounded tab can be huge. The runner clamps it to 2.5 before `tick` receives it.

## Extending ODD

Since v0.14.0, ODD has a documented extension API (filters, events,
registries, lifecycle phases, error boundaries, debug inspector). Agents
adding features should prefer the extension API over monkey-patching
core files — see [docs/building-on-odd.md](docs/building-on-odd.md).

## Adding content

### A new scene

1. Add a row to `odd/src/wallpaper/scenes.json` with `{ slug, label, franchise, tags, fallbackColor, added }`. `franchise` is a free-form category string ("Generative", "Atmosphere", "Paper", etc.), not a brand name.
2. Drop `odd/src/wallpaper/scenes/<slug>.js` that self-registers.
3. Drop `odd/assets/previews/<slug>.webp` (~640×360, WebP q80).
4. Drop `odd/assets/wallpapers/<slug>.webp` (1920×1080, WebP q82).
5. `odd/bin/validate-scenes` asserts the JS + preview + wallpaper files all exist. CI runs it on every PR.

No `index.js` edit required — the manifest is read at runtime.

### A new icon set

1. Add an entry to `_tools/gen-icon-sets.py` (or hand-author):
   - manifest with `{ slug, label, franchise, accent (#hex), description?, preview?, icons: { dashboard, posts, pages, media, comments, appearance, plugins, users, tools, settings, profile, links, fallback } }`,
   - SVGs named in `manifest.icons`, dropped next to the manifest.
2. Each SVG must parse as well-formed XML, have a `viewBox` or `width+height`, and contain no control bytes outside `\t\n\r`.
3. `odd/bin/validate-icon-sets` checks JSON + SVG + manifest-disk alignment.

## Workflows

### Local iteration

1. `git clone` into `wp-content/plugins/odd/` (or symlink).
2. Activate ODD alongside WP Desktop Mode.
3. No build step — plain JS, loaded via `wp_enqueue_script`.
4. For a full validation pass: `odd/bin/check-version && odd/bin/validate-scenes && odd/bin/validate-icon-sets && odd/bin/build-zip`.

### Cut a release

1. Bump `Version:` header + `ODD_VERSION` constant in `odd/odd.php`.
2. `odd/bin/check-version --expect 0.X.Y` to confirm they match.
3. Commit, push, tag: `git tag v0.X.Y && git push origin v0.X.Y`.
4. `.github/workflows/release-odd.yml` fires on the tag: version check, scene + icon-set validators, `odd/bin/build-zip`, `gh release create … --latest=true`, and a `releases/latest/download/odd.zip` HTTP probe. Retries the upload once on the 409 "Error creating policy" flake.

### CI

`.github/workflows/ci.yml` runs on every PR + push to `main`:
- `validate-scenes` — manifest + assets for every scene.
- `validate-icon-sets` — manifest + SVGs for every set.
- `check-version` — header + constant in `odd.php` agree.
- `json-valid` — `blueprint.json` + scene / drifter / icon manifests all parse.
- `zip-budget` — `odd/bin/build-zip` with a 35 MB cap; uploads `odd.zip` as a workflow artifact.

## Versioning

Version lives in two places inside `odd/odd.php` — keep them in sync on release:
- the `Version:` header (`* Version: 0.1.0`)
- the `ODD_VERSION` constant (`define( 'ODD_VERSION', '0.1.0' );`)

All other script/style/REST calls compute their cache-busting version from `ODD_VERSION` at runtime.

## Gotchas

- **SVG control bytes.** The icon-set validator scans for bytes `< 0x20` outside `\t\n\r`; an em-dash with a stray `\x14` once broke XML parsing in a prior release.
- **Client-side icon live-swap is a rabbit hole.** `data-menu-slug` on dock DOM is the *sanitized CSS ID* (e.g. `menu-posts`), not the raw menu slug (`edit.php`). The fix is going server-canonical via `wp_desktop_dock_item` + a reload; don't regress.
- **GitHub release asset uploads** sometimes 409 "Error creating policy" right after release creation. The release workflow retries once after a 3 s pause.
- **Playground + CORS.** `raw.githubusercontent.com` and `github.com/*/releases/download/…` both serve with `access-control-allow-origin: *`. Other hosts usually don't — check with `curl -H "Origin: https://playground.wordpress.net" -I <url>` before pointing a blueprint at a new URL.
- **`wp-desktop.wallpaper.visibility` payload shape** is `{ id, state: 'hidden' | 'visible' }` per the recipe example — not documented in the API reference. The `onVis` handler silently no-ops on anything else.

## File layout

```
.
├── odd/                            plugin (see tree above)
├── .github/workflows/
│   ├── ci.yml                      validate-scenes / validate-icon-sets / check-version / json-valid / zip-budget
│   └── release-odd.yml             v* tag → build odd.zip → release (latest=true)
├── blueprint.json                  Playground blueprint: installs odd.zip + pre-selects wallpaper='odd'
├── ci/smoke.blueprint.json         smoke-test blueprint (pluginPath: odd/odd.php)
├── _tools/                         author-side asset helpers (wallpaper + icon generators)
├── README.md                       user-facing docs
├── CLAUDE.md                       this file
├── LICENSE                         GPLv2
└── dist/                           build output (gitignored)
```
