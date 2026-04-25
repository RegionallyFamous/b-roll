=== ODD — Outlandish Desktop Decorator ===
Contributors: regionallyfamous
Tags: wp-desktop-mode, wallpaper, icons, pixi, canvas
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Decorator for WP Desktop Mode: generative PixiJS wallpapers, themed icon sets, and a native ODD Control Panel with installable Apps.

== Description ==

ODD (Outlandish Desktop Decorator) layers on top of the [WP Desktop Mode](https://github.com/WordPress/desktop-mode) plugin and turns the desktop into a playground:

* **Wallpapers.** Generative PixiJS scenes painted on custom 1920×1080 backdrops, with more packs shipping through the catalog over time.
* **Icon sets.** Themed SVG packs that re-skin the WP Desktop dock and desktop shortcut icons.
* **Apps.** Install small sandboxed web apps (HTML/CSS/JS) as windows and desktop icons, managed from the ODD Control Panel.
* **Iris.** A lightweight mascot/personality layer that reacts to scene changes, app lifecycle events, and time of day.

All three surfaces — wallpaper, icons, apps — are switched from a single native WP Desktop window: the ODD Control Panel.

== Installation ==

1. Install and activate the [WP Desktop Mode](https://github.com/WordPress/desktop-mode) plugin (v0.5.0+).
2. Upload the ODD plugin folder to `/wp-content/plugins/` or install via the plugin admin.
3. Activate ODD.
4. Click the floating gear (or the ODD Control Panel desktop icon) to switch wallpapers, icon sets, and install Apps.

== Frequently Asked Questions ==

= Do I need WP Desktop Mode to use ODD? =

Yes. ODD is a decorator for WP Desktop Mode and will not do anything useful without it active.

= Does ODD work on mobile? =

WP Desktop Mode itself is a desktop metaphor, so ODD targets desktop browsers. Scenes respect `prefers-reduced-motion` and tab-visibility pausing for battery life.

= How do I build my own scene, icon set, or app? =

See the developer documentation linked from the plugin readme on GitHub — there is a stable PHP + JS extension API (registries, event bus, store).

== Changelog ==

= 1.0.1 =
* Catalog REST route: fix route precedence so `/apps/catalog` is not shadowed by the `/apps/{slug}` regex — catalog apps now appear in the Apps panel.
* Desktop icons: the ODD eye now ships as a real SVG asset instead of a `data:` URI, so WP Desktop Mode's dock sanitizer no longer silently swaps it for a generic cog.

= 1.0.0 =
* Stable release. Apps engine (absorbed Bazaar), Iris personality system, scenes, icon sets, stable extension API, migration system.

== Upgrade Notice ==

= 1.0.1 =
Fixes missing desktop icons and an empty Apps catalog caused by a REST route collision.

= 1.0.0 =
First stable release. If you had the Bazaar plugin installed, ODD will migrate your wares into the Apps tab on first load and deactivate Bazaar.
