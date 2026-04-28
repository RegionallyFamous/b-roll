# ODD — Outlandish Desktop Decorator

**The missing app store for WP Desktop Mode.**

[WP Desktop Mode](https://github.com/WordPress/desktop-mode) makes your WordPress admin feel like a real desktop. ODD gives that desktop somewhere to go.

### [Try it live in WordPress Playground](https://odd.regionallyfamous.com/playground/)

No install, no signup, nothing to uninstall. Boots ODD + WP Desktop Mode in your browser in ~20–30 seconds.

---

## What you can do with it

### Actually do the work — right inside WordPress.

Click install in the Shop and the app is on your desktop. Its own icon. Its own window. Its own taskbar pill if you want one. No ZIP upload, no FTP, no plugin-upload dance.

Out of the box:

- **Plan your week and ship it.** Run Pomodoro sessions with ambient sound and a show-up heatmap (**Flow**). Move client work across kanban columns (**Board**). Track invoices and payments without leaving WordPress (**Ledger**).
- **Write together.** Keep the whole team's knowledge in a fast markdown wiki with search (**Tome**) and close one more SaaS tab.
- **Design stuff.** Build a color system with harmony rules + WCAG contrast checks and export to CSS, Tailwind, or SVG (**Swatch**). Paint a 32×32 icon with real drawing tools and PNG export (**Mosaic**). Make actual sounds — four-waveform synth with ADSR, a resonant filter, and a step sequencer (**Sine**).
- **Add anything else.** Any `.wp` bundle drops straight into the Shop and installs. The catalog grows from there.

### Make the desktop a place you want to open.

- **Pick a wallpaper you actually want to look at.** Twenty live scenes — abstract ribbon fields, procedural auroras, rainfall that splashes on your real windows and dock, a tropical greenhouse at golden hour, and the Oddling Desktop starter scene. Every frame drawn fresh. Time-of-day aware. Optionally reacts to your microphone if you let it.
- **Re-skin the whole desktop.** Eighteen icon packs swap every dock and shortcut icon in one click — Arctic frost blues, Blueprint construction strokes, Claymation, Hologram, Cross-Stitch, Arcade Tokens, Oddlings, and more. The current catalog uses full-color iOS-style SVGs with distinct silhouettes per set, not one recolored glyph system.
- **Keep little things within reach.** Drop a handwritten sticky note or a Magic 8-Ball onto the desktop and drag them wherever feels right.

### Try it before you commit.

Every wallpaper and icon pack previews instantly. Wander the Shop, let a scene run for a minute, then keep it or roll back with one click. The preview bar floats in the corner until you decide — it's the Mac App Store "try before you buy" flow, for your own desktop.

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

**Requires:** WordPress 6.0+ · PHP 7.4+ · WP Desktop Mode v0.5.1+

---

## Build your own

Anyone can ship a scene, icon set, widget, or app as a single `.wp` file and hand it to an ODD user — they drop it on the Shop and it installs. No companion plugin required. First-party content lives under `_tools/catalog-sources/` and is published to the remote catalog by GitHub Pages; plugin releases are only for runtime changes.

- [Building an App](docs/building-an-app.md)
- [Building a Scene](docs/building-a-scene.md)
- [Building an Icon Set](docs/building-an-icon-set.md)
- [Building a Widget](docs/building-a-widget.md)
- [`.wp` Manifest Reference](docs/wp-manifest.md)

## Repo layout

- `odd/` — the plugin itself (what ships in `odd.zip`). **As of v3.0 this is empty of content** — just the PHP + JS runtime.
- `_tools/catalog-sources/` — source of truth for every bundle (scene / icon set / widget / app). Rebuilt into `site/catalog/v1/` by `_tools/build-catalog.py`.
- `site/` — the [odd.regionallyfamous.com](https://odd.regionallyfamous.com) marketing site **and the remote catalog** (`site/catalog/v1/registry.json` + `bundles/` + `icons/`), deployed to GitHub Pages.
- `docs/` — authoring guides and reference docs.
- `ci/smoke/` — MU-plugin fixtures used by `install-smoke.yml` to test the starter-pack installer hermetically.
- `bin/` → see `odd/bin/` — `validate-catalog`, `check-version`, `build-zip`, `make-pot`.

## License

GPLv2 or later, matching [WP Desktop Mode](https://github.com/WordPress/desktop-mode). See [LICENSE](./LICENSE).

Integrating ODD into a larger plugin or theme? The filter / event / registry surface is documented in [Building on ODD](docs/building-on-odd.md) and on the [wiki](https://github.com/RegionallyFamous/odd/wiki).
