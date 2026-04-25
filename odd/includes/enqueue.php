<?php
/**
 * ODD — script + style enqueues.
 *
 * All handles share a single localized `window.odd` config blob.
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

		wp_enqueue_script(
			'odd-api',
			ODD_URL . '/src/shared/api.js',
			array( 'wp-desktop', 'wp-hooks' ),
			ODD_VERSION,
			true
		);
		wp_enqueue_script(
			'odd',
			ODD_URL . '/src/wallpaper/index.js',
			array( 'wp-desktop', 'wp-hooks', 'odd-api' ),
			ODD_VERSION,
			true
		);
		wp_enqueue_script(
			'odd-panel',
			ODD_URL . '/src/panel/index.js',
			array( 'wp-desktop', 'odd-api' ),
			ODD_VERSION,
			true
		);
		wp_enqueue_script(
			'odd-widgets',
			ODD_URL . '/src/widgets/index.js',
			array( 'wp-desktop', 'wp-hooks', 'odd-api' ),
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
			array( 'wp-desktop', 'wp-hooks', 'odd-api' ),
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
			'pluginUrl'     => ODD_URL,
			'version'       => ODD_VERSION,
			'restUrl'       => esc_url_raw( rest_url( 'odd/v1/prefs' ) ),
			'restNonce'     => wp_create_nonce( 'wp_rest' ),

			// Wallpaper.
			'scenes'        => odd_wallpaper_scenes(),
			'scene'         => odd_wallpaper_get_user_scene( $uid ),
			'wallpaper'     => odd_wallpaper_get_user_scene( $uid ),
			'favorites'     => odd_wallpaper_get_user_slug_list( $uid, 'odd_favorites' ),
			'recents'       => odd_wallpaper_get_user_slug_list( $uid, 'odd_recents' ),
			'shuffle'       => odd_wallpaper_get_user_shuffle( $uid ),
			'audioReactive' => odd_wallpaper_get_user_audio_reactive( $uid ),

			// Icons.
			'iconSets'      => $sets,
			'iconSet'       => odd_icons_get_active_slug( $uid ),
		);

		// `odd-api` is a dependency of every other ODD script, so
		// localizing once here is enough: the `<script>` tag it emits
		// lands before any of the dependents, and they all read the
		// same `window.odd` global.
		wp_localize_script( 'odd-api', 'odd', $config );
	}
);
