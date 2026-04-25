# Architecture

> Status: v1.0.8. Mirrored to the
> [Architecture](https://github.com/RegionallyFamous/odd/wiki/Architecture)
> wiki page.

## File tree

```
odd/
├── odd.php                          main bootstrap + ODD_VERSION constant
├── includes/
│   ├── enqueue.php                  odd / odd-panel / odd-gear / odd-apps script handles
│   ├── rest.php                     /odd/v1/prefs (GET+POST)
│   ├── migrate.php                  activation-time b-roll → odd migration (idempotent)
│   ├── migrations.php               versioned per-user migration runner (odd_schema_version)
│   ├── native-window.php            wp_register_desktop_window('odd', ...)
│   ├── wallpaper/
│   │   ├── registry.php             scenes.json reader + slug helpers
│   │   └── prefs.php                per-user pref getters (odd_wallpaper_*)
│   ├── icons/
│   │   ├── registry.php             scans assets/icons/*/manifest.json, tints SVGs
│   │   └── dock-filter.php          wp_desktop_dock_item + wp_desktop_icons @ priority 20
│   └── apps/
│       ├── bootstrap.php            feature flag + require_once list
│       ├── storage.php              odd_apps_index + odd_app_{slug} helpers + .htaccess
│       ├── loader.php               zip validate + extract pipeline
│       ├── registry.php             install / uninstall / enable / list + odd_app_registry
│       ├── rest.php                 /odd/v1/apps/* routes
│       ├── native-surfaces.php      per-app desktop icon + native window registration
│       ├── core-controller.php      curated catalog + install-from-catalog
│       ├── bazaar-compat.php        bazaar/v1/* → odd/v1/apps/* forwarder
│       └── migrate-from-bazaar.php  one-shot Bazaar → ODD migration
├── src/
│   ├── gear.js                      floating gear pill (bottom-left) → opens 'odd' window
│   ├── panel/
│   │   └── index.js                 native-window render callback (sidebar + sections)
│   ├── wallpaper/
│   │   ├── index.js                 boot + registerWallpaper('odd') + shared mount runner
│   │   ├── picker.js                legacy in-canvas picker (hidden, kept for fallback)
│   │   ├── audio.js  easter-eggs.js
│   │   ├── scenes.json  drifters.json
│   │   └── scenes/*.js              self-registering scene modules
│   └── apps/
│       └── window-host.js           iframe injector + odd.app-* event re-emitter
├── apps/
│   └── catalog/
│       ├── registry.json            curated catalog (built-in + remote)
│       └── bundles/*.wp             bundled catalog archives
├── assets/
│   ├── wallpapers/  previews/  cutouts/  atlases/  drifters/
│   └── icons/
│       └── <slug>/                  manifest.json + 13 SVGs
└── bin/
    ├── build-zip                    → dist/odd.zip
    ├── validate-scenes
    ├── validate-icon-sets
    └── check-version
```

Extracted app bundles (installed by users) live **outside** the plugin
at `wp-content/odd-apps/<slug>/` so they survive plugin reinstalls.

## Single-window contract

Both the floating gear (`src/gear.js`) and the registered desktop icon
(`includes/native-window.php`) call `wp.desktop.registerWindow({ id:
'odd', baseId: 'odd', ... })`. WP Desktop's window manager reuses any
window with a matching `baseId`, so there's always at most one Control
Panel on screen.

The panel body renders from `window.wpDesktopNativeWindows.odd = body
=> { … }` in `src/panel/index.js`. Layout is a fixed-width sidebar
(Wallpaper / Icons / Apps / About) + a scrollable content pane. All
state flows through REST.

Apps break the single-window rule intentionally: each installed app
registers its own `baseId: 'odd-app-<slug>'` window, so users can have
the Control Panel plus any number of app windows open simultaneously
(still capped to one window per app).

## Single REST namespace (core)

`POST /wp-json/odd/v1/prefs` accepts any subset of:

| Key             | Shape                                                       | Written to           |
|-----------------|-------------------------------------------------------------|----------------------|
| `wallpaper`     | scene slug, validated against `odd_wallpaper_scene_slugs()` | `odd_wallpaper`      |
| `favorites`     | `slug[]` capped to 50                                       | `odd_favorites`      |
| `recents`       | `slug[]` capped to 12                                       | `odd_recents`        |
| `shuffle`       | `{ enabled: bool, minutes: 1..240 }`                        | `odd_shuffle`        |
| `audioReactive` | bool                                                        | `odd_audio_reactive` |
| `iconSet`       | set slug or `"none"`                                        | `odd_icon_set`       |

`GET /wp-json/odd/v1/prefs` returns the user's prefs plus the catalog
of installed scenes and icon sets so the panel can hydrate without
re-fetching. Permission callback is `is_user_logged_in`. The panel
also ships the same state inlined via `wp_localize_script( 'odd-panel',
'odd', … )` so first paint doesn't wait on a round-trip.

The Apps feature adds a second REST surface under
`/odd/v1/apps/*` — documented in [Apps REST API](app-rest-api.md).
Both surfaces share the same `odd/v1` namespace and the same
"logged-in user" baseline, with per-endpoint capability escalation
where needed.

## Live scene swaps

Panel clicks fire `wp.hooks.doAction( 'odd/pickScene', slug )` in
parallel with the REST POST. The wallpaper engine subscribes under the
`odd/wallpaper` namespace and swaps the scene immediately — same
transition contract as the legacy picker, no reload.

## Icon swaps (server-canonical)

Icon-set changes trigger a 180 ms fade + `window.location.reload()`
after the POST succeeds. Re-render happens server-side through two
filters in `includes/icons/dock-filter.php`:

- `wp_desktop_dock_item` (priority 20, 2-arg): per-tile swap keyed by
  `odd_icons_slug_to_key( $menu_slug )`, e.g. `edit.php` → `posts`.
  Falls back to the set's `fallback` icon when a set ships no specific
  match.
- `wp_desktop_icons` (priority 20): re-skins desktop shortcuts by the
  same key logic, but skips the ODD Control Panel icon itself so its
  gear stays recognizable regardless of the active set.

Why server-canonical: the v0.1.4 lesson from the legacy `b-roll-icons`
plugin was that `data-menu-slug` on dock DOM is the sanitized CSS ID
(`menu-posts`), not the raw menu slug (`edit.php`) — client-side DOM
surgery was unreliable. Don't regress.

## Icon accent pipeline

Every icon set declares an `accent` hex in its manifest. For sets whose
SVGs opt in by using `stroke="currentColor"` / `fill="currentColor"`:

1. `odd_icons_tint_svg_data_uri()` in `includes/icons/registry.php`
   reads the SVG, substitutes `currentColor` with the manifest hex,
   returns a `data:image/svg+xml;utf8,…` URI.
2. `odd_icons_get_sets()` returns tinted data URIs in the `icons` map
   instead of plain URLs.
3. Dock + desktop-icon filters and the panel thumb grid all consume
   the same field — one manifest edit retints the entire set.

Sets that hardcode hex in their SVGs (e.g. the legacy `code-rain`)
return plain URLs and are unaffected. Mixed-style sets "just work".

Why data URIs: WP Desktop renders icons via `<img>`, and browsers
sandbox `<img>`-loaded SVGs — CSS variables on the surrounding page
can't reach inside. Baking the accent into the SVG payload is the
only reliable way to make one `accent` value actually drive the paint.

## Scene module API

Every `odd/src/wallpaper/scenes/<slug>.js` self-registers:

```js
( function () {
    'use strict';
    window.__odd = window.__odd || {};
    window.__odd.scenes = window.__odd.scenes || {};
    var h = window.__odd.helpers;

    window.__odd.scenes[ '<slug>' ] = {
        setup:         function ( env ) {},               // required
        tick:          function ( state, env ) {},        // required; env.dt clamped to 2.5
        onResize:      function ( state, env ) {},        // optional
        cleanup:       function ( state, env ) {},        // optional
        stillFrame:    function ( state, env ) {},        // optional — reduced-motion pose
        transitionOut: function ( state, env, done ) {},  // optional
        transitionIn:  function ( state, env ) {},        // optional
        onAudio:       function ( state, env ) {},        // optional — only when env.audio.enabled
        onEgg:         function ( name, state, env ) {},  // 'festival' | 'reveal' | 'peek'
    };
} )();
```

`env` carries `{ app, PIXI, ctx, helpers, dt, parallax: {x,y},
reducedMotion, tod, todPhase, season, audio: {enabled, level, bass,
mid, high}, perfTier: 'high'|'normal'|'low' }`. Scenes that ignore new
fields are unaffected.

The shared mount runner in `src/wallpaper/index.js` owns:

- Pixi app creation (`await app.init`, `app.canvas`)
- The `wp-desktop.wallpaper.visibility` subscription +
  `document.visibilitychange` pause
- Per-minute `env.tod` recompute, rolling-FPS `env.perfTier` sampler
- The chaos-cast overlay (two random `weird: true` drifters from
  `drifters.json` per swap)
- The shuffle scheduler (every `odd_shuffle.minutes`)
- Audio analyser sampling

Swap-in-place: the same `PIXI.Application` is reused across scene
swaps. `app.stage.removeChildren()` runs between swaps; scenes must
tolerate a fresh-but-reused app. Anything allocated outside the Pixi
scene graph (timers, `window` listeners) belongs in `cleanup`.

## Pixi v8 conventions

- `new PIXI.Application()` + `await app.init({ … })` — v7 constructor
  options don't work.
- `app.canvas`, not `app.view`.
- Fluent Graphics: `g.rect(…).fill({…})`,
  `g.moveTo().lineTo().stroke({…})`.
- `app.ticker.add( ticker => { const dt = ticker.deltaTime } )` —
  callback receives a `Ticker`, not a number.
- Bloom layers: `h.makeBloomLayer(PIXI, strength)` returns a
  `Container` with `blendMode='add'` + `BlurFilter`.
- Teardown: `app.destroy(true, { children: true, texture: true })` —
  the shared runner does this.

`ticker.deltaTime` after a backgrounded tab can be huge. The runner
clamps it to 2.5 before `tick` receives it.

## Apps subsystem

> Added in v0.16.0; Bazaar migration landed in v0.17.0. The three
> app-authoring pages live separately:
> [Building an App](building-an-app.md),
> [App Manifest Reference](app-manifest.md),
> [Apps REST API](app-rest-api.md).

### High-level flow

```
Upload .odd / .wp
  → odd_apps_validate_archive()     ZIP integrity, limits, forbidden exts,
                                    path traversal, symlinks, manifest shape
  → odd_apps_extract_archive()      unzip to .tmp-<slug>-<rand>/, symlink sweep,
                                    atomic rename into wp-content/odd-apps/<slug>/
  → odd_apps_install()              write odd_apps_index + odd_app_<slug>,
                                    fire odd_app_installed action,
                                    re-apply manifest.extensions
  → native-surfaces.php (init)      wp_register_desktop_window('odd-app-<slug>'),
                                    wp_register_desktop_icon('odd-app-<slug>')

User double-clicks the desktop icon
  → WP Desktop opens odd-app-<slug> window
  → native-surfaces renders a <div class="odd-app-host"
     data-odd-app-src="…?_wpnonce=<fresh>">
  → src/apps/window-host.js sees odd.window-opened with a matching id,
     injects an <iframe sandbox="allow-scripts allow-forms allow-popups
     allow-same-origin allow-downloads"> pointing at the serve URL,
     re-emits odd.app-opened
```

### Storage model

Two-tier options, matching Bazaar's proven shape:

| Option                    | Autoload | Purpose                                                |
|---------------------------|----------|--------------------------------------------------------|
| `odd_apps_index`          | no       | Flat `{ slug => index_row }`. Fast path for listing.   |
| `odd_app_<slug>`          | no       | Full manifest + runtime fields for one app.            |
| `odd_apps_shared_secret`  | no       | Optional shared secret (carried over from Bazaar).     |
| `odd_apps_install_lock_<slug>` | no  | Transient lock — `add_option` guard against concurrent installs. |

The index is the fast path for listing installed apps; the per-slug
option carries the full manifest (including `extensions`) and is only
read when the app is served or its details pane opens.

No custom tables. Migrations are per-user, run via the
`odd_migrations` filter → `includes/migrations.php` pipeline.

### File layout on disk

```
wp-content/odd-apps/
├── .htaccess                        “Require all denied” / “Deny from all”
├── <slug>/                          extracted bundle — manifest.json + assets
└── .tmp-<slug>-<rand>/              transient staging dir (removed after extract)
```

`.htaccess` is written by `odd_apps_ensure_storage()` on first install
and blocks direct HTTP access. Every app file must go through the REST
serve endpoint so capability + forbidden-extension checks apply per
request.

### File serving

`GET /odd/v1/apps/serve/<slug>/<path>` (see
[Apps REST API](app-rest-api.md#get-appsserveslugpath)):

1. Permission callback: logged-in + app exists + app enabled +
   `current_user_can( $manifest.capability )`.
2. Path validation: reject `..`, leading `/`, NUL bytes, and anything
   outside `[a-zA-Z0-9._/-]`.
3. Extension re-check against the forbidden list (belt-and-braces;
   the manifest can't sneak a `.php` entry past validation).
4. `realpath()` confinement to the app's own base directory.
5. `readfile()` with headers: `X-Content-Type-Options: nosniff`,
   `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`,
   `Cache-Control` via `nocache_headers()`, `Content-Type` from a
   small MIME table.

Output buffers are drained before `readfile()` so a stray debug notice
or `admin_head` echo never corrupts the response body.

### Icon endpoint

`GET /odd/v1/apps/icon/<slug>` is the **only public Apps endpoint** —
intentionally, because `<img src>` tags cannot send an `X-WP-Nonce`
header, and dock / desktop icons are already public branding. Only
the manifest's declared icon path is served (no client-supplied path
is ever honored), with a long public cache header.

### Iframe nonce handoff

`native-surfaces.php` appends a fresh `?_wpnonce=<wp_rest_nonce>` to
the iframe's `src`. Apps read it once with
`new URLSearchParams( window.location.search ).get( '_wpnonce' )` and
include it as `X-WP-Nonce` on outgoing `fetch()` calls to
`/wp-json/...`. Same convention Bazaar used; nonces are user-scoped
and expire after 12 hours.

### Native window + desktop icon registration

An `init` handler (guarded by `function_exists(
'wp_register_desktop_window' )` so a missing WP Desktop install fails
closed rather than fatal) iterates every enabled app and registers two
things:

- `wp_register_desktop_window( 'odd-app-<slug>', { template, width,
  height, min_width, min_height, icon, title } )` — `template` is a
  closure rendering a minimal mount-point `<div>`. Dimensions default
  to 860×600 (min 420×320) and can be overridden by `manifest.window`.
- `wp_register_desktop_icon( 'odd-app-<slug>', { title, icon, window,
  position } )` — `position` defaults to 200 and can be overridden
  by `manifest.desktopIcon.position`.

Both IDs are prefixed `odd-app-` so the dock-filter knows to skip them
when re-skinning icon sets (ODD-native chrome, not WP admin menu
icons).

### `manifest.extensions` re-application

On every pageload (`init` priority 6), `odd_apps_apply_manifest_extensions`
walks every enabled app's manifest and forwards each
`extensions.<registry>[]` entry to the matching `odd_register_*()`
helper:

| manifest key        | Helper                              |
|---------------------|-------------------------------------|
| `muses`             | `odd_register_muse()`               |
| `commands`          | `odd_register_command()`            |
| `widgets`           | `odd_register_widget()`             |
| `rituals`           | `odd_register_ritual()`             |
| `motionPrimitives`  | `odd_register_motion_primitive()`   |

Each registration is tagged `source: "app:<slug>"` so the debug
inspector can distinguish app-sourced entries from core / plugin ones.
Malformed entries are skipped silently — a broken manifest must never
crash the admin.

### Catalog + remote install

`odd/apps/catalog/registry.json` ships a curated list. Entries flagged
`builtin: true` are available for in-place install from
`odd/apps/catalog/<slug>/`; the rest carry a `download_url` that
`/odd/v1/apps/install-from-catalog` fetches via `download_url()`,
validates, and feeds through the normal `odd_apps_install` pipeline.

Remote downloads are HTTPS-only by default (override for dev hosts with
the `odd_apps_allow_insecure_catalog` filter) and every URL goes
through the `odd_apps_catalog_download_url` filter so enterprise
deployments can enforce a host allowlist.

### Bazaar compat shim

When `ODD_BAZAAR_COMPAT` is true (default),
`includes/apps/bazaar-compat.php` registers `bazaar/v1/*` routes that
repackage the request and dispatch a nested `WP_REST_Request` at the
matching `odd/v1/apps/*` route — so capability checks, nonces, and
edge cases all resolve in exactly one place. See the
[compatibility table in the REST docs](app-rest-api.md#bazaar-compatibility-shim).

### Bazaar migration (one-shot)

`includes/apps/migrate-from-bazaar.php` is registered as schema
migration #3 via the `odd_migrations` filter. On the first admin
pageload after an upgrade:

1. Detect Bazaar by probe-testing `wp-content/bazaar/` and the
   `bazaar_index` option.
2. Copy every `bazaar/<slug>/` directory with a readable
   `manifest.json` into `wp-content/odd-apps/<slug>/` (copy, not
   rename, so a partial migration can't corrupt the Bazaar tree).
3. Rewrite `bazaar_index` → `odd_apps_index` and each
   `bazaar_ware_<slug>` → `odd_app_<slug>`, dropping any
   `license.*` fields (ODD's license model is out of scope).
4. Copy `bazaar_shared_secret` → `odd_apps_shared_secret` if set.
5. Deactivate the Bazaar plugin (don't delete it — admin can do that).
6. Show a one-time admin notice pointing at the new Apps tab.

A `odd_apps_bazaar_migration_lock` option guards against two
simultaneous admin pageloads racing the copy.

### Sandbox details

Every app iframe is sandboxed with:

```
sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-downloads"
referrerpolicy="no-referrer"
allow="clipboard-read; clipboard-write; fullscreen"
```

`allow-top-navigation` and `allow-modals` are **intentionally
excluded** — apps can't redirect the parent page, and
`alert()`/`confirm()`/`prompt()` are no-ops. Build your own modal UI
in-app.

`allow-same-origin` is required for cookie auth on REST calls, but
it means apps are not fully isolated from the host origin. Install
apps only from sources you trust, the same way you would a WordPress
plugin.

## Migration from b-roll / b-roll-icons

ODD replaced two earlier plugins, `b-roll` (wallpapers) and
`b-roll-icons` (dock icons). An activation-time migration in
`includes/migrate.php` copies every `b_roll_*` / `b_roll_icons_set`
user_meta key into the matching `odd_*` key non-destructively, and
rewrites each user's `wpdm_os_settings.wallpaper` from `'b-roll'` to
`'odd'` so WP Desktop picks up the renamed wallpaper.

GitHub keeps a permanent redirect from the old
`RegionallyFamous/b-roll` repo so historical Playground links keep
working — but new content should always use the canonical
`RegionallyFamous/odd` URL.
