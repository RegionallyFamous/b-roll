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

<a id="v3.6.7"></a>
## [3.6.7] — 2026-04-30

### Changed
- **Safer installs and catalog browsing.** ODD now keeps installer-only catalog
  details behind admin access, verifies catalog entries match the bundle being
  installed, and prevents duplicate refresh/install work from slowing the admin.
- **Stronger asset safety.** Icon and cursor bundles now use stricter passive-SVG
  validation before they can be installed.
- **Better support diagnostics.** Copy Diagnostics now includes clearer catalog,
  content, cursor, and app health signals so problems are easier to identify.

<a id="v3.6.6"></a>
## [3.6.6] — 2026-04-29

### Fixed
- **Custom cursors feel consistent on clickable controls.** Buttons and other
  interactive admin elements now keep the active themed pointer instead of
  falling back to the browser default.

<a id="v3.6.5"></a>
## [3.6.5] — 2026-04-29

### Changed
- **Oddlings cursors are larger, clearer, and fully themed.** Every cursor state
  now has custom art and updated hotspots, making the starter theme easier to see
  across the desktop and wp-admin.

### Fixed
- **Cursor themes apply more reliably** across the Desktop Mode shell, classic
  admin, and ODD app frames.

<a id="v3.6.4"></a>
## [3.6.4] — 2026-04-29

### Fixed
- **Playground and browser compatibility for cursor themes** is improved so the
  demo can load themed cursor assets cleanly over HTTPS.

<a id="v3.6.3"></a>
## [3.6.3] — 2026-04-29

### Fixed
- **Deactivation is safer.** If ODD is turned off, users are returned to the host
  desktop wallpaper instead of being left on an ODD-only wallpaper setting.

<a id="v3.6.2"></a>
## [3.6.2] — 2026-04-29

### Fixed
- **Cursor asset URLs now respect the current site scheme** across normal sites,
  tests, and proxied Playground sessions.

<a id="v3.6.1"></a>
## [3.6.1] — 2026-04-29

### Fixed
- **First launch is more dependable.** ODD now registers its wallpaper and themed
  assets early enough for fresh Playground and starter-pack sessions to open to a
  usable desktop.

<a id="v3.6.0"></a>
## [3.6.0] — 2026-04-29

### Added
- **Cursor themes.** ODD now treats cursors like wallpapers and icon sets: browse
  them in the Shop, install them from catalog cards, preview before applying, and
  keep the choice per user.
- **Classic admin theming.** The selected cursor theme carries through Desktop
  Mode and classic wp-admin chrome while leaving the public front end alone.
- **Starter content feels cohesive.** Fresh installs now start with matching
  Oddlings wallpaper, icons, and cursors.

<a id="v3.5.10"></a>
## [3.5.10] — 2026-04-28

### Fixed
- **App desktop shortcuts** now keep their app-specific icon even when an
  ODD icon set is active. The icon-set filter already left the taskbar/native
  window icon alone; it now skips `odd-app-*` desktop shortcuts too.
- **Preview hero button hover** stays white instead of switching to the amber
  hover treatment.

<a id="v3.5.9"></a>
## [3.5.9] — 2026-04-28

### Fixed
- **App install cards are clearer.** Freshly installed apps now show the right
  next step in the Shop, and install failures include useful troubleshooting
  copy instead of a generic error.

<a id="v3.5.8"></a>
## [3.5.8] — 2026-04-28

### Fixed
- **Repair diagnostics are more reliable** when checking app asset references.

<a id="v3.5.7"></a>
## [3.5.7] — 2026-04-28

### Fixed
- **Reliability test coverage is stronger** for app surface registration and
  repair reports.

<a id="v3.5.6"></a>
## [3.5.6] — 2026-04-28

### Fixed
- **Degraded-mode activation** now works when WP Desktop Mode is missing.
  ODD still clearly warns admins and pauses desktop integrations, but no
  longer uses WordPress's `Requires Plugins` header because that prevents
  activation before ODD's own dependency guards and recovery UI can run.

<a id="v3.5.5"></a>
## [3.5.5] — 2026-04-28

### Added
- **More resilient catalog installs.** ODD keeps using the last known good or
  bundled catalog when the remote catalog is unavailable, and Copy Diagnostics
  now explains which catalog source is active.
- **Self-healing apps.** Catalog-owned apps can repair missing files by
  re-downloading their verified bundle, with admin-visible repair history.
- **Safer troubleshooting.** Admins can inspect app install health before running
  any repair action.

### Changed
- Catalog installs now require `sha256` by default, retry temporary network
  failures, and use expiring locks so one bad request cannot block future
  installs.
- Starter-pack recovery now prefers usable cached or bundled catalog data and
  reports clearer next actions.

### Fixed
- App desktop and taskbar icons now stay app-specific instead of falling back to
  generic chrome.

