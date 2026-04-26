<?php
/**
 * ODD — script + style enqueues.
 *
 * All handles share a single localized `window.odd` config blob.
 *
 * Foundation modules (Cut 1, v0.14.0) — no user-visible behavior,
 * but every feature shipped on top of ODD should read through them:
 *
 *   - `odd-store`      window.__odd.store — typed state container
 *   - `odd-events`     window.__odd.events — typed event bus on wp.hooks
 *   - `odd-registries` window.__odd.registries — filter-aware readers
 *   - `odd-lifecycle`  window.__odd.lifecycle — explicit boot phases
 *   - `odd-safecall`   window.__odd.safeCall — error boundary helper
 *   - `odd-debug`      window.__odd.debug — inspector (self-gates)
 *
 * Feature surfaces:
 *
 *   - `odd-api`       shared client helpers on window.__odd.api
 *                     (setScene / setIconSet / shuffle / toast /
 *                     onSceneChange). All other surfaces depend on it.
 *   - `odd`           wallpaper engine boot (Pixi + scene registrar).
 *                     Registers the `odd` wallpaper with WP Desktop Mode.
 *   - `odd-panel`     ODD Control Panel native-window render callback,
 *                     declared on `window.wpDesktopNativeWindows.odd`.
 *   - `odd-widgets`   registers four desktop widgets (Now Playing,
 *                     Picker, Postcard, Clock) via registerWidget().
 *   - `odd-commands`  registers slash commands (/odd, /odd-icons,
 *                     /shuffle, /odd-panel) via registerCommand().
 *
 * All handles load only when WP Desktop Mode is active.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'admin_enqueue_scripts',
	function () {
		if ( ! function_exists( 'wpdm_is_enabled' ) ) {
			return;
		}

		// Foundation modules. Strictly ordered: store → events → the
		// rest. Each is a small IIFE that installs onto window.__odd
		// and returns. Any of them can be loaded on its own without
		// waiting on feature surfaces.
		wp_enqueue_script(
			'odd-store',
			ODD_URL . '/src/shared/store.js',
			array(),
			ODD_VERSION,
			true
		);
		wp_enqueue_script(
			'odd-events',
			ODD_URL . '/src/shared/events.js',
			array( 'wp-hooks', 'odd-store' ),
			ODD_VERSION,
			true
		);
		wp_enqueue_script(
			'odd-registries',
			ODD_URL . '/src/shared/registries.js',
			array( 'wp-hooks', 'odd-store' ),
			ODD_VERSION,
			true
		);
		wp_enqueue_script(
			'odd-lifecycle',
			ODD_URL . '/src/shared/lifecycle.js',
			array( 'odd-store', 'odd-events' ),
			ODD_VERSION,
			true
		);
		wp_enqueue_script(
			'odd-safecall',
			ODD_URL . '/src/shared/safecall.js',
			array( 'odd-store', 'odd-events' ),
			ODD_VERSION,
			true
		);
		wp_enqueue_script(
			'odd-debug',
			ODD_URL . '/src/shared/debug.js',
			array( 'odd-store', 'odd-events', 'odd-registries', 'odd-lifecycle' ),
			ODD_VERSION,
			true
		);

		// Feature surfaces. `odd-api` depends on every foundation
		// module so downstream scripts can assume the full stack is
		// installed before their IIFE runs.
		$foundation_deps = array(
			'wp-desktop',
			'wp-hooks',
			'odd-store',
			'odd-events',
			'odd-registries',
			'odd-lifecycle',
			'odd-safecall',
			'odd-debug',
		);

		wp_enqueue_script(
			'odd-api',
			ODD_URL . '/src/shared/api.js',
			$foundation_deps,
			ODD_VERSION,
			true
		);
		wp_enqueue_script(
			'odd',
			ODD_URL . '/src/wallpaper/index.js',
			array_merge( $foundation_deps, array( 'odd-api' ) ),
			ODD_VERSION,
			true
		);
		wp_enqueue_script(
			'odd-panel',
			ODD_URL . '/src/panel/index.js',
			array_merge( $foundation_deps, array( 'odd-api' ) ),
			ODD_VERSION,
			true
		);
		wp_enqueue_script(
			'odd-widgets',
			ODD_URL . '/src/widgets/index.js',
			array_merge( $foundation_deps, array( 'odd-api' ) ),
			ODD_VERSION,
			true
		);
		wp_enqueue_style(
			'odd-widgets',
			ODD_URL . '/src/widgets/style.css',
			array(),
			ODD_VERSION
		);
		wp_enqueue_script(
			'odd-commands',
			ODD_URL . '/src/commands/index.js',
			array_merge( $foundation_deps, array( 'odd-api' ) ),
			ODD_VERSION,
			true
		);
		// Screensaver: idle-detector + fullscreen scene overlay.
		// Self-contained — only depends on odd-store (for the
		// localized prefs) and odd-events (for panel echoes).
		wp_enqueue_script(
			'odd-screensaver',
			ODD_URL . '/src/screensaver/index.js',
			array( 'odd-store', 'odd-events' ),
			ODD_VERSION,
			true
		);
		wp_enqueue_style(
			'odd-icon-contrast',
			ODD_URL . '/src/icons/contrast.css',
			array( 'wp-desktop' ),
			ODD_VERSION
		);

		// ---- Apps (Cut 4, v0.16.0) ---- //
		//
		// Single JS handle `odd-apps` hosts the sandboxed iframe for
		// every installed app. Listens to odd.window-* and re-emits
		// the canonical odd.app-* events. Feature-flagged server-side
		// via ODD_APPS_ENABLED; we still enqueue the listener so that
		// manually-registered apps (via odd_register_app from another
		// plugin) work even when uploads are off.
		//
		// `wp-element` + `wp-dom-ready` are load-bearing deps: installed
		// apps' Vite bundles import `react` / `react-dom` /
		// `react/jsx-runtime` as bare specifiers, and the serve path
		// injects an import-map that redirects them to shims reading
		// `window.parent.wp.element`. If the parent page doesn't load
		// wp-element the shim throws `React is unavailable`, the app
		// never mounts, and the iframe paints pure white. (The throw
		// lands in the iframe's console context — not the main page —
		// which is why it was invisible to users.) Declaring the dep
		// here guarantees `window.wp.element` is globally installed
		// wherever this script loads (every WPDM admin page).
		wp_enqueue_script(
			'odd-apps',
			ODD_URL . '/src/apps/window-host.js',
			array_merge( $foundation_deps, array( 'odd-api', 'wp-element', 'wp-dom-ready' ) ),
			ODD_VERSION,
			true
		);

		// ---- Iris personality (Cut 3, v0.15.0) ---- //
		//
		// Five small modules, each strict IIFE, each registering a
		// muse / motion / ritual / reactivity / eye layer. Order
		// matters only inasmuch as muse + motion must install
		// before the reactivity + rituals start emitting. The
		// first-run onboarding card was retired in v1.0.3 — the
		// panel now opens directly on the Wallpaper section.
		$iris_deps = array_merge( $foundation_deps, array( 'odd-api' ) );
		wp_enqueue_script( 'odd-iris-muse', ODD_URL . '/src/iris/muse.js', $iris_deps, ODD_VERSION, true );
		wp_enqueue_script( 'odd-iris-motion', ODD_URL . '/src/iris/motion.js', $iris_deps, ODD_VERSION, true );
		wp_enqueue_script( 'odd-iris-rituals', ODD_URL . '/src/iris/rituals.js', array_merge( $iris_deps, array( 'odd-iris-muse', 'odd-iris-motion' ) ), ODD_VERSION, true );
		wp_enqueue_script( 'odd-iris-reactivity', ODD_URL . '/src/iris/reactivity.js', array_merge( $iris_deps, array( 'odd-iris-muse', 'odd-iris-motion' ) ), ODD_VERSION, true );
		wp_enqueue_script( 'odd-iris-eye', ODD_URL . '/src/iris/eye.js', array_merge( $iris_deps, array( 'odd-iris-motion' ) ), ODD_VERSION, true );

		$uid = get_current_user_id();

		$sets = array();
		foreach ( odd_icons_get_sets() as $set ) {
			$sets[] = array(
				'slug'        => $set['slug'],
				'label'       => $set['label'],
				'franchise'   => $set['franchise'],
				'accent'      => $set['accent'],
				'description' => $set['description'],
				'preview'     => $set['preview'],
				'icons'       => $set['icons'],
			);
		}

		// Resolve once, reuse — the panel reads both `scene` (canonical)
		// and `wallpaper` (alias for older consumers) off the same key.
		$active_scene = odd_wallpaper_get_user_scene( $uid );
		$apps_enabled = defined( 'ODD_APPS_ENABLED' ) && ODD_APPS_ENABLED;
		$installed    = ( $apps_enabled && function_exists( 'odd_apps_list' ) ) ? wp_list_pluck( odd_apps_list(), 'slug' ) : array();
		$has_ext      = function_exists( 'odd_extensions_collect' );

		// Per-slug serve URLs for client-side hydration. We bake one
		// fresh `_wpnonce` into each URL so the app can, if it wants,
		// read it back via URLSearchParams and use it for REST calls
		// back into /wp-json/odd/v1/. The cookie-auth serve path
		// itself doesn't require the nonce; it's there purely as a
		// convenience for the app's own fetches.
		//
		// Emitted under `appServeUrls` so window-host.js can register
		// a `wpDesktopNativeWindows[id]` render callback that builds
		// the iframe directly in JS — independent of any server-
		// rendered <template> being present in the DOM.
		$app_serve_urls = array();
		if ( $apps_enabled && function_exists( 'odd_apps_cookieauth_url_for' ) && is_array( $installed ) ) {
			foreach ( $installed as $_slug ) {
				$app_serve_urls[ $_slug ] = esc_url_raw(
					add_query_arg(
						array( '_wpnonce' => wp_create_nonce( 'wp_rest' ) ),
						odd_apps_cookieauth_url_for( $_slug )
					)
				);
			}
		}

		$config = array(
			'pluginUrl'        => ODD_URL,
			'version'          => ODD_VERSION,
			'schemaVersion'    => defined( 'ODD_SCHEMA_VERSION' ) ? ODD_SCHEMA_VERSION : 0,
			'restUrl'          => esc_url_raw( rest_url( 'odd/v1/prefs' ) ),
			'restNonce'        => wp_create_nonce( 'wp_rest' ),

			// Wallpaper.
			'scenes'           => odd_wallpaper_scenes(),
			'scene'            => $active_scene,
			'wallpaper'        => $active_scene,
			'favorites'        => odd_wallpaper_get_user_slug_list( $uid, 'odd_favorites' ),
			'recents'          => odd_wallpaper_get_user_slug_list( $uid, 'odd_recents' ),
			'shuffle'          => odd_wallpaper_get_user_shuffle( $uid ),
			'screensaver'      => odd_wallpaper_get_user_screensaver( $uid ),
			'audioReactive'    => odd_wallpaper_get_user_audio_reactive( $uid ),

			// Iris personality prefs (Cut 3).
			'initiated'        => (bool) get_user_meta( $uid, 'odd_initiated', true ),
			'mascotQuiet'      => (bool) get_user_meta( $uid, 'odd_mascot_quiet', true ),
			'winkUnlocked'     => (bool) get_user_meta( $uid, 'odd_wink_unlocked', true ),

			// Icons.
			'iconSets'         => $sets,
			'iconSet'          => odd_icons_get_active_slug( $uid ),

			// Registries reserved for Cut 1 consumers. Ship empty in
			// this release; third-party plugins fill them by adding
			// filters on the matching odd_*_registry names.
			'muses'            => $has_ext ? odd_extensions_collect( 'muses' ) : array(),
			'commands'         => $has_ext ? odd_extensions_collect( 'commands' ) : array(),
			'widgets'          => $has_ext ? odd_extensions_collect( 'widgets' ) : array(),
			'rituals'          => $has_ext ? odd_extensions_collect( 'rituals' ) : array(),
			'motionPrimitives' => $has_ext ? odd_extensions_collect( 'motionPrimitives' ) : array(),

			// Apps (v0.16.0). `apps` is the installed + enabled list
			// filtered through odd_app_registry. `userApps` is the
			// current user's personal slice — which apps they chose
			// to pin, and which they've installed themselves. Both
			// ship only when the apps feature is flag-enabled so the
			// JS store stays empty on legacy installs.
			'appsEnabled'      => $apps_enabled,
			'apps'             => ( $apps_enabled && $has_ext ) ? odd_extensions_collect( 'apps' ) : array(),
			'appServeUrls'     => $app_serve_urls,
			'userApps'         => array(
				'installed' => $installed,
				'pinned'    => (array) get_user_meta( $uid, 'odd_apps_pinned', true ),
			),
		);

		// The store and the feature surfaces read from the same
		// `window.odd` global. Localizing once on `odd-store` puts
		// the inline <script> tag at the very start of the ODD
		// script chain so everything else sees a fully-populated
		// config blob.
		wp_localize_script( 'odd-store', 'odd', $config );
	}
);
