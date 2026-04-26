<?php
/**
 * ODD Apps — cookie-auth bundle serve endpoint.
 *
 * WHY THIS EXISTS
 * ---------------
 * Installed apps are Vite/React single-page bundles whose HTML entry
 * references static assets with *relative* URLs (`./assets/index-*.js`
 * etc.). The iframe receives those sub-requests from the browser, so
 * they carry the login cookie but NOT the `X-WP-Nonce` header.
 *
 * The REST serve route (`/wp-json/odd/v1/apps/serve/...`) requires a
 * rest_nonce because WP core's `rest_cookie_check_errors`
 * (wp-includes/rest-api.php) runs `wp_set_current_user(0)` whenever
 * a REST request has a login cookie but no nonce. The first request
 * succeeds (the nonce is in the iframe src query string) but every
 * subsequent asset fetch unsets the current user and 403s — the
 * iframe paints blank white.
 *
 * This endpoint sidesteps REST entirely. It listens on `init` for
 * requests whose URI path matches
 *
 *   /odd-app/<slug>/<path>
 *
 * authenticates via the logged-in cookie, checks the app's
 * capability, streams the file, and exits. No rewrite rules, no REST
 * pipeline, no nonce — so relative asset URLs from the iframe's own
 * document resolve and stream cleanly.
 *
 * Earlier revisions (<= 1.3.1) used `add_rewrite_rule` +
 * `template_redirect`, but that path depended on `flush_rewrite_rules`
 * having run (and having persisted) on the exact install the user is
 * loading. Playground installs, mu-plugin setups, and any site with a
 * stale `rewrite_rules` option regressed back to the REST path and
 * left the iframe blank. A direct `$_SERVER['REQUEST_URI']` match
 * has no such dependency.
 *
 * SECURITY
 * --------
 *   - Cookie auth is validated via `wp_validate_auth_cookie` — we
 *     don't trust a bare cookie, we re-validate the HMAC.
 *   - Capability is the app's own `capability` field (default
 *     `manage_options`) — same surface as the REST serve route.
 *   - Path is regex-constrained; realpath() confines the read to
 *     the app's own directory.
 *   - `X-Frame-Options: SAMEORIGIN` + `Referrer-Policy: no-referrer`
 *     mirror the REST route headers.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Match + serve on every request. Registered at priority 1 on
 * `init` — that's the first hook after `pluggable.php` loads, so
 * `wp_validate_auth_cookie` is guaranteed to be available. It still
 * runs before any template / canonical-redirect logic, so the URL
 * can't be repurposed out from under us.
 */
add_action(
	'init',
	'odd_apps_cookieauth_maybe_serve',
	1
);

function odd_apps_cookieauth_maybe_serve() {
	if ( ! defined( 'ODD_APPS_ENABLED' ) || ! ODD_APPS_ENABLED ) {
		return;
	}

	$uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
	if ( '' === $uri ) {
		return;
	}

	$parts = explode( '?', $uri, 2 );
	$path  = (string) $parts[0];

	$home_path = wp_parse_url( home_url( '/' ), PHP_URL_PATH );
	if ( ! is_string( $home_path ) ) {
		$home_path = '/';
	}
	$home_path = '/' . ltrim( (string) $home_path, '/' );

	// Strip the site's home path prefix so that subdir installs
	// (example.com/blog/odd-app/...) match the same way as root
	// installs (example.com/odd-app/...).
	if ( '/' !== $home_path && 0 === strpos( $path, $home_path ) ) {
		$path = substr( $path, strlen( $home_path ) - 1 );
	}

	// Expect `/odd-app/<slug>[/<rest>]`.
	if ( ! preg_match( '#^/odd-app/([a-z0-9-]+)(?:/(.*))?$#', $path, $m ) ) {
		return;
	}

	$slug = $m[1];
	$sub  = isset( $m[2] ) ? (string) $m[2] : '';

	odd_apps_serve_cookieauth( $slug, $sub );
	exit;
}

/**
 * Serve an app bundle file using cookie auth only.
 *
 * @param string $slug App slug.
 * @param string $path Requested file path relative to the app root.
 */
function odd_apps_serve_cookieauth( $slug, $path ) {
	$slug = sanitize_key( $slug );
	if ( '' === $slug ) {
		status_header( 404 );
		exit;
	}

	// Re-validate the logged-in cookie directly. REST's nonce
	// requirement doesn't apply because we never entered the REST
	// pipeline. The cookie's HMAC is still verified.
	$user_id = wp_validate_auth_cookie( '', 'logged_in' );
	if ( ! $user_id ) {
		status_header( 401 );
		exit;
	}
	wp_set_current_user( $user_id );

	if ( ! function_exists( 'odd_apps_index_load' ) ) {
		// Registry wasn't loaded — this can happen during very early
		// bootstrap errors. Fail closed rather than serve nothing.
		status_header( 500 );
		exit;
	}

	$index = odd_apps_index_load();
	if ( ! isset( $index[ $slug ] ) ) {
		status_header( 404 );
		exit;
	}
	if ( empty( $index[ $slug ]['enabled'] ) ) {
		status_header( 404 );
		exit;
	}
	$cap = isset( $index[ $slug ]['capability'] ) && $index[ $slug ]['capability']
		? (string) $index[ $slug ]['capability']
		: 'manage_options';
	if ( ! current_user_can( $cap ) ) {
		status_header( 403 );
		exit;
	}

	if ( '' === $path ) {
		$manifest = odd_apps_manifest_load( $slug );
		$path     = isset( $manifest['entry'] ) && $manifest['entry']
			? (string) $manifest['entry']
			: 'index.html';
	}

	if (
		false !== strpos( $path, '..' ) ||
		( strlen( $path ) > 0 && '/' === $path[0] ) ||
		false !== strpos( $path, "\0" ) ||
		! preg_match( '#^[a-zA-Z0-9._/-]+$#', $path )
	) {
		status_header( 400 );
		exit;
	}

	$ext = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );
	if ( in_array( $ext, odd_apps_forbidden_extensions(), true ) ) {
		status_header( 403 );
		exit;
	}

	$base      = odd_apps_dir_for( $slug );
	$real_base = realpath( $base );
	$full      = realpath( $base . $path );
	if ( ! $real_base || ! $full || 0 !== strpos( $full, $real_base ) ) {
		status_header( 404 );
		exit;
	}
	if ( ! is_file( $full ) || ! is_readable( $full ) ) {
		status_header( 404 );
		exit;
	}

	$mime = odd_apps_mime_for( $full );
	$size = filesize( $full );

	while ( ob_get_level() > 0 ) {
		@ob_end_clean();
	}

	nocache_headers();
	header( 'Content-Type: ' . $mime );
	header( 'X-Content-Type-Options: nosniff' );
	if ( false === $size || ini_get( 'zlib.output_compression' ) ) {
		header_remove( 'Content-Length' );
	} else {
		header( 'Content-Length: ' . (int) $size );
	}
	header( 'Referrer-Policy: no-referrer' );
	header( 'X-Frame-Options: SAMEORIGIN' );
	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
	readfile( $full );
}

/**
 * Build the public iframe URL for an app. Always uses the pretty
 * `/odd-app/<slug>/` shape — since the matcher runs directly on
 * `$_SERVER['REQUEST_URI']` we don't need permalinks configured or
 * rewrite rules flushed for it to work.
 */
function odd_apps_cookieauth_url_for( $slug ) {
	$slug = sanitize_key( (string) $slug );
	return home_url( '/odd-app/' . $slug . '/' );
}
