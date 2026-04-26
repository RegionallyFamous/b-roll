# `.wp` Manifest Reference

Every ODD bundle — app, icon set, scene, or widget — ships a
`manifest.json` at the root of its `.wp` archive. The manifest
carries a shared header (identity, versioning, type) and a per-type
body (entry points, icons, preview assets).

This page is the canonical field reference. Author guides live
alongside:

- [Building an App](building-an-app.md)
- [Building a Scene](building-a-scene.md)
- [Building an Icon Set](building-an-icon-set.md)
- [Building a Widget](building-a-widget.md)

---

## Shared header — every type uses this

```json
{
    "type":        "app",
    "slug":        "my-bundle",
    "name":        "My Bundle",
    "version":     "1.0.0",
    "author":      "Your Name",
    "description": "A short sentence for Shop cards.",
    "icon":        "icon.svg"
}
```

| Field         | Required | Pattern / Type                              | Notes                                                                  |
|---------------|----------|---------------------------------------------|------------------------------------------------------------------------|
| `type`        | no       | `"app" \| "icon-set" \| "scene" \| "widget"` | Defaults to `"app"` for back-compat with v1.7.x bundles.              |
| `slug`        | yes      | `^[a-z0-9-]+$`, 1–64 chars                  | Globally unique across **all** installed bundles (any type).           |
| `name`        | yes      | non-empty string                            | Display name on Shop cards + native window titles.                     |
| `version`     | yes      | non-empty string                            | Semver recommended. Drives the `ver` query on every enqueued asset.    |
| `author`      | no       | string                                      | Shown on the detail sheet.                                             |
| `description` | no       | string                                      | One or two sentences. Shown on the tile + the detail sheet.            |
| `icon`        | no       | relative path or absolute URL               | Fallbacks: apps use a cog, icon sets use the dashboard icon, scenes use their preview, widgets use a generic glyph. |

### Global slug uniqueness

A slug identifies a bundle across every type. You **cannot** install
`my-thing` as an icon set if `my-thing` is already an app. The Shop
rejects the second upload with `slug_exists`. The same rule applies
when an author tries to reuse a slug that's already taken by a
built-in: e.g. `flux` is baked in as a scene.

---

## Per-type fields

### Type: `app`

Covered in full by the [Building an App](building-an-app.md) guide.

```json
{
    "type":        "app",
    "slug":        "ledger",
    "name":        "Ledger",
    "version":     "1.0.0",
    "entry":       "index.html",
    "capability":  "read",
    "window":      { "width": 720, "height": 520, "min_width": 420, "min_height": 320 },
    "desktopIcon": { "title": "Ledger", "position": 300 },
    "extensions":  { "muses": [], "commands": [], "widgets": [], "rituals": [], "motionPrimitives": [] }
}
```

| Field         | Required | Notes                                                                        |
|---------------|----------|------------------------------------------------------------------------------|
| `entry`       | no       | Defaults to `"index.html"`. Path relative to archive root, no `..`.          |
| `capability`  | no       | Defaults to `"manage_options"`. Checked on every serve request.              |
| `window`      | no       | `{ width, height, min_width, min_height, title }`.                           |
| `desktopIcon` | no       | `{ title, position }`. Position is an ordering hint (lower = earlier).       |
| `extensions`  | no       | Declarative registrations against the ODD extension registries.              |

### Type: `icon-set`

Covered in full by [Building an Icon Set](building-an-icon-set.md).

```json
{
    "type":      "icon-set",
    "slug":      "aurora",
    "name":      "Aurora",
    "version":   "1.0.0",
    "franchise": "Aurora",
    "accent":    "#7cc0ff",
    "preview":   "preview.svg",
    "icons": {
        "dashboard":  "icons/dashboard.svg",
        "posts":      "icons/posts.svg",
        "pages":      "icons/pages.svg",
        "media":      "icons/media.svg",
        "comments":   "icons/comments.svg",
        "appearance": "icons/appearance.svg",
        "plugins":    "icons/plugins.svg",
        "users":      "icons/users.svg",
        "tools":      "icons/tools.svg",
        "settings":   "icons/settings.svg",
        "profile":    "icons/profile.svg",
        "links":      "icons/links.svg",
        "fallback":   "icons/fallback.svg"
    }
}
```

| Field       | Required | Notes                                                                    |
|-------------|----------|--------------------------------------------------------------------------|
| `franchise` | yes      | Free-form bucket label used on the Shop shelves.                         |
| `accent`    | yes      | `#hex`. Paints the tile, quilt gradient, and hover states.               |
| `preview`   | no       | Relative path to a hero SVG/PNG/WebP. Falls back to `icons.dashboard`.   |
| `icons`     | yes      | Map of 13 required keys (see guide) → relative SVG paths.                |

Every SVG is scrubbed on install: no `<script>`, no `on*` attributes,
no external `xlink:href`/`href`, no control bytes outside `\t\n\r`,
valid `viewBox` or `width+height`.

### Type: `scene`

Covered in full by [Building a Scene](building-a-scene.md).

```json
{
    "type":          "scene",
    "slug":          "my-scene",
    "name":          "My Scene",
    "version":       "1.0.0",
    "franchise":     "Generative",
    "tags":          [ "blue", "slow" ],
    "fallbackColor": "#112233",
    "added":         "2026-04-26",
    "entry":         "scene.js",
    "preview":       "preview.webp",
    "wallpaper":     "wallpaper.webp"
}
```