<a id="v3.5.4"></a>
## [3.5.4] — 2026-04-28

### Changed
- **Spotify Embed is easier to recognize in the Shop** with a custom mini-player
  storefront card instead of a generic letter tile.

### Fixed
- **Spotify Embed opens with useful content** on first launch instead of an empty
  setup form.
- **Adding a widget to the desktop is more dependable** even when it was already
  enabled.

<a id="v3.5.3"></a>
## [3.5.3] — 2026-04-28

### Fixed
- **Installed cards keep their storefront art.** Widgets, apps, and scenes now
  preserve their catalog thumbnails after install, so the Shop feels consistent
  before and after you add something.

<a id="v3.5.2"></a>
## [3.5.2] — 2026-04-28

### Fixed
- **Sticky Note and Magic 8-Ball look polished on the desktop.** Widget styles
  now load with the widget script, preserving their intended layout, animation,
  and controls.

<a id="v3.5.1"></a>
## [3.5.1] — 2026-04-28

### Changed
- **App icons sit on the same dock/desktop tile as ODD and Code.** The
  plate-stripping CSS was originally written so themed icon sets (which
  ship their own backplate) wouldn't render tile-on-tile, but it was
  catching installed app icons too — leaving them as bare glyphs floating
  over the wallpaper. Apps now keep the dark glass tile, so the dock and
  desktop read as one coherent grid instead of a mix of tiles and
  stickers.
- **Flipping a per-app surface toggle no longer bounces the page.** The
  Shop used to do a 180 ms fade + `window.location.reload()` every time
  you toggled "Desktop icon" or "Taskbar icon" on an installed app,
  which felt like a hard reset. The preference now saves immediately
  and flips the card's action to "Reload to apply" — same pattern as a
  fresh install — so you pick when to take the reload.
- **"Taskbar pill" → "Taskbar icon".** Cleaner label, matches the
  Desktop icon toggle next to it.

<a id="v3.5.0"></a>
## [3.5.0] — 2026-04-28

### Added
- **Unified Shop search.** The topbar search now searches across
  wallpapers, icon sets, widgets, and apps at once, then groups matches
  by department so users do not need to know where a bundle lives before
  they search.
- **Subtle ODD Shop sound effects.** Browsing, previewing, installing,
  and success/error states now play tiny generated Web Audio cues after
  user interaction. A new local **Shop sound effects** setting lets users
  turn the cues off without affecting wallpaper audio-reactive scenes.
- **Spotify Embed widget.** The first-party catalog now includes a
  third widget that accepts Spotify playlist, album, track, artist, show,
  and episode URLs and renders Spotify's official embedded player on the
  desktop.

### Changed
- **Icon-set catalog previews now share a dark stage.** The Shop and
  generated catalog tiles strip each set's preview background so icon
  packs compare by glyph style and color instead of by mismatched tile
  backplates.
- **Preview button hover polish.** Preview CTAs now use a warmer staging
  tint that matches the amber preview state instead of the generic gray
  hover treatment.

<a id="v3.4.0"></a>
## [3.4.0] — 2026-04-27

### Added
- **Personality pass across the whole catalog.** Every scene and every
  icon set now leans harder into its own voice.
  - Each of the 17 pre-existing icon sets grew one or two tile-surface
    tells that read at dock/taskbar size without breaking glyph
    recognition: arcade coins show relief cracks and a bent-coin variant,
    arctic tiles grow frost from a corner, blueprint gains margin
    rulers and coffee rings, claymation carries fingerprints, cross-stitch
    skips a stitch, eyeball-avenue sprouts bloodshot veins, filament
    kinks, fold tears at the edges, hologram scratches and peels,
    lemonade-stand drips a crayon, monoline lifts a sticker edge,
    risograph smudges an ink pass, stadium frays a pennant, tiki burns
    its wood, and more. All via new tell emitters in
    `_tools/regen-icon-set.py`.
  - Every one of the 19 pre-existing scenes got one hand-coded Pixi
    signature motif inside its tick: a luminous jellyfish bloom in
    `abyssal-aquarium`, shooting stars in `aurora`, a cat silhouette
    panning a window in `balcony-noon`, a rolling beach ball in
    `beach-umbrellas`, a V-formation of birds in `big-sky`, a ladybug
    walking a trace in `circuit-garden`, a paper airplane in
    `cloud-city`, an ink-drop splash in `flux`, a pulsing iris lens in
    `iris-observatory`, confetti bursts in `mercado`, a breathing
    origami shape in `origami`, a blinking portal in `pocket-dimension`,
    silent heat-lightning in `rainfall`, a sun-shifted silhouette in
    `sun-print`, a rotating chip in `terrazzo`, a hermit-crab scuttle in
    `tide-pool`, a mist puff in `tropical-greenhouse`, a "wrong weather"
    flurry in `weather-factory`, and a butterfly landing in
    `wildflower-meadow`. All perf-tier-aware (skipped on `low`) and
    reduced-motion friendly.
