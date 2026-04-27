# `window.__odd.api` versioning contract

ODD exposes its extension surface through `window.__odd.api`. The
string at `window.__odd.api.version` describes **that surface**, not
the plugin you just installed — plugin releases and API releases
evolve on their own SemVer tracks so a bug-fix plugin release never
silently changes what third-party extensions can rely on.

Today: **`2.0.0`**.

## What counts as the API surface

The surface tracked by `api.version` covers everything a third-party
bundle or companion plugin might touch:

### JavaScript

- `window.__odd.api` methods: `scenes`, `sceneBySlug`, `currentScene`,
  `iconSets`, `iconSetBySlug`, `currentIconSet`, `savePrefs`,
  `setScene`, `setIconSet`, `shuffle`, `toast`, `onSceneChange`,
  `onIconSetChange`, `openPanel`, and the `HOOK_SCENE` / `HOOK_ICONSET`
  / `TOAST_TONE` constants.
- `window.__odd.diagnostics.{collect, collectMarkdown, copy}` —
  zero-telemetry diagnostic bundle.
- `window.__odd.store` / `events` / `registries` / `lifecycle` /
  `safeCall` foundation modules and their documented methods.
- `wp.hooks` hook names `odd.pickScene` and `odd.pickIconSet`.
- The bus event names emitted through `window.__odd.events` with an
  `odd.` prefix (`odd.scene-changed`, `odd.icon-set-changed`,
  `odd.shuffle-tick`, `odd.error`).

### PHP

- REST namespace `odd/v1` and the endpoint shapes documented under
  `docs/app-rest-api.md`.
- `odd_*_registry` filters for extension authors
  (`odd_scene_registry`, `odd_widget_registry`, `odd_iconset_registry`,
  `odd_command_registry`).
- `odd_*_install` / `odd_*_uninstall` PHP entry points invoked from
  the bundle dispatcher.
- Content directory layout under `wp-content/odd-apps/`,
  `wp-content/odd-icon-sets/`, `wp-content/odd-scenes/`,
  `wp-content/odd-widgets/`.
- `.wp` manifest shape (canonicalised in
  [`docs/schemas/manifest.schema.json`](schemas/manifest.schema.json)).

## Versioning rules (SemVer, applied to the API)

- **Patch bump** (`1.0.0` → `1.0.1`): bug fix, documentation fix, or
  internal refactor that is invisible to third parties.
- **Minor bump** (`1.0.0` → `1.1.0`): we add new methods, new events,
  new hooks, or new manifest fields without removing or changing the
  behaviour of anything that already existed.
- **Major bump** (`1.0.0` → `2.0.0`): we remove, rename, or change the
  shape/behaviour of anything in the surface above. Major bumps come
  with an upgrade note in the changelog and a migration path in the
  release notes.

Plugin releases that only touch scenes, icon sets, icon assets, the
Shop UI, or the panel visuals **do not** bump `api.version`. That's
the whole point of keeping them separate — scenes can ship, break,
and evolve without contracting downstream to match.

## Reading the version from an extension

```js
var api = window.__odd && window.__odd.api;
if ( ! api || typeof api.version !== 'string' ) {
    return;
}
var major = parseInt( api.version.split( '.' )[ 0 ], 10 );
if ( major !== 2 ) {
    console.warn( '[my-extension] unsupported ODD API major:', api.version );
    return;
}
// safe to call anything listed for the 2.x surface
```

## Deprecation window

When something is planned for removal:

1. We announce the deprecation in a minor release (with a
   `console.warn` on first call for JS, and a `_doing_it_wrong()` for
   PHP).
2. We ship the removal in the next major release.
3. The changelog entry for the major release lists every removal in
   one place so downstream can scan for hits.

The minimum deprecation window is **one minor release**. In practice
we aim for two: the announcement, the removal preview release, then
the removal major.

## Where the version is stamped

- `window.__odd.api.version` — live from JavaScript.
- `odd/src/shared/api.js` — the `API_VERSION` constant is the source
  of truth. The `2.x.y` line is current; bump major only for breaking
  surface changes (see Versioning rules above).
- `odd/tests/integration/api-surface.test.js` (to land with the test
  harness rollout) — snapshots the surface and fails the test when the
  constant and the snapshot drift without a deliberate update.
