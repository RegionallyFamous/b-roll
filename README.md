# B-Roll for WP Desktop Mode

A pack of pop-culture-themed PixiJS wallpapers for [WP Desktop Mode](https://github.com/WordPress/desktop-mode). Nine animated scenes living under one "B-Roll" wallpaper card, switchable via an in-canvas picker — architected to scale to hundreds without bloating the shell's picker or the plugin bundle.

**Requires:** WordPress 6.0+ · PHP 7.4+ · WP Desktop Mode (active)

## The nine scenes

| # | Scene | Franchise | One-liner |
|---|---|---|---|
| 01 | **Code Rain** | The Matrix | Cascading katakana with a bright-white lead and a green glow trail. |
| 02 | **Hyperspace** | Star Wars | 3D-layered radial starlines and a cinematic warp flash. |
| 03 | **Neon Rain** | Blade Runner 2049 | Parallax city, two-pass neon signs, rain splashes, rare spinner. |
| 04 | **The Grid** | Tron | Neon grid, light-cycles with gradient trails, intersection pulses. |
| 05 | **Rainbow Road** | Mario Kart | Scrolling neon road with bloom rails, distant planet, `?`-box. |
| 06 | **Soot Sprites** | Studio Ghibli | Fluffy sprites; candy drops attract nearby ones into huddles. |
| 07 | **The Upside Down** | Stranger Things | Tendrils from the edges, spiraling spores, glitchy title cards. |
| 08 | **Refinery** | Severance | Numerals cluster into three shapes; occasionally turn "scary." |
| 09 | **Shimmer** | Arcane | Rising magenta particles with trails, hex-grid waves, gold glints. |

Pick **B-Roll** from **OS Settings → Wallpapers**, then click the gear in the bottom-right of the live wallpaper to switch scenes. Your pick is remembered per-user.

## v0.6.0 — One card, one picker, built for hundreds

B-Roll used to register one shell wallpaper per scene. At nine scenes that was fine; at fifty it would have swamped the WP Desktop picker. v0.6 collapses the plugin into a **single "B-Roll" wallpaper card**. Scene selection moved into an in-canvas picker you open by hovering the wallpaper and clicking the gear in the bottom-right corner. Your choice is saved per-user via a new `POST /b-roll/v1/prefs` REST route (with a `localStorage` fallback on network failure), so your desktop remembers it across sessions.

Architected on three scaling pillars:

- **Manifest-driven**. The scene list lives in [src/scenes.json](src/scenes.json) with `{ slug, label, franchise, tags, fallbackColor, added }` per entry. Both PHP (for REST validation + default scene) and JS (for the picker) read the same file. Adding a scene is a manifest row plus three asset files — no code change in `index.js`.
- **Lazy everything**. Boot only fetches [src/index.js](src/index.js). The picker UI ([src/picker.js](src/picker.js)) loads on first gear click. Each scene's Pixi implementation and its painted backdrop JPG load the moment that scene is chosen. Cold start stays O(1) in scene count.
- **Search-first UI**. At 50+ scenes a grid is a wall. The picker opens with the search bar focused, fuzzy-matches across label + franchise + tags, exposes tag-chip filters derived from the manifest, and pins `Favorites` + `Recent` rows at the top. Keyboard-first: `/` focuses search, arrows navigate the grid, `Enter` selects, `f` toggles favorite, `Esc` closes. Virtualizes natively via CSS `content-visibility: auto` so 500 cards stay cheap. Thumbnails lazy-load via `<img loading="lazy">`.

Also in this release:

- Retired the **Couch Gag** scene (the suburban-backyard mood didn't sit cleanly next to the other nine). Plugin drops from ten scenes to nine.
- New `assets/previews/b-roll.jpg` brand swatch (a 3×3 collage of the scene previews) for the shell's single card.
- New `bin/new-scene` scaffolder and `bin/validate-scenes` CI check (every manifest entry must have JS + preview + wallpaper).
- REST + persistence: `b_roll_scene`, `b_roll_favorites`, `b_roll_recents` in WP user meta; one REST route for the whole bundle.
- Failure modes: a scene that 404s or throws in `setup` reverts to the previous scene without freezing the canvas; REST failures fall back to `localStorage` and retry on the next save.

**Migration:** previously you picked the scene directly ("Rainbow Road") from the WP Desktop wallpaper picker. In v0.6 you pick "B-Roll" once; scene switching lives inside the wallpaper after that.

## v0.5.0 — Painted backdrops + live motion overlay

Every scene now layers its existing Pixi animation on top of a **1920×1080 painterly JPG backdrop** (`assets/wallpapers/<slug>.jpg`, ~300–500 KB each, ~3.5 MB total). The painting carries everything that was static — sky gradients, city silhouettes, sigils, vignettes, lit windows, distant glows. The Pixi layers carry everything that moves: rain, glyph columns, light cycles, soot sprites, hex pulses, lightning, splashes, the falling couch.

Practically, this means the backdrops do the heavy lifting on visual richness — Saturn really looks painted, the Blade Runner street really looks wet — and the motion stack stays tight and animated on top. A handful of procedural layers tied to old Pixi geometry got dropped in the process (Neon Rain's per-window flicker, the Tron horizon glow) because they no longer had buildings or hills to flicker over; the painting carries them statically instead. The plugin payload grew from ~677 KB to ~4.7 MB, mostly the JPGs.

Every scene's `setup()` is now `async` so it can `await PIXI.Assets.load(url)` for its backdrop texture. `onResize()` re-runs the cover-fit math (`Math.max(scaleX, scaleY)`) so the painting fills 16:10 / 21:9 / 4:3 by cropping edges, never letterboxing.

## v0.4.1 — Painterly preview swatches

The wallpaper picker no longer shows hand-coded SVG composites. Each scene now ships with a painterly raster thumbnail (1.6:1, ~640px wide, JPG q75, ~50–100 KB each) generated from a matte-painting prompt that captures the mood of the live animation without using any franchise IP. The full 10-image set adds ~650 KB to the plugin payload. The `src/index.js` registrar shrunk from ~1,120 lines to ~245 lines as a result. Picker URL: `assets/previews/<slug>.jpg?v=<plugin-version>` for cache-busting on bumps.

## v0.4.0 — Visual overhaul

Every scene was reworked for richer atmospherics without adding any external assets. All ten scenes stay Pixi primitives + `Graphics` + `Text`, but now with additional layers per scene:

- **Code Rain** — 3-depth parallax columns, per-column phosphor wobble, occasional synced `MATRIX`-style phrase cascades across adjacent columns, CRT vignette + per-frame film grain.
- **Hyperspace** — 3-layer parallax starfield, cubic acceleration streaks, a pulsing iris with 8 lens-flare spokes, chromatic warp-flash ghosts.
- **Neon Rain** — wet-ground reflection band with ripple shimmer, fog haze between city layers, per-window flicker + block blackouts, distant lightning, droplet splashes.
- **The Grid** — scrolling perspective grid with brighter near rows, intersection dots, horizon-glow reflection band, data packets traveling along fade-trails, collision rings.
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
4. OS Settings → Wallpapers → pick **B-Roll**.
5. Click the gear in the bottom-right of the wallpaper to switch scenes.

Or clone this repo directly into `wp-content/plugins/b-roll/`.

## Architecture

Designed to scale to hundreds of scenes without bloating the bundle or the shell's picker.

```
b-roll/
├── b-roll.php              # enqueues src/index.js; REST route /b-roll/v1/prefs;
│                             hydrates scenes.json + per-user prefs into bRoll localize.
├── blueprint.json          # Playground demo blueprint
├── bin/
│   ├── new-scene           # scaffold a new scene (JS stub + manifest row)
│   └── validate-scenes     # CI check: every manifest entry has JS + both JPGs
├── tools/
│   └── build-b-roll-swatch.py   # regenerate assets/previews/b-roll.jpg
├── assets/
│   ├── previews/           # painterly thumbnails (1.6:1, ~640px, JPG q75) + b-roll.jpg brand swatch
│   └── wallpapers/         # painted 1920×1080 backdrops (JPG q80)
└── src/
    ├── index.js            # registrar + shared mount runner + lazy loaders + prefs plumbing
    ├── picker.js           # in-canvas picker overlay (search, tags, favorites, recents)
    ├── scenes.json         # canonical scene manifest (single source of truth)
    └── scenes/             # one self-registering file per scene
        ├── code-rain.js
        ├── hyperspace.js
        ├── neon-rain.js
        ├── tron-grid.js
        ├── rainbow-road.js
        ├── soot-sprites.js
        ├── upside-down.js
        ├── refinery.js
        └── shimmer.js
```

At boot, `index.js` registers **one** wallpaper: `b-roll`. The moment a user activates it, the shared mount runner:

1. Creates a single `PIXI.Application`.
2. Reads `bRoll.scene` (from user meta, falling back to `rainbow-road`) and loads that scene's JS via a one-shot `<script>` injection.
3. Runs the scene's `setup → tick → cleanup` lifecycle.
4. Injects a small gear button into the wallpaper's container; clicking it lazy-loads `src/picker.js` and opens the picker overlay.
5. When the user picks another scene, the runner calls the current scene's `cleanup`, clears `app.stage`, loads the new scene's JS if needed, and runs its `setup` — all **without re-initializing Pixi**. Failures (script 404, parse error, `setup` throw) keep the previous scene running.

Consequences:
- Activating the plugin loads one JS file. Picker loads only if the user clicks the gear. Each scene's ~8–15 KB loads the moment it's chosen.
- Previews in the picker are static JPGs with `loading="lazy" decoding="async"`, so 500 cards stay cheap; the grid virtualizes natively via `content-visibility: auto`.
- Adding a new scene = `bin/new-scene <slug> "<Label>" "<Franchise>" tag1,tag2` (writes JS stub + appends the manifest row), then drop the painterly preview at `assets/previews/<slug>.jpg` and the 1920×1080 painted backdrop at `assets/wallpapers/<slug>.jpg`. Run `bin/validate-scenes` to sanity-check before a PR.

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