- **New default: weird-first `oddlings` icon tweaks + Oddling
  personality continuity.** The Oddlings set and Oddling Desktop scene
  (introduced in 3.3.0) now sit inside a catalog where the rest of the
  bundles also have personality, so the default doesn't feel like the
  only opinionated option.
- **`_tools/wallpaper-prompts-v2.json`** — a new prompt archive that
  pushes saturation, reserves negative-space slots for the Pixi motifs,
  bakes in a signature ODD detail per scene (iris-shaped clouds,
  eye-shaped bubbles, a specimen ceramic cat, etc.), and keeps the
  "no text, no logos, no people" guardrails.

### Changed
- **Every scene wallpaper repainted via gpt-image-2 from v2 prompts.**
  All 20 scene `wallpaper.webp` / `preview.webp` pairs were regenerated
  at high quality with stronger art direction and explicit negative
  space where each new motif lands. `_tools/gen-wallpaper.py` now also
  mirrors output into `_tools/catalog-sources/scenes/<slug>/` so the
  catalog bundle picks up regenerations without a separate copy step.
- **Scene `meta.json` descriptions rewritten.** The placeholder
  "<Label> — a painted ODD wallpaper scene." line has been replaced with
  a specific one-liner on every scene that tells the user what they'll
  see and which signature moment to watch for.
- **Icon-set `manifest.json` descriptions polished** to reflect the new
  surface tells.
- **`regen-icon-set.py --all` now skips `oddlings`** so the hand-authored
  creature badges aren't stomped by the generic fallback renderer. The
  Oddlings set still rebuilds via `_tools/gen-oddling-desktop.py`.

### Fixed
- **Wallpaper fallback still prefers Oddling Desktop** when the starter
  pack hasn't resolved yet, with the new repainted Flux as a second
  fallback.
- **The Code taskbar icon now matches its themed desktop icon.** ODD
  mirrors the filtered desktop shortcut icon into Desktop Mode's
  `nativeWindows[]` taskbar entry for `wpdc-editor`.
- **ODD-owned desktop and taskbar icons no longer get extra chrome.**
  The contrast CSS strips the leftover glass plate and padding around
  self-contained ODD icon artwork.

<a id="v3.3.0"></a>
## [3.3.0] — 2026-04-27

### Added
- **New default bundle: Oddling Desktop + Oddlings.** A matched scene and
  icon set ship as the ODD starter pack so first-boot says "this plugin
  has a personality" immediately.
  - `oddling-desktop` paints a plum CRT terrarium: slow-drifting
    specimen silhouettes with pinprick blinking eyes, translucent
    file-tabs riding a shallow vector drift, and rare peek-eyes that
    blink into the edges and recede. Audio reactive (bass speeds the
    drift, treble fires a cyan scanline flare). Reduced-motion parks
    specimens half-lidded; perf-low halves populations and skips the
    halo bloom layer.
  - `oddlings` delivers 13 Dashicons-readable admin icons on a
    specimen-plum glass base, each wearing a single creature trait
    (eyes, teeth, antennae, slit pupil, tongue) so the set reads as
    recognizable first, weird second.
  - `_tools/gen-oddling-desktop.py` is a deterministic generator for
    both the icon SVGs and the wallpaper/preview WebPs so the default
    is re-buildable from source without external tooling.

### Changed
- **Settings cards span the full content width.** The preference grid
  in Settings is now a single column so every card gets the same
  breathing room instead of awkwardly doubling up.
- **App card management controls read cleanly.** Desktop icon / Taskbar
  pill toggles use a dedicated panel with proper label/hint spacing,
  rounded pills, and a tinted background so they stop looking squished.
- **Wallpaper fallback prefers Oddling Desktop.** When the starter
  pack has not resolved yet, `odd_wallpaper_default_scene()` now
  chooses `oddling-desktop` before falling back to `flux`.

<a id="v3.2.5"></a>
## [3.2.5] — 2026-04-27

### Fixed
- **The ODD Shop taskbar launcher now defaults on.** Users with no saved
  `shopTaskbar` preference get the taskbar item automatically, while an
  explicit off value is still respected.

<a id="v3.2.4"></a>
## [3.2.4] — 2026-04-27

### Fixed
- **The ODD Shop launcher setting now targets the taskbar, not the dock.**
  Settings writes `shopTaskbar` / `odd_shop_taskbar`, and the native window
  registers with `placement: 'taskbar'`.

<a id="v3.2.3"></a>
## [3.2.3] — 2026-04-27

### Changed
- **Install cards and catalog artwork are easier to scan.** The "What can I install?"
  cards now use a vertical icon-first layout, icon-set catalog previews fill the art
  frame, and widgets get specific preview art instead of a generic glyph.
