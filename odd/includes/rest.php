<?php
/**
 * ODD — unified REST endpoint.
 *
 * Registers `odd/v1/prefs` with:
 *   - GET  returns the current user's wallpaper + icon/cursor prefs plus the
 *          full catalog of installed scenes, icon sets, and cursor sets so the panel
 *          can hydrate without re-fetching localized data.
 *   - POST accepts any subset of wallpaper/favorites/recents/shuffle/
 *          audioReactive/shopTaskbar/iconSet/cursorSet and writes each to its own user_meta
 *          key. Partial updates are fine.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'odd/v1',
			'/prefs',
			array(
				array(
					'methods'             => 'GET',
					'permission_callback' => function () {
						return is_user_logged_in();
					},
					'callback'            => 'odd_rest_prefs_get',
				),
				array(
					'methods'             => 'POST',
					'permission_callback' => function () {
						return is_user_logged_in();
					},
					'callback'            => 'odd_rest_prefs_post',
				),
			)
		);
	}
);

function odd_rest_prefs_get() {
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

	$cursor_sets = array();
	foreach ( odd_cursors_get_sets() as $set ) {
		$cursor_sets[] = array(
			'slug'        => $set['slug'],
			'label'       => $set['label'],
			'franchise'   => $set['franchise'],
			'accent'      => $set['accent'],
			'description' => $set['description'],
			'preview'     => $set['preview'],
			'cursors'     => $set['cursors'],
		);
	}

	$apps_enabled = defined( 'ODD_APPS_ENABLED' ) && ODD_APPS_ENABLED;
	$apps_list    = ( $apps_enabled && function_exists( 'odd_apps_list' ) ) ? odd_apps_list() : array();

	return rest_ensure_response(
		array(
			'wallpaper'        => odd_wallpaper_get_user_scene( $uid ),
			'favorites'        => odd_wallpaper_get_user_slug_list( $uid, 'odd_favorites' ),
			'recents'          => odd_wallpaper_get_user_slug_list( $uid, 'odd_recents' ),
			'shuffle'          => odd_wallpaper_get_user_shuffle( $uid ),
			'screensaver'      => odd_wallpaper_get_user_screensaver( $uid ),
			'audioReactive'    => odd_wallpaper_get_user_audio_reactive( $uid ),
			'shopTaskbar'      => function_exists( 'odd_shop_taskbar_enabled' ) ? odd_shop_taskbar_enabled( $uid ) : false,
			'iconSet'          => odd_icons_get_active_slug( $uid ),
			'cursorSet'        => odd_cursors_get_active_slug( $uid ),
			'cursorStylesheet' => odd_cursors_active_stylesheet_url(),
			'initiated'        => (bool) get_user_meta( $uid, 'odd_initiated', true ),
			'mascotQuiet'      => (bool) get_user_meta( $uid, 'odd_mascot_quiet', true ),
			'winkUnlocked'     => (bool) get_user_meta( $uid, 'odd_wink_unlocked', true ),
			'scenes'           => odd_wallpaper_scenes(),
			'sets'             => $sets,
			'cursorSets'       => $cursor_sets,
			'appsEnabled'      => $apps_enabled,
			'apps'             => $apps_list,
			'userApps'         => array(
				'installed' => wp_list_pluck( $apps_list, 'slug' ),
				'pinned'    => (array) get_user_meta( $uid, 'odd_apps_pinned', true ),
			),
		)
	);
}

function odd_rest_prefs_post( WP_REST_Request $request ) {
	$uid    = get_current_user_id();
	$params = $request->get_json_params();
	if ( ! is_array( $params ) ) {
		$params = $request->get_body_params();
	}
	$params = is_array( $params ) ? $params : array();

	$slugs = odd_wallpaper_scene_slugs();
	$out   = array();

	if ( array_key_exists( 'wallpaper', $params ) || array_key_exists( 'scene', $params ) ) {
		$raw   = array_key_exists( 'wallpaper', $params ) ? $params['wallpaper'] : $params['scene'];
		$scene = is_string( $raw ) ? sanitize_key( $raw ) : '';
		if ( $scene === '' || in_array( $scene, $slugs, true ) ) {
			update_user_meta( $uid, 'odd_wallpaper', $scene );
			$out['wallpaper'] = $scene;
		} else {
			return new WP_Error(
				'odd_invalid_wallpaper',
				__( 'Unknown wallpaper slug.', 'odd' ),
				array( 'status' => 400 )
			);
		}
	}

	if ( array_key_exists( 'favorites', $params ) ) {
		$favs = odd_wallpaper_sanitize_slug_list( $params['favorites'], 50 );
		update_user_meta( $uid, 'odd_favorites', $favs );
		$out['favorites'] = $favs;
	}

	if ( array_key_exists( 'recents', $params ) ) {
		$recs = odd_wallpaper_sanitize_slug_list( $params['recents'], 12 );
		update_user_meta( $uid, 'odd_recents', $recs );
		$out['recents'] = $recs;
	}

	if ( array_key_exists( 'shuffle', $params ) ) {
		$sh = odd_wallpaper_sanitize_shuffle( $params['shuffle'] );
		update_user_meta( $uid, 'odd_shuffle', $sh );
		$out['shuffle'] = $sh;
	}

	if ( array_key_exists( 'screensaver', $params ) ) {
		$ss = odd_wallpaper_sanitize_screensaver( $params['screensaver'] );
		update_user_meta( $uid, 'odd_screensaver', $ss );
		$out['screensaver'] = $ss;
	}

	if ( array_key_exists( 'audioReactive', $params ) ) {
		$on = ! empty( $params['audioReactive'] );
		update_user_meta( $uid, 'odd_audio_reactive', $on ? 1 : 0 );
		$out['audioReactive'] = $on;
	}

	if ( array_key_exists( 'shopTaskbar', $params ) || array_key_exists( 'shopDock', $params ) ) {
		$on = array_key_exists( 'shopTaskbar', $params ) ? ! empty( $params['shopTaskbar'] ) : ! empty( $params['shopDock'] );
		if ( function_exists( 'odd_shop_set_taskbar_enabled' ) ) {
			$out['shopTaskbar'] = odd_shop_set_taskbar_enabled( $uid, $on );
		} else {
			update_user_meta( $uid, 'odd_shop_taskbar', $on ? 1 : 0 );
			$out['shopTaskbar'] = $on;
		}
	}

	// Iris personality slice (Cut 3). All three are booleans, stored
	// as 0/1 via the existing audioReactive pattern. Cast once here
	// so anything downstream (JS store, REST GET) sees a strict bool.
	foreach ( array(
		'initiated'    => 'odd_initiated',
		'mascotQuiet'  => 'odd_mascot_quiet',
		'winkUnlocked' => 'odd_wink_unlocked',
	) as $key => $meta ) {
		if ( array_key_exists( $key, $params ) ) {
			$on = ! empty( $params[ $key ] );
			update_user_meta( $uid, $meta, $on ? 1 : 0 );
			$out[ $key ] = $on;
		}
	}

	if ( array_key_exists( 'appsPinned', $params ) ) {
		$pinned_raw = is_array( $params['appsPinned'] ) ? $params['appsPinned'] : array();
		$pinned     = array();
		foreach ( $pinned_raw as $slug ) {
			if ( is_string( $slug ) ) {
				$clean = sanitize_key( $slug );
				if ( '' !== $clean && ! in_array( $clean, $pinned, true ) ) {
					$pinned[] = $clean;
				}
			}
			if ( count( $pinned ) >= 50 ) {
				break;
			}
		}
		update_user_meta( $uid, 'odd_apps_pinned', $pinned );
		$out['appsPinned'] = $pinned;
	}

	if ( array_key_exists( 'iconSet', $params ) ) {
		$raw = is_string( $params['iconSet'] ) ? $params['iconSet'] : '';
		$ok  = odd_icons_set_active_slug( $raw );
		if ( ! $ok ) {
			return new WP_Error(
				'odd_invalid_icon_set',
				__( 'Unknown icon set.', 'odd' ),
				array( 'status' => 400 )
			);
		}
		$out['iconSet'] = odd_icons_get_active_slug( $uid );
	}

	if ( array_key_exists( 'cursorSet', $params ) ) {
		$raw = is_string( $params['cursorSet'] ) ? $params['cursorSet'] : '';
		$ok  = odd_cursors_set_active_slug( $raw, $uid );
		if ( ! $ok ) {
			return new WP_Error(
				'odd_invalid_cursor_set',
				__( 'Unknown cursor set.', 'odd' ),
				array( 'status' => 400 )
			);
		}
		$out['cursorSet']        = odd_cursors_get_active_slug( $uid );
		$out['cursorStylesheet'] = odd_cursors_active_stylesheet_url();
	}

	return rest_ensure_response( $out );
}
