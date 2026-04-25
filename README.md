# ODD — Outlandish Desktop Decorator

**Turn your WordPress admin into a moving, themed, thoroughly-yours desktop.**

ODD is a decorator plugin for [WP Desktop Mode](https://github.com/WordPress/desktop-mode). It ships generative PixiJS wallpapers and matching icon packs, all controlled from a single native desktop window. Install it, pick a vibe, get back to work — but happier.

### [▶ Try it live in WordPress Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/RegionallyFamous/odd/main/blueprint.json)

No install, no signup, nothing to uninstall. Boots ODD + WP Desktop Mode in your browser in ~20–30 seconds.

---

## What you get

### Three generative scenes

Real-time PixiJS art layered over hand-painted backdrops. Not videos. Not GIFs. Every frame is drawn fresh.

- **Flux** — ribbon particles flowing through a slowly-evolving vector field over deep marbled ink. Rare "koi" particles cross-fade in for emphasis.
- **Aurora** — twinkling stars and procedural aurora curtains over an arctic mountain plateau, with the occasional shooting star.
- **Origami** — a flock of folded paper cranes drifting across warm washi paper, with subtle pollen catching the light.

Scenes respond to time of day, reduced-motion preferences, and (optionally) your microphone.

### Three icon packs

Coordinated sets that re-skin your dock and desktop shortcuts. Each set declares an accent color that drives every stroke — retint a set with a single hex edit.

- **Filament** — hair-thin single-stroke icons that read as one unbroken line of light.
- **Arctic** — frost-blue line icons with a small magenta accent dot.
- **Fold** — flat folded-paper icons with cream faces, warm-tan creases, and soft drop shadows.

### The ODD Control Panel

A native WP Desktop Mode window — not a settings page, not a modal. Opens from the **ODD** desktop icon, the `/odd-panel` slash command, or the "Open ODD" button on the Now Playing widget. Tabbed sidebar for Wallpaper, Icons, Apps, and About. Everything you'd tweak, in one place.

### Apps — self-contained desktop apps

Install small, sandboxed apps that each get their own desktop icon and open in their own native window. Browse the curated catalog inside the Apps panel, or drop in your own `.odd` / `.wp` archive. Apps can register commands, muses, widgets, rituals, and motion primitives through a manifest — no PHP bootstrap required.

---

## Install

### Playground (one-click demo)

[**Launch ODD in WordPress Playground →**](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/RegionallyFamous/odd/main/blueprint.json)

Raw blueprint URL (handy for bookmarking or sharing):

```
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/RegionallyFamous/odd/main/blueprint.json
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
