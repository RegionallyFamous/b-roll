# Changelog

All notable changes to ODD are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each section is delimited by an `<a id="vX.Y.Z"></a>` anchor so
`odd/bin/release-notes <version>` can slice it out for GitHub release
bodies.

<a id="unreleased"></a>
## [Unreleased]

<a id="v1.6.3"></a>
## [1.6.3] — 2026-04-26

### Changed
- Hero contrast finally rock-solid. The 1.6.2 scrim faded to ~22% opacity by the title baseline and got eaten alive by bright editorial art (the Icons + Apps banners, especially). Replaced it with a near-solid left ink panel that holds .94→.92 alpha through the first 36% of the hero, eases out at 50%, and only goes transparent past the body content at ~84%. Stacked it with a vertical bottom haze so the floating thumbnail still bleeds in cleanly. Title + subtitle pick up a two-stop text-shadow halo (1px tight + 14px diffuse) and force `color:#fff` so they're legible on any backdrop. Eyebrow pill darkens its shadow stop to match.
- Categories instead of franchises. The shelving model rolled up by `franchise`, but every icon set declared its own franchise — so the Icons department rendered 17 shelves of one set each. Wallpapers were nearly as bad: 15 of 19 scenes lived under "ODD Originals" alongside three franchise singletons. Both surfaces now bucket items into curated categories with real siblings:
  - Wallpapers: **Skies** (5 — aurora, rainfall, big-sky, cloud-city, weather-factory), **Wilds** (6 — circuit-garden, tropical-greenhouse, wildflower-meadow, tide-pool, abyssal-aquarium, sun-print), **Places** (5 — iris-observatory, pocket-dimension, balcony-noon, mercado, beach-umbrellas), **Forms** (3 — flux, origami, terrazzo).
  - Icon Sets: **Playful** (5 — arcade-tokens, lemonade-stand, tiki, stadium, eyeball-avenue), **Crafted** (5 — claymation, cross-stitch, botanical-plate, fold, risograph), **Technical** (5 — blueprint, circuit-bend, hologram, monoline, filament), **Cool** (2 — arctic, brutalist-stencil).
- Quilt + shelf headers now read "Browse by category" and use category gradients (Skies blue→sky, Wilds forest→leaf, Places terracotta→cream, Forms violet→lilac, Playful magenta→amber, Crafted umber→sand, Technical teal→cyan, Cool slate→ice).
- "Default" pseudo-set no longer renders as a 1-item shelf. The synthetic "Default" tile is filtered out of both the category quilt and the shelves; instead, when a custom icon set is committed, a dedicated **Reset to default** pill renders between the hero and the quilt with a tertiary-style action that previews `none` so the user can confirm before reloading.

### Internal
- New `categoryOf( item, kind )` and `compareCategoryNames( a, b )` helpers replace the per-franchise `groupByFranchise` path. Tables live inside the helper functions so they survive `var`-hoist ordering during initial render — same fix pattern as `franchiseGradient` from 1.6.1. Items not yet curated fall back to their declared `franchise` so nothing disappears, just lands at the bottom of the category sort.
- `franchiseGradient` keeps its name (legacy callers) but the palette gains explicit entries for each new category. Old per-franchise entries stay so any uncurated item renders the same as before.
- `panel.test.js` fixture now uses three slugs that map to three distinct categories (flux→Forms, aurora→Skies, circuit-garden→Wilds) so the existing 3-shelf assertion still holds; assertion comment updated to reflect category grouping.

<a id="v1.6.2"></a>
## [1.6.2] — 2026-04-26

### Changed
- Apps user-facing copy rewritten. The Apps department is no longer described as "sandbox bundles" / "sandboxed bundles" / "apps in a sandbox" anywhere users actually read. Apps are now framed as **mini apps that run on your WordPress desktop without using or knowing anything about WordPress** — they just open from the dock icon. Applies to: rail tagline, Apps section description, About strapline, About credit, and `readme.txt` plugin description. Technical references to the iframe sandbox (security headers, REST docs, app-developer docs) are unchanged because the iframe IS sandboxed.
- Icon Sets + Apps departments now ship dedicated editorial hero artwork. Generated `odd/assets/shop/icons-hero.webp` (constellation of pastel app-icon stickers on a deep galactic gradient) and `odd/assets/shop/apps-hero.webp` (still-life of floating 3D mini-app objects on a peach-to-rose backdrop). The Icon Sets hero now uses the icons banner instead of a flat franchise gradient. The Apps department gets a hero where it previously had none.
- Contrast + spacing pass on the Shop:
  - Hero scrim is asymmetric (heavy on the left where text lives, transparent on the right where the artwork sits) so headlines stay readable on bright backgrounds like Aurora and Origami without washing out the art. Hero title + subtitle pick up text-shadow as belt-and-braces.
  - Hero padding 26→32px, min-height 220→248px, title 36→40px, subtitle .82→.94 alpha; eyebrow opacity .16→.22 for legibility on light scrims.
  - Department title 28→30px, shelf title 17→19px, content pane padding 28/36→32/40px, shelf bottom margins 32→36/48px so franchises breathe.
  - `--odd-shop-ink-3` darkened from #6e6e73 to #5d5d62 (4.7→5.7 contrast on white) for the tile sub-line and rail tagline; `--odd-shop-ink-2` from #424245 to #3a3a3d.
  - Quilt count picks up text-shadow + bumps to weight 700 so it survives the Paper (cream→amber) gradient. Quilt scrim now darkens both edges instead of only the bottom.
  - Tile pill background 10%→12% alpha, hover 12%→18%; previewing pill swapped from amber-on-cream to a higher-contrast warm-brown-on-yellow. Tile title + sub now ellipsis-truncate.
  - Search pill border thickened, padding bumped, max-width 360→380. Top bar drops the unused right-side gutter column (was reserving 60px for an avatar that never landed).