- **The ODD Shop taskbar launcher is now user-configurable.** Settings includes
  a "Show ODD in Taskbar" toggle backed by the new `shopTaskbar` preference.

### Fixed
- **Bundle installs no longer hard-refresh Desktop Mode.** The Shop now
  hot-registers scene/widget scripts and splices installed rows into the
  current panel state so new content appears immediately without kicking
  the user back through the Dashboard restore path. Apps that still need
  a Desktop Mode boot to register their native window show an explicit
  reload action instead of forcing it.
- **Settings keeps the Screensaver controls inside the preference grid.** The
  compact card now wraps cleanly instead of spilling across the panel.

<a id="v3.2.2"></a>
## [3.2.2] — 2026-04-27

### Changed
- **Settings is now a compact preference grid instead of a stretched
  form banner.** Shuffle, Audio-reactive, and Screensaver use the same
  card rhythm; Screensaver now lives in the grid with its controls
  stacked inside the card instead of sprawling across the panel.
- **Appearance and Tools icons now keep closer to Dashicons-style
  metaphors.** The shared icon generator now draws Appearance as a
  cleaner paintbrush mark and Tools as a simpler wrench mark, then
  regenerates those two SVGs across all 17 icon sets. The icons still
  keep each set's iOS-style treatment, but the core silhouettes are
  easier to recognize in the dock.

<a id="v3.2.1"></a>
## [3.2.1] — 2026-04-27

### Fixed
- **Catalog cards look consistent.** Remote catalog rows now use their
  storefront artwork and stay at the intended card size, even in one-item
  shelves.

<a id="v3.2.0"></a>
## [3.2.0] — 2026-04-27

### Fixed
- **Installed content appears where users expect it.** After install, the Shop
  now lands on the right department, highlights the new item, and keeps the card
  action accurate.
- **One card model across the Shop.** Wallpapers, icon sets, widgets, and apps
  now share the same card layout and action language, so browsing and using
  installed content feels predictable.
- **Fresh installs start on the ODD desktop.** Starter content now selects ODD's
  wallpaper only when the user is still on the host default.

<a id="v3.1.2"></a>
## [3.1.2] — 2026-04-27

### Fixed
- **Install cards update immediately.** Once a catalog item installs, its card
  flips to the installed state right away instead of inviting a repeat click.

<a id="v3.1.1"></a>
## [3.1.1] — 2026-04-27

### Fixed
- **Install feedback is immediate and clear.** Install buttons now show progress
  right away, recover on unexpected errors, and surface useful messages instead
  of leaving the user guessing.

<a id="v3.1.0"></a>
## [3.1.0] — 2026-04-27

### Added
- **Apps can now surface on the Desktop Mode taskbar as well as the
  desktop.** Each installed ODD App has independent per-user toggles
  in the ODD Shop for "Desktop icon" and "Taskbar pill" — you can
  have one, both, or neither. Neither still keeps the app reachable
  from `/odd-slash` commands, the Shop's Open button, and any sibling
  plugin that calls `wp.desktop.openWindow( 'odd-app-<slug>' )`. The
  taskbar path is implemented by forwarding the existing
  `desktop_mode_register_window( …, placement: 'taskbar' )` argument
  — Desktop Mode paints the pill and wires its click to the window
  manager natively; no JS click handler on ODD's side.
- **Manifest authors can declare install-time defaults** via a new
  top-level `surfaces: { desktop: bool, taskbar: bool }` object in
  `manifest.json`. Missing keys default to `{ desktop: true, taskbar:
  false }` — the historical behavior — so existing apps continue to
  install exactly as before. Users can override per-install after
  the fact in the Shop.
- **`odd_app_surfaces_changed` action** fires after a successful
  `POST /odd/v1/apps/{slug}/toggle` call that included a `surfaces`
  object. Handlers receive `( string $slug, array $surfaces )`.

<a id="v3.0.4"></a>
## [3.0.4] — 2026-04-27

### Changed
- **Starter pack is now cron-free — installs always happen inline.**
  Previously a one-shot WP-Cron event scheduled from the activation
  hook drove the first install, with `admin_init` as a safety net. On
  any site where WP-Cron couldn't tick (DISABLE_WP_CRON set, loopback
  blocked, or a freshly-activated site whose admin landed on the
  frontend desktop without ever visiting wp-admin), the starter pack
  would sit `pending` indefinitely — empty shop, no wallpaper
  defaults. 3.0.4 removes the scheduler entirely:

  - The activation hook runs `odd_starter_ensure_installed( true )`
    inline. The admin is already on a privileged request; we use it.
  - A safety-net `init` hook retries inline on any subsequent
    privileged page load (frontend or admin), gated by exponential
    backoff (0s → 30s → 2min → 10min → 1h → 6h) against
    `last_attempt` so a chronically-failing catalog doesn't thrash.
  - A running-lock (status=running, auto-expires after 240s) keeps
    concurrent admin tabs from double-installing.
  - Any pre-existing cron event from older installs is cleaned up on
    upgrade via a one-shot `wp_clear_scheduled_hook` migration.

  Net effect: freshly-activated sites are rock-solid. The same admin
  request that activates the plugin also downloads and extracts the
  starter pack, so the shop is populated before the activation
  response returns. `POST /odd/v1/starter/retry` still exists for
  manual kicks.

