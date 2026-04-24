# B-Roll Icons for WP Desktop Mode

Themed icon sets that re-skin the **WP Desktop Mode** Dock, Taskbar, and Desktop icons. Pick a set from the floating pill in the bottom-right of the shell and every core admin icon (Dashboard, Posts, Pages, Media, Users, Settings, …) renders in that set's visual language.

**Sibling plugin to [B-Roll](../).** Independent pick — your wallpaper and your icon set can match or mix. Ship together or separately.

**Requires:** WordPress 6.0+ · PHP 7.4+ · WP Desktop Mode (active)

## v0.1.0 — Code Rain flagship

One set, shipping now: **Code Rain** (The Matrix) — monochrome phosphor-green wireframe icons at 24×24, crisp at every Dock size, bundled as transparent SVG (≈6 KB for the whole set). The picker pill appears next to B-Roll's wallpaper gear when both plugins are active, or on its own when b-roll-icons ships solo.

Included icons:

| Key | Menu slug | Design |
|---|---|---|
| `dashboard`   | `index.php`                 | Four cascading-katakana columns with a bright-white leader in the first |
| `posts`       | `edit.php`                  | Rolled scroll with matrix-glyph lines |
| `pages`       | `edit.php?post_type=page`   | Stacked sheets with folded corners and a shadow layer |
| `media`       | `upload.php`                | CRT-frame eye: rectangle + target-reticle circle |
| `comments`    | `edit-comments.php`         | Speech bubble with a blinking cursor `\|` |
| `appearance`  | `themes.php`                | Paintbrush trailing a dripping glyph |
| `plugins`     | `plugins.php`               | Power-plug silhouette over a circuit prong |
| `users`       | `users.php`                 | Agent silhouette with sunglass visor |
| `tools`       | `tools.php`                 | Crossed wrench + screwdriver |
| `settings`    | `options-general.php`       | Gear with dot-pattern core |
| `profile`     | `profile.php`               | Torso/head silhouette with name-card lines |
| `links`       | `link-manager.php`          | Interlocked chain links |
| `fallback`    | (anything else)             | Single bright phosphor glyph |

CPTs (`edit.php?post_type=<foo>`) use the `posts` icon automatically. Anything registered by a plugin menu we don't have a mapping for uses `fallback`.

## Architecture

```
b-roll-icons/
├── b-roll-icons.php            Plugin header + bootstrap
├── includes/
│   ├── registry.php            Load sets/<slug>/manifest.json, cache, per-user active slug
│   ├── dock-filter.php         Hooks wp_desktop_dock_items + wp_desktop_icons
│   ├── rest.php                POST/GET /b-roll-icons/v1/prefs
│   └── enqueue.php             Enqueue picker JS on wp_desktop_mode_init
├── src/
│   └── picker.js               Vanilla DOM floating pill + popover (no build step)
├── sets/
│   └── code-rain/
│       ├── manifest.json
│       ├── dashboard.svg   posts.svg   pages.svg   media.svg
│       ├── comments.svg    appearance.svg   plugins.svg   users.svg
│       ├── tools.svg       settings.svg     profile.svg   links.svg
│       └── fallback.svg
└── bin/
    └── validate-sets           Validates every set (JSON + SVG XML + on-disk match)
```

### How the swap works

1. **PHP filter.** When the WP Desktop Mode shell builds its dock, `wpdm_build_dock_items()` calls `apply_filters( 'wp_desktop_dock_items', $items )`. Our filter maps each item's menu slug (`edit.php` → `posts`, `upload.php` → `media`, …) to the active set's icon URL (`plugins/b-roll-icons/sets/code-rain/posts.svg`). Unmatched items fall back to `fallback.svg` so every tile feels themed.
2. **Desktop icons.** Same treatment for `wp_desktop_icons` — shell-surface tiles registered via `wp_register_desktop_icon()` get their `icon` field rewritten before shipping to the client.
3. **Live swap.** When the user picks a new set from the pill, we also walk the shell's rendered `<wpd-dock>` tiles client-side and poke each `<img>` src without a reload. The next full page load gets the same URLs from the server — so client-side and server-side agree.

### Adding a new set

1. `mkdir sets/<your-slug>`
2. Drop 1–13 SVGs there (more = more coverage; `fallback.svg` catches everything else).
3. Write `manifest.json`:

```json
{
  "slug": "<your-slug>",
  "label": "Your Set",
  "franchise": "Source material",
  "accent": "#ff2d9f",
  "description": "One-sentence pitch for the picker.",
  "preview": "dashboard.svg",
  "icons": {
    "dashboard": "dashboard.svg",
    "posts":     "posts.svg",
    "fallback":  "fallback.svg"
  }
}
```

4. Run `bin/validate-sets` to check it parses + every referenced SVG is on disk + every SVG is well-formed XML.
5. That's it — no PHP edit, no JS build. `b_roll_icons_get_sets()` scans the `sets/` directory at request time.

SVGs must be:
- Well-formed XML (run `bin/validate-sets`)
- Have `viewBox` OR `width`+`height` on the root `<svg>`
- Use flat filenames (no subdirs)
- No `data:` / `javascript:` URLs — the shell's `wpdm_sanitize_dock_icon()` rejects those

## REST

- `GET /wp-json/b-roll-icons/v1/prefs` — returns `{ active, sets }`
- `POST /wp-json/b-roll-icons/v1/prefs` — body `{ set: '<slug>' }` or `{ set: 'none' }`, nonce-gated (`X-WP-Nonce`), logged-in users only. Stored in user_meta `b_roll_icons_set`.

## Dev console

```javascript
window.__bRollIcons.get();            // current active slug
window.__bRollIcons.set( 'code-rain' );
window.__bRollIcons.set( 'none' );
window.__bRollIcons.open();
window.__bRollIcons.sets();           // all registered sets
```

## Planned

- **More sets**: Outrun (neon magenta+cyan), Code Rain cyan variant, Soot Sprites (minimal black+white), Hyperspace (white/blue line-art). Each is ~10–13 SVGs at ≤1 KB each.
- **Taskbar icons**: plugin menus routed to the floating taskbar pill get the same treatment automatically — already works in v0.1.0 but only coverage is `fallback.svg`.
- **Accent autotint**: inherit the WP Desktop Mode accent and apply `color:` to each SVG via `<img>` → `<object>` swap, so a single monochrome set re-colors to match the active wallpaper. Opt-in per set.
- **Raster fallback**: optional PNG beside each SVG for shell paths that can't render inline SVG (rare — Pixi dock renderers can, browsers can).
