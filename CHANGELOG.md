# Changelog

All notable changes to ODD are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each section is delimited by an `<a id="vX.Y.Z"></a>` anchor so
`odd/bin/release-notes <version>` can slice it out for GitHub release
bodies.

This file records the milestones users actually care about. Patch
releases that tuned, corrected, or iterated on a milestone are folded
into the parent entry and called out inline where it matters. The git
tag history is the full record of every shipped version.

<a id="unreleased"></a>
## [Unreleased]

<a id="v1.8.1"></a>
## [1.8.1] — 2026-04-25

### Changed
- **Dedicated Install tab.** The per-shelf "Install from file…" helper links are gone. Wallpapers / Icon Sets / Widgets / Apps now get a sibling **Install** tab in the sidebar that owns the whole flow: a big, clickable drop zone for a `.wp` archive plus a four-card "What can I install?" grid that explains each content type. The topbar **Install** pill and the Shop-wide drag-and-drop overlay still work from anywhere; the new tab just gives the action a first-class destination.

<a id="v1.8.0"></a>
## [1.8.0] — 2026-04-26

### Added
- **Universal `.wp` archive.** The `.wp` format now carries any ODD content type — app, icon set, scene, or widget — selected via a new `type` field in `manifest.json`. One manifest, one archive, one install flow for everything. Authors no longer need a companion plugin to ship a scene or an icon pack.
- **ODD Shop as the install surface.** Topbar **Install** pill opens a file picker from anywhere in the Shop; a glassy drop overlay picks up `.wp` files dropped anywhere on the window; each department gets an inline "Install from file…" link. After install the Shop auto-switches to the matching department, scrolls the new item into view, and flashes a subtle highlight.
- **Unified bundle dispatcher.** New `odd_bundle_install()` routes every upload through shared archive validation, per-type validators and installers under `odd/includes/content/`, a REST endpoint at `POST /odd/v1/bundles/upload` and `DELETE /odd/v1/bundles/{slug}`, and a global slug uniqueness check across all four content types. `POST /odd/v1/apps/upload` stays as a back-compat alias.
- **Per-type author docs.** Four focused guides — [Building an App](docs/building-an-app.md), [Building a Scene](docs/building-a-scene.md), [Building an Icon Set](docs/building-an-icon-set.md), [Building a Widget](docs/building-a-widget.md) — plus a universal [`.wp` Manifest Reference](docs/wp-manifest.md).

### Changed
- Install progress and errors are first-class UI: the topbar pill reads "Installing…" during upload, green-success for ~2s after, and shows a descriptive error state with retry on failure. Type-specific error copy explains exactly what's wrong instead of a generic failure string.
- [Building on ODD](docs/building-on-odd.md) reframed as the integrator / plugin-author surface (filters, events, registries). The path for shipping content is the four author guides above.
- Capitalization pass: every product reference in prose and UI strings is the all-caps brand name **ODD**. Code identifiers (`odd/v1/*`, `odd_*` filters, `window.__odd`, CSS classes) stay lowercase where the system requires it.

### Security
- Scenes and widgets run JavaScript in the privileged admin frame, so installs of those two types require `manage_options` plus a one-time inline confirmation banner inside the Shop — no modal dialogs.
- Icon-set SVGs are scrubbed on the server (no `<script>`, no `on*` attributes, no external `xlink:href`, no control bytes outside `\t\n\r`) before they hit disk.

<a id="v1.7.1"></a>
## [1.7.1] — 2026-04-26

### Changed
- **Polish pass across the ODD Shop.** One interaction grammar for every department: shared primary/ghost pill language for hero CTAs and tile buttons, consistent hover lifts on tiles and catalog rows, subtle top-to-bottom gradient on the active rail item, 1px inset top highlight on the topbar, pill-style shelf counts, and a "→" arrow hint on category quilt tiles. Empty state, widgets footer, and the "Reset to default" row share one informational-row pattern (icon-in-circle + text). Widget tiles gain an inner shine overlay, a scaling glyph on hover, and a green status dot on the "On desktop" chip; the widget hero glyph bobs gently on a 7s loop.

### Accessibility
- Explicit `:focus-visible` outlines on the rail, hero buttons, and tile buttons; `aria-pressed` on widget Add/Remove pills.

<a id="v1.7.0"></a>
## [1.7.0] — 2026-04-26

### Added
- **Widgets department in the ODD Shop.** Fourth department (between Icon Sets and Apps) for browsing and toggling ODD's desktop widgets (Sticky Note 📝 and Magic 8-Ball 🎱). Editorial hero card with a translucent oversized glyph that flips between "Featured widget" and "On your desktop" depending on state; shelf of gradient-glyph tiles with inline Add/Remove pills; global search filters widget label, tagline, and description; footer tip explaining where widgets appear on the desktop.

### Internal
- Uses `wp.desktop.widgetLayer` directly for add/remove, with a `wp-desktop-widgets` localStorage fallback for post-reload boot races. Subscribes to `wp-desktop.widget.added` / `.removed` under the `odd/widgets` namespace so the Shop stays in sync with × clicks on the widgets themselves, and removes the subscriptions on teardown.

<a id="v1.6.3"></a>
## [1.6.3] — 2026-04-26

