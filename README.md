# ODD — Outlandish Desktop Decorator

**The Luxe + Weird desktop shop for WP Desktop Mode.**

[WP Desktop Mode](https://github.com/WordPress/desktop-mode) makes WordPress feel like a desktop. ODD gives that desktop a polished, updateable shop for living wallpapers, icon costumes, pointer themes, draggable widgets, and tiny apps that open in native Desktop Mode windows.

### [Try it live in WordPress Playground](https://odd.regionallyfamous.com/playground/)

No install, no signup, nothing to uninstall. Boots ODD + WP Desktop Mode in your browser in ~20–30 seconds.

---

## Why Use ODD

### Make WordPress Feel Like Your Place

ODD turns the admin desktop into a place people actually want to open. Pick a live wallpaper, dress the dock in a new icon set, give the pointer a personality, and park useful widgets exactly where you want them. Fresh installs get a complete starter look right away; the catalog keeps growing without making you chase plugin updates.

### Add Useful Tools Without More Plugins

Apps install from the same card you use to open them. Each app gets its own desktop icon, native window, and optional taskbar launcher, but it does not require a separate WordPress plugin. The catalog includes tools for focus, planning, invoices, writing, color systems, pixel art, and sound design.

### Browse A Real Shop, Not A Settings Dump

The ODD Shop has responsive light/dark chrome, department glyphs, editorial shelves, global search, preview bars, compact settings, and just enough Oddling chaos to feel alive. Wallpapers, icon sets, and cursors preview before they commit, so exploration stays playful and reversible.

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

1. Install and activate [WP Desktop Mode](https://github.com/WordPress/desktop-mode) v0.6.0 or newer.
2. Download the latest `odd.zip` from the [Releases](https://github.com/RegionallyFamous/odd/releases/latest) page.
3. WP Admin → Plugins → Add New → Upload Plugin → pick the zip → Activate.
4. Double-click the **ODD** desktop icon, use the taskbar icon, or run `/odd-panel` from the command palette to open the Shop.

**Requires:** WordPress 6.0+ · PHP 7.4+ · WP Desktop Mode v0.6.0+

---

## Build your own

Anyone can ship a scene, icon set, cursor set, widget, or app as a single `.wp` file. ODD validates the archive, checks catalog downloads against SHA256, and keeps app files behind authenticated serve paths. First-party content lives under `_tools/catalog-sources/` and publishes to the remote catalog through GitHub Pages; plugin releases are only for runtime/API changes.

- [Building an App](docs/building-an-app.md)
- [Building a Scene](docs/building-a-scene.md)
- [Building an Icon Set](docs/building-an-icon-set.md)
- [Building a Cursor Set](docs/building-a-cursor-set.md)
- [Building a Widget](docs/building-a-widget.md)
- [`.wp` Manifest Reference](docs/wp-manifest.md)
- [ODD Shop State Machine](docs/store-state-machine.md)
- [Release Runbook](docs/release-runbook.md)

## Repo layout

- `odd/` — the plugin itself (what ships in `odd.zip`). The 1.0 runtime is intentionally lightweight; catalog content installs on demand.
- `_tools/catalog-sources/` — source of truth for every bundle (scene / icon set / cursor set / widget / app). Rebuilt into `site/catalog/v1/` by `_tools/build-catalog.py`.
- `site/` — the [odd.regionallyfamous.com](https://odd.regionallyfamous.com) marketing site **and the remote catalog** (`site/catalog/v1/registry.json` + `bundles/` + `icons/`), deployed to GitHub Pages.
- `docs/` — authoring guides and reference docs.
- `ci/smoke/` — MU-plugin fixtures used by `install-smoke.yml` to test the starter-pack installer hermetically.
- `bin/` → see `odd/bin/` — `validate-catalog`, `validate-blueprint`, `check-version`, `build-zip`, `make-pot`.

## License

GPLv2 or later, matching [WP Desktop Mode](https://github.com/WordPress/desktop-mode). See [LICENSE](./LICENSE).

Integrating ODD into a larger plugin or theme? The filter / event / registry surface is documented in [Building on ODD](docs/building-on-odd.md) and on the [wiki](https://github.com/RegionallyFamous/odd/wiki).
