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

		$config = array(
			'pluginUrl'        => ODD_URL,
			'version'          => ODD_VERSION,
			'schemaVersion'    => defined( 'ODD_SCHEMA_VERSION' ) ? ODD_SCHEMA_VERSION : 0,
			'restUrl'          => esc_url_raw( rest_url( 'odd/v1/prefs' ) ),
			'restNonce'        => wp_create_nonce( 'wp_rest' ),

			// Wallpaper.
			'scenes'           => odd_wallpaper_scenes(),
			'scene'            => odd_wallpaper_get_user_scene( $uid ),
			'wallpaper'        => odd_wallpaper_get_user_scene( $uid ),
			'favorites'        => odd_wallpaper_get_user_slug_list( $uid, 'odd_favorites' ),
			'recents'          => odd_wallpaper_get_user_slug_list( $uid, 'odd_recents' ),
			'shuffle'          => odd_wallpaper_get_user_shuffle( $uid ),
			'audioReactive'    => odd_wallpaper_get_user_audio_reactive( $uid ),

			// Icons.
			'iconSets'         => $sets,
			'iconSet'          => odd_icons_get_active_slug( $uid ),

			// Registries reserved for Cut 1 consumers. Ship empty in
			// this release; third-party plugins fill them by adding
			// filters on the matching odd_*_registry names.
			'muses'            => function_exists( 'odd_extensions_collect' ) ? odd_extensions_collect( 'muses' ) : array(),
			'commands'         => function_exists( 'odd_extensions_collect' ) ? odd_extensions_collect( 'commands' ) : array(),
			'widgets'          => function_exists( 'odd_extensions_collect' ) ? odd_extensions_collect( 'widgets' ) : array(),
			'rituals'          => function_exists( 'odd_extensions_collect' ) ? odd_extensions_collect( 'rituals' ) : array(),
			'motionPrimitives' => function_exists( 'odd_extensions_collect' ) ? odd_extensions_collect( 'motionPrimitives' ) : array(),
		);

		// The store and the feature surfaces read from the same
		// `window.odd` global. Localizing once on `odd-store` puts
		// the inline <script> tag at the very start of the ODD
		// script chain so everything else sees a fully-populated
		// config blob.
		wp_localize_script( 'odd-store', 'odd', $config );
	}
);
