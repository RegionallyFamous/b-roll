=== ODD — Outlandish Desktop Decorator ===
Contributors: regionallyfamous
Tags: wp-desktop-mode, wallpaper, icons, widgets, admin
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 2.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Generative PixiJS wallpapers, themed icon sets, desktop widgets, and a shop-style control panel for WP Desktop Mode.

== Description ==

ODD (Outlandish Desktop Decorator) layers on top of the [WP Desktop Mode](https://github.com/WordPress/desktop-mode) plugin. Once both are active, the WordPress admin grows a proper desktop — dock at the bottom, icons on the wall, wallpaper behind, and the ODD Control Panel native window to switch between them.

ODD ships three kinds of decoration in one plugin:

* **Canvas wallpapers** — 19 generative PixiJS scenes painted on top of 1920×1080 WebP backdrops. Drifting paper cranes, procedural aurora curtains, rainfall that respects on-screen icons, a pocket dimension that looks like the inside of a lava lamp, and more.
* **Icon sets** — 17 themed SVG packs that reskin the dock and desktop shortcuts. Blueprint. Cross-stitch. Claymation. Brutalist stencil. Hologram. Filament (tube neon). Fold (origami). Arctic.
* **Desktop widgets** — Sticky Note and Magic 8-Ball ship built-in. Third-party widgets install through the universal `.wp` bundle format.

Everything is managed from one native WP Desktop Mode window (the ODD Control Panel), opened from its desktop shortcut, the `/odd-panel` slash command, or any widget that routes through `api.openPanel()`.

**Extending ODD.** Third parties ship apps, scenes, icon sets, and widgets as universal `.wp` bundles — no companion plugins required. See the [building guide](https://github.com/RegionallyFamous/odd/blob/main/docs/building-on-odd.md) for the full extension API (filters, events, registries, lifecycle hooks, error boundaries, debug inspector).

**Zero server-side telemetry.** ODD never phones home. The built-in "Copy diagnostics" button assembles a bug-report payload on the clipboard; what the user does with it is up to them. See [ADR 0004](https://github.com/RegionallyFamous/odd/blob/main/docs/adr/0004-zero-server-side-telemetry.md).

== Installation ==

1. Install and activate [WP Desktop Mode](https://github.com/WordPress/desktop-mode) v0.5.1 or newer.
2. Upload and activate ODD from the Plugins screen, or install it from this directory.
3. Enable desktop mode on your user profile (WP Desktop Mode's user setting).
4. Visit `wp-admin`, open the ODD Control Panel from its desktop icon, and pick a wallpaper or icon set.

== Frequently Asked Questions ==

= Does ODD work without WP Desktop Mode? =

No — ODD is a decorator plugin. Without WP Desktop Mode there's no desktop to decorate. ODD will show an admin notice if you activate it alone.

= Do scenes run in every tab? =

Only in tabs where WP Desktop Mode is rendering the desktop. ODD respects the visibility hooks that WP Desktop Mode publishes, so scenes pause when the tab is hidden and when the desktop is layered under another window.

= Can I install third-party content? =

Yes. Drop a `.wp` archive on the Shop → Upload area. Scenes and widgets that ship JavaScript require `manage_options` and a one-time confirmation banner (SVGs are scrubbed). See [docs/building-on-odd.md](https://github.com/RegionallyFamous/odd/blob/main/docs/building-on-odd.md).

= How do I reset everything? =

User preferences live in user-meta; a full reset is "Edit Profile → Reset ODD" in the panel, or delete the plugin (the uninstaller scrubs the DB but leaves installed bundle folders behind on purpose — see [odd/uninstall.php](https://github.com/RegionallyFamous/odd/blob/main/odd/uninstall.php)).

= How do I report bugs? =

The ODD Control Panel → About tab has a **Copy diagnostics** button. Paste the markdown into a [new issue](https://github.com/RegionallyFamous/odd/issues/new). Nothing is sent anywhere without you pressing the button.

== Screenshots ==

1. ODD Control Panel — Wallpaper tab with scene previews and franchise filtering.
2. Shop — Mac App Store-style browsing for scenes, icon sets, widgets, and apps.
3. Aurora scene with the Hologram icon set.
4. Origami scene with the Fold icon set.
5. Rainfall scene avoiding live desktop icons.

== Changelog ==

See [CHANGELOG.md](https://github.com/RegionallyFamous/odd/blob/main/CHANGELOG.md) for the full history. Version headings follow SemVer; API versioning is tracked separately (see [docs/api-versioning.md](https://github.com/RegionallyFamous/odd/blob/main/docs/api-versioning.md)).

== Upgrade Notice ==

= 2.1.0 =
Follow WP Desktop Mode's 0.5.1 hook rename. Every `wp_desktop_*` filter/action and every `wp_register_desktop_*()` function call now uses the new `desktop_mode_*` / `desktop_mode_register_*()` names. ODD now requires WP Desktop Mode 0.5.1 or newer — older hosts won't fire the renamed hooks and ODD's dock-icon reskinning / native windows / accent swatches / toast tones would silently no-op. Update the host plugin before upgrading ODD.

= 2.0.2 =
Drop the mouse-follow parallax drift from every GPT-painted scene. The subtle "second image sliding around on top" effect is gone — backdrops now sit perfectly still under the foreground motion layer.

= 2.0.1 =
Ship the three Discover-shelf bundles (Rainfall / Origami / Confetti) that have been referenced from the ODD Shop catalog but never actually checked into the repo, so "Install" on them finally works end to end. Add a validate-catalog CI gate that blocks future Discover rows from merging without their matching .wp archives + icon SVGs.

= 2.0.0 =
The “world-class” release: Playwright e2e, deeper smoke tests, scene perf sampling, local diagnostics, JSON Schema + manifest CLI, example bundles, API 2.0 tagging, test harness + scaffold CLI, CSP for apps, SVG fuzz + rate limits, keyboard help + axe checks, install troubleshoot UI, i18n + POT, bundle update badges, and more. See CHANGELOG.md.