### Internal
- `pickFeaturedSet` no longer returns the synthetic "Default" pseudo-set as the hero for new users. It only honors `state.cfg.iconSet` when explicitly set, otherwise falls through to the first real installed set so the hero always shows off something stylable.
- New `renderAppsHero()` mirrors the wallpaper / icons hero renderers; reads its banner from `assets/shop/apps-hero.webp`.

<a id="v1.6.1"></a>
## [1.6.1] — 2026-04-26

### Changed
- ODD Shop now ships a full Mac App Store-style layout pass. Each department (Wallpapers, Icon Sets) gets a full-width **hero card** featuring the active (or filtered-top) title with preview art, blurred scrim, eyebrow pill, and inline Preview / Active actions; a **"Browse by franchise" quilt** of gradient category tiles that smooth-scroll to the matching shelf; **horizontal-scrolling shelves** replacing the flat grids, with scroll-snap, native scrollbar styling, and a count anchor in the head; and **tile-style scene cards** — preview thumbnail on top, title + "Generative · Scene" subhead, inline blue `Preview` / `Open` / `Previewing` pill, corner `✓ Active` badge on the committed scene.
- Top bar now includes a **search pill** that filters the current department's cards live against label, slug, franchise, and tags. Empty-results state reads "No scenes match …" and preserves the hero-less layout.
- Preview bar was redesigned as a **floating pill** anchored to the content pane's lower-right (was: full-width sticky toolbar). Retains the eye glyph + `Keep` / `Apply` / `Cancel` actions.

### Internal
- New helpers in `src/panel/index.js`: `pickFeaturedScene` / `pickFeaturedSet` (hero source-of-truth), `renderWallpaperHero` / `renderIconHero`, `renderCategoryQuilt`, `filterByQuery`, `franchiseGradient` (deterministic hash fallback for unknown franchises), and `cssEscape` shim for franchise scroll anchors. `renderShelf` now takes `{ scope }` and builds a horizontal-scroll track instead of a grid. `redecorateSceneGrid` also syncs the inline pill label and the corner active badge so live swaps match the hero without re-render.
- No REST, data, or extension-API changes. Internal window id is still `odd`. Back-compat preserved for slash commands, tests, and third-party extensions.

<a id="v1.6.0"></a>
## [1.6.0] — 2026-04-26

### Changed
- The ODD Control Panel is now the **ODD Shop** — a Mac App Store-style browsing surface. The native window adds a top bar with an ODD wordmark + tagline, a translucent left rail listing the departments (Wallpapers · Icon Sets · Apps · About) with glyphs and one-line taglines, and groups each catalog into franchise "shelves" (Generative, Atmosphere, Paper…). Default window size grew from 820×560 to 960×620 to match the new chrome; minimum is 720×480.
- Slash command `/odd-panel` now reads "ODD: open Shop" in the ⌘K palette.
- Plugin description (`odd/odd.php`) and short description (`odd/readme.txt`) refer to the window as the ODD Shop.

### Internal
- Window id stays `odd` for back-compat with WP Desktop Mode session state, tests, slash commands, and third-party extensions. All data, REST endpoints, live-swap hooks, and panel state logic are unchanged — only the chrome + copy moved.
- `panel.test.js` asserts the new department rail labels (`Wallpapers`, `Icon Sets`, `About`) and the franchise shelf grouping (one `.odd-shop__shelf` per franchise in `window.odd.scenes`).

<a id="v1.5.8"></a>
## [1.5.8] — 2026-04-26

### Added
- `install-smoke` workflow that boots WordPress + WP Desktop Mode in CI, installs `odd.zip`, and asserts core entry points (`odd` active, `odd_wallpaper_scene_slugs`, `odd_apps_install`, `wp_desktop_dock_item` filter). Wired into the release pipeline as a gate.
- Playground / blueprint / release-zip uptime probe (every 30 minutes). Opens or reuses a `uptime-auto`-labelled GitHub issue on failure and closes it on recovery.
- Husky pre-commit hook running version check, scene + icon-set validators, the full Vitest suite, and `phpcs` on staged PHP.
- `CHANGELOG.md` + `odd/bin/release-notes` for machine-readable release bodies.
- Pull-request template and `.github/CODEOWNERS`.

