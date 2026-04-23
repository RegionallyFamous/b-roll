# B-Roll for WP Desktop Mode

A pack of pop-culture-themed PixiJS wallpapers for [WP Desktop Mode](https://github.com/WordPress/desktop-mode). Ten animated scenes that register themselves into the desktop shell's wallpaper picker the moment the plugin activates — and architected so each scene's Pixi code is only fetched when that scene is actually selected.

**Requires:** WordPress 6.0+ · PHP 7.4+ · WP Desktop Mode (active)

## The ten scenes

| # | Scene | Franchise | One-liner |
|---|---|---|---|
| 01 | **Code Rain** | The Matrix | Cascading katakana with a bright-white lead and a green glow trail. |
| 02 | **Hyperspace** | Star Wars | 3D-layered radial starlines and a cinematic warp flash. |
| 03 | **Neon Rain** | Blade Runner 2049 | Parallax city, two-pass neon signs, rain splashes, rare spinner. |
| 04 | **The Grid** | Tron | Neon grid, light-cycles with gradient trails, intersection pulses. |
| 05 | **Couch Gag** | The Simpsons | Sky + clouds + birds; every so often, a full living-room tableau drops in. |
| 06 | **Rainbow Road** | Mario Kart | Scrolling neon road with bloom rails, distant planet, `?`-box. |
| 07 | **Soot Sprites** | Studio Ghibli | Fluffy sprites; candy drops attract nearby ones into huddles. |
| 08 | **The Upside Down** | Stranger Things | Tendrils from the edges, spiraling spores, glitchy title cards. |
| 09 | **Refinery** | Severance | Numerals cluster into three shapes; occasionally turn "scary." |
| 10 | **Shimmer** | Arcane | Rising magenta particles with trails, hex-grid waves, gold glints. |

Pick any of them from **OS Settings → Wallpapers** once the plugin is active.

## v0.4.1 — Painterly preview swatches

The wallpaper picker no longer shows hand-coded SVG composites. Each scene now ships with a painterly raster thumbnail (1.6:1, ~640px wide, JPG q75, ~50–100 KB each) generated from a matte-painting prompt that captures the mood of the live animation without using any franchise IP. The full 10-image set adds ~650 KB to the plugin payload. The `src/index.js` registrar shrunk from ~1,120 lines to ~245 lines as a result. Picker URL: `assets/previews/<slug>.jpg?v=<plugin-version>` for cache-busting on bumps.

## v0.4.0 — Visual overhaul

Every scene was reworked for richer atmospherics without adding any external assets. All ten scenes stay Pixi primitives + `Graphics` + `Text`, but now with additional layers per scene:

- **Code Rain** — 3-depth parallax columns, per-column phosphor wobble, occasional synced `MATRIX`-style phrase cascades across adjacent columns, CRT vignette + per-frame film grain.
- **Hyperspace** — 3-layer parallax starfield, cubic acceleration streaks, a pulsing iris with 8 lens-flare spokes, chromatic warp-flash ghosts.
- **Neon Rain** — wet-ground reflection band with ripple shimmer, fog haze between city layers, per-window flicker + block blackouts, distant lightning, droplet splashes.
- **The Grid** — scrolling perspective grid with brighter near rows, intersection dots, horizon-glow reflection band, data packets traveling along fade-trails, collision rings.
- **Couch Gag** — pulsing sun corona + lens-flare ghosts, 3 depth tiers of flapping birds, squash/stretch clouds, wind-swayed grass strip, wind gusts, bouncy couch landing.
- **Rainbow Road** — slow-rotating Saturn with ring shadow, tinted starfield, scrolling chevron lane markings, abstract kart silhouettes racing to the camera, speed-line bursts from the vanishing point.
- **Soot Sprites** — squash-and-stretch bounce physics, shared wind sway across the flock, dust-trail particles, eye-glance tracking toward the falling candy.
- **The Upside Down** — tendrils animate grow → hold → retract → respawn with a bright tip blossom, 3-tier parallax spores, ash flakes with red/cyan chromatic aberration, scene-wide lightning veil flash, a static-line sweep rolling top→bottom.
- **Refinery** — per-number sine bob, scary-number scale pulse, MDR selector box snapping through a 6×4 cell grid, quota progress bar filling along the bottom, blinking CRT cursor, rotating Lumon mark, corner vignette.
- **Shimmer** — chemical bubbles rising from the base with gold→pink tints and specular highlights, thicker-core magenta hex-grid pulses, color-shift waves sweeping the gradient, distant lavender lightning over Piltover.

## Install

### Playground (one-click demo)

https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/RegionallyFamous/b-roll/main/blueprint.json

(First load takes ~20–30 seconds while Playground boots and both plugins install.)

### A real WordPress install

1. Download the latest `b-roll.zip` from the [Releases](https://github.com/RegionallyFamous/b-roll/releases) page.
2. WP Admin → Plugins → Add New → Upload Plugin → pick the zip → Activate.
3. Enable desktop mode (admin bar toggle).
4. OS Settings → Wallpapers → pick a scene.

Or clone this repo directly into `wp-content/plugins/b-roll/`.

## Architecture

Designed to scale to hundreds of scenes without bloating the bundle or the picker.

```
b-roll/
├── b-roll.php              # enqueues just src/index.js (+ plugin URL)
├── blueprint.json          # Playground demo blueprint
├── assets/previews/        # painterly raster preview swatches (10x ~50–100 KB JPGs)
└── src/
    ├── index.js            # thin registrar — metadata + raster preview URLs
    │                         + shared mount runner. ~7 KB.
    └── scenes/             # one self-registering file per scene
        ├── code-rain.js
        ├── hyperspace.js
        ├── neon-rain.js
        ├── tron-grid.js
        ├── couch-gag.js
        ├── rainbow-road.js
        ├── soot-sprites.js
        ├── upside-down.js
        ├── refinery.js
        └── shimmer.js
```

At boot, `index.js` does two things for every scene:
1. Registers the scene's file as a **module** via `wp.desktop.registerModule({ id, url, isReady })`.
2. Registers a wallpaper with `needs: ['pixijs', 'b-roll/<slug>']`, so the scene module is only fetched the moment that wallpaper is selected.

Consequences:
- Activating the plugin loads ~7 KB (one file).
- Picking a wallpaper lazy-loads just that scene's ~8–15 KB of Pixi code.
- Previews are static JPGs lazily loaded by the browser when the picker scrolls them into view; no WebGL cost in the picker.
- Adding a new scene = drop a file in `src/scenes/`, add one line to `SCENES` and one to `PREVIEWS` in `index.js`, drop a `<slug>.jpg` in `assets/previews/`. No bundler, no build step.

Each scene file self-registers under `window.__bRoll.scenes[<slug>]` with this shape:

```javascript
window.__bRoll.scenes[ 'my-thing' ] = {
    setup: function ( env ) {
        // env: { app, PIXI, ctx, helpers }
        // Build Pixi containers, sprites, state on app.stage.
        // Return your scene state.
    },
    tick: function ( state, env ) {
        // env: { app, PIXI, ctx, helpers, dt }
        // dt is frames @ 60fps, clamped to 2.5.
    },
    onResize: function ( state, env ) { /* optional */ },
    cleanup: function ( state, env ) { /* optional — teardown */ },
};
```

The shared mount runner (in `index.js`) handles Pixi app creation, canvas styling, reduced-motion still-frame, the shell's visibility action, and full GL teardown. Scene files only write the creative code.

## License

GPLv2 or later, matching [WP Desktop Mode](https://github.com/WordPress/desktop-mode). See [LICENSE](./LICENSE).

## Credits

Scene concepts are loving references to their respective franchises. No franchise artwork is shipped: every visual is rendered from first principles with Pixi primitives (particles, polygons, text glyphs) so the plugin stays small, unambiguous on ownership, and fast.