### Changed
- **The ODD Control Panel is now the ODD Shop** — a Mac App Store-style browsing surface for wallpapers, icon sets, and apps. Top bar with the ODD wordmark + search pill; translucent left rail with departments (Wallpapers · Icon Sets · Apps · About); editorial hero cards per department with artwork, scrim, and inline actions; category quilt that smooth-scrolls to the matching shelf; horizontal-scroll tile shelves with snap + count chips; floating preview bar for staged changes. The default window grew from 820×560 to 960×620 to match the new chrome.
- **Curated categories instead of per-item franchises.** Every shelf has real siblings:
  - Wallpapers: **Skies** · **Wilds** · **Places** · **Forms**
  - Icon Sets: **Playful** · **Crafted** · **Technical** · **Cool**
- **Apps get editorial framing.** Dedicated hero artwork (Icon Sets and Apps banners generated as original editorial art); "mini apps that just run on your WordPress desktop" language replaces the prior "sandboxed bundles" framing throughout user-facing copy. Technical references to the iframe sandbox are unchanged.
- **Hero contrast pass.** Stacked asymmetric scrim (near-solid on the left where text lives, transparent on the right where the artwork sits) with two-stop text-shadow halos on the title + subtitle so headlines stay legible on any backdrop.
- **Reset-to-default row.** When a custom icon set is committed, a dedicated pill renders between the hero and the quilt instead of surfacing a synthetic "Default" tile inside the catalog.

### Internal
- No REST, data, or extension-API changes. Window id stays `odd`; slash commands, tests, and third-party extensions are preserved.
- _Shipped across 1.6.0 – 1.6.3 as the redesign stabilized._

<a id="v1.5.2"></a>
## [1.5.2] — 2026-04-26

### Added
- **Testing + release infrastructure.**
  - PHP_CodeSniffer + WordPress Coding Standards + PHPCompatibilityWP wired into CI (`phpcs.xml.dist`, `composer.json` scripts).
  - PHPUnit integration suite on `wp-phpunit`: prefs REST, icons dock filter, wallpaper registry, apps install/uninstall, Bazaar shim.
  - Vitest JS smoke suite: `scenes.test.js` (every scene registers, runs `setup` + `tick`), `widgets.test.js` (Sticky Note + Magic 8-Ball mount; regression guard for `pointer-events: none` on 8-Ball decorations), `panel.test.js` (sidebar / tabs / preview-bar Keep/Cancel flow).
  - `install-smoke` workflow that boots WordPress + WP Desktop Mode in CI, installs `odd.zip`, and asserts core entry points.
  - Playground / blueprint / release-zip uptime probe (every 30 minutes), opens a `uptime-auto` GitHub issue on failure.
  - Husky pre-commit hook (version check, validators, Vitest, `phpcs` on staged PHP).
  - `CHANGELOG.md` + `odd/bin/release-notes` for machine-readable release bodies. PR template + `.github/CODEOWNERS`.

### Fixed
- Installed apps without React now paint an in-iframe banner instead of rendering blank.
- _Shipped across 1.5.0 – 1.5.8._

<a id="v1.4.0"></a>
## [1.4.0] — 2026-04-26

### Changed
- **New widgets.** Replaced the "Now Playing / Postcard / Clock" set with **Sticky Note** (persists via `localStorage`) and **Magic 8-Ball**.

### Fixed
- Installed apps no longer paint blank: React + `wp-element` hydration and `/odd-app/<slug>/` routing hardened.
- _Shipped across 1.4.0 – 1.4.6 with incremental app-runtime hardening._

<a id="v1.3.2"></a>
## [1.3.2] — 2026-04-26

### Added
- **Screensaver option**, **Rainfall** wallpaper scene (collision-aware via `wp.desktop.getWallpaperSurfaces()`), and **click-to-preview** on both scene and icon-set cards with a floating preview bar.

### Fixed
- Installed apps actually open; odd-border artefact around icons removed.

<a id="v1.2.0"></a>
## [1.2.0] — 2026-04-26

### Added
- **10 new wallpaper scenes and 10 new icon sets** (ODD's content doubled in one drop).

### Changed
- Catalog install flow redesigned with surfaced install errors; the `.odd` extension retired in favour of `.wp`.
- About tab redesigned with a funky title card.

<a id="v1.1.0"></a>
## [1.1.0] — 2026-04-25

### Added
- **Self-hosted catalog** at `odd.regionallyfamous.com` with Playground-compatible CORS mirrors.
- **Iris Observatory** wallpaper scene.
- **Extension API documentation** covering the Apps subsystem, filters, events, registries, lifecycle phases, and the debug inspector.

### Fixed
- Dock icons render on first paint — no more reload when switching icon sets. Empty Apps catalog + missing desktop icons on fresh installs.
- _Shipped across 1.1.0 – 1.1.4 as catalog hosting stabilized._

<a id="v1.0.0"></a>
## [1.0.0] — 2026-04-25 — Absorb Bazaar

### Added
- **Apps subsystem absorbed from the standalone Bazaar plugin.** `odd_apps_*` PHP API, sandboxed `/odd-app/<slug>/` windows, catalog install + upload install. ODD now ships wallpapers, icon sets, **and** apps in one plugin.
- Passes WordPress Plugin Check.
- _Shipped across 1.0.0 – 1.0.8 as catalog + install flows hardened._

---

Earlier `v0.x` releases are intentionally omitted from this changelog;
the repository history is the record of those iterations.

<!--
Release-notes consumers (odd/bin/release-notes) look for the literal
`<a id="vX.Y.Z"></a>` anchor followed by the corresponding `## [...]`
heading. Please keep that pairing intact when adding new releases.
-->
