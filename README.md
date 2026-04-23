# B-Roll for WP Desktop Mode

A pack of pop-culture-themed PixiJS wallpapers for [WP Desktop Mode](https://github.com/WordPress/desktop-mode). Ten animated scenes that register themselves into the desktop shell's wallpaper picker the moment the plugin activates.

**Requires:** WordPress 6.0+ · PHP 7.4+ · WP Desktop Mode (active)

## The ten scenes

| # | Scene | Franchise | One-liner |
|---|---|---|---|
| 01 | **Code Rain** | The Matrix | Cascading green katakana with the occasional `W` mixed in. |
| 02 | **Hyperspace** | Star Wars | Radial starlines and the occasional warp-flash. |
| 03 | **Neon Rain** | Blade Runner 2049 | Distant city silhouette, flickering neon signs, diagonal rain, rare spinner glide. |
| 04 | **The Grid** | Tron | Isometric neon grid with racing light-cycles leaving fading trails. |
| 05 | **Couch Gag** | The Simpsons | Springfield-blue sky with drifting clouds; every so often, the couch appears. |
| 06 | **Rainbow Road** | Mario Kart | A scrolling neon road in perspective, twinkling stars, drifting `?`-box. |
| 07 | **Soot Sprites** | Studio Ghibli | Pastel sky with fluffy black sprite-blobs; one blinks its eyes now and then. |
| 08 | **The Upside Down** | Stranger Things | Red-violet murk, drifting spores, rare title-card glitch. |
| 09 | **Refinery** | Severance | A pool of pale numerals that clusters into ominous rings and disperses. |
| 10 | **Shimmer** | Arcane | Rising bioluminescent particles, gold glints, and a transient hex-grid flash. |

Pick any of them from **OS Settings → Wallpapers** once the plugin is active.

## Install

### Playground (one-click demo)

Open a hosted WordPress + Desktop Mode + B-Roll environment:

https://playground.wordpress.net/?blueprint-url=https://files.catbox.moe/a9u8e1.json

(First load takes ~20–30 seconds while Playground boots and both plugins install.)

### A real WordPress install

1. Download the latest `b-roll.zip` from the repo's Releases.
2. WP Admin → Plugins → Add New → Upload Plugin → pick the zip → Activate.
3. Enable desktop mode (admin bar toggle).
4. OS Settings → Wallpapers → pick a scene.

Or clone this repo directly into `wp-content/plugins/b-roll/`.

## How it works

Every scene is a canvas wallpaper registered through `wp.desktop.registerWallpaper()`. They declare `needs: ['pixijs']` so the desktop shell loads PixiJS v8 (pre-registered as a module) before any scene's `mount` fires.

`src/scenes.js` ships a tiny scene framework that handles the common plumbing — app init, reduced-motion still-frame, ticker start/stop on the shell's `wp-desktop.wallpaper.visibility` action, Pixi app teardown on wallpaper switch — so each scene only has to implement `setup` and `tick`.

The PHP side is a single-file plugin that enqueues the JS with `wp-desktop` as a dependency, so the bundle only loads where the desktop shell is live.

## Add your own scene

Inside `src/scenes.js`, each scene is a function that returns the output of `makeScene({ ... })`. The shape is:

```javascript
function sceneMyThing() {
    return makeScene({
        id: 'my-thing',              // becomes 'b-roll/my-thing'
        label: 'My Thing',
        preview: '#101820',          // CSS swatch background for the picker
        needs: ['pixijs'],           // modules the shell will load first
        setup({ app, PIXI, ctx, helpers }) {
            // Build containers, sprites, whatever you want on app.stage.
            // Return the state object you'll mutate in tick().
            return { /* ...state... */ };
        },
        tick(state, { app, PIXI, dt, ctx, helpers }) {
            // Animate. dt is frames at 60fps, clamped to 2.5.
        },
        onResize(state, { app, PIXI, ctx }) {
            // Optional. Re-paint backgrounds / re-layout.
        },
        cleanup(state, { app, PIXI }) {
            // Optional. The framework already destroys the app and
            // removes visibility listeners — only release things you
            // created outside the Pixi scene graph here.
        },
    });
}
```

Then add your factory to `SCENE_FACTORIES` at the bottom of `scenes.js`. That's it — the next activation registers every scene automatically, including yours.

## License

GPLv2 or later, matching [WP Desktop Mode](https://github.com/WordPress/desktop-mode). See [LICENSE](./LICENSE).

## Credits

Scene concepts are loving references to their respective franchises. No franchise artwork is shipped: every scene is rendered from first principles with Pixi primitives (particles, polygons, text glyphs) so the plugin stays small, unambiguous on ownership, and fast.
