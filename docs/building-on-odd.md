# Building on ODD

> Status: v0.17.0 (foundation + Iris + Apps). This page is the source of truth
> for every filter, event, registry, and lifecycle phase ODD exposes.
> It's meant to be mirrored verbatim into the GitHub wiki.

ODD is a WordPress plugin layered on top of [WP Desktop Mode](https://github.com/WordPress/desktop-mode).
From v0.14.0 forward the plugin has a stable extension surface so other
plugins (and authors writing `mu-plugins`) can add scenes, icon sets,
muses, commands, widgets, rituals, and motion primitives without
touching ODD's core files.

All extension points follow WordPress conventions:

- **PHP surfaces** use `apply_filters` with well-defined registry shapes.
- **JS surfaces** use `@wordpress/hooks` actions/filters using
  dot-separated names (`odd.*`), matching WP Desktop Mode's `wp-desktop.*`
  convention.

Everything below is part of the 1.0 contract. Event names and filter
slugs are stable; the store shape is considered public.

## Quick start — register a scene

```php
add_action( 'plugins_loaded', function () {
    if ( ! function_exists( 'odd_register_scene' ) ) return;
    odd_register_scene( [
        'slug'          => 'my-scene',
        'label'         => 'My Scene',
        'franchise'     => 'Mine',
        'tags'          => [ 'custom' ],
        'fallbackColor' => '#111827',
        'added'         => '2026-05-01',
    ] );
} );
```

Ship the matching `my-scene.js`, `assets/previews/my-scene.webp`, and
`assets/wallpapers/my-scene.webp` alongside the registration, enqueue
the scene module after `odd` using `wp_enqueue_script`, and ODD will
pick it up on the next page load. No fork required.

## Lifecycle phases

Phases are monotonic — they never go backward — and each phase fires
exactly one event on `window.__odd.events`.

| Phase                  | Event name              | Fires when                                              |
|------------------------|-------------------------|---------------------------------------------------------|
| `boot`                 | `odd.boot`              | Shared modules loaded, store allocated.                 |
| `configured`           | `odd.configured`        | `window.odd` hydrated into the store.                   |
| `registries-ready`     | `odd.registries-ready`  | All JS registries populated (scenes, icon sets, etc.).  |
| `mounted`              | `odd.mounted`           | First scene painted by the wallpaper runtime.           |
| `ready`                | `odd.ready`             | Every enqueued subsystem reported in.                   |
| `teardown`             | `odd.teardown`          | Page unload / plugin shutdown.                          |

Use `window.__odd.lifecycle.whenPhase( 'ready' )` to await a phase:

```js
window.__odd.lifecycle.whenPhase( 'ready' ).then( () => {
    // Safe to touch any subsystem.
} );
```

`window.__odd.lifecycle.phase()` returns the current phase string.

## Event bus

All events live on `window.__odd.events`, a typed wrapper around
`wp.hooks`. Use the constants on `window.__odd.events.NAMES` or subscribe
by string.

```js
const off = window.__odd.events.on( 'odd.scene-changed', ( p ) => {
    console.log( 'scene', p.from, '→', p.to );
} );
// off() to unsubscribe.
```

### Canonical events

| Name                          | Payload                                    |
|-------------------------------|--------------------------------------------|
| `odd.boot`                    | `{ from, to }`                             |
| `odd.configured`              | `{ from, to }`                             |
| `odd.registries-ready`        | `{ from, to }`                             |
| `odd.mounted`                 | `{ from, to }`                             |
| `odd.ready`                   | `{ from, to }`                             |
| `odd.teardown`                | `{ from, to }`                             |
| `odd.scene-changed`           | `{ from, to }`                             |
| `odd.scene-swap-started`      | `{ from, to }`                             |
| `odd.scene-swap-completed`    | `{ from, to, ms }`                         |
| `odd.scene-mount-failed`      | `{ slug, err }`                            |
| `odd.icon-set-changed`        | `{ from, to }`                             |
| `odd.shuffle-tick`            | `{ slug }`                                 |
| `odd.window-opened`           | `{ id, bounds }`                           |
| `odd.window-closed`           | `{ id }`                                   |
| `odd.window-focused`          | `{ id, bounds }`                           |
| `odd.shell-error`             | `{ message, err }`                         |
| `odd.iframe-error`            | `{ message, err }`                         |
| `odd.visibility-changed`      | `{ state: 'hidden' \| 'visible' }`         |
| `odd.error`                   | `{ source, err, severity, message, stack }`|
| `odd.app-installed`           | `{ slug, manifest }`                       |
| `odd.app-uninstalled`         | `{ slug }`                                 |
| `odd.app-enabled`             | `{ slug }`                                 |
| `odd.app-disabled`            | `{ slug }`                                 |
| `odd.app-opened`              | `{ slug, windowId, bounds }`               |
| `odd.app-closed`              | `{ slug, windowId }`                       |
| `odd.app-focused`             | `{ slug, windowId, bounds }`               |

Emitting a custom event is fine — prefix with your plugin's slug
(`myplugin.*`) rather than `odd.*` to avoid collision.

## Registries (extension API)

Each registry is a list that ODD reads at runtime through both a PHP
filter and a JS filter. Third parties add to the list via a filter
callback; ODD never exposes a mutable global to mutate directly.

| Registry          | PHP filter                | JS filter            | Helper (PHP)              |
|-------------------|---------------------------|----------------------|---------------------------|
| Scenes            | `odd_scene_registry`      | `odd.scenes`         | `odd_register_scene`      |
| Icon sets         | `odd_icon_set_registry`   | `odd.iconSets`       | `odd_register_icon_set`   |
| Muses             | `odd_muse_registry`       | `odd.muses`          | `odd_register_muse`       |
| Commands          | `odd_command_registry`    | `odd.commands`       | `odd_register_command`    |
| Widgets           | `odd_widget_registry`     | `odd.widgets`        | `odd_register_widget`     |
| Rituals           | `odd_ritual_registry`     | `odd.rituals`        | `odd_register_ritual`     |
| Motion primitives | `odd_motion_primitive_registry` | `odd.motionPrimitives` | `odd_register_motion_primitive` |
| Apps              | `odd_app_registry`        | `odd.apps`           | `odd_register_app`        |

### PHP example

```php
add_filter( 'odd_scene_registry', function ( $scenes ) {
    $scenes[] = [
        'slug'          => 'my-scene',
        'label'         => 'My Scene',
        'franchise'     => 'Mine',
        'fallbackColor' => '#111827',
    ];
    return $scenes;
} );
```

The helper `odd_register_scene( $scene )` is a thin wrapper that wires
the filter for you. It upserts on `slug` — passing the same slug twice
updates the existing row rather than duplicating it.

### JS example

```js
wp.hooks.addFilter( 'odd.scenes', 'myplugin/extra-scene', ( scenes ) => {
    return scenes.concat( [
        {
            slug: 'my-scene',
            label: 'My Scene',
            franchise: 'Mine',
            fallbackColor: '#111827',
        },
    ] );
} );
```

Reads go through `window.__odd.registries` (`readScenes`, `readIconSets`,
`findScene`, `findIconSet`, etc.), which call `applyFilters` on every
read so late-registered callbacks are picked up.

## State store

`window.__odd.store` is the single source of truth. It's a plain object
with a typed shape:

```js
{
    user: {
        wallpaper, favorites, recents, shuffle, audioReactive, iconSet,
        schemaVersion,
    },
    registries: {
        scenes, iconSets, muses, commands, widgets, rituals,
        motionPrimitives,
    },
    runtime: {
        phase, tod, season, perfTier, reducedMotion, debug,
    },
}
```

API:

```js
window.__odd.store.get( 'user.wallpaper' );           // any path, dotted
window.__odd.store.set( 'runtime.tod', 'night' );     // emits odd.store.updated
window.__odd.store.subscribe( 'user', ( next ) => … );// path-scoped
window.__odd.store.persistUser( { wallpaper: 'x' } ); // POST /odd/v1/prefs
```

Writes are shallow + depth-2 merged. Subscribers fire after the merge.

## Error boundaries

Every public surface inside ODD is wrapped in `window.__odd.safeCall`.
If your extension throws, ODD swallows the exception, logs it, and
emits `odd.error`:

```js
window.__odd.events.on( 'odd.error', ( { source, err, severity } ) => {
    // Ship to your own telemetry, or inspect in devtools.
} );
```

The wrapper is available to your own code too:

```js
const tick = window.__odd.safeCall.wrapMethod( scene, 'tick', 'myplugin.tick' );
```

Severity is `'warn'` by default; pass `'error'` for unrecoverable
failures.

## Debug inspector

Enable debug mode one of two ways:

- Set `wpDesktopConfig.debug = true` (WP Desktop Mode exposes this).
- Append `?odd-debug=1` to any URL that loads the Desktop shell.

Then in devtools:

```js
window.__odd.debug.state();       // deep snapshot of the store
window.__odd.debug.events( 50 );  // last 50 bus events
window.__odd.debug.registries();  // filtered registry contents
window.__odd.debug.timings();     // boot/phase timings in ms
window.__odd.debug.dump();        // everything, formatted
```

In production (debug off) the inspector installs a no-op stub, so
there's no memory cost.

## Migrations

ODD runs versioned one-shot migrations on `admin_init`. Each migration
gets a single schema version bump via `odd_schema_version` user meta.

Add your own migration by hooking `odd_migrations`:

```php
add_filter( 'odd_migrations', function ( $list ) {
    $list[] = [
        'version' => 2,
        'name'    => 'my-migration',
        'run'     => 'myplugin_migration_2',
    ];
    return $list;
} );

function myplugin_migration_2( $user_id ) {
    // Idempotent! Runs once per user.
}
```

Migrations must be idempotent — ODD records completion *after* they run,
so a crashed migration re-runs on next load.

## Iris — the default muse, motion vocabulary, and rituals

> Added in v0.15.0 (Cut 3).

Iris is a personality layer built entirely on the Cut 1 extension
surface. Nothing about her is special-cased in core; she's six small
modules that register the default muse, five motion primitives, three
rituals, a reactivity shim, a floating eye overlay, and the first-run
onboarding card. A third-party plugin can replace any of them by
adding a filter with a higher priority, or register an additional muse
to play alongside her.

### Muses

```javascript
wp.hooks.addFilter( 'odd.muses', 'my-plugin/anya', function ( muses ) {
    muses.push( {
        slug:  'anya',
        label: 'Anya',
        voice: {
            boot: [ 'Boot complete.' ],
            sceneOpen: { flux: [ 'Ink.' ] },
        },
    } );
    return muses;
} );
```

`window.__odd.iris.say( 'bucket' )` routes through the currently-active
muse (Iris, unless another is installed) and honors the user's
`mascotQuiet` preference.

### Motion primitives

The registry `odd.motionPrimitives` defines five named motions:
`blink`, `wink`, `glance`, `glitch`, `ripple`. Each entry has a
`run(opts)` method. When `run` fires, it:

1. Emits `odd.motion.<slug>` on the event bus.
2. Calls the matching optional hook on the active scene
   (`onRipple`, `onGlitch`, `onGlance`) if one is registered.

Scenes opt in by implementing any subset of the hooks. Reduced-motion
short-circuits everything except `glance` so focus tracking still
works for keyboard users.

### Rituals

The `odd.rituals` registry lists three built-ins:

| Slug       | Trigger                                                           |
| ---------- | ----------------------------------------------------------------- |
| `festival` | Konami code (↑↑↓↓←→←→BA) on the window                            |
| `dream`    | 120 s of no `pointermove` / `keydown` / `wheel` / `touchstart`    |
| `seven`    | Seven rapid pointerdown→pointerup pairs on the ODD desktop icon   |

Each ritual fires `odd.ritual.<slug>` on the bus. Third parties add
their own via the same filter, or hook the built-ins by subscribing.

### Iris prefs slice

Three new booleans live under `store.user`, written via
`/odd/v1/prefs` and mirrored on the REST GET response:

- `initiated` — onboarding card dismissed
- `mascotQuiet` — Iris toasts suppressed (motion still plays)
- `winkUnlocked` — The Seven has been found

## Apps

> Added in v0.16.0 (uploads), expanded in v0.17.0 (built-in catalog).
> Replaces the standalone Bazaar plugin — a one-shot migration moves
> existing wares into ODD on first admin login after upgrade.

ODD apps are self-contained static bundles (HTML + CSS + JS + assets)
that run inside a sandboxed iframe, get their own desktop icon, and
appear in their own WP Desktop Mode native window. Every app looks
the same to the host, whether it ships pre-installed, arrives from
the curated catalog, or is uploaded as a `.odd` / `.wp` archive.

### Manifest shape

Every app is defined by a `manifest.json` at the root of its bundle:

```json
{
    "slug":        "my-app",
    "name":        "My App",
    "version":     "1.0.0",
    "author":      "you",
    "description": "A short sentence for the card and catalog.",
    "icon":        "icon.svg",
    "entry":       "index.html",
    "capability":  "read",
    "window":      { "width": 720, "height": 520 },
    "desktopIcon": { "position": 300 },
    "extensions": {
        "muses":            [ { "slug": "my-app", "voice": { … } } ],
        "commands":         [ { "slug": "my-app", "label": "Open My App", "run": "odd.apps.open:my-app" } ],
        "widgets":          [],
        "rituals":          [],
        "motionPrimitives": []
    }
}
```

`slug`, `name`, and `version` are required. Everything else is
optional. `capability` is the WordPress capability the user must have
to install or open the app — defaults to `manage_options`; public
utility apps can lower that to `read`.

### Archive format

An app archive is a ZIP file with:

- `manifest.json` at the root (required)
- The `entry` file (defaults to `index.html`)
- Any additional static assets the app needs

Extension is `.odd` (canonical) or `.wp` (Bazaar parity — both work).
Archives may contain up to **2000 files** totalling **25 MB
uncompressed**. Files with server-executable extensions (`.php`,
`.phtml`, `.phar`, `.cgi`, `.pl`, `.py`, `.rb`, `.sh`, `.bash`) are
rejected at validation. Symlinks and path-traversal entries are
rejected. The per-file compression ratio is capped at 100:1 so a zip
bomb can't sneak through.

### Installation paths

Three ways to install an app:

1. **Upload** — the Apps panel accepts a `.odd` / `.wp` archive via
   the file picker or drag-and-drop. Uploads go to
   `POST /wp-json/odd/v1/apps/upload`.
2. **Catalog** — the Apps panel's *Catalog* section lists curated
   entries (from `odd/apps/catalog/registry.json`) with *Add* or
   *Download* buttons. Remote entries download the referenced `.wp`
   archive and install it through the same pipeline as uploads. Backed by
   `GET /odd/v1/apps/catalog` and `POST /odd/v1/apps/install-from-catalog`.
3. **Programmatic** — call `odd_apps_install( $tmp_path, $filename )`
   from PHP. Returns the parsed manifest on success or a `WP_Error`.

ODD no longer ships a built-in demo app. The built-in install pipeline
is still present for third-party builds that add catalog entries with
`"builtin": true`, but the stock catalog is remote-app-only.

### Where app files live

Extracted bundles live in `wp-content/odd-apps/<slug>/`. A
`.htaccess` in that directory blocks direct HTTP access — every app
file is served exclusively through the REST endpoint
`GET /odd/v1/apps/serve/<slug>/<path>`, which enforces the app's
declared capability and re-runs the forbidden-extension check on
every request.

The extraction pipeline is atomic: files stage in
`wp-content/odd-apps/.tmp-<slug>-<nonce>/` and only rename into place
after the full archive validates. A crashed extraction never leaves a
partially-installed app visible to the server.

### Option storage (two-tier)

| Option                 | Purpose                                                     |
|------------------------|-------------------------------------------------------------|
| `odd_apps_index`       | Flat `{ slug => index_row }` map. Autoloaded.               |
| `odd_app_<slug>`       | Full manifest + runtime fields for one app. Lazy-loaded.    |
| `odd_apps_shared_secret` | Optional shared secret for catalog auth (future use).     |

The index is the fast path for listing installed apps; the per-slug
option carries the full manifest (including `extensions`) and is only
read when the app is served or its details pane opens.

### REST routes

| Method | Route                                            | Notes                             |
|--------|--------------------------------------------------|-----------------------------------|
| `GET`  | `/odd/v1/apps`                                   | List installed apps.              |
| `GET`  | `/odd/v1/apps/catalog`                           | Curated catalog + `installed` flag.|
| `POST` | `/odd/v1/apps/install-from-catalog`              | Install by catalog slug.          |
| `POST` | `/odd/v1/apps/upload`                            | Install from uploaded archive.    |
| `GET`  | `/odd/v1/apps/{slug}`                            | Full manifest.                    |
| `POST` | `/odd/v1/apps/{slug}/toggle`                     | Enable / disable.                 |
| `DELETE`|`/odd/v1/apps/{slug}`                            | Uninstall.                        |
| `GET`  | `/odd/v1/apps/serve/{slug}/{path...}`            | Serve a file from the bundle.     |

Every `bazaar/v1/*` route is forwarded to its `odd/v1/apps/*`
equivalent for a release cycle so existing Bazaar clients keep
working. The shim is gated by `ODD_BAZAAR_COMPAT` (default `true`).

### Lifecycle events

App lifecycle fires on `window.__odd.events`:

| Name                  | Payload                           |
|-----------------------|-----------------------------------|
| `odd.app-installed`   | `{ slug, manifest }`              |
| `odd.app-uninstalled` | `{ slug }`                        |
| `odd.app-enabled`     | `{ slug }`                        |
| `odd.app-disabled`    | `{ slug }`                        |
| `odd.app-opened`      | `{ slug, windowId, bounds }`     |
| `odd.app-closed`      | `{ slug, windowId }`              |
| `odd.app-focused`     | `{ slug, windowId, bounds }`     |

The `odd-apps` JS module watches for `odd.window-opened` on windows
whose id matches `odd-app-<slug>`, injects a sandboxed iframe into
the server-rendered mount point, and re-emits the `odd.app-*`
events. Iris listens to `odd.app-opened` and fires a `wink` motion
primitive plus an `appOpen.<slug>` voice line — per-slug overrides
live in the app's `manifest.extensions.muses` entry.

### manifest.extensions — apps that extend ODD

Any extension registry shape ODD exposes to PHP/JS can appear in
`manifest.extensions.<registry>[]`. Entries are re-applied on every
page load (via the `init` hook at priority 6) so an app's commands,
muses, widgets, rituals, and motion primitives stay registered
without a custom PHP bootstrap.

Supported registries today: `muses`, `commands`, `widgets`,
`rituals`, `motionPrimitives`. Each entry must have a `slug`;
invalid entries are skipped silently so a malformed manifest never
crashes the admin. ODD tags each registration with
`source: "app:<slug>"` so the debug inspector can distinguish
app-contributed entries from core or plugin ones.

### Sandboxing

Apps run in an `<iframe>` with `sandbox="allow-scripts allow-forms
allow-popups allow-same-origin allow-downloads"`. The host never
exposes ODD's store, events, or lifecycle to the iframe directly —
cross-frame communication is your choice (`postMessage` is the
recommended pattern). The server adds `X-Content-Type-Options:
nosniff` and `Referrer-Policy: no-referrer` on every served file.

### debug helpers

```js
window.__odd.debug.apps();
// → { installed: [...], pinned: [...], enabled: [...], open: [...] }
```

## Testing

ODD ships a Vitest + jsdom harness under `odd/tests/integration/`. To
add a test for your extension:

1. Install ODD locally and `npm install`.
2. Add a `*.test.js` next to the existing harness.
3. `npm test`.

The harness provides `resetOdd`, `seedConfig`, `loadFoundation`, and
`sleep` helpers under `odd/tests/integration/harness.js`.

## Versioning and stability

- Event names, filter slugs, and registry keys listed here are part of
  ODD's 1.x contract. Breaking changes land on major bumps only.
- Store shape is considered public — additions are fine, removals
  require a major.
- PHP helper function names (`odd_register_*`) are stable and callable
  from any WordPress context (plugins, themes, `mu-plugins`).

If you ship an ODD extension, please drop an issue in
[RegionallyFamous/odd](https://github.com/RegionallyFamous/odd) so we
can link it from this page.
