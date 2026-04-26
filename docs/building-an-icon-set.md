# Building an ODD Icon Set

> One of four ODD author guides. Siblings: [Building an App](building-an-app.md), [Building a Scene](building-a-scene.md), [Building a Widget](building-a-widget.md).

An icon set re-skins the WP Desktop dock and the desktop shortcuts
with a themed pack of SVGs. Drop a `.wp` on the ODD Shop and ODD
scans the manifest, scrubs every SVG, copies the set into
`wp-content/odd-icon-sets/`, and makes it selectable from the Icon
Sets department — no WordPress plugin, no custom PHP.

Icon sets ship **no JavaScript**, so they install without a consent
prompt.

---

## Anatomy

```
my-icons.wp
├── manifest.json
├── preview.svg            ← optional — 480×270 hero shown on the Shop card
└── icons/
    ├── dashboard.svg
    ├── posts.svg
    ├── pages.svg
    ├── media.svg
    ├── comments.svg
    ├── appearance.svg
    ├── plugins.svg
    ├── users.svg
    ├── tools.svg
    ├── settings.svg
    ├── profile.svg
    ├── links.svg
    └── fallback.svg
```

Paths inside `icons/` can be anything — the manifest maps the
13 required keys to paths of your choosing. The 13 keys are fixed:
**every icon set must ship all of them**.

## Manifest

```json
{
    "type":        "icon-set",
    "slug":        "my-icons",
    "name":        "My Icons",
    "label":       "My Icons",
    "version":     "1.0.0",
    "franchise":   "My Icons",
    "accent":      "#ff7a3c",
    "description": "Warm hand-drawn icons with a coffee-stained palette.",
    "preview":     "preview.svg",
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

| Field         | Required | Purpose                                                                    |
|---------------|----------|----------------------------------------------------------------------------|
| `type`        | yes      | Must be `"icon-set"`.                                                      |
| `slug`        | yes      | `^[a-z0-9-]+$`, globally unique across all bundle types.                   |
| `name`        | yes      | Display name in the Shop quilt + hero.                                     |
| `label`       | no       | Falls back to `name`.                                                      |
| `version`     | yes      | Semver-ish string.                                                         |
| `franchise`   | yes      | Free-form bucket that groups sets on the shelves.                          |
| `accent`      | yes      | `#hex` used behind the tile, under the quilt gradient, and in hover states.|
| `description` | no       | Longer copy shown on the detail sheet.                                     |
| `preview`     | no       | Relative path to an SVG/PNG/WebP hero (falls back to the `dashboard` icon).|
| `icons`       | yes      | Map of 13 required keys → relative SVG paths.                              |

### Why 13 keys?

The dock + desktop-shortcut filters map every WordPress menu slug to
one of 13 stable logical keys via `odd_icons_slug_to_key()`:

| Key           | Maps to                                   |
|---------------|-------------------------------------------|
| `dashboard`   | Dashboard, Home                           |
| `posts`       | Posts, `edit.php`                         |
| `pages`       | Pages, `edit.php?post_type=page`          |
| `media`       | Media, Uploads                            |
| `comments`    | Comments, `edit-comments.php`             |
| `appearance`  | Themes, Customize, Widgets, Menus         |
| `plugins`     | Plugins, `plugins.php`                    |
| `users`       | Users, Profile (when listing other users) |
| `tools`       | Tools, Import / Export                    |
| `settings`    | Settings, Options                         |
| `profile`     | Your own profile tile                     |
| `links`       | Legacy Links, any URL-browsing tool       |
| `fallback`    | Anything unmapped                         |

If the active set can't provide one of the logical keys, ODD reaches
for `fallback`, then finally the built-in "Default" set.

## SVG rules

Every SVG is scrubbed at install time. An SVG is rejected if any of
the following fail:

- Parses as well-formed XML.
- Contains a `viewBox` attribute (or explicit `width` + `height`).
- No `<script>` elements anywhere in the tree.
- No `on*` event handler attributes (`onclick`, `onload`, …).
- No external `xlink:href` / `href` values that escape the archive.
- No control bytes outside `\t`, `\n`, `\r` (byte < `0x20`).
- File size ≤ 64 KB (well above what any reasonable icon needs).

### Color conventions

**Tintable sets** (recommended) paint in `currentColor`, so the dock's
active / hover / disabled states pick up cleanly. ODD's tinted-SVG
endpoint serves any icon in a tint by URL when a consumer asks for one;
`currentColor` lets that work without search-and-replace:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
    <path d="M4 6h16M4 12h10M4 18h16"/>
</svg>
```

**Fixed-color sets** paint explicit fills / strokes. That's fine, but
you lose the hover + active tint hooks and icons render identically in
every state. Use fixed color when the palette is the point (enamel pins,
pixel art) and use `currentColor` everywhere else.

### Size + density

- Canvas: `viewBox="0 0 24 24"` is the ODD default; 20 or 28 work too.
- Aim for ~1–2 KB per icon after minification. Heavy clipPaths /
  filters can slow the dock paint on low-tier devices.
- Keep stroke widths consistent across the set — the dock lays them
  out at the same px size and mismatched weights read as sloppiness.

## preview.svg (optional)

If present, the Shop card uses it for the hero thumbnail — otherwise
the `dashboard` icon stands in. A preview image usually works best as:

- SVG or WebP, 480×270 (16:9).
- A composition of 6–9 icons from the set, not the whole alphabet.
- On a soft accent-tinted background that matches `manifest.accent`.

## Ship it

1. Zip the folder:

    ```bash
    cd my-icons/
    zip -r ../my-icons.wp manifest.json preview.svg icons/
    ```

2. Open the ODD Control Panel, click **Install** in the topbar (or
   drop the `.wp` anywhere on the Shop).
3. The Shop jumps to Icon Sets and flashes your new set's tile.
   Click **Preview** on the tile — the dock swaps in place. Click
   **Keep** to commit; ODD does a 180 ms fade and reloads so the
   server-side dock filter renders with your set applied.

## Debugging

- The icon registry is cached in a transient; installing or
  uninstalling a set busts the cache automatically. If the Shop shelf
  doesn't show your new set, re-open the panel — stale page-load data
  can hang around for one cycle.
- Inspect the stored manifest:

    ```bash
    wp option get odd_icon_set_my-icons
    ```

- List installed files on disk:

    ```bash
    find "$(wp eval 'echo WP_CONTENT_DIR;')/odd-icon-sets/my-icons/" -type f
    ```

- If the tinted-SVG endpoint 404s on one of your icons, double-check
  that the path in `manifest.icons` matches the actual file name
  (case-sensitive on Linux) and that the SVG is well-formed.

## See also

- [`.wp` Manifest Reference](wp-manifest.md) — full icon-set manifest schema.
- [Building on ODD](building-on-odd.md) — icon registry internals, slug-to-key mapping.
- Sibling author guides: [Building an App](building-an-app.md), [Building a Scene](building-a-scene.md), [Building a Widget](building-a-widget.md).
