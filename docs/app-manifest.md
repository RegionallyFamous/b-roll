# App Manifest Reference

> Status: v1.0.8. Mirrored to the
> [App Manifest Reference](https://github.com/RegionallyFamous/odd/wiki/App-Manifest-Reference)
> wiki page.

Every ODD app ships a `manifest.json` at the root of its archive. It
tells ODD the app's identity, which HTML file to load, which desktop
icon / window chrome to use, and optionally which core registries
the app wants to extend.

```json
{
    "slug":        "my-app",
    "name":        "My App",
    "version":     "1.0.0",
    "author":      "Your Name",
    "description": "A short sentence for the dock and panel cards.",
    "icon":        "icon.svg",
    "entry":       "index.html",
    "capability":  "read",
    "window":      { "width": 720, "height": 520, "min_width": 420, "min_height": 320 },
    "desktopIcon": { "title": "My App", "position": 300 },
    "extensions": {
        "muses":            [],
        "commands":         [],
        "widgets":          [],
        "rituals":          [],
        "motionPrimitives": []
    }
}
```

Only `slug`, `name`, and `version` are required.

---

## Field reference

### `slug` (required)

| Property | Value                                   |
|----------|-----------------------------------------|
| Type     | `string`                                |
| Pattern  | `^[a-z0-9-]+$`                          |
| Example  | `"ledger"`                              |

Unique identifier. Used as:

- the directory name under `wp-content/odd-apps/<slug>/`,
- the path segment in every REST URL (`/odd/v1/apps/serve/<slug>/…`),
- the WP Desktop Mode window id (`odd-app-<slug>`),
- the key in the `odd_apps_index` option.

**The slug is permanent.** Changing it after install requires deleting
and re-installing. Lowercase letters, numbers, and hyphens only.

### `name` (required)

| Property | Value         |
|----------|---------------|
| Type     | `string`      |
| Example  | `"Ledger"`    |

Human-readable display name. Shown on the desktop icon, in the app's
native window title bar, and on the panel's app cards.

### `version` (required)

| Property | Value                                    |
|----------|------------------------------------------|
| Type     | `string`                                 |
| Format   | Semver recommended (`MAJOR.MINOR.PATCH`) |
| Example  | `"1.0.0"`                                |

Free-form version string. ODD doesn't enforce semver today, but a
semver tag makes future update flows predictable.

### `author`

| Property | Value                             |
|----------|-----------------------------------|
| Type     | `string` (optional)               |
| Example  | `"Regionally Famous"`             |

Creator name shown in the panel's app card. Can be a person, team, or
company.

### `description`

| Property | Value                                                         |
|----------|---------------------------------------------------------------|
| Type     | `string` (optional)                                           |
| Example  | `"Get paid. Track clients, generate invoices, log payments."` |

One or two sentences describing the app. Shown on app cards and (when
distributed through the catalog) in the Get More Apps gallery.

### `icon`

| Property | Value                                                   |
|----------|---------------------------------------------------------|
| Type     | `string` — relative path inside the archive, or absolute URL |
| Default  | `"icon.svg"`                                            |
| Example  | `"icon.svg"`, `"assets/logo.svg"`, `"https://example.com/icon.svg"` |

Icon for the dock tile and desktop shortcut. Supported formats:

| Format | Notes                                                                                     |
|--------|-------------------------------------------------------------------------------------------|
| SVG    | Recommended. Keep under 4 KB. Scales cleanly across dock sizes.                           |
| PNG / JPG / WebP | Served via `/odd/v1/apps/icon/<slug>`. Use 40×40 px for crisp rendering at 2× DPI. |

Relative paths are resolved against the archive root and served via the
public icon endpoint (`<img>` tags can't send an `X-WP-Nonce` header,
so icons are the single unauthenticated surface of the Apps REST API
and only the declared path is reachable). Absolute `http://` or
`https://` URLs are passed through as-is.

If the file is missing, the dock falls back to a generic cog.

### `entry`

| Property | Value                                                            |
|----------|------------------------------------------------------------------|
| Type     | `string` (optional, path relative to archive root)               |
| Default  | `"index.html"`                                                   |
| Pattern  | `^[a-zA-Z0-9._-]+(/[a-zA-Z0-9._-]+)*$`                           |
| Example  | `"index.html"`, `"app.html"`, `"dist/index.html"`                |

The HTML file ODD loads in the iframe. Must exist in the archive and
must not contain `..` or path-traversal sequences.

Tip: if your build tool emits to a subdirectory (e.g. `dist/`), you
have two options — either set `"entry": "dist/index.html"` in the
manifest, or `cd dist/` before zipping so `index.html` sits at the
archive root. The latter is usually cleaner because all relative asset
paths inside the HTML line up without a prefix.

### `capability`

| Property | Value                                                       |
|----------|-------------------------------------------------------------|
| Type     | `string`                                                    |
| Default  | `"manage_options"`                                          |
| Example  | `"read"`, `"edit_posts"`, `"manage_options"`                |

The WordPress capability a user must have to open the app. Checked on
every request to `/odd/v1/apps/serve/<slug>/…`. Common values:

| Capability       | Who has it                                 |
|------------------|--------------------------------------------|
| `read`           | All logged-in users (Subscribers and above).|
| `edit_posts`     | Contributors, Authors, Editors, Admins.    |
| `publish_posts`  | Authors, Editors, Administrators.          |
| `manage_options` | Administrators only.                       |

Public-facing utility apps should lower the default to `"read"`. Admin-
only tools can leave it at `"manage_options"`. For finer-grained access
checks, perform them inside the app via
`GET /wp-json/wp/v2/users/me` and hide UI accordingly.

### `window`

| Property | Value                                                           |
|----------|-----------------------------------------------------------------|
| Type     | `object` (optional)                                             |

Controls the native WP Desktop Mode window that opens when the user
launches the app. All sub-fields optional.

| Sub-field   | Type      | Default | Notes                                    |
|-------------|-----------|---------|------------------------------------------|
| `width`     | `integer` | `860`   | Initial width in CSS pixels.             |
| `height`    | `integer` | `600`   | Initial height.                          |
| `min_width` | `integer` | `420`   | Minimum width the user can drag to.      |
| `min_height`| `integer` | `320`   | Minimum height.                          |
| `title`     | `string`  | `name`  | Title bar text. Defaults to `name` if absent.|

```json
"window": {
    "width":      720,
    "height":     520,
    "min_width":  480,
    "min_height": 360
}
```

### `desktopIcon`

| Property | Value                                                           |
|----------|-----------------------------------------------------------------|
| Type     | `object` (optional)                                             |

Controls the desktop shortcut icon paired with the app's window.

| Sub-field  | Type      | Default | Notes                                       |
|------------|-----------|---------|---------------------------------------------|
| `title`    | `string`  | `name`  | Label shown under the icon.                 |
| `position` | `integer` | `200`   | Ordering hint. Lower numbers appear first.  |

```json
"desktopIcon": {
    "title":    "My App",
    "position": 300
}
```

Position numbers are relative — the built-in ODD icon sits at 1, so any
app `position` between `2` and `999` keeps the app ordered after it.
Collisions with other apps are resolved by name.

### `extensions`

| Property | Value               |
|----------|---------------------|
| Type     | `object` (optional) |

Declares registrations against ODD's core extension registries. Each
child is an array of entries forwarded to the matching
`odd_register_*()` helper on install and on every pageload (at `init`
priority 6), so your registrations persist without a companion PHP
plugin.

Supported children:

| Key                 | Forwards to                         | Registry       |
|---------------------|-------------------------------------|----------------|
| `muses`             | `odd_register_muse()`               | `odd.muses`    |
| `commands`          | `odd_register_command()`            | `odd.commands` |
| `widgets`           | `odd_register_widget()`             | `odd.widgets`  |
| `rituals`           | `odd_register_ritual()`             | `odd.rituals`  |
| `motionPrimitives`  | `odd_register_motion_primitive()`   | `odd.motionPrimitives` |

Every entry must have a `slug`. Invalid entries are skipped silently —
a malformed manifest will never crash the admin. Each entry gets tagged
`source: "app:<your-slug>"` so the debug inspector can distinguish
app-sourced registrations from core / plugin ones.

Example: a muse with a per-open voice line and a palette command:

```json
"extensions": {
    "muses": [
        {
            "slug":  "ledger",
            "voice": {
                "appOpen":  { "ledger": [ "Let's get paid." ] },
                "sceneOpen":{ "flux":   [ "Numbers, but make it art." ] }
            }
        }
    ],
    "commands": [
        {
            "slug":  "open-ledger",
            "label": "Open Ledger",
            "run":   "odd.apps.open:ledger"
        }
    ]
}
```

See [Building on ODD](building-on-odd.md#registries-extension-api) for
the full contract of each registry shape.

---

## Runtime fields

ODD writes a couple of additional fields into the stored manifest
(`odd_app_<slug>` option) at install time. Do not set these in your
source `manifest.json` — they'll be overwritten:

| Field       | Added by                          |
|-------------|-----------------------------------|
| `installed` | `odd_apps_install()` — unix timestamp.|
| `enabled`   | `odd_apps_install()` / `set_enabled()` — bool.|
| `builtin`   | `odd_apps_install_builtin()` — true for built-in catalog apps copied in-place. |

They're exposed on `GET /odd/v1/apps/<slug>` so the panel can flag app
state, but they're not part of the authoring contract.

---

## Validation summary

ODD rejects an archive on upload if any of the following fail:

| Check                                                            | Error code              |
|------------------------------------------------------------------|-------------------------|
| File extension is `.odd` or `.wp`                                | `invalid_extension`     |
| File opens as a ZIP                                              | `invalid_zip`           |
| Archive contains ≤ 2,000 files                                   | `too_many_files`        |
| No path-traversal (`..` or leading `/`) in any entry             | `path_traversal`        |
| No symlinks                                                      | `symlink_in_archive`    |
| No forbidden extensions (see [Building an App](building-an-app.md#limits-and-validation)) | `forbidden_file_type`   |
| Per-file compression ratio ≤ 100:1                               | `zip_bomb`              |
| Total uncompressed size ≤ 25 MB                                  | `too_large`             |
| `manifest.json` exists at root                                   | `missing_manifest`      |
| `manifest.json` parses as JSON                                   | `invalid_manifest`      |
| `name` / `slug` / `version` present and non-empty                | `missing_manifest_field`|
| `slug` matches `^[a-z0-9-]+$`                                    | `invalid_slug`          |
| `slug` not already installed                                     | `slug_exists`           |
| `entry` path passes the sanity regex                             | `invalid_entry`         |
| `entry` file is present in the archive                           | `missing_entry`         |

---

## Fields ODD does *not* support

If you're migrating from Bazaar, these manifest fields are silently
ignored — they'll pass validation but have no effect:

- `shared` (shared library import maps)
- `permissions`, `permissions_network`, `zero_trust` (zero-trust SW)
- `health_check` (health-polling endpoint)
- `jobs` (WP-Cron background jobs)
- `license` (license-key enforcement)
- `updateUrl`, `homepage` (remote update metadata)
- `signature` (RSA archive signing)
- `trust` (sandbox trust level)
- `settings` (admin-editable config schema)
- `search_endpoint` (shell search integration)
- `menu.*` (Bazaar used wp-admin sidebar menus; ODD uses desktop icons + native windows)

Your Bazaar ware will still install and run — ODD just doesn't enforce
any of those features today.

---

## See also

- [Building an App](building-an-app.md) — authoring guide.
- [Apps REST API](app-rest-api.md) — endpoint reference.
- [Building on ODD](building-on-odd.md) — the registries your app can extend.