| Field           | Required | Notes                                                                |
|-----------------|----------|----------------------------------------------------------------------|
| `franchise`     | yes      | Free-form bucket for the Shop quilt ("Generative", "Paper", …).      |
| `tags`          | yes      | Array of short strings. Drives search + muse tone selection.         |
| `fallbackColor` | yes      | `#hex` painted under the canvas before the first frame draws.        |
| `added`         | yes      | `YYYY-MM-DD`. Used for "new" badges + sort-by-freshness.             |
| `entry`         | yes      | Relative path to the self-registering `.js`, no `..`.                |
| `preview`       | yes      | Relative path to the ~640×360 WebP shown on the Shop card.           |
| `wallpaper`     | yes      | Relative path to the 1920×1080 WebP painted behind the canvas.       |

Scene JavaScript is enqueued on every admin page with `odd` as a
dependency, so `window.__odd`, `env`, and `PIXI` are available at
load time. Installing a scene triggers the one-time JS confirmation
prompt (admins only).

### Type: `widget`

Covered in full by [Building a Widget](building-a-widget.md).

```json
{
    "type":        "widget",
    "slug":        "pomodoro",
    "name":        "Pomodoro",
    "version":     "1.0.0",
    "entry":       "widget.js",
    "icon":        "icon.svg",
    "preview":     "preview.webp",
    "defaultSize": { "width": 220, "height": 180 }
}
```

| Field         | Required | Notes                                                               |
|---------------|----------|---------------------------------------------------------------------|
| `entry`       | yes      | Relative path to the JS that calls `wp.desktop.registerWidget()`.   |
| `icon`        | no       | SVG/PNG/WebP shown on the Shop tile.                                |
| `preview`     | no       | Hero WebP shown on the detail sheet.                                |
| `defaultSize` | no       | `{ width, height }` in CSS px.                                      |

Widget JavaScript is enqueued on every admin page with `wp-desktop`
and `odd-api` as dependencies. Installing a widget triggers the
one-time JS confirmation prompt (admins only).

---

## Runtime fields

ODD writes a couple of additional fields into the stored manifest
(e.g. `odd_app_<slug>`, `odd_scene_<slug>`) at install time. Do **not**
set these in your source `manifest.json` — they'll be overwritten:

| Field       | Added by                           | Meaning                                       |
|-------------|------------------------------------|-----------------------------------------------|
| `installed` | Per-type installer                 | Unix timestamp of the install.                |
| `enabled`   | Apps-only: `odd_apps_set_enabled`  | Whether the app surfaces in the dock.         |
| `builtin`   | Apps-only                          | True for built-in catalog apps copied in-place.|

These are exposed on `GET /odd/v1/bundles/<slug>` (and the older
`GET /odd/v1/apps/<slug>`) so the Shop can flag state, but they're
not part of the authoring contract.

---

## Validation summary

Every bundle upload is validated against these checks. The relevant
error code is shown; they surface as `{ code, message }` in the REST
response and as friendly copy in the Shop topbar pill.

### Archive-level

| Check                                                     | Error code              |
|-----------------------------------------------------------|-------------------------|
| File extension is `.wp`                                   | `invalid_extension`     |
| File opens as a ZIP                                       | `invalid_zip`           |
| Archive contains ≤ 2,000 files                            | `too_many_files`        |
| No path-traversal (`..` or leading `/`) in any entry      | `path_traversal`        |
| No symlinks                                               | `symlink_in_archive`    |
| No forbidden extensions (`.php`, `.phtml`, `.phar`, `.cgi`, `.pl`, `.py`, `.rb`, `.sh`, `.bash`, etc.) | `forbidden_file_type` |
| Per-file compression ratio ≤ 100:1                        | `zip_bomb`              |
| Total uncompressed size ≤ 25 MB                           | `too_large`             |

### Shared header

| Check                                                     | Error code              |
|-----------------------------------------------------------|-------------------------|
| `manifest.json` exists at root                            | `missing_manifest`      |
| `manifest.json` parses as JSON                            | `invalid_manifest`      |
| `name` / `slug` / `version` present and non-empty         | `missing_manifest_field`|
| `slug` matches `^[a-z0-9-]+$`                             | `invalid_slug`          |
| `type`, if set, is one of the four supported values       | `unsupported_type`      |
| `slug` is not already installed (any type)                | `slug_exists`           |

### Per-type

| Type       | Extra checks                                                                                   |
|------------|------------------------------------------------------------------------------------------------|
| `app`      | `entry` matches the entry regex + file exists in the archive.                                  |
| `icon-set` | `icons` present, all 13 keys mapped, each path is a real SVG, each SVG passes the scrubber.    |
| `scene`    | `entry`, `preview`, `wallpaper` all present in the archive; `fallbackColor` is a `#hex`.       |
| `widget`   | `entry` matches the entry regex + file exists in the archive.                                  |

---

## See also

- [Building an App](building-an-app.md)
- [Building a Scene](building-a-scene.md)
- [Building an Icon Set](building-an-icon-set.md)
- [Building a Widget](building-a-widget.md)
- [Building on ODD](building-on-odd.md) — extension registries + debug inspector (for integrators).
- [Apps REST API](app-rest-api.md) — endpoint reference.
