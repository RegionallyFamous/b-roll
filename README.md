# ODD — Outlandish Desktop Decorator

**Turn your WordPress admin into a moving, themed, thoroughly-yours desktop — and an app platform you can build for.**

ODD is a decorator plugin for [WP Desktop Mode](https://github.com/WordPress/desktop-mode). It ships generative PixiJS wallpapers and matching icon packs… and a full **app runtime** that lets anyone package a plain JavaScript web app into a `.wp` file, install it into WordPress in one click, and run it as a real desktop app — its own dock icon, its own resizable window, shared access to a command palette, event bus, widget shelf, and more.

In short: **WP Desktop Mode gives WordPress a desktop. ODD turns that desktop into a place you can build software for.**

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

### The ODD Control Panel

A native WP Desktop Mode window — not a settings page, not a modal. Opens from the **ODD** desktop icon or the `/odd-panel` slash command. Tabbed sidebar for Wallpaper, Icons, Apps, and About. Everything you'd tweak, in one place — including wallpaper and icon-set previews you can try-before-you-commit, a screensaver with a big clock, audio-reactivity, and a shuffle scheduler.

### Desk knickknacks

Two little widgets you can drop anywhere on the desktop via the widget shelf:

- **Sticky Note** — a tilted handwritten scrap that auto-saves as you type.
- **Magic 8-Ball** — ask a question, click to shake, get an opinionated (if occasionally unhelpful) answer.

### Apps — build and ship your own JS apps, inside WordPress

**This is the part we're most excited about.** ODD is the first plugin that turns WordPress into a real desktop you can build apps for. Not admin pages. Not Gutenberg blocks. Actual apps — the kind that open in windows, sit in a dock, and have their own icon on the desktop.

What you get as a developer:

- **A packageable app format.** Drop your built web app (any framework — Vite, Next static export, plain JS, whatever produces HTML + JS + CSS) into a `.wp` archive with a `manifest.json`. That's the whole format. It's Bazaar-compatible, so the same bundle works anywhere else that speaks it.
- **A one-click installer.** ODD's Apps panel accepts any `.wp` (or `.odd`) archive via drag-drop or URL. Every WordPress user with the right capability can install, toggle, and uninstall apps without SSH, FTP, or even a plugin upload.
- **Real desktop integration.** Every installed app gets a dock icon (using the manifest's SVG), a desktop shortcut, an entry in the ⌘K command palette, and a real WP Desktop window with chrome, resize, and minimize. No bespoke wiring.
- **A sandboxed iframe runtime.** Your app runs in a same-origin iframe served by ODD's REST endpoints (`/odd/v1/apps/serve`), with cookie-auth that inherits the user's WordPress capabilities — so you can hit the WP REST API from inside your app as the logged-in user.
- **A React shim, for free.** Apps can `import React from 'react'` in source; ODD injects an import map at serve time that resolves those bare specifiers to WordPress's bundled React (`wp.element`). You don't ship React, and you don't fight module resolution.
- **An extension API.** Apps can register commands (for the palette), widgets (for the desktop), icon sets, wallpapers, muses (Iris personalities), rituals, and motion primitives — all through the manifest or a tiny bootstrap script. No PHP required.
- **An event bus + shared store.** `wp.hooks` (the same one core uses) is the canonical event bus. ODD's `window.__odd.store` exposes typed state. Your app can subscribe, publish, and read state alongside first-party ODD features.
- **Catalogs.** Host a `registry.json` anywhere (a repo, a gist, your CDN) and other ODD installs can subscribe to it. It's that simple to build and distribute a curated app store.

#### Seven bundled apps, as working examples

To prove the format works, ODD ships seven apps in its catalog. Each one is a small but real thing you can use today, and every one is a reference implementation for "how do I build an app like this?" — their source, manifests, and bundles are in the repo.

- **Mosaic** — pixel editor with drawing tools, fills, undo/redo, and PNG export for your 32×32 masterpieces.
- **Flow** — Pomodoro with ambient soundscapes, per-session task lists, and a heatmap of the days you actually showed up.
- **Board** — no-nonsense kanban: cards, columns, drag, drop, done.
- **Ledger** — track clients, generate polished invoices, and log payments without leaving WordPress.
- **Swatch** — HSL editing, harmony rules, WCAG contrast checks, and one-click export to CSS, Tailwind, or SVG.
- **Sine** — a real Web Audio synthesizer: four waveforms, ADSR envelope, resonant filter, and a step sequencer.
- **Tome** — a fast markdown wiki for your team — pages, search, no SaaS tab.

Want to write your own? See [**Building an App**](https://github.com/RegionallyFamous/odd/wiki/Building-an-App) in the wiki.

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
5. Double-click the **ODD** desktop icon to open the Control Panel (or run `/odd-panel` from the ⌘K palette).

**Requires:** WordPress 6.0+ · PHP 7.4+ · WP Desktop Mode v0.5.0+

---

## For developers

Everything technical — architecture, the scene and icon-set contracts, release workflow, prior incidents — lives in the **[ODD Wiki](https://github.com/RegionallyFamous/odd/wiki)**.

Good starting points:

- [Architecture](https://github.com/RegionallyFamous/odd/wiki/Architecture) — how the pieces fit together.
- [Adding a Scene](https://github.com/RegionallyFamous/odd/wiki/Adding-a-Scene) — four files, no build step.
- [Adding an Icon Set](https://github.com/RegionallyFamous/odd/wiki/Adding-an-Icon-Set) — the manifest + `currentColor` convention.
- [Building an App](https://github.com/RegionallyFamous/odd/wiki/Building-an-App) — manifest, archive format, REST, sandboxing.
- [Developing](https://github.com/RegionallyFamous/odd/wiki/Developing) — local iteration, validators, CI.

Bug reports and feature requests: [open an issue](https://github.com/RegionallyFamous/odd/issues).

---

## License

GPLv2 or later, matching [WP Desktop Mode](https://github.com/WordPress/desktop-mode). See [LICENSE](./LICENSE).