<a id="v3.0.3"></a>
## [3.0.3] — 2026-04-27

### Changed
- **Settings moved into their own Shop tab.** The Shuffle / Audio-reactive / Screensaver cards used to sit on top of the Wallpapers shelf, where they cluttered scene browsing and hid preferences behind a department that wasn't really about preferences. They now live in a dedicated **Settings** entry in the Shop sidebar. All three controls still write through the same `/odd/v1/prefs` endpoint (`shuffle`, `audioReactive`, `screensaver`) and the live module hooks (`window.__odd.screensaver.applyPrefs`, `odd.screensaver-prefs-changed`) are unchanged, so the REST contract and integrator surface are untouched.

<a id="v3.0.2"></a>
## [3.0.2] — 2026-04-27

### Changed
- **Discover shelf — real artwork, roomier rows.** Catalog scene tiles
  used to be generated SVGs (a single letter on a flat swatch), which
  meant every scene whose label started with the same letter looked
  identical. The builder now publishes each scene's painted
  `preview.webp` as its Discover tile and points `icon_url` at that.
  Row layout got more breathing room too — bigger 84 px tiles, 20 px
  gaps, 18 px vertical padding, tighter typography — so a Discover
  card reads as a real preview instead of a dense list row.
- **First pass at starter-pack self-heal** (fully superseded by the
  cron removal in 3.0.4). Added `spawn_cron()` on activation and
  moved the safety-net retry from `admin_init` to `init` so frontend
  page loads could also trigger it. Helped on sites where WP-Cron
  could still tick; didn't fully fix `DISABLE_WP_CRON` installs.

<a id="v3.0.1"></a>
## [3.0.1] — 2026-04-27

### Fixed
- **Installed scenes couldn't find their backdrop.** The localized
  `window.odd` config exposed `scenes` (array) but not `sceneMap` (dict),
  so installed scene bundles fell through to the hard-coded
  `pluginUrl + /assets/wallpapers/<slug>.webp` fallback — which no
  longer exists in the empty 3.0 plugin and 404'd on every swap. Added
  `sceneMap` to the localized blob so `cfg.sceneMap[slug].wallpaperUrl`
  resolves to the real `/wp-content/odd-scenes/<slug>/wallpaper.webp`.
- **ODD Shop window didn't render via the JS API.** `api.openPanel()`
  was calling `wp.desktop.registerWindow({ id: 'odd' })`, which opens
  an unthemed shell and bypasses the server-side template. The canonical
  call for server-registered native windows is
  `wp.desktop.openWindow('odd')`; openPanel now prefers that and falls
  back to `registerWindow` only on older shells.
