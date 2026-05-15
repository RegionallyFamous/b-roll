=== ODD — Outlandish Desktop Decorator ===
Contributors: nickhamze, regionallyfamous
Tags: wp-desktop-mode, desktop, wallpaper, widgets, apps
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Install living wallpapers, icon sets, cursors, widgets, and tiny desktop apps for WP Desktop Mode from a safe remote catalog.

== Description ==

ODD (Outlandish Desktop Decorator) layers on top of [WP Desktop Mode](https://github.com/WordPress/desktop-mode). Once both plugins are active, the WordPress admin becomes a desktop with a polished shop for visual themes, desktop widgets, and small tools.

ODD ships as a lightweight runtime. The content lives in a remote catalog at [odd.regionallyfamous.com/catalog/v1/](https://odd.regionallyfamous.com/catalog/v1/registry.json), installs as universal `.wp` bundles, and can be updated without shipping a new plugin zip.

ODD manages five content types:

* **Canvas wallpapers** — living PixiJS scenes painted on top of desktop backdrops.
* **Icon sets** — themed SVG costume packs for dock and desktop shortcuts.
* **Cursor sets** — pointer themes for Desktop Mode and classic wp-admin.
* **Desktop widgets** — draggable desk companions like Sticky Note, Magic 8-Ball, and Spotify Embed.
* **Apps** — sandboxed HTML/CSS/JS tools that open in their own Desktop Mode windows.

Fresh installs get a starter pack so the desktop looks complete immediately. Everything else is one click away in the ODD Shop, with responsive light/dark chrome, global search, editorial shelves, reversible previews, compact preferences, and just enough Oddling weirdness to make the admin feel alive.

== Installation ==

1. Install and activate [WP Desktop Mode](https://github.com/WordPress/desktop-mode) v0.8.0 or newer (WordPress.org distribution recommended).
2. Upload and activate ODD from the Plugins screen, or install the release zip.
3. Enable desktop mode for your user.
4. Open the ODD Shop from its desktop icon, taskbar icon, or `/odd-panel` command.

== External services ==

ODD connects to the public ODD catalog service at [odd.regionallyfamous.com/catalog/v1/](https://odd.regionallyfamous.com/catalog/v1/registry.json). The catalog is a static HTTPS endpoint hosted by Regionally Famous / Nick Hamze and is used to show Shop items, seed the starter pack, and download selected `.wp` bundles, previews, and icons.

When an administrator opens or refreshes the ODD Shop, runs the starter pack, installs catalog content, or repairs an installed bundle from the catalog, the WordPress site sends HTTPS GET requests for static JSON and asset files. Those requests include normal web request metadata such as the site server's IP address, user agent, requested URL, and timestamp. ODD does not send site content, user account details, cookies, analytics events, license keys, or diagnostic reports to the catalog service.

Service terms: [https://odd.regionallyfamous.com/terms/](https://odd.regionallyfamous.com/terms/)

Privacy policy: [https://odd.regionallyfamous.com/privacy/](https://odd.regionallyfamous.com/privacy/)

== Source and build tools ==

The human-readable source code for this plugin is maintained at [https://github.com/RegionallyFamous/odd](https://github.com/RegionallyFamous/odd). The repository includes the source files, build scripts, catalog sources, and package metadata used to create the distributed plugin zip.

The files in `apps/runtime/*.js` are generated JavaScript modules built from the public `react` and `react-dom` npm packages pinned in the repository. React and React DOM source code is maintained at [https://github.com/facebook/react](https://github.com/facebook/react), and the exact package versions are recorded in `package-lock.json`. The runtime files are rebuilt with `odd/bin/build-runtime`, which installs the pinned npm dependencies in a temporary directory and uses esbuild to create the small ESM runtime files used by sandboxed ODD apps.

Typical build commands:

1. `npm ci`
2. `odd/bin/build-runtime`
3. `python3 _tools/build-catalog.py`
4. `odd/bin/build-zip`

== Frequently Asked Questions ==

= Does ODD work without WP Desktop Mode? =

No. ODD is a decorator and app-store layer for WP Desktop Mode. If Desktop Mode is missing or out of date, ODD shows an admin notice and pauses desktop integrations.

= Does ODD call home? =

ODD fetches the public catalog and catalog assets described in the External services section. It does not send telemetry, analytics, license checks, or error reports. Copy Diagnostics is local-only and user initiated.

= Can I install third-party content? =

Yes. Apps, scenes, icon sets, cursor sets, and widgets can be packaged as `.wp` bundles. ODD validates archives before install, and app/widget JavaScript requires administrator capability.

= Can the store update without a plugin release? =

Yes. Catalog entries, card art, bundles, and starter content publish through the remote catalog. Plugin releases are reserved for runtime, security, and API changes.

= How do I report bugs? =

Open ODD Shop → About → Copy diagnostics, then paste the markdown into a GitHub issue. Nothing is sent anywhere unless you choose to share it.

== Screenshots ==

1. ODD Shop with unified catalog cards.
2. Wallpaper department with preview/apply controls.
3. Apps department with install/open cards.
4. Desktop with themed wallpaper, icons, cursors, and widgets.

== Changelog ==

= 1.0.0 =

The clean public baseline for ODD: a catalog-driven app store and decorator layer for WP Desktop Mode v0.8.0+, with unified store cards, hardened bundle installs, Playground app-loading fixes, custom cursor fixes, local-only diagnostics, starter content, and release-quality CI gates.

== Upgrade Notice ==

= 1.0.0 =

Initial WordPress.org release. Requires WP Desktop Mode v0.8.0 or newer.
