# Apps REST API

> Status: v1.0.8. Mirrored to the
> [Apps REST API](https://github.com/RegionallyFamous/odd/wiki/Apps-REST-API)
> wiki page.

All ODD Apps endpoints live under the `odd/v1` namespace.

Base URL: `https://your-site.com/wp-json/odd/v1/`

---

## Authentication

| Context             | Method                                                                        |
|---------------------|-------------------------------------------------------------------------------|
| Browser (wp-admin)  | Cookie auth + `X-WP-Nonce` header. `@wordpress/api-fetch` attaches it for you.|
| Inside an app iframe| ODD passes the nonce as `?_wpnonce=…` on the iframe URL — read it with `new URLSearchParams(window.location.search).get('_wpnonce')`.|
| External clients    | [Application Passwords](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/#application-passwords) via HTTP Basic auth. |

Permission shorthand used below:

- **admin** — logged-in user with `manage_options`.
- **login** — any logged-in user (`read`).
- **public** — no auth required.

---

## Endpoint index

| Method   | Path                                         | Auth          | Purpose                                    |
|----------|----------------------------------------------|---------------|--------------------------------------------|
| `GET`    | `/apps`                                      | login         | List installed apps.                       |
| `GET`    | `/apps/{slug}`                               | login         | Full manifest for one app.                 |
| `POST`   | `/apps/upload`                               | admin         | Install from a `.odd` / `.wp` archive.     |
| `DELETE` | `/apps/{slug}`                               | admin         | Uninstall an app and delete its files.     |
| `POST`   | `/apps/{slug}/toggle`                        | admin         | Enable or disable an installed app.        |
| `GET`    | `/apps/serve/{slug}/{path...}`               | per-app cap   | Serve a file from the app bundle.          |
| `GET`    | `/apps/icon/{slug}`                          | public        | Serve the app's declared icon file.        |
| `GET`    | `/apps/catalog`                              | login         | Curated catalog of installable apps.       |
| `POST`   | `/apps/install-from-catalog`                 | admin         | Install by catalog slug.                   |

---

## Endpoints

### `GET /apps`

List all installed apps.

**Auth:** login

**Response** — `200 OK`:

```json
{
    "apps": [
        {
            "slug":        "ledger",
            "name":        "Ledger",
            "version":     "1.1.0",
            "enabled":     true,
            "icon":        "icon.svg",
            "description": "Get paid. Track clients, generate invoices.",
            "capability":  "manage_options",
            "installed":   1713996000,
            "builtin":     false
        }
    ]
}
```

Apps are sorted alphabetically by `name`.

---

### `GET /apps/{slug}`

Return the full stored manifest for one installed app.

**Auth:** login

**Path params:**

| Param | Type   | Description                      |
|-------|--------|----------------------------------|
| `slug`| string | The app slug (`[a-z0-9-]+`).     |

**Response** — `200 OK`: the full manifest object, identical to what
was packaged plus the runtime fields `enabled`, `installed`, and
(if applicable) `builtin`.

**Errors:**

| Status | Code        | Meaning                                 |
|--------|-------------|-----------------------------------------|
| 404    | `not_found` | No app with that slug is installed.     |

---

### `POST /apps/upload`

Install an app from a `.odd` (or `.wp`) archive.

**Auth:** admin
**Content-Type:** `multipart/form-data`

**Request body:** `file` field containing the archive.

**JavaScript example:**

```js
import apiFetch from '@wordpress/api-fetch';

const fd = new FormData();
fd.append( 'file', fileInput.files[ 0 ] );

const result = await apiFetch( {
    path:   '/odd/v1/apps/upload',
    method: 'POST',
    body:   fd,
} );
```

**curl example:**

```bash
NONCE=$(wp eval 'echo wp_create_nonce("wp_rest");')
SITE=$(wp option get siteurl)

curl -X POST "${SITE}/wp-json/odd/v1/apps/upload" \
    -H "X-WP-Nonce: ${NONCE}" \
    -b cookie-jar.txt \
    -F "file=@my-app.odd"
```

**Response** — `200 OK`:

```json
{
    "installed": true,
    "manifest": {
        "slug":    "my-app",
        "name":    "My App",
        "version": "1.0.0",
        "enabled": true,
        "installed": 1714000000
    }
}
```

**Error codes:**

| Status | Code                     | Meaning                                                   |
|--------|--------------------------|-----------------------------------------------------------|
| 400    | `no_file`                | No `file` field present in the multipart body.            |
| 400    | `invalid_extension`      | Filename does not end in `.odd` or `.wp`.                 |
| 400    | `zip_unavailable`        | PHP `ZipArchive` extension not installed.                 |
| 400    | `invalid_zip`            | File is not a valid ZIP archive.                          |
| 400    | `too_many_files`         | Archive exceeds 2,000 files.                              |
| 400    | `corrupt_archive`        | An entry failed `ZipArchive::statIndex`.                  |
| 400    | `path_traversal`         | An entry contained `..` or a leading `/`.                 |
| 400    | `symlink_in_archive`     | An entry was a symbolic link.                             |
| 400    | `forbidden_file_type`    | Archive contains an executable extension (`.php` etc.).   |
| 400    | `zip_bomb`               | Per-file compression ratio exceeded 100:1.                |
| 400    | `too_large`              | Uncompressed total exceeded 25 MB (filterable).           |
| 400    | `missing_manifest`       | `manifest.json` not at archive root.                      |
| 400    | `invalid_manifest`       | `manifest.json` is not valid JSON.                        |
| 400    | `missing_manifest_field` | Required `name` / `slug` / `version` missing.             |
| 400    | `invalid_slug`           | Slug contains invalid characters.                         |
| 400    | `slug_exists`            | A different app with that slug is already installed.      |
| 400    | `invalid_entry`          | `entry` path invalid.                                     |
| 400    | `missing_entry`          | `entry` file absent from archive.                         |
| 400    | `install_in_progress`    | Another upload of the same slug is mid-extraction.        |
| 500    | `extract_mkdir_failed`   | Could not create the staging directory.                   |
| 500    | `extract_rename_failed`  | Could not promote staged files into final location.       |

---

### `DELETE /apps/{slug}`

Uninstall an app. Removes its directory, per-slug option, and index
entry. Idempotent — returns `200` for unknown slugs.

**Auth:** admin

**Response** — `200 OK`:

```json
{ "uninstalled": true }
```

**Errors:**

| Status | Code            | Meaning                         |
|--------|-----------------|---------------------------------|
| 400    | `invalid_slug`  | Slug parameter was empty.       |

---

### `POST /apps/{slug}/toggle`

Enable or disable an installed app. Disabled apps keep their files and
manifest; their desktop icon, native window, and serve endpoint stop
working until re-enabled.

**Auth:** admin
**Content-Type:** `application/json`

**Request body (optional):**

```json
{ "enabled": true }
```

If `enabled` is omitted, the endpoint flips the current state.

**Response** — `200 OK`:

```json
{ "enabled": false }
```

**Errors:**

| Status | Code             | Meaning                    |
|--------|------------------|----------------------------|
| 400    | `invalid_slug`   | Slug parameter was empty.  |
| 404    | `not_installed`  | No app with that slug.     |

---

### `GET /apps/serve/{slug}/{path...}`

Serve a static file from an installed, enabled app's bundle. This is
the endpoint the iframe's `src` points to, and the only way app files
reach the browser — direct requests to `wp-content/odd-apps/` are
blocked by an `.htaccess` that ODD writes on first install.

**Auth:** logged-in + the app's declared `capability` (default
`manage_options`).

**Path params:**

| Param   | Type   | Description                                              |
|---------|--------|----------------------------------------------------------|
| `slug`  | string | App slug.                                                |
| `path`  | string | File path inside the bundle. Optional — defaults to the manifest's `entry`. |

**Headers set on the response:**

| Header                       | Value                                  |
|------------------------------|----------------------------------------|
| `Content-Type`               | Guessed from extension; fallback `application/octet-stream`. |
| `X-Content-Type-Options`     | `nosniff`                              |
| `X-Frame-Options`            | `SAMEORIGIN`                           |
| `Referrer-Policy`            | `no-referrer`                          |
| `Cache-Control`              | Driven by `nocache_headers()`.         |
| `Content-Length`             | Set when `zlib.output_compression` is off. |

**Errors:**

| Status | Code         | Meaning                                                |
|--------|--------------|--------------------------------------------------------|
| 400    | `bad_path`   | Path contained `..`, a leading `/`, NUL bytes, or other invalid chars. |
| 403    | `forbidden`  | Extension is on the forbidden list.                    |
| 404    | `not_found`  | Path resolved outside the app's realpath, or file missing. |

---

### `GET /apps/icon/{slug}`

Serve the app's declared `icon` file. **Public endpoint** — no nonce
required, because `<img src>` tags can't send an `X-WP-Nonce` header,
and icons are already public branding (every enabled app's tile shows
on the desktop).

**Path params:**

| Param  | Type   | Description   |
|--------|--------|---------------|
| `slug` | string | App slug.     |

The endpoint only serves the single path recorded in the manifest's
`icon` field (default `icon.svg`). Client-supplied path segments are
never honored, so there's no traversal surface.

**Response headers:**

| Header                       | Value                              |
|------------------------------|------------------------------------|
| `Cache-Control`              | `public, max-age=86400`            |
| `Content-Type`               | Guessed from the icon file's extension. |

**Errors:**

| Status | Code         | Meaning                                                  |
|--------|--------------|----------------------------------------------------------|
| 404    | `not_found`  | Slug unknown, app disabled, icon path invalid, or file missing. |

---

### `GET /apps/catalog`

Return the curated app catalog, with an `installed` flag per entry so
UIs can flip "Install" buttons straight to "Open".

The catalog ships in `odd/apps/catalog/registry.json` and is cached in
memory for the request. Entries marked `"builtin": true` are available
for in-place install from plugin-bundled sources; the rest download an
external `.wp` archive via `install-from-catalog`.

**Auth:** login

**Response** — `200 OK`:

```json
{
    "apps": [
        {
            "slug":         "ledger",
            "name":         "Ledger",
            "version":      "1.1.0",
            "author":       "Regionally Famous",
            "description":  "Get paid. Track clients, generate invoices.",
            "icon_url":     "https://…/icon.svg",
            "download_url": "https://…/ledger.wp",
            "tags":         [ "business", "invoicing" ],
            "builtin":      false,
            "installed":    false
        }
    ]
}
```

---

### `POST /apps/install-from-catalog`

Install a catalog entry by slug. For `builtin: true` entries ODD
copies files in-place from `odd/apps/catalog/<slug>/`; for remote
entries it downloads `download_url`, validates it, and feeds it to
`odd_apps_install()`.

**Auth:** admin
**Content-Type:** `application/json`

**Request body:**

```json
{ "slug": "ledger" }
```

**Response** — `200 OK`:

```json
{
    "installed": true,
    "manifest": { "slug": "ledger", "name": "Ledger", "version": "1.1.0", "enabled": true }
}
```

**Errors:**

| Status | Code                  | Meaning                                                 |
|--------|-----------------------|---------------------------------------------------------|
| 400    | `invalid_slug`        | Missing or empty `slug` in body.                        |
| 404    | `not_in_catalog`      | Slug is not in `catalog/registry.json`.                 |
| 409    | `already_installed`   | Something with that slug is already installed.          |
| 400    | `no_download`         | Catalog row has no `download_url`.                      |
| 400    | `insecure_download`   | `download_url` is not HTTPS. Override with the `odd_apps_allow_insecure_catalog` filter on dev hosts. |
| *varies* | (download errors)   | Any `WP_Error` from `download_url()` is passed through. |
| *varies* | (install errors)    | Any validation error from `POST /apps/upload` applies.  |

---

## From PHP

The same operations are available as procedural PHP helpers, safe to
call from a companion plugin, theme, or `mu-plugin`:

```php
// Install
$result = odd_apps_install( $tmp_path, $filename );
if ( is_wp_error( $result ) ) {
    // Handle error.
}

// Uninstall
odd_apps_uninstall( 'my-app' );

// Enable / disable
odd_apps_set_enabled( 'my-app', false );

// Read
$rows     = odd_apps_list();
$manifest = odd_apps_get( 'my-app' );
$exists   = odd_apps_exists( 'my-app' );
```

All write helpers fire lifecycle `do_action( 'odd_app_*' )` hooks —
see [Building on ODD](building-on-odd.md#canonical-events) for the bus
equivalents.

---

## Bazaar compatibility shim

While `ODD_BAZAAR_COMPAT` is true (the default), the following Bazaar
routes forward to their ODD equivalents. The handlers re-dispatch the
request through the WP REST server, so capability checks, nonces, and
edge cases resolve in exactly one place.

| Bazaar route                                        | Forwards to                                       |
|-----------------------------------------------------|---------------------------------------------------|
| `GET    /wp-json/bazaar/v1/wares`                   | `GET    /wp-json/odd/v1/apps`                     |
| `GET    /wp-json/bazaar/v1/wares/{slug}`            | `GET    /wp-json/odd/v1/apps/{slug}`              |
| `POST   /wp-json/bazaar/v1/upload`                  | `POST   /wp-json/odd/v1/apps/upload`              |
| `DELETE /wp-json/bazaar/v1/wares/{slug}`            | `DELETE /wp-json/odd/v1/apps/{slug}`              |
| `POST   /wp-json/bazaar/v1/wares/{slug}/toggle`     | `POST   /wp-json/odd/v1/apps/{slug}/toggle`       |
| `GET    /wp-json/bazaar/v1/serve/{slug}/{path...}`  | `GET    /wp-json/odd/v1/apps/serve/{slug}/{path...}` |

The `POST /bazaar/v1/upload` shim also accepts the old `ware` field
name in addition to `file`. Everything else behaves identically to
the `odd/v1/apps/*` route it forwards to.

Disable the shim globally with:

```php
// wp-config.php
define( 'ODD_BAZAAR_COMPAT', false );
```

…or via the `odd_apps_bazaar_compat` filter.

---

## Endpoints intentionally not in this API

If you're coming from Bazaar and looking for them, ODD does not
currently ship:

- `GET /index` (compact index)
- `GET|PATCH|DELETE /config/{slug}` (per-app config schema)
- `GET /health`, `GET /health/{slug}` (health polling)
- `POST|GET /analytics*` (page-view tracking)
- `GET /audit*` (audit log)
- `GET|POST|DELETE /badges*` (notification badges)
- `GET|PATCH|DELETE /csp/{slug}` (per-app CSP management)
- `GET|POST|DELETE /errors*` (client error reporting)
- `GET /jobs/{slug}`, `POST /jobs/{slug}/{job_id}` (WP-Cron jobs)
- `GET /nonce` (nonce refresh — see `_wpnonce` in the iframe URL instead)
- `GET|PUT|DELETE /store/{slug}/{key}` (server-side K/V storage)
- `GET /stream` (SSE event stream)
- `GET|POST|DELETE /webhooks*` (outbound webhooks)
- `GET /sw` (zero-trust service worker)

Some of these may land in future releases; none are promised.

---

## See also

- [Building an App](building-an-app.md) — authoring guide.
- [App Manifest Reference](app-manifest.md) — every `manifest.json` field.
- [Building on ODD](building-on-odd.md) — the extension API apps can tap via `manifest.extensions`.
