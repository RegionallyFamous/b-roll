=== ODD — Outlandish Desktop Decorator ===
Contributors: regionallyfamous
Tags: wp-desktop-mode, wallpaper, icons, pixi, canvas
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.8.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Decorator for WP Desktop Mode: generative PixiJS wallpapers, themed icon sets, and a native ODD Shop window with installable Apps.

== Description ==

ODD (Outlandish Desktop Decorator) layers on top of the [WP Desktop Mode](https://github.com/WordPress/desktop-mode) plugin and turns the desktop into a playground:

* **Wallpapers.** Generative PixiJS scenes painted on custom 1920×1080 backdrops, with more packs shipping through the catalog over time.
* **Icon sets.** Full-color SVG packs that re-skin the WP Desktop dock and desktop shortcut icons.
* **Widgets.** Small desktop companions (a handwritten sticky note, a WP-flavoured Magic 8-ball) you add to your desktop from the Shop and drag anywhere.
* **Apps.** Install small standalone web apps (HTML/CSS/JS) as windows and desktop icons. Apps run on your WordPress desktop without using or knowing about WordPress — they just open. Browse and install from the ODD Shop.
* **Iris.** A lightweight mascot/personality layer that reacts to scene changes, app lifecycle events, and time of day.

All four surfaces — wallpaper, icons, widgets, apps — are switched from a single native WP Desktop window: the ODD Shop (Mac App Store-style, with category shelves).

== Installation ==

1. Install and activate the [WP Desktop Mode](https://github.com/WordPress/desktop-mode) plugin (v0.5.0+).
2. Upload the ODD plugin folder to `/wp-content/plugins/` or install via the plugin admin.
3. Activate ODD.
4. Click the floating gear (or the ODD Shop desktop icon) to switch wallpapers, icon sets, and install Apps.

== Frequently Asked Questions ==

= Do I need WP Desktop Mode to use ODD? =

Yes. ODD is a decorator for WP Desktop Mode and will not do anything useful without it active.

= Does ODD work on mobile? =

WP Desktop Mode itself is a desktop metaphor, so ODD targets desktop browsers. Scenes respect `prefers-reduced-motion` and tab-visibility pausing for battery life.

= How do I build my own scene, icon set, or app? =

See the developer documentation linked from the plugin readme on GitHub — there is a stable PHP + JS extension API (registries, event bus, store).

== Changelog ==

= 1.8.1 =
* **Dedicated Install tab.** The per-shelf "Install from file…" helper links are gone. Instead, Wallpapers / Icon Sets / Widgets / Apps now get a sibling **Install** tab in the sidebar that owns the whole flow: a big, clickable drop zone for a `.wp` archive plus a four-card "What can I install?" grid that explains each content type. The topbar **Install** pill and the Shop-wide drag-and-drop overlay still work from anywhere; the new tab just gives the action a first-class destination.

= 1.8.0 =
* **Universal `.wp` format.** The `.wp` archive now carries any ODD content type — app, icon set, scene, or widget — selected via a new `type` field in `manifest.json`. One manifest, one archive, one install flow for everything. Authors no longer need to ship a companion plugin to add a scene or an icon pack; drop the `.wp` on the ODD Shop and it's live.
* **ODD Shop as the install surface.** A topbar **Install** pill (with keyboard focus + aria label) opens a file picker from anywhere in the Shop. Drop a `.wp` file anywhere over the Shop and the whole window shows a glassy drop target. Each department — Wallpapers, Icon Sets, Widgets, Apps — also gets an inline "Install from file…" link at the top of its shelf. After install the Shop auto-switches to the matching department, scrolls the new item into view, and flashes a subtle highlight.
* **Install progress and errors are first-class UI.** The topbar pill reads "Installing…" during the upload, green-success checkmark for about two seconds after, and a descriptive error state with retry on failure. Type-specific error copy explains what's wrong (missing scene script, SVG outside the icon set directory, widget trying to run without admin trust, etc.) instead of a generic "install failed."
* **JavaScript-executing content asks first.** Scenes and widgets run in the privileged admin frame, so installs of those two types require `manage_options` plus a one-time inline confirmation banner inside the Shop — no modal dialogs, no blocking `window.confirm()`. Admins see exactly what's about to run and click Install or Cancel. Icon-set SVGs are scrubbed (no `<script>`, no `on*` handlers, no external `xlink:href`) on the server before they hit disk.
* **Unified bundle dispatcher.** A new `odd_bundle_install()` entry point routes every upload through one pipeline — shared archive validation, per-type validators and installers under `odd/includes/content/`, a REST endpoint at `POST /odd/v1/bundles/upload` and `DELETE /odd/v1/bundles/{slug}`, and a global slug uniqueness check across all four content types. `POST /odd/v1/apps/upload` stays as a back-compat alias so existing tooling keeps working.
* **Docs rewrite.** Four focused author guides — [Building an App](docs/building-an-app.md), [Building a Scene](docs/building-a-scene.md), [Building an Icon Set](docs/building-an-icon-set.md), [Building a Widget](docs/building-a-widget.md) — plus a universal [`.wp` Manifest Reference](docs/wp-manifest.md). Each is a one-stop guide: anatomy, manifest fields, runtime contracts, install flow, validation rules. The [Building on ODD](docs/building-on-odd.md) page is reframed as the integrator / plugin-author surface (filters, events, registries) — not where you go to ship content. README, `CLAUDE.md`, and the old `app-manifest.md` all cross-link to the new guides.
* **"ODD" capitalization pass.** Every product reference in prose and UI strings is the all-caps brand name; code identifiers (`odd/v1/*`, `odd_*` filters, `window.__odd`, CSS classes) stay lowercase where the system requires it.

= 1.7.2 =
* ODD Shop shelves are now proper sliders. Every category row (wallpapers, icon sets, widgets) gets a pair of floating prev/next pills that nudge the track by about one card's width. Native touch, wheel, and keyboard scroll still work — the buttons fade out at the start or end, and disappear entirely on rows that don't overflow, so short shelves stay clean.
* "Browse by category" tiles now ship with hand-drawn SVG artwork per category (Skies, Wilds, Places, Forms, Playful, Crafted, Technical, Cool, Generative, Atmosphere, Paper, ODD Originals, WP Desktop Mode, Default). Each tile's illustration crops to the right side of the card and scales gently on hover, making the quilt feel like a real navigation surface instead of flat gradients.
* The Widgets department shelf now reads "Widgets" instead of "ODD Widgets" — one less redundant brand stamp inside a panel that's already clearly ours.

= 1.7.1 =
* Polish pass across the ODD Shop. Shared pill language for every button (primary / ghost) from the hero CTAs down to the widget "Add to desktop" tiles, so the interaction vocabulary is one grammar instead of five bespoke variants. Rail active state gets a subtle top-to-bottom gradient + inner highlight, topbar picks up a 1px top inset so it reads as glass instead of matte, shelf count sits in a small rounded chip, and category quilt tiles reveal a "→" on hover or keyboard focus to signal they jump to a shelf.
* Widget tiles gain depth: an inner shine overlay + drop-shadowed glyph scale up slightly on hover, the "On desktop" chip shows a green status dot, and enabled cards get a soft accent-tinted glow. The widget hero glyph now does a gentle 7-second bob (drops out under `prefers-reduced-motion`) and is clamped to `clamp(130px, 26vw, 240px)` so it never clips on narrow panels.
* Empty-state and footer polish. The "no results" state gets a 🔍 icon above the headline, the widget footer is now a shared `.odd-shop__tip` row with a 💡 icon in a tinted circle, and the "Reset to default" icon-set row picks up a ↺ glyph in the same circle treatment. Icon-set catalog rows lift 1px on hover. Focus rings added across the rail, hero CTAs, and tile buttons so every interactive element has a visible keyboard state.
* Shelf entrance now animates a 6px rise on load (`odd-shop-rise`) so switching departments feels live without being flashy.

= 1.7.0 =
* Widgets department in the ODD Shop. Adds a fourth department between Icon Sets and Apps that browses ODD's desktop widgets (Sticky Note, Magic 8-Ball) with the same Mac App Store chrome as the rest of the Shop: an editorial hero, a shelf of gradient-glyph tiles, and an "Add to desktop" / "Remove" pill on each tile that wires straight into `wp.desktop.widgetLayer`. The hero flips from "Featured widget" to "On your desktop" once a widget is enabled. Enabling or dismissing a widget from its × button on the desktop is picked up live via the `wp-desktop.widget.added` / `.removed` hooks, so the Shop stays in sync either way.

= 1.6.3 =
* Hero contrast fix. The hero scrim was sliding past the title on bright editorial backdrops (Apps, Icon Sets); tightened it to a near-solid left ink panel with a soft vertical haze and stacked text-shadow halos on the title + subtitle, so the body stays legible on any artwork. Eyebrow pill darkens its shadow to match.
* Categories instead of franchises. Wallpapers and Icon Sets used to show one shelf per `franchise` field, which meant 17 icon shelves of 1 set each — and 15 wallpaper shelves under "ODD Originals" alongside three singletons. Both are now bucketed into broader curated categories with real siblings: **Skies / Wilds / Places / Forms** for scenes, **Playful / Crafted / Technical / Cool** for icon sets. Every shelf has more than one item.
* "Default" set out of the catalog. The synthetic "Default WP icons" tile no longer appears in any shelf or in the category quilt (it was creating a singleton "Default" shelf that violated the same rule). Instead, when a custom icon set is committed, a dedicated "Reset to default" pill renders between the hero and the quilt.
* Quilt + shelf headers now read "Browse by category".

= 1.6.2 =
* Apps copy rewrite. Apps are no longer described as "sandbox bundles" or "sandboxed apps" anywhere user-facing — they're "mini apps that just run on your WordPress desktop without using or knowing about WordPress". The Apps department now ships an editorial hero banner and proper mini-apps department description.
* Icon Sets and Apps departments get dedicated AI-generated hero artwork (a constellation of pastel app-icon stickers, and a still-life of floating mini-app objects). Wallpapers hero keeps the live scene preview.
* Contrast + spacing pass: stronger hero scrim with text-shadow on the title and subtitle so headlines stay readable on any backdrop; bumped department title from 28→30px and shelf title from 17→19px; airier padding around the content pane and between shelves; ink-3 darkened from #6e6e73 to #5d5d62 for legible secondary text; quilt count gets text-shadow so it survives bright gradients; tile pill contrast tightened. Topbar drops the unused right-side gutter.

= 1.6.1 =
* ODD Shop redesigned to look and feel like the Mac App Store: department hero card, franchise category quilt, horizontal-scroll shelves, tile-style cards with inline Preview/Active pills, search pill in the top bar, and a floating preview confirmation bar. No data or REST changes.

= 1.6.0 =
* The ODD Control Panel is now the **ODD Shop** — a Mac App Store-style browsing surface for ODD's wallpapers, icon sets, and apps. Adds a dedicated top bar ("ODD Shop" with the Outlandish Desktop Decorator byline), a translucent left-rail with department glyphs and taglines (Wallpapers / Icon Sets / Apps / About), and groups every catalog into franchise "shelves" (Generative, Atmosphere, Paper…) on a softer off-white surface. Default window size grew from 820×560 to 960×620 to match the new chrome. All data, REST endpoints, live-swap hooks, and slash commands (`/odd-panel`) are unchanged — only the chrome + copy moved.

= 1.5.7 =
* Fixes `Uncaught SyntaxError: The requested module '/odd-app-runtime/react.js' does not provide an export named 'createContext'` in installed apps. React and ReactDOM are CommonJS packages, so `export * from 'react'` through esbuild only exposes a single `default` interop wrapper and loses the named symbols apps import (`createContext`, `useState`, `StrictMode`, etc.). `odd/bin/build-runtime` now enumerates each package's public exports at build time and emits explicit `export { default, A, B, C } from "…"` entry files, so the served bundles expose real named ESM exports backed by the CJS modules' live-bound properties. Affects `react.js`, `react-dom.js`, `react-dom-client.js`, and `react-jsx-runtime.js`.

= 1.5.6 =
* Ships real React 19 from the plugin instead of proxying through wp.element, fixing the "Cannot read properties of undefined (reading 'S')" crash that installed apps threw after v1.5.5. Vite-built apps are compiled against React 19 and read React's `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE` internals pointer, which only exists in React 19 — but WordPress's `wp.element` is still React 18, so the proxy handed back objects whose internals the apps couldn't use. The runtime endpoint at `/odd-app-runtime/*.js` now serves pre-built React 19 ESM bundles (`react.js`, `react-dom.js`, `react-dom-client.js`, `react-jsx-runtime.js` plus shared chunks) from `odd/apps/runtime/`, regeneratable via the new `odd/bin/build-runtime` script.

= 1.5.5 =
* Makes installed apps actually render, not just load their HTML. Vite-built bundles use bare module imports (`from "react"`, `from "react/jsx-runtime"`, `from "react-dom"`) that depend on a browser import map. The import map was present in the iframe's HTML, but inside Playground's service-worker-mediated iframe sandbox the module loader raced ahead of it and threw "Failed to resolve module specifier" before the map registered. ODD now also rewrites those bare specifiers inside every served JS chunk to absolute `/odd-app-runtime/*.js` URLs, so modules resolve without relying on import-map support or timing.

= 1.5.4 =
* Fixes the long-running "still white" app window: installed apps now actually load their HTML. The cookie-auth serve path was unintentionally emitting the `?odd_debug=1` JSON envelope on every `/odd-app/<slug>/` request, because the debug trace buffer was always passed as an array (and `is_array()` always true) into the serve function — so the iframe's body was the debug trace instead of `index.html`. The top-level matcher now passes `null` when debug is off, and the serve function additionally requires `?odd_debug=1` in the query before emitting JSON.

= 1.5.3 =
* Fixes the Wallpaper setting cards wrapping one word per line on narrow panels. The switch/label column now claims the remaining width, the helper text wraps as normal prose, and cards reflow in a responsive grid instead of getting squeezed against the controls column.

= 1.5.2 =
* Third-line-of-defense against the "Still White" app window. v1.4.5 added client-side window-body hydration; v1.4.6 added `wp-element` as a script dep so the React-runtime shim could resolve bare `react` imports. This release adds an in-iframe visible-error banner: if the shim ever can't find React or ReactDOM on the parent page, it now paints a full-viewport diagnostic card ("ODD runtime: React is unavailable") into the iframe's own `<body>` *before* throwing, instead of leaving the iframe completely blank. Unlike the parent-side watchdog (which needs same-origin DOM access + a 1.5s timer), this inner fallback runs synchronously at module-evaluation time and is robust against cross-frame access restrictions, timing races, and any future sandbox tightening. End-user promise: if an app ever fails to mount again, the user sees why, directly inside the window, without opening DevTools or switching iframe context.

= 1.5.1 =
* Redesigns the Wallpaper controls (Shuffle, Audio-reactive, Screensaver) as polished setting cards with pill toggles, helper text, and a clearer Preview action. Bumps ODD_VERSION so cached `odd-panel` scripts get invalidated on upgrade.

= 1.4.6 =
* Actually fixes the "Still White" app window. 1.4.5 shipped a client-side hydration path that confirmed the window body was being built correctly, but installed apps still painted blank. The `?odd_debug=1` trace added in 1.4.5 showed the server was serving a valid 393-byte `index.html` with a working `<script type="module">` pointing at the Vite bundle — meaning the blank-white was happening after the HTML loaded, inside the iframe, at module-evaluation time. Inspection of the shipped catalog bundles confirmed the actual root cause: every Vite-built app imports `react` / `react-dom` / `react/jsx-runtime` as bare module specifiers, and ODD's import-map redirects those to runtime shims that read React out of `window.parent.wp.element`. But `odd-apps` didn't declare `wp-element` as a script dependency, so on WPDM admin pages that don't otherwise pull in Gutenberg-adjacent code, `window.wp.element` was `undefined` — the shim threw `ODD app runtime: React is unavailable.` inside the iframe's execution context, which doesn't surface in the main-page console without manually switching DevTools scope (hence the "no errors visible" user report). Adding `wp-element` + `wp-dom-ready` as deps of the `odd-apps` handle guarantees React is on the parent page wherever the apps host loads.
* Visible failure fallback. Even after the dep fix, any future reason an app could mount-and-render-nothing (third-party app, runtime exception in the bundle, broken import map) now surfaces as a diagnostic card inside the window body instead of pure white. Post-`load` the window host peeks at the iframe's `#root` / `body` (same-origin, which our `allow-same-origin` sandbox permits) and, if it's still empty 1.5s later, replaces the loading placeholder with a titled card explaining the most likely cause — and differentiates between "wp-element missing on parent" and "app bundle loaded but rendered nothing." The next regression will be a single right-click-Inspect away, not another week-long diagnostic.

= 1.4.5 =
* Fixes the "Still White" regression where installed apps opened a completely blank window in Playground — no "Loading…" text, no console errors, no network activity. Root cause was a two-failure-mode combination introduced by the v1.4.4 lazy-loading split: `native-surfaces.php` (which owns the server-rendered `.odd-app-host` `<template>`) was context-gated behind `is_admin() || wp_doing_ajax() || ...`, and on some Playground request shapes that gate evaluated false at `init` priority 20, so the template was never registered. WPDM's client-side `cloneTemplate()` silently catches "no such template" errors and paints an empty window body — which is exactly what users saw. The fix is belt-and-suspenders: (a) always load all four formerly-gated apps submodules (`native-surfaces.php`, `migrate-from-bazaar.php`, `bazaar-compat.php`, `core-controller.php`) — the overhead is one filestat per request, vs. a hard-to-diagnose blank-window regression, and (b) register client-side render callbacks in `window.wpDesktopNativeWindows[id]` for every installed app at boot, so the window body is hydrated by JS regardless of whether the server template exists. The JS path uses a new `appServeUrls` map (pre-signed with a fresh `_wpnonce`) localized into `window.odd`.
* Keeps the diagnostic scaffolding: a new readonly `GET /wp-json/odd/v1/apps/diag/{slug}` endpoint (gated on `manage_options`) reports request context, index state, filesystem paths, and loader function availability; the cookie-auth serve path emits a one-shot `?odd_debug=1` JSON trace (also `manage_options`-gated) showing the exact branch taken plus a base64'd body head. Both are cheap, stay shipped, and let the next regression be diagnosed from a single URL instead of another week-long browser-based repro hunt. Also ships `odd/bin/smoke-app`, a curl-based regression check that asserts `/odd-app/<slug>/` returns non-empty `text/html` — the one-line smoke test referenced by this plan.
* Visible failure: when no serve URL is registered for a slug (e.g. browser tab predates the most recent install), the window body now shows "No serve URL registered for \"<slug>\". Reload the desktop to refresh the app list." instead of pure white.

= 1.4.4 =
* Speed / reliability / security audit pass. Twelve targeted fixes across three tiers, no feature surface changes.
* Correctness: Bazaar → ODD migration now correctly skips (instead of silently advancing the schema) when it can't acquire its concurrency lock, so a user whose first login raced another admin's pageload doesn't lose their per-ware manifest copy forever. The permanent `add_option` lock is replaced with a 60-second transient so a mid-migration fatal self-heals on the next pageload rather than wedging everyone. Per-app capability default is now `manage_options` whether an app was installed from a catalog entry or a zip upload — previously zip-installed apps defaulted to admin-only while built-ins defaulted to `read`, so the same app installed two ways had two different access policies. Schema-version migrations no longer require WP Desktop Mode to be active (they're pure usermeta rewrites; gating them on the host plugin meant a temporary deactivation silently skipped migrations for that admin session).
* Performance: icon-set registry is now cached in a `ODD_VERSION`-keyed transient so admin pages no longer do 17 manifest JSON parses + ~220 small SVG reads on cold PHP workers. Apps subsystem's manifest-extensions loop is gated to admin / REST / ajax only, so wp-cron waking the site and logged-out front-end views skip the per-app get_option + JSON decode cost. The apps submodule bootstrap itself lazy-loads `rest.php` / `loader.php` / `native-surfaces.php` / `migrate-from-bazaar.php` / `core-controller.php` on public front-end requests. Panel payload building dedupes repeated `odd_apps_list()` and `odd_wallpaper_get_user_scene()` calls.
* Hardening: remote `http(s)://` app icons are piped through `esc_url()` with a scheme allowlist (no more `javascript:` URIs leaking in via a bad manifest), the double-`APP_OPENED` race between the WINDOW_OPENED handler and the MutationObserver is fixed so muse / motion / analytics subscribers only fire once per app open, `readfile()` failures in both serve paths now log on `WP_DEBUG` so a disk-read regression surfaces in the error log, and a new `odd/uninstall.php` scrubs every `odd_*` option + user_meta key + transient when an admin deletes the plugin. Broken `manifest.json` files now surface a single admin notice naming the path(s) that failed to parse.

= 1.3.2 =
* Really fixes the blank-iframe bug for installed apps. 1.3.1 shipped a cookie-auth rewrite endpoint (`/odd-app/<slug>/<path>`) that depended on `flush_rewrite_rules` having persisted — a precondition that silently failed on Playground installs, mu-plugin-based setups, and any site with a stale `rewrite_rules` option, so the iframe kept 403ing its own asset sub-requests and painting white. The endpoint now matches directly against `$_SERVER['REQUEST_URI']` on `init` priority 1 (after `pluggable.php` loads so `wp_validate_auth_cookie` is available) instead of going through the rewrite pipeline. No flushes, no query vars, no activation dance — just a regex on the URI, a cookie HMAC re-validation, a capability check, and `readfile()`. Works the first time the plugin activates, on every install shape.

= 1.3.1 =
* Fixes two long-running visual / functional bugs around installed apps and icon surfaces.
* Installed apps now load correctly. Previously the app iframe served its HTML entry but every relative asset fetch (`./assets/*.js`, CSS, images) returned 403 because WP core's REST cookie check runs `wp_set_current_user(0)` on any logged-in cookie request without a nonce — the browser doesn't propagate nonces to `<script src>` sub-requests. Apps now serve from a dedicated cookie-auth rewrite endpoint (`/odd-app/<slug>/<path>`) that sits outside the REST pipeline, so relative URLs resolve against the iframe's own base and all assets stream cleanly. Rewrite rules are flushed once on activation and re-flushed by a version-stamped option when the endpoint ships new rules.
* Dock and desktop-shortcut icons no longer wrap ODD-owned artwork in WP Desktop Mode's default dark glass plate with a white border. The plate is now stripped for every ODD icon URL — themed icon sets (`/wp-json/odd/v1/icons/`, `/assets/icons/`), installed app icons (`/wp-json/odd/v1/apps/icon/`), and catalog icons (`/apps/catalog/icons/`) — and a uniform rounded corner is clipped onto the `<img>` so the full-bleed v1.2 sets (Risograph, Cross-Stitch, Lemonade Stand, etc.) match the rounded silhouette of the hand-authored sets.

= 1.2.0 =
* Ships a full expansion pack: 10 new GPT Image 2 wallpaper scenes (Tide Pool, Tropical Greenhouse, Big Sky, Terrazzo, Balcony Noon, Cloud City, Wildflower Meadow, Sun Print, Beach Umbrellas, Mercado) and 10 new icon sets (Risograph, Claymation, Circuit Bend, Stadium, Botanical Plate, Arcade Tokens, Cross-Stitch, Lemonade Stand, Hologram, Tiki). Every wallpaper has a custom PixiJS motion scene layered over the painted backdrop; every icon set provides all 13 WP Desktop icon keys.
* All new concepts are bright / warm / daytime / whimsical — no dark or moody wallpapers in this pack.
* Scene catalog doubles from 8 → 18; icon-set catalog grows from 7 → 17.

= 1.1.4 =
* Redesigned all seven catalog app icons (Mosaic, Ledger, Flow, Board, Sine, Swatch, Tome) as flat, bold glyphs with no gradient background boxes, sparkles, or drop shadows. Replaces the previous purple-gradient-chrome style that clashed with the dock and the desktop.
* Rebuilt each app bundle so the icon served on the desktop shortcut is the same clean flat glyph, not the old chromed version embedded in the archive.
* Installed app windows now mount their iframe defensively. A `MutationObserver` watches for the server-rendered `.odd-app-host` mount points and injects the sandboxed iframe the moment they appear — previously, windows whose `wp-desktop.window.opened` hook didn't fire (e.g. session-restored windows) could stay stuck on the "Loading…" placeholder.

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

= 1.5.2 =
Adds a third line of defense against "pure white" app windows: if React/ReactDOM can't be resolved for any reason, the iframe now paints its own visible error banner directly into its body before throwing. No more silent failures even in worst-case scenarios.

= 1.4.6 =
Actually fixes the "Still White" app window — 1.4.5 fixed half the problem (the window body now builds reliably) but the apps themselves couldn't mount React because wp-element wasn't guaranteed on the parent page. Also ships a visible "App did not render" card instead of pure white for any future mount failure. Recommended immediately if you're on 1.4.4 or 1.4.5.

= 1.4.5 =
Fixes the "Still White" regression where installed apps opened a blank window in Playground. Also adds gated diag endpoints so the next one is findable from a URL. Recommended for every install that shipped on 1.4.4.

= 1.4.4 =
Speed / reliability / security audit pass — fixes a Bazaar-migration data-loss bug, caches the icon registry, hardens the remote-icon path, de-dupes the APP_OPENED event, and ships an uninstall.php. Recommended for every install.

= 1.3.2 =
Fixes the blank-iframe app regression that 1.3.1 tried (and failed) to fix. If you saw installed apps still paint white in 1.3.1, upgrade — they really load now.

= 1.3.1 =
Fixes installed apps (blank iframe after the HTML loaded) and strips the "weird border / dark plate" around catalog app icons and the v1.2 icon sets on both the dock and desktop. Strongly recommended.

= 1.2.0 =
Doubles the wallpaper catalog and more than doubles the icon-set catalog with 10 new bright / warm / daytime scenes and 10 new icon sets. Highly recommended for anyone who wants more to look at.

= 1.1.4 =
Cleans up the look of installed app icons (flat, no gradient boxes) and hardens window mounting so installed apps always open. Recommended.

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
