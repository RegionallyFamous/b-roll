=== ODD — Outlandish Desktop Decorator ===
Contributors: regionallyfamous
Tags: wp-desktop-mode, wallpaper, icons, widgets, admin
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 3.0.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Remote catalog of PixiJS wallpapers, themed icon sets, desktop widgets, and apps for WP Desktop Mode. The plugin itself ships empty — you pick content from the ODD Shop and it installs on demand.

== Description ==

ODD (Outlandish Desktop Decorator) layers on top of the [WP Desktop Mode](https://github.com/WordPress/desktop-mode) plugin. Once both are active, the WordPress admin grows a proper desktop — dock at the bottom, icons on the wall, wallpaper behind, and the ODD Shop native window to browse and install decorations.

As of ODD 3.0 the plugin is an **empty shell**. Every wallpaper, icon set, widget, and app lives in a remote catalog published at [odd.regionallyfamous.com/catalog/v1/](https://odd.regionallyfamous.com/catalog/v1/registry.json) and streams in as a universal `.wp` bundle the first time you install it. Releases stay small and new content can land without a plugin update.

ODD manages four content types:

* **Canvas wallpapers** — generative PixiJS scenes painted on top of 1920×1080 WebP backdrops. Drifting paper cranes, procedural aurora curtains, rainfall that respects on-screen icons, a pocket dimension that looks like the inside of a lava lamp, and more.
* **Icon sets** — themed SVG packs that reskin the dock and desktop shortcuts. Blueprint. Cross-stitch. Claymation. Brutalist stencil. Hologram. Filament (tube neon). Fold (origami). Arctic.
* **Desktop widgets** — sandboxed tiles like Sticky Note and Magic 8-Ball that install as `.wp` bundles.
* **Apps** — sandboxed HTML/CSS/JS bundles that live in their own native window with a dock icon.

On first activation ODD installs a small **starter pack** defined in the remote catalog (a default scene + icon set) so the desktop has content out of the box. Everything else is one click away in the Shop.

**Extending ODD.** Third parties ship apps, scenes, icon sets, and widgets as universal `.wp` bundles — no companion plugins required. See the [building guide](https://github.com/RegionallyFamous/odd/blob/main/docs/building-on-odd.md) for the full extension API (filters, events, registries, lifecycle hooks, error boundaries, debug inspector).

**Zero server-side telemetry.** ODD never phones home. The built-in "Copy diagnostics" button assembles a bug-report payload on the clipboard; what the user does with it is up to them. See [ADR 0004](https://github.com/RegionallyFamous/odd/blob/main/docs/adr/0004-zero-server-side-telemetry.md).

== Installation ==

1. Install and activate [WP Desktop Mode](https://github.com/WordPress/desktop-mode) v0.5.1 or newer.
2. Upload and activate ODD from the Plugins screen, or install it from this directory.
3. Enable desktop mode on your user profile (WP Desktop Mode's user setting).
4. Visit `wp-admin`, open the ODD Shop from its desktop icon, and pick a wallpaper or icon set. (On first activation ODD fetches a small starter pack from the remote catalog; if the site's offline, the Shop shows a retry affordance.)

== Frequently Asked Questions ==

= Does ODD work without WP Desktop Mode? =

No — ODD is a decorator plugin. Without WP Desktop Mode there's no desktop to decorate. ODD will show an admin notice if you activate it alone.

= Do scenes run in every tab? =

Only in tabs where WP Desktop Mode is rendering the desktop. ODD respects the visibility hooks that WP Desktop Mode publishes, so scenes pause when the tab is hidden and when the desktop is layered under another window.

= Can I install third-party content? =

Yes. Drop a `.wp` archive on the Shop → Upload area. Scenes and widgets that ship JavaScript require `manage_options` and a one-time confirmation banner (SVGs are scrubbed). See [docs/building-on-odd.md](https://github.com/RegionallyFamous/odd/blob/main/docs/building-on-odd.md).

= How do I reset everything? =

User preferences live in user-meta; a full reset is "Edit Profile → Reset ODD" in the panel, or delete the plugin (the uninstaller scrubs the DB but leaves installed bundle folders behind on purpose — see [odd/uninstall.php](https://github.com/RegionallyFamous/odd/blob/main/odd/uninstall.php)).

= Does ODD call home? =

Only to fetch the content catalog. On boot ODD issues a single `wp_remote_get()` against `https://odd.regionallyfamous.com/catalog/v1/registry.json`, caches the response for 12 hours, and serves stale data if the fetch fails. Installing a bundle triggers a second request for the bundle's `.wp` URL. Every URL is swappable via the `ODD_CATALOG_URL` constant or the `odd_catalog_url` filter (enterprise mirrors), and you can disable catalog fetches entirely by returning a cached payload from the filter. No analytics, no error pings, no beacons — see [ADR 0004](https://github.com/RegionallyFamous/odd/blob/main/docs/adr/0004-zero-server-side-telemetry.md) and [ADR 0005](https://github.com/RegionallyFamous/odd/blob/main/docs/adr/0005-remote-catalog-empty-plugin.md).

= How do I report bugs? =

The ODD Shop → About tab has a **Copy diagnostics** button. Paste the markdown into a [new issue](https://github.com/RegionallyFamous/odd/issues/new). Nothing is sent anywhere without you pressing the button.

== Screenshots ==

1. ODD Shop — Discover tile view with the Install / Open state per catalog row.
2. Shop — Wallpaper department with a detail sheet for the selected scene.
3. Aurora scene with the Hologram icon set on the live desktop.
4. Origami scene with the Fold icon set on the live desktop.
5. Rainfall scene avoiding live desktop icons.

== Changelog ==

See [CHANGELOG.md](https://github.com/RegionallyFamous/odd/blob/main/CHANGELOG.md) for the full history. Version headings follow SemVer; API versioning is tracked separately (see [docs/api-versioning.md](https://github.com/RegionallyFamous/odd/blob/main/docs/api-versioning.md)).

== Upgrade Notice ==

= 3.0.1 =
Post-3.0.0 fixes: installed scene bundles can now find their painted backdrop again (the localized `sceneMap` was missing, so every scene fell back to a 404'd plugin-assets URL), the ODD Shop window opens reliably via `wp.desktop.openWindow` instead of the bare `registerWindow` shortcut, and three a11y violations in the Shop (nested interactive on the favorite star, unlabeled shuffle/screensaver inputs, low-contrast department eyebrow) are resolved. Zero content changes.

= 3.0.0 =
Major architectural shift. The plugin now ships empty — every wallpaper, icon set, widget, and app lives in a remote catalog at odd.regionallyfamous.com/catalog/v1/. On activation ODD installs a starter pack from the catalog, then pulls additional content on demand from the ODD Shop. Plugin zip drops from ~1 MB to <500 KB. Breaking: no built-in content on fresh installs until the starter pack finishes running (it retries with exponential backoff if the catalog is unreachable). Requires WP Desktop Mode 0.5.1+.

= 2.1.0 =
Follow WP Desktop Mode's 0.5.1 hook rename. Every `wp_desktop_*` filter/action and every `wp_register_desktop_*()` function call now uses the new `desktop_mode_*` / `desktop_mode_register_*()` names. ODD now requires WP Desktop Mode 0.5.1 or newer — older hosts won't fire the renamed hooks and ODD's dock-icon reskinning / native windows / accent swatches / toast tones would silently no-op. Update the host plugin before upgrading ODD.

= 2.0.2 =
Drop the mouse-follow parallax drift from every GPT-painted scene. The subtle "second image sliding around on top" effect is gone — backdrops now sit perfectly still under the foreground motion layer.

= 2.0.1 =
Ship the three Discover-shelf bundles (Rainfall / Origami / Confetti) that have been referenced from the ODD Shop catalog but never actually checked into the repo, so "Install" on them finally works end to end. Add a validate-catalog CI gate that blocks future Discover rows from merging without their matching .wp archives + icon SVGs.

= 2.0.0 =
The “world-class” release: Playwright e2e, deeper smoke tests, scene perf sampling, local diagnostics, JSON Schema + manifest CLI, example bundles, API 2.0 tagging, test harness + scaffold CLI, CSP for apps, SVG fuzz + rate limits, keyboard help + axe checks, install troubleshoot UI, i18n + POT, bundle update badges, and more. See CHANGELOG.md.
