# Building on ODD

> Status: v0.15.0 (foundation + Iris). This page is the source of truth
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
