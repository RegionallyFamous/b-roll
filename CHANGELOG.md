# Changelog

All notable changes to ODD are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each section is delimited by an `<a id="vX.Y.Z"></a>` anchor so
`odd/bin/release-notes <version>` can slice it out for GitHub release
bodies.

<a id="unreleased"></a>
## [Unreleased]

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
