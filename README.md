# ODD — Outlandish Desktop Decorator

**Turn your WordPress admin into a moving, themed, thoroughly-yours desktop.**

ODD is a decorator plugin for [WP Desktop Mode](https://github.com/WordPress/desktop-mode). It ships generative PixiJS wallpapers and matching icon packs, all controlled from a single native desktop window. Install it, pick a vibe, get back to work — but happier.

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

### Apps — self-contained desktop apps

Install small, sandboxed apps that each get their own desktop icon and open in their own native window. Browse the curated catalog inside the Apps panel, or drop in your own `.odd` / `.wp` archive. Apps can register commands, muses, widgets, rituals, and motion primitives through a manifest — no PHP bootstrap required.

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
