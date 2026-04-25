<?php
/**
 * ODD Apps — Bazaar REST compat shim.
 *
 * Forwards `/wp-json/bazaar/v1/*` calls to their `/wp-json/odd/v1/apps/*`
 * equivalents so existing Bazaar clients keep working during the
 * transition. Opt-in: enabled whenever `ODD_BAZAAR_COMPAT` is defined or
 * the `odd_apps_bazaar_compat` filter returns true (which it does by
 * default in v0.16.2).
 *
 * Routes forwarded:
 *
 *   GET     bazaar/v1/wares          → odd/v1/apps
 *   GET     bazaar/v1/wares/{slug}   → odd/v1/apps/{slug}
 *   POST    bazaar/v1/upload         → odd/v1/apps/upload
 *   DELETE  bazaar/v1/wares/{slug}   → odd/v1/apps/{slug}
 *   POST    bazaar/v1/wares/{slug}/toggle → odd/v1/apps/{slug}/toggle
 *   GET     bazaar/v1/serve/{slug}/{path} → odd/v1/apps/serve/{slug}/{path}
 *
 * The handlers are intentionally thin — they repackage the request
 * parameters and dispatch a nested WP_REST_Request through the same
 * WP REST server the real route uses, so capability checks, nonces,
 * and edge cases resolve in exactly one place.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_BAZAAR_COMPAT' ) ) {
	define( 'ODD_BAZAAR_COMPAT', (bool) apply_filters( 'odd_apps_bazaar_compat', true ) );
}

add_action(
	'rest_api_init',
	function () {
		if ( ! ODD_BAZAAR_COMPAT ) {
			return;
		}

		$read_cb = function () {
			return current_user_can( 'read' );
		};
		$manage_cb = function () {
			return current_user_can( 'manage_options' );
		};

		register_rest_route(
			'bazaar/v1',
			'/wares',
			array(
				'methods'             => 'GET',
				'callback'            => 'odd_apps_bazaar_compat_list',
				'permission_callback' => $read_cb,
			)
		);
		register_rest_route(
			'bazaar/v1',
			'/upload',
			array(
				'methods'             => 'POST',
				'callback'            => 'odd_apps_bazaar_compat_upload',
				'permission_callback' => $manage_cb,
			)
		);
		register_rest_route(
			'bazaar/v1',
			'/wares/(?P<slug>[a-z0-9-]+)',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => 'odd_apps_bazaar_compat_get',
					'permission_callback' => $read_cb,
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => 'odd_apps_bazaar_compat_delete',
					'permission_callback' => $manage_cb,
				),
			)
		);
		register_rest_route(
			'bazaar/v1',
			'/wares/(?P<slug>[a-z0-9-]+)/toggle',
			array(
				'methods'             => 'POST',
				'callback'            => 'odd_apps_bazaar_compat_toggle',
				'permission_callback' => $manage_cb,
			)
		);
		register_rest_route(
			'bazaar/v1',
			'/serve/(?P<slug>[a-z0-9-]+)(?:/(?P<path>.+))?',
			array(
				'methods'             => 'GET',
				'callback'            => 'odd_apps_bazaar_compat_serve',
				'permission_callback' => 'odd_apps_rest_serve_permission',
			)
		);
	}
);

function odd_apps_bazaar_compat_dispatch( $method, $route, $params = array(), $files = array() ) {
	$req = new WP_REST_Request( $method, $route );
	foreach ( $params as $k => $v ) {
		$req->set_param( $k, $v );
	}
	if ( ! empty( $files ) ) {
		$req->set_file_params( $files );
	}
	return rest_do_request( $req );
}

function odd_apps_bazaar_compat_list() {
	return odd_apps_bazaar_compat_dispatch( 'GET', '/odd/v1/apps' );
}

function odd_apps_bazaar_compat_get( WP_REST_Request $req ) {
	return odd_apps_bazaar_compat_dispatch( 'GET', '/odd/v1/apps/' . sanitize_key( $req['slug'] ) );
}

function odd_apps_bazaar_compat_delete( WP_REST_Request $req ) {
	return odd_apps_bazaar_compat_dispatch( 'DELETE', '/odd/v1/apps/' . sanitize_key( $req['slug'] ) );
}

function odd_apps_bazaar_compat_toggle( WP_REST_Request $req ) {
	return odd_apps_bazaar_compat_dispatch(
		'POST',
		'/odd/v1/apps/' . sanitize_key( $req['slug'] ) . '/toggle',
		array( 'enabled' => $req->get_param( 'enabled' ) )
	);
}

function odd_apps_bazaar_compat_upload( WP_REST_Request $req ) {
	$files = $req->get_file_params();
	if ( empty( $files['file'] ) && ! empty( $files['ware'] ) ) {
		// Older Bazaar clients used the `ware` field name. Rename it
		// so the ODD handler finds the upload under the expected key.
		$files['file'] = $files['ware'];
	}
	return odd_apps_bazaar_compat_dispatch( 'POST', '/odd/v1/apps/upload', array(), $files );
}

function odd_apps_bazaar_compat_serve( WP_REST_Request $req ) {
	$slug = sanitize_key( $req['slug'] );
	$path = (string) $req['path'];
	$fwd  = new WP_REST_Request( 'GET', '/odd/v1/apps/serve/' . $slug . ( $path ? '/' . $path : '' ) );
	$fwd->set_url_params( array( 'slug' => $slug, 'path' => $path ) );
	// The real handler streams directly with readfile() + exit. Let
	// it do that — we're in the same PHP process, so the bytes flow
	// through untouched.
	return odd_apps_rest_serve( $fwd );
}
