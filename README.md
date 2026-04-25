# B-Roll for WP Desktop Mode

A pack of pop-culture-themed PixiJS wallpapers for [WP Desktop Mode](https://github.com/WordPress/desktop-mode). **Fourteen** painterly animated scenes living under one "B-Roll" wallpaper card, switchable via an in-canvas picker — architected to scale to hundreds without bloating the shell's picker or the plugin bundle.

**Requires:** WordPress 6.0+ · PHP 7.4+ · WP Desktop Mode (active)

**Sibling plugin:** [B-Roll Icons](./b-roll-icons/) — themed icon sets that re-skin the Dock (v0.1.0 ships the Code Rain / Matrix set). Activate both plugins and pick each independently.

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

## v0.12.0 — Painted overhaul (gpt-image-1.5 quality)

The whole pack got repainted at much higher fidelity, and the five v0.10 scenes finally received their per-scene foreground cast:

- **All 14 wallpapers regenerated** through OpenAI's `gpt-image-1.5` at `quality: high`, then resized to a 1920×1080 WebP backdrop and a 640×360 picker preview. Every scene benefits, but the standouts are: **Code Rain** (the wooden TV bezel is gone — pure dark phosphor now), **Wasteland** (painterly post-apocalyptic desert instead of a geometric placeholder), **Attract Mode** (a dark arcade CRT void with vector glow instead of a sparse black field), and **Nerv Entry Plug** (warm amber LCL refraction instead of clinical instrument lines). Prompts live in [`_tools/wallpaper-prompts.json`](_tools/wallpaper-prompts.json) and the renderer is [`_tools/gen-wallpaper.py`](_tools/gen-wallpaper.py); both are batch-mode and 429-aware.
- **All 64 cut-outs and drifters regenerated** through the same model at 1024×1024, then put through `rembg` (u2net) for background removal, trimmed, and saved as transparent WebP. New tool [`_tools/gen-cutout.py`](_tools/gen-cutout.py) drives the whole pipeline; prompts in [`_tools/cutout-prompts.json`](_tools/cutout-prompts.json) are franchise-safe descriptive ("anime soot sprite") rather than brand-tagged.
- **Foreground cast for the five v0.10 scenes.** `beacon-hills`, `nerv-entry-plug`, `wasteland`, `attract-mode`, and `outrun` now mount per-scene cut-outs in addition to whatever shared drifters they already used. Three new cut-outs per scene (e.g. wolf-howl + lacrosse-stick + full-moon for Beacon Hills; chrome-skull + dust-devil + vulture-silhouette for Wasteland; vector-asteroid + vector-ship + vector-bullet for Attract Mode), declared in `src/scenes.json` and atlas-packed alongside the existing nine.
- **Beacon Hills realigned to Teen Wolf.** The slug always pointed at the Teen Wolf town; the v0.10 metadata accidentally tagged it Lord of the Rings. Franchise + tags + scene docstring now match the wolf-howl / lacrosse-stick / full-moon cast and the misty Pacific Northwest backdrop the new prompt produced.
- **Atlases rebuilt for all 14 scenes** so the new cut-outs ship in the same single-WebP-per-scene round-trip path the original nine use.

## v0.11.0 — Auto-close picker + chaos cast

Two small but high-impact additions:

- **Picker auto-dismisses on select.** Clicking a wallpaper card now commits and closes the panel in one motion (with a 180 ms opacity/scale fade-out, skipped under `prefers-reduced-motion`). The "Now playing" badge / live-preview revert dance is no longer needed because the panel is gone the moment your choice is made — same instant-feel snap as picking a wallpaper in OS Settings.
- **Chaos cast — weird transparent drifters in every scene.** Six new painted, background-removed cut-outs ship with the plugin (rubber chicken in shades, googly-eye thumbs-up, winged toaster, tuxedo-banana, UFO abducting a cow, saxophone-playing pickle), all in `assets/drifters/*.webp` and tagged `weird: true` in `src/drifters.json`. Two are randomly drawn per scene swap and mounted on a top-of-stage container that sits above the scene's own cut-outs, so every wallpaper now gets a small dose of absurdism without the per-scene scenes.json having to know about them. Respects `prefers-reduced-motion` (skips the cast entirely) and per-impl opt-out (`impl.skipChaos = true` or `state.skipChaos = true`). Live tunable from devtools via `__bRoll.setChaos(n)` (0–5, 0 disables).

## v0.10.0 — Sprite atlases + take-a-frame

v0.10 is mostly a polish release for the wallpaper mount path:

- **Sprite atlases for cut-outs.** The 4-ish cut-outs each scene used to pull with 4 separate requests are now packed into a single `assets/atlases/<slug>.{webp,json}` via a new `_tools/pack-atlases.py` shelf packer. `mountCutouts()` loads the atlas once and slices per-cut-out textures by frame name; the prior per-file path is kept as an automatic fallback for any scene that hasn't generated one yet. Round-trips per scene: **4 → 1** (36 → 9 across the full set), texture uploads: **1 per scene instead of 4**. Format is Pixi v8's native spritesheet JSON (`frames`, `meta.image`, `meta.size`).
- **Take-a-frame (the `S` key).** A new camera button sits to the left of the gear (and `s` from anywhere that isn't an input triggers it too). Composites the painted backdrop WebP + the Pixi cut-out / FX canvas at DPR-native resolution via `renderer.extract.canvas(stage)`, writes `b-roll-<scene>-<timestamp>.png`, flashes the screen briefly, and toasts the saved filename. Same-origin so no CORS taints; reduced-motion users skip the flash but still get the save.

## v0.9.0 — Color-aware OS, cinematic depth, smaller zip

v0.9 is the "plugin disappears into the OS" release. The wallpaper now drives the Dock and Admin Bar color, the cut-outs feel like real cinematography, and the whole plugin shed another third of its payload.

- **Color-aware OS accent.** On every scene swap we sample the active backdrop at 32×32, weight pixels by saturation × brightness, and push the result into `--wp-admin-theme-color`. The Dock, Admin Bar, and focus rings tint to match the wallpaper. Cached per-slug so hover previews reuse the same hue. Restored cleanly on teardown.
- **Depth-of-field blur on cut-outs.** `far` cut-outs get a `PIXI.BlurFilter(2.2)`, `mid` a gentle `0.6`, `near` stays sharp. Scenes can override per-def with `blur: N` in `scenes.json`. Reads as real cinematography instead of a sticker sheet.
- **ARIA live region.** A visually-hidden `role="status" aria-live="polite"` node announces "Now playing: Neon Rain (Blade Runner)" on every swap. Respects screen readers without touching visible chrome.
- **WebP for wallpapers + previews.** The painted backdrops went JPG → WebP q82 (3.8 MB → 1.1 MB, 29% of original) and so did the picker thumbnails. Combined with v0.8's cut-out WebP conversion, the full plugin zip is now **5.1 MB — down from 22.7 MB at the start of v0.7**.
- **`bin/bump-version` + pre-commit hook.** The three version strings in `b-roll.php` (header, `wp_enqueue_script`, `wp_localize_script`) are now bumped atomically. A pre-commit hook runs `bin/check-version` whenever `b-roll.php` is in the commit, catching the mismatch that bit the last two releases. Install via `bin/install-hooks` (one-time).

## v0.8.0 — Crossfades, live preview, parallax, WebP

v0.8 is a perceived-quality release. Nothing about the scene list or the easter-egg surface changed, but everything about the *swap* got crisper:

- **Crossfade scene swaps.** Before teardown we snapshot the current canvas into a DOM overlay, run the old scene's cleanup, set up the new scene, then fade the snapshot over ~350 ms. No more hard cut. Respects `prefers-reduced-motion`.
- **Instant first paint.** A plain DOM `<img>` backdrop sits under the Pixi canvas and paints the scene's JPG immediately, so there is never a blank frame while Pixi boots or a new scene's `setup()` loads textures.
- **Live preview on hover.** Dwell a card in the picker for 350 ms and the wallpaper swaps to it live — no commit, no "recent", revert on pointer-leave or panel close. Makes the picker feel like a proper browser.
- **Mouse parallax on cut-outs.** Every foreground cut-out now reads `env.parallax` and nudges 6–24 px based on its depth slot. Scenes get it for free via `h.tickDrifters()`. Smoothed on the ticker so it never jitters.
- **Gear onboarding tooltip.** First time you see the wallpaper, a "Change wallpaper `?`" tooltip points at the gear for ~6 s, then disappears forever (`localStorage`).
- **WebP cut-outs.** All 36 cut-outs were converted from PNG to WebP q85 method=6. The full plugin zip dropped from ~22.7 MB to ~7.8 MB (66% smaller) with no visible quality loss. Pixi v8 loads transparent WebP natively in every modern browser.
- **Page Visibility pause.** The ticker now stops on `document.visibilitychange` (tab hidden, minimize, background workspace) in addition to the existing WP Desktop hook. Pure battery back.
- **Swap queue.** Rapid hover previews no longer get dropped mid-flight — the latest requested slug is drained once the current swap finishes.

## v0.7.0 — Painted foreground cut-outs + interactive easter eggs

Every scene now layers a third tier on top of the painted backdrop and the Pixi motion stack: a **foreground container of painted PNG cut-outs** that drift across the frame on per-cutout motion profiles. Four cut-outs per scene (36 in total) — agents, X-wings, light cycles, Bullet Bills, soot huddles, Demogorgons, MDR mugs, Shimmer vials — each with its own depth slot (`far` / `mid` / `near`), opacity, and motion type (`cross`, `drift`, `bob`, `tumble`, `orbit`).

Cut-outs are declared in [src/scenes.json](src/scenes.json) and ship from `assets/cutouts/<slug>/*.png`. The painting still does the static heavy lifting; the Pixi motion still carries rain/glyphs/grids; the cut-outs add the read-it-from-across-the-room franchise punch.

This release also adds **interactive easter eggs**, dispatched globally and routed to the active scene's `onEgg(name, state, env)` handler:

- **Konami code** (`↑↑↓↓←→←→ba`) → `festival` — a per-scene celebratory blowout (slow-mo bullet time in Code Rain, fleet hyperspace burst in Hyperspace, Demogorgon stomp + lightning in The Upside Down, candy storm in Soot Sprites, etc.).
- **Scene keywords** (e.g. `matrix`, `wars`, `blade`, `tron`, `mario`, `ghibli`, `hawkins`, `praise kier`, `jinx`) → `reveal` — a hidden flourish themed to the scene.
- **Triple-click** in the bottom-left 60×60 corner → `peek` — a quick foreground reveal/zoom of one egg cut-out.

The shared helpers (`window.__bRoll.helpers.mountCutouts`, `tickDrifters`, `showEggDrifter`, `hideEggDrifter`) handle the heavy lifting so each scene only adds ~3 lines to `setup()` / `tick()` and an `onEgg` handler. Lazy-loaded once at boot ([src/easter-eggs.js](src/easter-eggs.js)) and reduced-motion-aware. Plugin payload grows by ~3.5 MB of compressed transparent PNGs.

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

https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/RegionallyFamous/odd/main/blueprint.json

(First load takes ~20–30 seconds while Playground boots and both plugins install.)

### A real WordPress install

1. Download the latest `b-roll.zip` from the [Releases](https://github.com/RegionallyFamous/odd/releases) page.
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

## CI + releases

The repo is wired up with two GitHub Actions workflows:

- **`.github/workflows/ci.yml`** runs on every PR and push to `main`: scene manifest validation (`bin/validate-scenes`), `b-roll.php` version-string consistency (`bin/check-version`), blueprint validation (`bin/check-blueprint`), `php -l` + PHPCS (WordPress-Extra) on PHP 7.4 and 8.3, `node --check` + ESLint on every scene file, JSON parse checks on all config files, a zip build with a 7 MB size budget, and a Playground activation smoke test via `@wp-playground/cli`. Every step has a `bin/` script that runs locally with the same exit semantics.
- **`.github/workflows/release.yml`** triggers on `v*` tag push. It reruns the full CI suite, asserts the tag matches the committed `b-roll.php` version, builds `dist/b-roll.zip`, creates a GitHub release with auto-generated notes, and uploads the zip as the release asset. Cutting a release is just: bump the three version strings in `b-roll.php`, commit, `git tag v0.X.0 && git push origin v0.X.0`.

## License

GPLv2 or later, matching [WP Desktop Mode](https://github.com/WordPress/desktop-mode). See [LICENSE](./LICENSE).

## Credits

Scene concepts are loving references to their respective franchises. No franchise artwork is shipped: every visual is rendered from first principles with Pixi primitives (particles, polygons, text glyphs) so the plugin stays small, unambiguous on ownership, and fast.
