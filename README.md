# ODD — Outlandish Desktop Decorator

**A desktop shop for WP Desktop Mode.**

[WP Desktop Mode](https://github.com/WordPress/desktop-mode) makes WordPress feel like a desktop. ODD gives that desktop a safe, updateable shop for wallpapers, icons, cursors, widgets, and small apps.

### [Try it live in WordPress Playground](https://odd.regionallyfamous.com/playground/)

No install, no signup, nothing to uninstall. Boots ODD + WP Desktop Mode in your browser in ~20–30 seconds.

---

## Why Use ODD

### Make WordPress Feel Personal

ODD turns the admin desktop into a place people actually want to use. Pick a live wallpaper, switch the dock icons, theme the cursor, and keep small desktop widgets nearby. New users get a starter look right away; admins can refresh the catalog as new content ships.

### Add Useful Tools Without More Plugins

Apps install from the same card you use to open them. Each app gets its own desktop icon, native window, and optional taskbar icon, but it does not require a separate WordPress plugin. The catalog includes tools for focus, planning, invoices, writing, color systems, pixel art, and sound design.

### Keep The Shop Fresh Without Plugin Releases

Visual content and app bundles live in a remote catalog. That means new wallpapers, card art, widgets, apps, icon sets, and cursor sets can publish through GitHub Pages without forcing every site to install a new plugin zip. Plugin releases are reserved for runtime changes and security fixes.

### Preview Before You Commit

Wallpapers, icon sets, and cursor sets preview instantly. Try a scene, theme, or cursor set, then keep it or roll back from the preview bar. Catalog cards update in place after install, so the thing you install is the thing you use.

---

## Install

### One-click demo

[**Launch ODD in WordPress Playground →**](https://odd.regionallyfamous.com/playground/)

First load takes ~20–30 seconds while Playground boots the site and installs the plugin. Throwaway — close the tab and it's gone.

### A real WordPress install

1. Download the latest `odd.zip` from the [Releases](https://github.com/RegionallyFamous/odd/releases) page.
2. WP Admin → Plugins → Add New → Upload Plugin → pick the zip → Activate.
3. Make sure [WP Desktop Mode](https://github.com/WordPress/desktop-mode) is installed + active, then flip on desktop mode from the admin bar.
4. Double-click the **ODD** desktop icon (or run `/odd-panel` from the ⌘K palette) to open the Shop.

**Requires:** WordPress 6.0+ · PHP 7.4+ · WP Desktop Mode v0.5.4+

---

## Build your own

Anyone can ship a scene, icon set, cursor set, widget, or app as a single `.wp` file. ODD validates the archive, checks catalog downloads against SHA256, and keeps app files behind authenticated serve paths. First-party content lives under `_tools/catalog-sources/` and publishes to the remote catalog through GitHub Pages; plugin releases are only for runtime/API changes.

- [Building an App](docs/building-an-app.md)
- [Building a Scene](docs/building-a-scene.md)
- [Building an Icon Set](docs/building-an-icon-set.md)
- [Building a Cursor Set](docs/building-a-cursor-set.md)
- [Building a Widget](docs/building-a-widget.md)
- [`.wp` Manifest Reference](docs/wp-manifest.md)

## Repo layout

- `odd/` — the plugin itself (what ships in `odd.zip`). **In v3.x this ships no catalog content** — just the PHP + JS runtime.
- `_tools/catalog-sources/` — source of truth for every bundle (scene / icon set / cursor set / widget / app). Rebuilt into `site/catalog/v1/` by `_tools/build-catalog.py`.
- `site/` — the [odd.regionallyfamous.com](https://odd.regionallyfamous.com) marketing site **and the remote catalog** (`site/catalog/v1/registry.json` + `bundles/` + `icons/`), deployed to GitHub Pages.
- `docs/` — authoring guides and reference docs.
- `ci/smoke/` — MU-plugin fixtures used by `install-smoke.yml` to test the starter-pack installer hermetically.
- `bin/` → see `odd/bin/` — `validate-catalog`, `validate-blueprint`, `check-version`, `build-zip`, `make-pot`.

## License

GPLv2 or later, matching [WP Desktop Mode](https://github.com/WordPress/desktop-mode). See [LICENSE](./LICENSE).

Integrating ODD into a larger plugin or theme? The filter / event / registry surface is documented in [Building on ODD](docs/building-on-odd.md) and on the [wiki](https://github.com/RegionallyFamous/odd/wiki).
