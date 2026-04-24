<?php
/**
 * Plugin Name:       B-Roll for WP Desktop Mode
 * Plugin URI:        https://github.com/RegionallyFamous/b-roll
 * Description:       A pack of pop-culture-themed PixiJS wallpapers for WP Desktop Mode, served as a single 'B-Roll' wallpaper whose scene is chosen from an in-canvas picker. Architected to scale to hundreds of scenes.
 * Version:           0.7.1
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            regionallyfamous
 * Author URI:        https://github.com/regionallyfamous
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       b-roll
 *
 * Requires the WordPress Desktop Mode plugin to be active:
 * https://github.com/WordPress/desktop-mode
 */

defined( 'ABSPATH' ) || exit;

/**
 * Canonical scene list, loaded once per request from src/scenes.json.
 * Both the REST validator and the localized bundle read from this.
 */
function b_roll_scenes() {
	static $cache = null;
	if ( $cache === null ) {
		$path = __DIR__ . '/src/scenes.json';
		$raw  = is_readable( $path ) ? file_get_contents( $path ) : '';
		$data = json_decode( $raw, true );
		$cache = is_array( $data ) ? $data : array();
	}
	return $cache;
}

function b_roll_scene_slugs() {
	$slugs = array();
	foreach ( b_roll_scenes() as $scene ) {
		if ( isset( $scene['slug'] ) ) {
			$slugs[] = $scene['slug'];
		}
	}
	return $slugs;
}

function b_roll_default_scene() {
	$slugs = b_roll_scene_slugs();
	if ( in_array( 'rainbow-road', $slugs, true ) ) {
		return 'rainbow-road';
	}
	return $slugs ? $slugs[0] : '';
}

function b_roll_sanitize_slug_list( $value, $cap ) {
	if ( ! is_array( $value ) ) {
		return array();
	}
	$valid = b_roll_scene_slugs();
	$out   = array();
	foreach ( $value as $item ) {
		$slug = is_string( $item ) ? sanitize_key( $item ) : '';
		if ( $slug && in_array( $slug, $valid, true ) && ! in_array( $slug, $out, true ) ) {
			$out[] = $slug;
		}
		if ( count( $out ) >= (int) $cap ) {
			break;
		}
	}
	return $out;
}

function b_roll_get_user_scene( $uid ) {
	$scene = get_user_meta( $uid, 'b_roll_scene', true );
	$slugs = b_roll_scene_slugs();
	if ( $scene && in_array( $scene, $slugs, true ) ) {
		return $scene;
	}
	return b_roll_default_scene();
}

function b_roll_get_user_slug_list( $uid, $key ) {
	$value = get_user_meta( $uid, $key, true );
	if ( ! is_array( $value ) ) {
		return array();
	}
	$valid = b_roll_scene_slugs();
	$out   = array();
	foreach ( $value as $item ) {
		if ( is_string( $item ) && in_array( $item, $valid, true ) ) {
			$out[] = $item;
		}
	}
	return $out;
}

add_action(
	'admin_enqueue_scripts',
	function () {
		if ( ! function_exists( 'wpdm_is_enabled' ) ) {
			return;
		}

		wp_enqueue_script(
			'b-roll',
			plugins_url( 'src/index.js', __FILE__ ),
			array( 'wp-desktop', 'wp-hooks' ),
			'0.7.1',
			true
		);

		$uid = get_current_user_id();

		wp_localize_script(
			'b-roll',
			'bRoll',
			array(
				'pluginUrl' => untrailingslashit( plugins_url( '', __FILE__ ) ),
				'version'   => '0.7.1',
				'scenes'    => b_roll_scenes(),
				'scene'     => b_roll_get_user_scene( $uid ),
				'favorites' => b_roll_get_user_slug_list( $uid, 'b_roll_favorites' ),
				'recents'   => b_roll_get_user_slug_list( $uid, 'b_roll_recents' ),
				'restUrl'   => esc_url_raw( rest_url( 'b-roll/v1/prefs' ) ),
				'restNonce' => wp_create_nonce( 'wp_rest' ),
			)
		);
	}
);

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'b-roll/v1',
			'/prefs',
			array(
				'methods'             => 'POST',
				'permission_callback' => function () {
					return is_user_logged_in();
				},
				'callback'            => function ( WP_REST_Request $request ) {
					$uid    = get_current_user_id();
					$params = $request->get_json_params();
					if ( ! is_array( $params ) ) {
						$params = $request->get_body_params();
					}
					$params = is_array( $params ) ? $params : array();

					$slugs = b_roll_scene_slugs();
					$out   = array();

					if ( array_key_exists( 'scene', $params ) ) {
						$scene = is_string( $params['scene'] ) ? sanitize_key( $params['scene'] ) : '';
						if ( $scene === '' || in_array( $scene, $slugs, true ) ) {
							update_user_meta( $uid, 'b_roll_scene', $scene );
							$out['scene'] = $scene;
						} else {
							return new WP_Error(
								'b_roll_invalid_scene',
								'Unknown scene slug.',
								array( 'status' => 400 )
							);
						}
					}

					if ( array_key_exists( 'favorites', $params ) ) {
						$favs = b_roll_sanitize_slug_list( $params['favorites'], 50 );
						update_user_meta( $uid, 'b_roll_favorites', $favs );
						$out['favorites'] = $favs;
					}

					if ( array_key_exists( 'recents', $params ) ) {
						$recs = b_roll_sanitize_slug_list( $params['recents'], 12 );
						update_user_meta( $uid, 'b_roll_recents', $recs );
						$out['recents'] = $recs;
					}

					return rest_ensure_response( $out );
				},
			)
		);
	}
);
