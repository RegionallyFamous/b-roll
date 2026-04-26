# ODD — Outlandish Desktop Decorator

**The missing app store for WP Desktop Mode.**

[WP Desktop Mode](https://github.com/WordPress/desktop-mode) makes your WordPress admin feel like a real desktop. ODD fills in the piece it was missing — a one-click app store of real apps (each with its own window, icon, and dock slot), plus animated wallpapers, icon packs, and a control panel that makes the desktop feel like yours.

### [▶ Try it live in WordPress Playground](https://odd.regionallyfamous.com/playground/)

No install, no signup, nothing to uninstall. Boots ODD + WP Desktop Mode in your browser in ~20–30 seconds.

---

## What you get

### A growing library of generative scenes

Real-time PixiJS art layered over hand-painted backdrops. Not videos. Not GIFs. Every frame is drawn fresh.

Close to twenty scenes across four franchises:

- **Generative** — abstract motion pieces like **Flux**: ribbon particles flowing through a slowly-evolving vector field over deep marbled ink.
- **Atmosphere** — weather and sky, including **Aurora** (procedural aurora curtains and twinkling stars) and **Rainfall**, a surfaces-aware rain scene whose drops splash on your windows, dock, taskbar, and widgets.
- **Paper** — **Origami**, a flock of folded paper cranes drifting across warm washi.
- **ODD Originals** — GPT-Image-2 painted backdrops with live Pixi layers on top: Circuit Garden, Pocket Dimension, Tide Pool, Weather Factory, Mercado, Big Sky, Cloud City, Beach Umbrellas, Wildflower Meadow, Sun Print, Terrazzo, Balcony Noon, Iris Observatory, Abyssal Aquarium, and Tropical Greenhouse.

Every scene responds to time of day and reduced-motion preferences, and can optionally react to your microphone.

### A wardrobe of icon packs

Seventeen coordinated sets that re-skin your dock and desktop shortcuts. Each set declares an accent color that drives every stroke — retint a set with a single hex edit.

A taste of what's in there: **Filament** (hair-thin single-stroke line-of-light), **Arctic** (frost-blue line icons with a magenta accent dot), **Fold** (folded-paper icons with warm creases), **Blueprint**, **Monoline**, **Risograph**, **Claymation**, **Hologram**, **Cross-Stitch**, **Arcade Tokens**, **Tiki**, **Botanical Plate**, **Brutalist Stencil**, **Eyeball Avenue**, **Lemonade Stand**, **Circuit Bend**, and **Stadium**.

### The ODD Shop

A native WP Desktop Mode window styled after the Mac App Store — not a settings page, not a modal. Opens from the **ODD** desktop icon or the `/odd-panel` slash command.

- **Top bar** with ODD wordmark and a live search pill that filters the current department against labels, slugs, franchises, and tags.
- **Translucent department rail** listing Wallpapers, Icon Sets, Apps, and About with SF-style glyphs and one-line taglines.
- **Department hero card** featuring the active (or first filtered) title — full-bleed preview art, eyebrow pill, headline, and a Preview / Active action.
- **"Browse by franchise" category quilt** — gradient tiles that smooth-scroll to the matching shelf.
- **Franchise shelves** as horizontal-scrolling rows of tile-style cards (preview at top, title + subhead + inline Preview pill, corner `✓ Active` badge on the committed scene).
- **Floating preview bar** in the lower-right that keeps the App Store–style try-before-you-commit flow for wallpapers and icon sets, plus the screensaver, audio-reactivity, and shuffle scheduler.

### Desk knickknacks

Two little widgets you can drop anywhere on the desktop via the widget shelf:

- **Sticky Note** — a tilted handwritten scrap that auto-saves as you type.
- **Magic 8-Ball** — ask a question, click to shake, get an opinionated (if occasionally unhelpful) answer.

### Apps — a one-click catalog, right on your desktop

Open the **Apps** tab in the ODD Shop and install with a click. Each app lands on your desktop with its own icon, opens in its own resizable window, and slots into the dock alongside everything else — no ZIP uploads, no FTP, no plugin-upload dance.

What's in the catalog today:

- **Mosaic** — pixel editor with drawing tools, fills, undo/redo, and PNG export for your 32×32 masterpieces.
- **Flow** — Pomodoro with ambient soundscapes, per-session task lists, and a heatmap of the days you actually showed up.
- **Board** — no-nonsense kanban: cards, columns, drag, drop, done.
- **Ledger** — track clients, generate polished invoices, and log payments without leaving WordPress.
- **Swatch** — HSL editing, harmony rules, WCAG contrast checks, and one-click export to CSS, Tailwind, or SVG.
- **Sine** — a real Web Audio synthesizer: four waveforms, ADSR envelope, resonant filter, and a step sequencer.
- **Tome** — a fast markdown wiki for your team — pages, search, no SaaS tab.

---

## Install

### Playground (one-click demo)

[**Launch ODD in WordPress Playground →**](https://odd.regionallyfamous.com/playground/)

Short demo URL:

```
https://odd.regionallyfamous.com/playground/
```

First load takes ~20–30 seconds while Playground boots and the plugin installs.

### A real WordPress install

1. Download the latest `odd.zip` from the [Releases](https://github.com/RegionallyFamous/odd/releases) page.
2. WP Admin → Plugins → Add New → Upload Plugin → pick the zip → Activate.
3. Make sure [WP Desktop Mode](https://github.com/WordPress/desktop-mode) is installed + active, then enable desktop mode from the admin bar toggle.
4. OS Settings → Wallpapers → pick **ODD**.
5. Double-click the **ODD** desktop icon to open the ODD Shop (or run `/odd-panel` from the ⌘K palette).

**Requires:** WordPress 6.0+ · PHP 7.4+ · WP Desktop Mode v0.5.0+

---

## Build your own

Anyone can ship a scene, icon set, widget, or app as a single `.wp`
file and hand it to an ODD user — they drop it on the Shop and it
installs. No companion plugin required.

- [Building an App](docs/building-an-app.md)
- [Building a Scene](docs/building-a-scene.md)
- [Building an Icon Set](docs/building-an-icon-set.md)
- [Building a Widget](docs/building-a-widget.md)
- [`.wp` Manifest Reference](docs/wp-manifest.md)

## License

GPLv2 or later, matching [WP Desktop Mode](https://github.com/WordPress/desktop-mode). See [LICENSE](./LICENSE).

Integrating ODD into a larger plugin or theme? The filter / event /
registry surface is documented in [Building on ODD](docs/building-on-odd.md)
and on the [wiki](https://github.com/RegionallyFamous/odd/wiki).
