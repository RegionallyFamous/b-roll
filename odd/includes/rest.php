<?php
/**
 * ODD — unified REST endpoint.
 *
 * Registers `odd/v1/prefs` with:
 *   - GET  returns the current user's wallpaper + icon prefs plus the
 *          full catalog of installed scenes and icon sets so the panel
 *          can hydrate without re-fetching localized data.
 *   - POST accepts any subset of wallpaper/favorites/recents/shuffle/
 *          audioReactive/iconSet and writes each to its own user_meta
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

	return rest_ensure_response(
		array(
			'wallpaper'     => odd_wallpaper_get_user_scene( $uid ),
			'favorites'     => odd_wallpaper_get_user_slug_list( $uid, 'odd_favorites' ),
			'recents'       => odd_wallpaper_get_user_slug_list( $uid, 'odd_recents' ),
			'shuffle'       => odd_wallpaper_get_user_shuffle( $uid ),
			'audioReactive' => odd_wallpaper_get_user_audio_reactive( $uid ),
			'iconSet'       => odd_icons_get_active_slug( $uid ),
			'initiated'     => (bool) get_user_meta( $uid, 'odd_initiated',     true ),
			'mascotQuiet'   => (bool) get_user_meta( $uid, 'odd_mascot_quiet',  true ),
			'winkUnlocked'  => (bool) get_user_meta( $uid, 'odd_wink_unlocked', true ),
			'scenes'        => odd_wallpaper_scenes(),
			'sets'          => $sets,
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

	if ( array_key_exists( 'audioReactive', $params ) ) {
		$on = ! empty( $params['audioReactive'] );
		update_user_meta( $uid, 'odd_audio_reactive', $on ? 1 : 0 );
		$out['audioReactive'] = $on;
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

	return rest_ensure_response( $out );
}