- **Shop a11y regressions.** Three WCAG violations flagged by axe:
  - The favorite star was a `<span role="button">` nested inside the
    card `<button>` (nested-interactive, serious). Tiles now wrap the
    card and star as siblings inside an `.odd-shop__tile-wrap`.
  - The shuffle-interval and screensaver-idle inputs had no accessible
    name (label, critical). Both now carry explicit `aria-label`s.
  - The department eyebrow used `--odd-shop-accent` (#0071e3) on the
    near-white background, failing AA contrast at 11px (color-contrast,
    serious). Darkened the eyebrow to `#0050a6` (~5.9:1) without
    touching the rest of the accent-coloured UI.

### CI
- **e2e: install WP Desktop Mode from its release zip.** `trunk.zip`
  ships TypeScript sources only, so `desktop.min.js` + `pixi.min.js`
  404'd at runtime and Playwright hung waiting for `window.PIXI`. The
  workflow now installs `desktop-mode.zip` from the latest GitHub
  release (which includes the built assets).
- **e2e: force synchronous starter-pack install.** `wp server` doesn't
  tick cron reliably, so the scheduled starter install never ran and
  `__odd.scenes` stayed empty. CI now runs
  `wp eval 'odd_starter_install_now();'` up-front.
- **e2e: assert on the mounted scene instead of pixel reads.** PIXI v8
  creates canvases with `preserveDrawingBuffer: false`, so
  `gl.readPixels` outside a render pass flaked. Poll
  `window.__odd.runtime.activeScene` — only set after `impl.setup()`
  resolves — instead.

<a id="v3.0.0"></a>
## [3.0.0] — 2026-04-27

### Changed
- **The plugin is empty.** Every wallpaper, icon set, widget, and app that used to ship inside the plugin now lives in a remote catalog at [`https://odd.regionallyfamous.com/catalog/v1/registry.json`](https://odd.regionallyfamous.com/catalog/v1/registry.json). The plugin zip drops from ~1 MB to well under 500 KB and ships zero binary content. Adding new scenes / icon sets / widgets / apps no longer requires a plugin release — land them in `_tools/catalog-sources/` on `main` and the next `pages.yml` run publishes them.
- **Content is installed on demand.** The ODD Shop renders empty "Nothing installed yet" states on a cold boot and pulls catalog entries in as universal `.wp` bundles when you click Install. Downloads are verified against an SHA256 from the registry before extraction, so tampered bundles can't take the site over.
- **Starter pack on activation.** On plugin activation, ODD reads `starter_pack` from the remote registry and installs the default scene + icon set inline through the same SHA256-verified bundle pipeline the Shop uses. The first implementation scheduled a one-off cron; the 3.0.4 patch replaced that with a synchronous activation path plus a privileged `init` safety net so first-run content never depends on WP-Cron or loopback requests. State is stored in the `odd_starter_state` option; `GET /wp-json/odd/v1/starter` + `POST /wp-json/odd/v1/starter/retry` expose it.
- **Pending fallback scene.** A single built-in `odd-pending` gradient is registered statically in `src/wallpaper/index.js` so the desktop has something to paint in the window between activation and the first starter-pack install. It's hidden from the Shop catalog.
- **Unified bundle installer.** The legacy `/odd/v1/apps/catalog` and `/odd/v1/apps/install-from-catalog` endpoints are now thin compatibility shims that forward to `/odd/v1/bundles/catalog?type=app` + `/odd/v1/bundles/install-from-catalog`. `odd_apps_install_builtin()` and `odd_apps_seed_builtins()` are retained as no-ops for older callers but warn that built-in apps are retired.
- **Filter-driven registries.** `odd_wallpaper_scenes()` no longer reads a bundled `scenes.json` — it returns whatever the `odd_scene_registry` filter provides, which is populated by installed bundles via `includes/content/scenes.php`. `odd_wallpaper_default_scene()` prefers the starter pack's first scene so mid-install admin loads still see a sensible default.

### Added
- **`_tools/catalog-sources/`.** The new source of truth for every bundle. Each scene / icon set / widget / app lives in its own subdirectory with the files the builder zips into a `.wp`. A `starter-pack.json` at the root lists the slugs the first-run installer should fetch.
- **`_tools/build-catalog.py`.** Deterministic builder that walks `_tools/catalog-sources/`, produces `.wp` archives + icon SVGs with fixed mtimes and stable compression flags, and writes `site/catalog/v1/registry.json` + `registry.schema.json`. Running it twice on the same source tree produces byte-identical output.
- **`odd/bin/validate-catalog`.** Rewritten to assert schema validity, bundle file presence, ZIP integrity, manifest consistency, size + SHA256 matches between the registry and the on-disk bundles, starter-pack slug resolution, and — when `ODD_VALIDATE_REBUILD=1` — that a fresh `build-catalog.py` run is byte-identical to the committed output.
- **Catalog fetch + transient cache.** `odd_catalog_load()` in `includes/content/catalog.php` pulls `registry.json` with `wp_remote_get()`, caches it for 12 hours in the `odd_catalog` transient, and serves stale data on failure. `ODD_CATALOG_URL` + the `odd_catalog_url` filter let vendors point ODD at their own registry. `POST /odd/v1/bundles/refresh` forces a re-fetch.
- **`ci/smoke/odd-smoke-fixture.php`.** MU-plugin used only by `install-smoke.yml`. It intercepts outbound HTTP to `/catalog/v1/` paths with a `pre_http_request` filter and serves locally-built fixtures from `ODD_SMOKE_FIXTURE_ROOT`, so the smoke suite can prove the starter-pack installer works hermetically without depending on the live Pages deploy.

### Removed
- **Bundled content.** `odd/src/wallpaper/scenes/**`, `odd/src/wallpaper/scenes.json`, `odd/src/wallpaper/drifters.json`, `odd/assets/wallpapers/**`, `odd/assets/previews/**`, `odd/assets/icons/**`, `odd/apps/catalog/**`, and the stock `odd/src/widgets/index.js` + `style.css` are all gone. The Sticky Note and Magic 8-Ball widgets now live in the remote catalog.
- **Enqueue of `odd-widgets`.** The plugin no longer emits a stock widgets script/style; installed widget bundles self-enqueue through `includes/content/widgets.php`.
- **`odd/bin/validate-scenes` + `odd/bin/validate-icon-sets`.** Folded into `odd/bin/validate-catalog`.
- **`_tools/build-catalog-bundles.py`.** Replaced by `_tools/build-catalog.py`.
- **`.github/workflows/ci.yml` validate-scenes + validate-icon-sets jobs.** Replaced by `catalog-build-and-validate`.

### Breaking
- Fresh installs can see empty Shop departments for a few seconds until the starter pack resolves. Any UI that previously assumed "ODD activation == built-in scenes + icon sets on disk" will see zero of each until the remote install completes.
- `odd/bin/validate-scenes` and `odd/bin/validate-icon-sets` no longer exist; anything invoking them must switch to `odd/bin/validate-catalog`.
- The plugin zip budget (`odd/bin/build-zip`) dropped from 35 MB to 2 MB. CI fails a release that accidentally reintroduces bundled content.

<a id="v2.1.0"></a>
## [2.1.0] — 2026-04-27

### Changed
- **Follow WP Desktop Mode's `wp_desktop_*` → `desktop_mode_*` hook rename (0.5.1).** Every PHP filter, action, and registration function ODD touches has moved to the new namespace. The minimum host plugin version is now **WP Desktop Mode 0.5.1**.
  - Filters: `wp_desktop_dock_item` → `desktop_mode_dock_item`; `wp_desktop_icons` → `desktop_mode_icons`; `wp_desktop_shell_config` → `desktop_mode_shell_config`; `wp_desktop_accent_colors` → `desktop_mode_accent_colors`; `wp_desktop_toast_types` → `desktop_mode_toast_types`; `wp_desktop_default_wallpaper` → `desktop_mode_default_wallpaper`.
  - Registration functions: `wp_register_desktop_window()` → `desktop_mode_register_window()`; `wp_register_desktop_icon()` → `desktop_mode_register_icon()`; `wpdm_native_window_registry()` → `desktop_mode_native_window_registry()`.
  - Capability helpers: `wpdm_is_enabled()` → `desktop_mode_is_enabled()` (three `admin_enqueue_scripts` guards).
  - User meta keys used by the Playground blueprint + e2e harness: `wp_desktop_mode` → `desktop_mode_mode`; `wpdm_save_os_settings()` → `desktop_mode_save_os_settings()` in the OS-settings seed step.
  - PHP unit tests (`odd/tests/php/test-icons-dock-filter.php`) and CI smoke checks (`install-smoke.yml`) updated to apply / inspect the new filter names.
  - All architecture docs (`CLAUDE.md`, `docs/architecture.md`, `docs/adr/0001-icon-live-swap-server-canonical.md`) now reference the new names.

### Compatibility
- There is no shim for the old names — 0.5.1 of the host plugin removed the `wp_desktop_*` prefix entirely. Users on 0.5.0 or earlier must update WP Desktop Mode before updating ODD, otherwise the dock reskinning, accent swatches, toast tones, and native windows will silently no-op (the `function_exists()` guards degrade to "do nothing" rather than fatal).
- The JavaScript hook namespace (`wp-desktop.*` under `window.wp.hooks`) and the client globals (`wp.desktop`, `wpDesktopConfig`, `wpDesktopNativeWindows`) are **unchanged** — 0.5.1 kept those exactly as they were. ODD's widgets, commands, slash commands, wallpaper-engine visibility subscriptions, and panel-side code all continue to work with zero changes.

<a id="v2.0.2"></a>
## [2.0.2] — 2026-04-27

### Changed
- **Painted-backdrop parallax drift is gone.** The 14 GPT-painted scenes (Aurora, Balcony Noon, Big Sky, Circuit Garden, Cloud City, Flux, Iris Observatory, Origami, Pocket Dimension, Tide Pool, Tropical Greenhouse, Weather Factory, Wildflower Meadow, Abyssal Aquarium) each nudged their backdrop sprite a few pixels toward the cursor every frame. It read as "a second image on top sliding around" — distracting rather than atmospheric. Backdrops now sit perfectly still; only the foreground motion layer (rain, cranes, aurora curtains, fish, mote drift, etc.) reacts to the cursor.

<a id="v2.0.1"></a>
## [2.0.1] — 2026-04-27

### Fixed
- **Discover-shelf bundles** — the three curated remote-install examples wired into `odd/apps/catalog/registry.json#bundles[]` (`scene-rainfall`, `iconset-origami`, `widget-confetti`) were referenced from the registry but the matching `.wp` archives and catalog icons were never checked in. Every Discover → Install click on those rows 404'd. All three bundles + icon SVGs are now in-tree and ship inside `odd.zip` + `raw.githubusercontent.com`.
- **Catalog version drift** — the seven bundled apps in `registry.json` all advertised older versions than the `.wp` archives they pointed at (e.g. `mosaic` row said 1.1.0, archive said 1.2.0), which broke the `odd_bundle_catalog_is_newer` "Update available" logic. Registry rows are now pinned to the canonical archive versions.

### Added
- **`odd/bin/validate-catalog`** — Python validator that fails if any `icon_url` or `download_url` in `registry.json` that points back into this repo doesn't resolve on disk, or if any `.wp` archive's internal `manifest.json` disagrees with the registry row on `slug`, `type`, or `version`. Wired into `.github/workflows/ci.yml` (blocks merge) and `.github/workflows/release-odd.yml` (blocks release).
- **`_tools/build-catalog-bundles.py`** — deterministic builder for the three Discover bundles. Idempotent, fixed-mtime ZIPs so repeat runs produce byte-identical artifacts.

<a id="v2.0.0"></a>
## [2.0.0] — 2026-04-27

Ships the **world-class menu** plan (21 items): reliability, ecosystem, authoring, distribution, security, and polish in one major release. `ODD_VERSION` and `window.__odd.api.version` both advance to **2.0.0** — see [docs/api-versioning.md](docs/api-versioning.md).

### Reliability & observability
- **Playwright e2e** — local WordPress + Chromium: admin boot, `window.__odd`, canvas pixels, `odd/pickScene` hook.
- **Deeper install-smoke** — icon set count, widget API, native window `odd`, bundle catalog + prefs REST shape.
- **Scene perf sampler** — vitest + Pixi stub, 600 ticks per scene, `scene-perf-baseline.json` + optional `ODD_ENFORCE_PERF_BUDGETS=1` gate.
- **Local diagnostics** — `odd/src/shared/diagnostics.js`, About tab “Copy diagnostics” (zero server telemetry, [ADR 0004](docs/adr/0004-zero-server-side-telemetry.md)).

### Platform & extensibility
- **JSON Schema** — `docs/schemas/manifest.schema.json` + `odd/bin/validate-manifest` (Python + jsonschema in CI).
- **Example bundles** — `examples/` (scene, icon set, widget, app) built and installed in install-smoke.
- **`window.__odd.api.version`** — `2.0.0` in `api.js` + [docs/api-versioning.md](docs/api-versioning.md).
- **`@odd/test-harness`** + **`create-odd-bundle`** — `packages/test-harness`, `packages/create-odd-bundle` with templates.
- **CONTRIBUTING.md**, **docs/adr/**, **docs/release-policy.md**.

### Authoring & distribution
- **`npm run build:previews`** — `odd/bin/build-previews` (Playwright + Pixi CDN) for 640×360 WebP previews.
- **LICENSES.md** + `odd/bin/check-licenses` CI job.
- **Uninstall** — docstring + options sweep for `odd-scenes`, `odd-icon-sets`, `odd-widgets` indexes; per-slug `odd_scene_*` / `odd_icon_set_*` / `odd_widget_*` options.
- **i18n** — `load_plugin_textdomain` + `wp_set_script_translations` in `odd.php`; `wp-i18n` on panel/widgets/commands; `wp.i18n.__` on core Shop + widget labels; `odd/bin/make-pot` on release.
- **readme.txt** + **docs/wp-org-submission.md** for directory workflow.
- **Bundle updates** — catalog compares versions; “Update available” + `allow_update=1` reinstall; REST fields `installed_version`, `update_available`.

### Security & hardening
- **CSP** for `/odd-app/` HTML — `Content-Security-Policy` + optional manifest `csp` + `odd_app_cookieauth_csp` filter.
- **SVG scrub corpus** — `odd/tests/php/test-svg-scrub-fuzz.php` (25+ cases).
- **Rate limits** — 10 req/min per user on `POST /odd/v1/bundles/upload` and catalog install; HTTP 429; `odd/tests/php/test-rate-limit-bundles.php`.

### Polish & UX
- **Keyboard** — `?` shortcuts overlay, `/` focus search, arrow keys in sidebar; styles in `styles.css`.
- **Axe e2e** — `e2e/panel-a11y.spec.ts` with `@axe-core/playwright` (zero critical/serious on `.odd-panel`).
- **Failed install** — troubleshoot dialog with JSON payload + Copy diagnostics (item 21).

### Breaking
- **API major 2.0.0** — extension authors should confirm `window.__odd.api.version` / [api-versioning.md](docs/api-versioning.md) (surface listed there; no wholesale removal of v1 methods in this release — major signals the 2.0 product line and locked-down contracts).

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
- App windows now show a helpful in-frame message when an app cannot render.
- _Shipped across 1.5.0 – 1.5.8._

<a id="v1.4.0"></a>
## [1.4.0] — 2026-04-26

### Changed
- **New widgets.** Replaced the "Now Playing / Postcard / Clock" set with **Sticky Note** (persists via `localStorage`) and **Magic 8-Ball**.

### Fixed
- App windows open more reliably with hardened runtime loading and app routing.
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
