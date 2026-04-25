# Building an ODD App

> Status: v1.0.8. Mirrored to the [Building an App](https://github.com/RegionallyFamous/odd/wiki/Building-an-App)
> wiki page.

An ODD app is any static web app — HTML, CSS, JS, assets — packaged as a
`.odd` (or `.wp`) archive with a `manifest.json`. Once installed, ODD gives
it a desktop icon, opens it in a native WP Desktop Mode window, and
serves every file from a sandboxed iframe.

Your app doesn't need to know anything about WordPress internals. If it
runs as a static site, it runs as an ODD app.

---

## Table of contents

1. [The mental model](#the-mental-model)
2. [Anatomy of an app](#anatomy-of-an-app)
3. [Quickstart: vanilla JS (no build step)](#quickstart-vanilla-js-no-build-step)
4. [Building with React (Vite)](#building-with-react-vite)
5. [Communicating with WordPress](#communicating-with-wordpress)
6. [Iframe sandbox capabilities](#iframe-sandbox-capabilities)
7. [manifest.extensions — apps that extend ODD](#manifestextensions--apps-that-extend-odd)
8. [App lifecycle events](#app-lifecycle-events)
9. [Installing, updating, and uninstalling](#installing-updating-and-uninstalling)
10. [Debugging](#debugging)
11. [Limits and validation](#limits-and-validation)
12. [Bazaar compatibility](#bazaar-compatibility)

Reference material lives in two sibling pages:

- [App Manifest Reference](app-manifest.md) — every `manifest.json` field.
- [Apps REST API](app-rest-api.md) — every endpoint.

---

## The mental model

Your app is just a website. ODD runs it in a sandboxed `<iframe>` that
lives inside a WP Desktop Mode native window. The iframe is on the same
origin as WordPress, so `fetch()` can hit the WP REST API with the
current user's cookies — no CORS setup, no external auth service.

```
┌─── wp-admin (WP Desktop Mode shell) ───────────────────┐
│                                                        │
│  ┌── Native window "My App" ───────────────────────┐   │
│  │  ┌─ sandboxed iframe ─────────────────────────┐ │   │
│  │  │                                            │ │   │
│  │  │   <your index.html>                        │ │   │
│  │  │                                            │ │   │
│  │  │   fetch('/wp-json/wp/v2/posts', …)         │ │   │
│  │  └────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

The only WordPress concept you need to learn is `manifest.json`, which
tells ODD what to call your app, which HTML file to load, and who's
allowed to open it.

---

## Anatomy of an app

```
my-app.odd                    ← renamed .zip (also accepts .wp)
├── manifest.json             ← REQUIRED — metadata
├── index.html                ← REQUIRED — entry (path can be overridden)
├── icon.svg                  ← optional — dock + desktop icon
└── assets/
    ├── app.js
    ├── app.css
    └── logo.png
```

Important: `manifest.json` must sit at the root of the archive, not
inside a subdirectory. Same for the entry file (unless you override
`entry` in the manifest).

The minimum viable `manifest.json`:

```json
{
    "slug":    "my-app",
    "name":    "My App",
    "version": "1.0.0"
}
```

Everything else is optional and has sensible defaults — see
[App Manifest Reference](app-manifest.md).

---

## Quickstart: vanilla JS (no build step)

The fastest path to a working app. No tools, no npm, no bundler.

### 1. `manifest.json`

```json
{
    "slug":        "hello-odd",
    "name":        "Hello ODD",
    "version":     "1.0.0",
    "author":      "Your Name",
    "description": "A tiny hello-world app.",
    "icon":        "icon.svg",
    "entry":       "index.html",
    "capability":  "read",
    "window":      { "width": 520, "height": 360 }
}
```

### 2. `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hello ODD</title>
    <style>
        body {
            font-family: system-ui, sans-serif;
            display: grid;
            place-items: center;
            height: 100vh;
            margin: 0;
            background: #101014;
            color: #f5f5fa;
        }
        h1 { margin: 0; font-weight: 500; }
    </style>
</head>
<body>
    <h1>Hello from ODD</h1>
</body>
</html>
```

### 3. `icon.svg` (optional, 20×20)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="3"/>
</svg>
```

### 4. Package and install

```bash
zip hello-odd.odd manifest.json index.html icon.svg
```

Then in the ODD Control Panel → Apps tab, drag `hello-odd.odd` onto the
drop zone (or hit the file picker). A **Hello ODD** icon appears on
the desktop. Double-click to open.

That's the whole workflow.

---

## Building with React (Vite)

Any framework that emits static HTML/CSS/JS works — React with Vite is
the most common path. ODD has no build-time integration: you hand it a
zip, it extracts and serves it.

### 1. Scaffold

```bash
npm create vite@latest my-app -- --template react
cd my-app
npm install
```

### 2. `vite.config.ts`

Keep Vite's default `dist/` output, but emit assets with relative paths
so they resolve under ODD's serve URL:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: './',
});
```

`base: './'` is the key line. Without it Vite emits absolute paths like
`/assets/index-abc.js`, which a sandboxed iframe will try to resolve
against the WordPress root instead of the serve endpoint. Relative
paths work because the iframe's `src` is
`/wp-json/odd/v1/apps/serve/<slug>/` — every `./assets/...` is resolved
against that.

### 3. `manifest.json` (lives in the project root, copied into `dist/` at package time)

```json
{
    "slug":        "my-app",
    "name":        "My App",
    "version":     "1.0.0",
    "author":      "Your Name",
    "description": "My first ODD app, built with React.",
    "icon":        "icon.svg",
    "entry":       "index.html",
    "capability":  "read",
    "window":      { "width": 720, "height": 520 }
}
```

### 4. `package.json` scripts

Add a one-liner that builds and zips in a single step:

```json
{
    "scripts": {
        "build":   "vite build",
        "package": "npm run build && cp manifest.json icon.svg dist/ && cd dist && zip -r ../$(node -p \"require('../manifest.json').slug\").odd ."
    }
}
```

### 5. Build and install

```bash
npm run package
# → my-app.odd in project root
```

Drag `my-app.odd` onto the ODD Apps panel.

### Dev workflow

There's no hot-reload proxy today. The fast loop is:

```bash
npm run package
# then re-upload, which triggers the panel to replace the old install
```

On a 30 KB React app this takes well under a second.

If you're iterating on pure UI, preview in the browser directly with
`npm run dev` — the REST calls won't work because Vite runs on a
different origin, but your layout and interactions render identically.

---

## Communicating with WordPress

Your app runs in a same-origin iframe served from
`/wp-json/odd/v1/apps/serve/<slug>/`. The WordPress session cookie is
sent with every `fetch()`, and ODD injects a fresh REST nonce into the
iframe's URL as `?_wpnonce=…` so your app can make authenticated writes.

### Reading the nonce

```js
const nonce = new URLSearchParams( window.location.search ).get( '_wpnonce' );
```

Read it once at startup and keep it around — it's valid for 12 hours
and you'll need it as the `X-WP-Nonce` header on every authenticated
REST call.

### GET requests (reading data)

```js
const posts = await fetch( '/wp-json/wp/v2/posts?per_page=5', {
    headers: { 'X-WP-Nonce': nonce },
    credentials: 'include',
} ).then( r => r.json() );
```

### POST/PUT/DELETE (writing data)

```js
await fetch( '/wp-json/wp/v2/posts', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce':   nonce,
    },
    credentials: 'include',
    body: JSON.stringify( { title: 'From my app', status: 'draft' } ),
} );
```

### Finding the REST root

Don't hardcode `/wp-json/` — WordPress can be installed in a subdirectory.
Derive it from the iframe's own location:

```js
const wpRoot   = window.location.href.split( '/wp-json/' )[ 0 ];
const restBase = wpRoot + '/wp-json';
```

### Refreshing the nonce

REST nonces expire after 12 hours. If your app is long-running (rare,
since users rarely leave a single iframe open that long), catch `403`
responses with `code: "rest_cookie_invalid_nonce"` and prompt the user
to reload the parent window. ODD does not currently expose a refresh
endpoint.

### A tiny helper

For anything beyond a couple of calls, wrap it:

```js
const nonce = new URLSearchParams( window.location.search ).get( '_wpnonce' );

async function wp( path, init = {} ) {
    const headers = new Headers( init.headers || {} );
    headers.set( 'X-WP-Nonce', nonce );
    if ( init.body && ! headers.has( 'Content-Type' ) ) {
        headers.set( 'Content-Type', 'application/json' );
    }
    const r = await fetch(
        '/wp-json' + ( path.startsWith( '/' ) ? path : '/' + path ),
        { ...init, headers, credentials: 'include' }
    );
    if ( ! r.ok ) throw new Error( `HTTP ${ r.status } ${ r.statusText }` );
    return r.json();
}

// Usage:
const me    = await wp( '/wp/v2/users/me' );
const posts = await wp( '/wp/v2/posts?per_page=5' );
await wp( '/wp/v2/posts', {
    method: 'POST',
    body: JSON.stringify( { title: 'Hi', status: 'draft' } ),
} );
```

### Registering your own REST endpoints

If your app needs server-side logic, ship a companion WordPress plugin:

```php
// my-app-companion.php
add_action( 'rest_api_init', function () {
    register_rest_route( 'my-app/v1', '/settings', [
        [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => fn() => rest_ensure_response(
                get_option( 'my_app_settings', [] )
            ),
            'permission_callback' => fn() => current_user_can( 'manage_options' ),
        ],
        [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => function ( WP_REST_Request $req ) {
                update_option( 'my_app_settings', $req->get_json_params(), false );
                return rest_ensure_response( [ 'success' => true ] );
            },
            'permission_callback' => fn() => current_user_can( 'manage_options' ),
        ],
    ] );
} );
```

From your app:

```js
const settings = await wp( '/my-app/v1/settings' );
```

---

## Iframe sandbox capabilities

Every app runs inside an `<iframe>` with a fixed sandbox attribute:

```
sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-downloads"
```

Plus:

- `referrerpolicy="no-referrer"`
- `allow="clipboard-read; clipboard-write; fullscreen"`

What each token buys you:

| Permission           | What it enables                                                   |
|----------------------|-------------------------------------------------------------------|
| `allow-scripts`      | Run JavaScript.                                                   |
| `allow-forms`        | Submit HTML forms.                                                |
| `allow-popups`       | Open links / windows via `window.open()`.                         |
| `allow-same-origin`  | Share origin with WordPress, so cookie auth + session storage work.|
| `allow-downloads`    | Trigger file downloads from anchor tags or programmatic blobs.    |

What's deliberately not granted:

- **`allow-top-navigation`** — apps can't redirect the outer admin page.
- **`allow-modals`** — `alert()`, `confirm()`, and `prompt()` are no-ops.
  Build your own modal UI in-app.

These are fixed across all apps; there's no per-app trust level today.
The response headers added by the serve endpoint give you a second
layer of hardening:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: no-referrer`
- `Cache-Control` driven by `nocache_headers()`

---

## manifest.extensions — apps that extend ODD

An app can register entries in ODD's core extension registries without
shipping a companion PHP plugin. Add an `extensions` object to your
manifest:

```json
{
    "slug":    "ledger",
    "name":    "Ledger",
    "version": "1.2.0",
    "extensions": {
        "muses": [
            {
                "slug":  "ledger",
                "voice": {
                    "appOpen": { "ledger": [ "Let's get paid." ] }
                }
            }
        ],
        "commands": [
            {
                "slug":  "open-ledger",
                "label": "Open Ledger",
                "run":   "odd.apps.open:ledger"
            }
        ],
        "widgets":          [],
        "rituals":          [],
        "motionPrimitives": []
    }
}
```

Supported registries: `muses`, `commands`, `widgets`, `rituals`,
`motionPrimitives`. Each entry needs at minimum a `slug`; invalid
entries are skipped silently so a malformed manifest never crashes the
admin. ODD re-applies the extensions on every pageload (at `init`
priority 6), so your registrations stay in effect without any custom
bootstrap.

Each entry gets tagged with `source: "app:<your-slug>"`, visible in the
debug inspector — see the [ODD Extension API](building-on-odd.md) for
the full registry contracts.

---

## App lifecycle events

Events fire on `window.__odd.events` in the parent frame. They're not
available inside the app iframe — use `window.postMessage()` if your app
needs to notify the host.

| Event                | Payload                              | Fires when                                 |
|----------------------|--------------------------------------|--------------------------------------------|
| `odd.app-installed`  | `{ slug, manifest }`                 | After upload / catalog install succeeds.   |
| `odd.app-uninstalled`| `{ slug }`                           | After `DELETE /odd/v1/apps/{slug}`.        |
| `odd.app-enabled`    | `{ slug }`                           | After `POST /apps/{slug}/toggle { enabled: true }`. |
| `odd.app-disabled`   | `{ slug }`                           | Same as above with `false`.                |
| `odd.app-opened`     | `{ slug, windowId }`                 | User double-clicks the icon / opens window.|
| `odd.app-closed`     | `{ slug, windowId }`                 | User closes the window.                    |
| `odd.app-focused`    | `{ slug, windowId }`                 | User focuses an already-open window.       |

Host-side subscription example (from a theme or companion plugin):

```js
window.__odd.events.on( 'odd.app-opened', ( { slug } ) => {
    if ( slug === 'ledger' ) {
        // Fire analytics, flash a welcome toast, etc.
    }
} );
```

---

## Installing, updating, and uninstalling

### From the UI

ODD Control Panel → **Apps** tab:

- **Upload** — drag a `.odd` or `.wp` archive onto the drop zone.
- **Catalog** — pick a curated entry and click **Install**.
- **Uninstall** — click the × on any installed app card.
- **Enable / disable** — toggle to hide the app without deleting it.

### From REST

See [Apps REST API](app-rest-api.md) for the full surface. The short
version:

```bash
# Upload
curl -X POST https://example.com/wp-json/odd/v1/apps/upload \
    -H "X-WP-Nonce: $NONCE" \
    -F "file=@my-app.odd"

# Uninstall
curl -X DELETE https://example.com/wp-json/odd/v1/apps/my-app \
    -H "X-WP-Nonce: $NONCE"

# Toggle
curl -X POST https://example.com/wp-json/odd/v1/apps/my-app/toggle \
    -H "X-WP-Nonce: $NONCE" \
    -H "Content-Type: application/json" \
    -d '{"enabled": false}'
```

### From PHP

```php
$result = odd_apps_install( $tmp_path, $filename );
if ( is_wp_error( $result ) ) {
    // Handle the error.
} else {
    // $result is the parsed manifest.
}

odd_apps_uninstall( 'my-app' );
odd_apps_set_enabled( 'my-app', false );
```

### Updating an existing app

Uploads reject an archive whose slug is already installed — you'll see
a `slug_exists` error with HTTP 400. To upgrade:

1. Delete the existing app (`DELETE /odd/v1/apps/{slug}` or the × in
   the panel).
2. Upload the new archive.

A future release will add a force-replace flag so updates become a
single call; for now, delete-then-upload is the way.

---

## Debugging

DevTools work normally. The iframe is fully inspectable — set
breakpoints, watch network requests, read console output as you would
any web app.

Common HTTP status codes you'll see from the serve endpoint:

| Status | Meaning                                                       |
|--------|---------------------------------------------------------------|
| 401    | Not logged in.                                                |
| 403    | Missing the app's declared capability, or app is disabled.    |
| 404    | Slug or file not found.                                       |
| 400    | Path traversal / invalid path characters.                     |

Inspect the stored manifest for an installed app:

```bash
wp option get odd_app_my-app
```

Inspect the index:

```bash
wp option get odd_apps_index
```

List files on disk:

```bash
find "$(wp eval 'echo WP_CONTENT_DIR;')/odd-apps/my-app/" -type f
```

Host-side debug helper (debug mode on — see [Building on ODD](building-on-odd.md#debug-inspector)):

```js
window.__odd.debug.apps();
// → { installed: [...], enabled: [...], open: [...] }
```

---

## Limits and validation

ODD validates every archive on upload. An archive is rejected if any
of the following fail:

- File extension is `.odd` or `.wp`.
- File is a valid ZIP.
- Archive contains no more than **2,000 files**.
- Total uncompressed size is under **25 MB** (filter:
  `odd_apps_max_uncompressed`).
- No per-file compression ratio exceeds **100:1** (zip-bomb guard).
- No symlinks.
- No path-traversal entries (`..` in file names).
- No server-executable extensions anywhere in the archive:
  `.php`, `.phtml`, `.phar`, `.php3` – `.php7`, `.phps`,
  `.cgi`, `.pl`, `.py`, `.rb`, `.sh`, `.bash`.
- `manifest.json` exists at the archive root.
- `manifest.json` is valid JSON.
- `name`, `slug`, and `version` are non-empty strings.
- `slug` matches `^[a-z0-9-]+$`.
- `slug` is not already installed.
- The `entry` file (default `index.html`) exists.
- The `entry` path doesn't contain `..`, leading `/`, or invalid
  characters.

---

## Bazaar compatibility

Users upgrading from the standalone Bazaar plugin are migrated
automatically on first admin login — bundles move from
`wp-content/bazaar/` to `wp-content/odd-apps/`, options rewrite from
`bazaar_index` / `bazaar_ware_<slug>` to `odd_apps_index` /
`odd_app_<slug>`, and Bazaar is deactivated.

For authors: **the old `.wp` extension is still accepted** alongside the
canonical `.odd`. Existing Bazaar wares install into ODD without
changes as long as they stick to the manifest fields ODD supports
(see [App Manifest Reference](app-manifest.md)). Features that Bazaar
shipped but ODD doesn't implement — shared libraries, zero-trust
network allowlists, CSP management, jobs, health checks, license
keys, signed archives, dev-mode proxying — are silently ignored. Your
ware will still work; those capabilities just aren't enforced.

The Bazaar REST shim forwards these routes while
`ODD_BAZAAR_COMPAT` is on (default: `true`):

| Bazaar route                                   | Forwards to                                    |
|------------------------------------------------|------------------------------------------------|
| `GET  /wp-json/bazaar/v1/wares`                | `GET  /wp-json/odd/v1/apps`                    |
| `GET  /wp-json/bazaar/v1/wares/{slug}`         | `GET  /wp-json/odd/v1/apps/{slug}`             |
| `POST /wp-json/bazaar/v1/upload`               | `POST /wp-json/odd/v1/apps/upload`             |
| `DELETE /wp-json/bazaar/v1/wares/{slug}`       | `DELETE /wp-json/odd/v1/apps/{slug}`           |
| `POST /wp-json/bazaar/v1/wares/{slug}/toggle`  | `POST /wp-json/odd/v1/apps/{slug}/toggle`      |
| `GET  /wp-json/bazaar/v1/serve/{slug}/{path}`  | `GET  /wp-json/odd/v1/apps/serve/{slug}/{path}`|

New apps should target `odd/v1/apps/*` directly.

---

## See also

- [App Manifest Reference](app-manifest.md)
- [Apps REST API](app-rest-api.md)
- [Building on ODD](building-on-odd.md) — scenes, icon sets, muses,
  commands, widgets, rituals, and motion primitives.
