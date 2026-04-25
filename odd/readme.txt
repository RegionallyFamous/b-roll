=== ODD — Outlandish Desktop Decorator ===
Contributors: regionallyfamous
Tags: wp-desktop-mode, wallpaper, icons, pixi, canvas
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.1.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Decorator for WP Desktop Mode: generative PixiJS wallpapers, themed icon sets, and a native ODD Control Panel with installable Apps.

== Description ==

ODD (Outlandish Desktop Decorator) layers on top of the [WP Desktop Mode](https://github.com/WordPress/desktop-mode) plugin and turns the desktop into a playground:

* **Wallpapers.** Generative PixiJS scenes painted on custom 1920×1080 backdrops, with more packs shipping through the catalog over time.
* **Icon sets.** Full-color SVG packs that re-skin the WP Desktop dock and desktop shortcut icons.
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

= 1.1.3 =
* Icons section now uses the same App Store-style list design as the Apps catalog: a 56px square preview, title + franchise + description, and an Apply / Active pill on the right. The previous grid of big thumbs didn't match the rest of the panel.

= 1.1.2 =
* Fixes the 500 error when installing a catalog app. `unzip_file()` silently no-ops when the `$wp_filesystem` global isn't initialized, which is the case on REST requests outside wp-admin (Playground hits this every time). ODD now forces `WP_Filesystem()` before extraction.
* Catalog installs now validate the downloaded bundle's ZIP magic bytes before extraction so captive-portal / rate-limit HTML pages can't reach the archive validator.
* Raises the catalog download timeout from 30s to 60s for slow proxied networks.
* Wraps the install-from-catalog REST handler in a try/catch so uncaught throwables surface as a proper JSON error body with a readable message instead of a bare HTTP 500.
* Drops `.odd` as an accepted archive extension; ODD apps are `.wp` only now. The file-picker, dropzone copy, archive validator, and docstrings are updated to match.

= 1.1.1 =
* Redesigns the Apps catalog as an App Store-style list with clean square icons, tighter typography, and pill-shaped action buttons. The previous grid cards left awkward empty space around square app icons.
* Surfaces the real REST error message on catalog install failures instead of the generic "Install failed." so users can see exactly why a Download didn't complete (network, timeout, archive validation, etc.).

= 1.1.0 =
* Launches the odd.regionallyfamous.com landing site and `/playground/` short link as the canonical Playground demo URL, replacing the long `playground.wordpress.net/?blueprint-url=…` link in the README and plugin docs.
* Moves catalog app icons and bundles from the retired Bazaar repository to first-party URLs under the ODD repo, eliminating the last cross-repo dependency for the Apps catalog.
* Refreshes all seven catalog app bundles (Board, Flow, Ledger, Mosaic, Sine, Swatch, Tome) so fresh installs pull the latest builds.
* Adds a dedicated Architecture page covering the Apps subsystem.
* Ships a GitHub Pages workflow so the site is rebuilt automatically from `site/` on every push to main.

= 1.0.8 =
* Adds four GPT Image 2 wallpaper scenes: Abyssal Aquarium, Circuit Garden, Pocket Dimension, and Weather Factory.
* Playground now opens the ODD Control Panel automatically on first launch while keeping normal installs untouched.
* Removes the glass tile behind active ODD custom dock icons while keeping it for default/fallback icons.
* Documents the Apps manifest, REST API, and app authoring flow.

= 1.0.7 =
* Enlarges the WP Desktop dock treatment so icons read more like an operating-system launcher, with wider glass tiles and larger rendered artwork.

= 1.0.6 =
* Mirrors WP Desktop Mode and catalog app bundles through raw GitHub URLs so Playground can fetch them without GitHub release-asset CORS failures.
* Adds pointer tracking to the inline Iris eye so the desktop icon can look toward the cursor when WP Desktop Mode renders it as an image.

= 1.0.5 =
* Removes the bundled Hello ODD demo app from the catalog and adds a migration to uninstall it from existing sites.
* Keeps the ODD Control Panel as a compact utility window instead of restoring accidental maximized session state.
* Reworks all bundled icon sets into richer full-color SVG tiles with gradients, shadows, and role-specific glyphs.
* Adds the Iris Observatory wallpaper scene and contrast treatment for dock + desktop icons.

= 1.0.4 =
* Icon sets now actually apply. Tinted SVGs are served through a new public `/odd/v1/icons/{set}/{key}` REST route as `image/svg+xml`, replacing the `data:image/svg+xml;utf8,` URIs that WP Desktop Mode silently rejected — icons used to fall back to letter badges on the dock and to broken shortcuts on the desktop.
* Selecting an icon set now swaps the dock + desktop icons in place without a full page reload, so the ODD Control Panel stays open.

= 1.0.3 =
* Retired the first-run "Hello. I decorate. Pick one of three." onboarding card. The ODD Control Panel now opens directly on the Wallpaper section.

= 1.0.2 =
* Public app icon route: `/wp-json/odd/v1/apps/icon/{slug}` serves the manifest-declared icon without a nonce so dock and panel `<img>` tags no longer 401.
* Bundled icon consumers updated to use the new public route.
* Playground blueprint switched to a `git:directory` resource for ODD so fresh launches pick up the latest `main` without GitHub release ZIP CORS noise.
* `.htaccess` for the apps storage directory now ships both Apache 2.4 (`Require all denied`) and Apache 2.2 (`Order allow,deny`) syntax wrapped in `<IfModule>` guards for shared-host compatibility.
* Window host: app frame mount waits up to ~30 animation frames so slow theme transitions no longer drop the iframe.
* Internal: `error_log` calls in the apps engine and migrations gated behind `WP_DEBUG`, atomic renames keep `phpcs:ignore` annotations with a documented rationale.

= 1.0.1 =
* Catalog REST route: fix route precedence so `/apps/catalog` is not shadowed by the `/apps/{slug}` regex — catalog apps now appear in the Apps panel.
* Desktop icons: the ODD eye now ships as a real SVG asset instead of a `data:` URI, so WP Desktop Mode's dock sanitizer no longer silently swaps it for a generic cog.

= 1.0.0 =
* Stable release. Apps engine (absorbed Bazaar), Iris personality system, scenes, icon sets, stable extension API, migration system.

== Upgrade Notice ==

= 1.1.3 =
Re-skins the Icons section to match the App Store-style list used by the Apps catalog, for a consistent panel look.

= 1.1.2 =
Fixes the 500 when installing catalog apps (WP_Filesystem wasn't initialized for REST extractions). Also drops the `.odd` extension; app bundles are `.wp` only now. Strongly recommended.

= 1.1.1 =
Fixes the look of the Apps catalog (now an App Store-style list) and makes Download failures report the real underlying error. Recommended if catalog installs aren't behaving.

= 1.1.0 =
Catalog apps now load from first-party ODD URLs and the Playground demo has a stable short link at odd.regionallyfamous.com/playground/. Recommended for anyone relying on the catalog.

= 1.0.8 =
Adds four new wallpapers and improves the Playground first-run experience.

= 1.0.7 =
Makes dock icons larger and gives the dock a more OS-like launcher feel.

= 1.0.6 =
Fixes Playground CORS blockers for WP Desktop Mode and catalog app installs.

= 1.0.5 =
Removes the demo app, keeps the Control Panel compact, and replaces the bundled icon sets with full-color artwork.

= 1.0.4 =
Fixes dock + desktop icon sets that were silently rendering as letter badges. Recommended.

= 1.0.3 =
Retires the first-run greeting card so the Control Panel opens straight to Wallpaper.

= 1.0.2 =
Fixes app icons 401-ing on the dock/desktop and Apps panel. Recommended.

= 1.0.1 =
Fixes missing desktop icons and an empty Apps catalog caused by a REST route collision.

= 1.0.0 =
First stable release. If you had the Bazaar plugin installed, ODD will migrate your wares into the Apps tab on first load and deactivate Bazaar.
