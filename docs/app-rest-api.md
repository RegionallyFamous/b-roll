# ODD REST API

> Status: v3.4.0. Covers the `/apps/*`, `/bundles/*`, and `/starter/*` surfaces.
> Mirrored to the
> [Apps REST API](https://github.com/RegionallyFamous/odd/wiki/Apps-REST-API)
> wiki page.

All ODD endpoints live under the `odd/v1` namespace.

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
| `POST`   | `/apps/{slug}/toggle`                        | admin         | Enable/disable an installed app or update its desktop/taskbar surfaces. |
| `GET`    | `/apps/serve/{slug}/{path...}`               | per-app cap   | Serve a file from the app bundle.          |
| `GET`    | `/apps/icon/{slug}`                          | public        | Serve the app's declared icon file.        |
| `GET`    | `/apps/catalog`                              | login         | Compat shim — forwards to `/bundles/catalog?type=app`. |
| `POST`   | `/apps/install-from-catalog`                 | admin         | Compat shim — forwards to `/bundles/install-from-catalog`. |
| `POST`   | `/bundles/upload`                            | admin         | Install any `.wp` bundle (app, icon set, scene, widget). |
| `DELETE` | `/bundles/{slug}`                            | admin         | Uninstall any bundle regardless of type.   |
| `GET`    | `/bundles/catalog`                           | login         | Browse the remote catalog (all bundle types). |
| `POST`   | `/bundles/install-from-catalog`              | admin         | Install a catalog bundle by slug, verified via SHA256. |
| `POST`   | `/bundles/refresh`                           | admin         | Force-refresh the remote catalog transient. |
| `GET`    | `/starter`                                   | login         | Read the starter-pack runner state.        |
| `POST`   | `/starter/retry`                             | admin         | Force a synchronous starter-pack retry.    |

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
            "installed":   1713996000
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

Enable or disable an installed app, or update where it appears in WP
Desktop Mode. Disabled apps keep their files and manifest; their
desktop icon, taskbar item, native window, and serve endpoint stop
working until re-enabled. Surface changes are stored even while an app
is disabled and take effect on the next Desktop Mode registration pass.

**Auth:** admin
**Content-Type:** `application/json`

**Request body (optional):**

```json
{
    "enabled": true,
    "surfaces": { "desktop": true, "taskbar": false }
}
```

If `enabled` is omitted, the endpoint flips the current state.
If `surfaces` is present, only the provided keys are changed; missing
keys keep their current values. Both keys are booleans.

**Response** — `200 OK`:

```json
{
    "enabled": false,
    "surfaces": { "desktop": true, "taskbar": false }
}
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

> **Compatibility shim (v3.0+).** This endpoint now forwards to
> `/bundles/catalog?type=app`. It is retained so pre-v3.0 callers keep
> working. New code should call `/bundles/catalog` directly.

Return the app subset of the remote catalog, with an `installed` flag
per entry so UIs can flip "Install" buttons straight to "Open".

The catalog is fetched from
`https://odd.regionallyfamous.com/catalog/v1/registry.json` via
`wp_remote_get()`, cached in the `odd_catalog` transient for 12
hours, and served stale-on-failure. No entries are "built-in" — every
app downloads a remote `.wp` archive through `install-from-catalog`.

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
            "sha256":       "a1b2c3…",
            "size":         48241,
            "installed":    false
        }
    ]
}
```

---

### `POST /apps/install-from-catalog`

> **Compatibility shim (v3.0+).** This endpoint forwards to
> `/bundles/install-from-catalog`.

Install a catalog entry by slug. ODD downloads the bundle from
`download_url`, verifies the SHA256 against the registry entry,
validates the archive, and feeds it to `odd_apps_install()`.

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
| 404    | `not_in_catalog`      | Slug is not in the remote registry.                     |
| 409    | `already_installed`   | Something with that slug is already installed.          |
| 400    | `no_download`         | Catalog row has no `download_url`.                      |
| 400    | `insecure_download`   | `download_url` is not HTTPS. Override with the `odd_apps_allow_insecure_catalog` filter on dev hosts. |
| 400    | `checksum_mismatch`   | Downloaded bundle's SHA256 didn't match the registry.   |
| 502    | `catalog_fetch_failed` | The registry could not be loaded and no cached copy exists. |
| *varies* | (download errors)   | Any `WP_Error` from `download_url()` is passed through. |
| *varies* | (install errors)    | Any validation error from `POST /apps/upload` applies.  |

---

### `POST /bundles/refresh`

Force-refresh the remote-catalog transient. Use after publishing a
new bundle to skip the 12-hour cache. Returns the freshly-fetched
registry payload.

**Auth:** admin

**Response** — `200 OK`:

```json
{
    "refreshed":   true,
    "fetched_at":  1766428800,
    "entries":     42
}
```

**Errors:**

| Status | Code                   | Meaning                                                   |
|--------|------------------------|-----------------------------------------------------------|
| 502    | `catalog_fetch_failed` | `wp_remote_get` failed and no cached copy was available.  |

---

### `GET /starter`

Return the current state of the starter-pack runner. Useful for the
Shop to show "installing starter pack…" / "retry after backoff" states.

**Auth:** login

**Response** — `200 OK`:

```json
{
    "status":          "installed",
    "attempts":        1,
    "last_attempt":    1766428800,
    "last_error":      "",
    "installed":       [ "oddling-desktop", "oddlings" ],
    "prefs_set":       true
}
```

Possible `status` values: `"pending"`, `"running"`, `"installed"`,
`"failed"`. Failed states retry from the `init` safety net after the
backoff window, or immediately when an admin calls `/starter/retry`.

---

### `POST /starter/retry`

Force a synchronous retry of the starter-pack install. Bypasses the
exponential backoff schedule. Useful for admins triggering a manual
retry from the Shop's About panel after a catalog outage.

**Auth:** admin

**Response** — `200 OK` mirrors `GET /starter` after the run.

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

## See also

- [Building an App](building-an-app.md) — authoring guide.
- [`.wp` Manifest Reference](wp-manifest.md) — every `manifest.json` field across every bundle type.
- [Building on ODD](building-on-odd.md) — the extension API apps can tap via `manifest.extensions`.