<a id="v1.5.2"></a>
## [1.5.2] — 2026-04-25

### Added
- JS smoke tests: `scenes.test.js` (registers every scene, runs `setup` + `tick`), `widgets.test.js` (mount Sticky Note + Magic 8-Ball, regression-guards `pointer-events: none` on 8-Ball decorations), `panel.test.js` (sidebar/tabs render, preview bar Keep/Cancel flow).

### Fixed
- Installed apps without React now paint an in-iframe banner instead of rendering blank.

<a id="v1.5.1"></a>
## [1.5.1] — 2026-04-25

### Added
- PHPUnit integration suite built on `wp-phpunit`, with tests for the prefs REST endpoint, icons dock filter, wallpaper registry, apps install/uninstall lifecycle, and the Bazaar compatibility shim.
- Composer scripts (`phpcs`, `phpcbf`, `phpunit`, `test`) and an `install-wp-tests.sh` CI helper.

<a id="v1.5.0"></a>
## [1.5.0] — 2026-04-25

### Added
- PHP_CodeSniffer + WordPress Coding Standards + PHPCompatibilityWP wired into CI via `phpcs.xml.dist` and `composer.json`.

### Changed
- Large automated PHPCS/PHPCBF cleanup pass across `odd/` (spacing, Yoda, alignment, text-domain, silenced-error whitelist).

<a id="v1.4.6"></a>
## [1.4.6] — 2026

### Fixed
- Apps: enqueue `wp-element` so bare `react` imports resolve in installed apps.

<a id="v1.4.5"></a>
## [1.4.5]

### Fixed
- Installed-app windows hydrate client-side so Playground can no longer paint them white.

<a id="v1.4.4"></a>
## [1.4.4]

### Changed
- Speed / reliability / security audit pass across the plugin.

<a id="v1.4.3"></a>
## [1.4.3]

### Fixed
- Magic 8-Ball widget looks and behaves like an actual 8-Ball (the `pointer-events: none` regression guard later added in 1.5.2 covers this class of bug).

<a id="v1.4.2"></a>
## [1.4.2]

### Changed
- README and `CLAUDE.md` refreshed for the current scene + icon-set + apps catalog.

<a id="v1.4.1"></a>
## [1.4.1]

### Fixed
- Normalised stray comment encoding in four scene files that could surface as control bytes.

<a id="v1.4.0"></a>
## [1.4.0]

### Changed
- Widgets: replace the introspective "Now Playing / Postcard / Clock" set with **Sticky Note** (persists via localStorage) and **Magic 8-Ball**.

### Fixed
- Installed apps no longer paint blank because `/odd-app/` URIs now match on `init`.

<a id="v1.3.2"></a>
## [1.3.2]

### Fixed
- Installed apps actually open; the odd border around icons is gone.

<a id="v1.3.0"></a>
## [1.3.0]

### Added
- Screensaver option, rainfall wallpaper scene, click-to-preview on scene cards.

<a id="v1.2.0"></a>
## [1.2.0]

### Added
- 10 new wallpaper scenes and 10 new icon sets.

### Changed
- Icons section reskinned to match the app catalog list.
- About tab redesigned with a funky title card.

### Fixed
- Catalog install 500 (with the `.odd` extension retired in favour of `.wp`).
- Catalog UI redesigned with surfaced install errors.
- App icons flattened and window-mount logic hardened.

<a id="v1.1.0"></a>
## [1.1.0]

### Added
- Self-hosted catalog assets behind `odd.regionallyfamous.com`.
- Iris Observatory wallpaper scene.
- Architecture documentation page covering the Apps subsystem.

### Changed
- Desktop dock icons enlarged.
- Icon sets refreshed; demo app removed.

### Fixed
- Playground CORS mirrors for the catalog endpoints.
- Icons appear on first paint, no more reload when switching sets.
- First-run onboarding card retired.
- Empty Apps catalog + missing desktop icons on fresh installs.

<a id="v1.0.0"></a>
## [1.0.0] — Absorb Bazaar

### Added
- Apps subsystem absorbed from the standalone Bazaar plugin (`odd_apps_*` API, sandboxed `/odd-app/<slug>/` windows, catalog + upload install).
- Passes WordPress Plugin Check.

---

Earlier `v0.x` releases are intentionally omitted from this changelog;
the repository history is the record of those iterations.

<!--
Release-notes consumers (odd/bin/release-notes) look for the literal
`<a id="vX.Y.Z"></a>` anchor followed by the corresponding `## [...]`
heading. Please keep that pairing intact when adding new releases.
-->
