# ODD — Outlandish Desktop Decorator

One decorator plugin for [WP Desktop Mode](https://github.com/WordPress/desktop-mode): generative PixiJS wallpapers and themed icon sets, all switched from a single native desktop window.

**Requires:** WordPress 6.0+ · PHP 7.4+ · WP Desktop Mode (active)

## What's in the box

- **3 generative scenes** — original PixiJS art layered over hand-painted backdrops:
    - **Flux** — ribbon particles flowing through a slowly-evolving vector field over deep marbled ink. Rare "koi" particles cross-fade in for emphasis.
    - **Aurora** — twinkling stars and procedural aurora curtains over an arctic mountain plateau, with the occasional shooting star.
    - **Origami** — a flock of folded paper cranes drifting across warm washi paper, with subtle pollen catching the light.
- **3 icon sets** — themed dock + desktop-shortcut icon packs with their own visual languages:
    - **Filament** — hair-thin single-stroke icons that read as one unbroken line of light.
    - **Arctic** — frost-blue line icons with a small magenta accent.
    - **Fold** — flat folded-paper icons with cream faces, warm-tan creases, and soft drop shadows.
- **ODD Control Panel** — a native WP Desktop Mode window opened from a floating gear pill or its desktop icon. Tabbed sidebar for Wallpaper, Icons, and About.

Every scene is rendered live with Pixi v8 primitives — particles, polygons, gradients — over a painted WebP backdrop. No third-party artwork ships in the plugin.

## Install

### Playground (one-click demo)

https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/RegionallyFamous/odd/main/blueprint.json

(First load takes ~20–30 seconds while Playground boots and the plugin installs.)

### A real WordPress install

1. Download the latest `odd.zip` from the [Releases](https://github.com/RegionallyFamous/odd/releases) page.
2. WP Admin → Plugins → Add New → Upload Plugin → pick the zip → Activate.
3. Enable desktop mode (admin bar toggle).
4. OS Settings → Wallpapers → pick **ODD**.
5. Click the gear pill in the bottom-right of the wallpaper (or the **ODD** desktop icon) to open the Control Panel.

Or clone this repo directly into `wp-content/plugins/odd/`.

## Architecture

```
odd/
├── odd.php                          main bootstrap + constants
├── includes/
│   ├── enqueue.php                  gear + boot + panel scripts
│   ├── rest.php                     /odd/v1/prefs (GET+POST)
│   ├── native-window.php            wp_register_desktop_window('odd',...)
│   ├── wallpaper/
│   │   ├── registry.php             scenes.json reader + slug helpers
│   │   └── prefs.php                per-user pref getters
│   └── icons/
│       ├── registry.php             scans assets/icons/*/manifest.json
│       └── dock-filter.php          wp_desktop_dock_item + wp_desktop_icons
├── src/
│   ├── gear.js                      floating gear → opens 'odd' window
│   ├── panel/
│   │   └── index.js                 native-window render callback (sidebar + sections)
│   └── wallpaper/                   Pixi engine
│       ├── index.js                 boot + registerWallpaper('odd')
│       ├── picker.js                in-canvas picker (legacy, hidden)
│       ├── audio.js  easter-eggs.js
│       ├── scenes.json  drifters.json
│       └── scenes/
│           ├── flux.js
│           ├── aurora.js
│           └── origami.js
├── assets/
│   ├── wallpapers/  previews/       3 painted backdrops + thumbnails
│   └── icons/
│       ├── filament/                manifest.json + 13 SVGs
│       ├── arctic/                  manifest.json + 13 SVGs
│       └── fold/                    manifest.json + 13 SVGs
└── bin/
    ├── build-zip                    → dist/odd.zip (~350 KB)
    ├── validate-scenes
    ├── validate-icon-sets
    └── check-version
```

**Single window.** The gear and the desktop icon both call `wp.desktop.registerWindow({ id: 'odd', ... })`, which reuses any existing instance with matching `baseId` — so the Control Panel is always a single window on screen.

**Single REST namespace.** `/wp-json/odd/v1/prefs` (GET+POST) covers wallpaper, favorites, recents, shuffle, audio-reactivity, and icon-set. All writes land in `odd_*` user meta; reads hydrate via `wp_localize_script`.

**Server-canonical icons.** Icon swaps fire `wp_desktop_dock_item` and `wp_desktop_icons` filters in PHP at priority 20, so the rendered dock is always the source of truth. The panel triggers a soft reload after applying an icon-set change to pick up the new render.

**Live wallpaper swaps.** The panel emits `wp.hooks.doAction( 'odd/pickScene', slug )` alongside its REST POST, and the engine subscribes to swap the scene instantly without waiting for the round-trip.

## Adding new content

A new scene needs four things:

1. An entry in `odd/src/wallpaper/scenes.json` with `slug`, `label`, `franchise` (used as a category, not a brand), `tags`, `fallbackColor`, and `added`.
2. `odd/src/wallpaper/scenes/<slug>.js` that self-registers under `window.__odd.scenes[ slug ]` with `setup`, `tick`, and optional `onResize` / `cleanup` / `onAudio` / `stillFrame`.
3. `odd/assets/wallpapers/<slug>.webp` (1920×1080, q82) for the painted backdrop.
4. `odd/assets/previews/<slug>.webp` (~640×360, q80) for the picker thumbnail.

`odd/bin/validate-scenes` checks that all four exist for every entry and that the JSON parses.

A new icon set needs `odd/assets/icons/<slug>/manifest.json` with `slug`, `label`, `franchise`, `accent` (hex), and an `icons` map naming the 13 standard keys (`dashboard`, `posts`, `pages`, `media`, `comments`, `appearance`, `plugins`, `users`, `tools`, `settings`, `profile`, `links`, `fallback`). Drop the SVGs next to the manifest. `odd/bin/validate-icon-sets` enforces this.

The reboot's three icon sets are generated from a single source of truth — `_tools/gen-icon-sets.py` — so adding a fourth set is a small edit to that script. The painted wallpaper backdrops were generated with `_tools/gen-wallpaper.py` from the prompts in `_tools/wallpaper-prompts.json`.

## Releases

Tagging `v<x.y.z>` triggers `.github/workflows/release-odd.yml`, which runs the scene + icon-set validators, asserts the tag matches `ODD_VERSION` in `odd/odd.php`, builds `dist/odd.zip`, and publishes it as the `latest` release asset.

## License

GPLv2 or later, matching [WP Desktop Mode](https://github.com/WordPress/desktop-mode). See [LICENSE](./LICENSE).
