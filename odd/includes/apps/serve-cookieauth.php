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
 * This endpoint sidesteps REST entirely. It binds a rewrite rule
 *
 *   /odd-app/<slug>/<path>
 *
 * to a `template_redirect` handler that authenticates via the
 * logged-in cookie, checks the app's capability, streams the file,
 * and exits. No nonce required, so relative asset URLs from the
 * iframe's own document resolve and stream.
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
 *
 * FLUSH CONTRACT
 * --------------
 * Rewrite rules ship via `add_rewrite_rule` on init. Flushing is
 * triggered by the main plugin activation hook (ODD_FILE) and by a
 * version-stamped option so a code update that adds new rules
 * re-flushes once on first admin pageload.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_APPS_SERVE_REWRITE_VERSION' ) ) {
	define( 'ODD_APPS_SERVE_REWRITE_VERSION', '1' );
}

add_action(
	'init',
	function () {
		if ( ! defined( 'ODD_APPS_ENABLED' ) || ! ODD_APPS_ENABLED ) {
			return;
		}
		add_rewrite_rule(
			'^odd-app/([a-z0-9-]+)/?(.*)$',
			'index.php?odd_app_slug=$matches[1]&odd_app_path=$matches[2]',
			'top'
		);

		// Flush exactly once per rewrite-schema version. add_rewrite_rule
		// registers into the cached rules but does not re-emit them; WP
		// only persists fresh rules when the cache is rebuilt. A version
		// stamp in options lets us force that rebuild after a code update.
		$stamped = get_option( 'odd_apps_serve_rewrite_version' );
		if ( ODD_APPS_SERVE_REWRITE_VERSION !== $stamped ) {
			flush_rewrite_rules( false );
			update_option( 'odd_apps_serve_rewrite_version', ODD_APPS_SERVE_REWRITE_VERSION );
		}
	},
	11
);

add_filter(
	'query_vars',
	function ( $vars ) {
		$vars[] = 'odd_app_slug';
		$vars[] = 'odd_app_path';
		return $vars;
	}
);

add_action(
	'template_redirect',
	function () {
		$slug = get_query_var( 'odd_app_slug' );
		if ( empty( $slug ) ) {
			return;
		}
		$slug = sanitize_key( (string) $slug );
		$path = (string) get_query_var( 'odd_app_path' );
		odd_apps_serve_cookieauth( $slug, $path );
		exit;
	},
	0
);

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
 * Build the public iframe URL for an app.
 */
function odd_apps_cookieauth_url_for( $slug ) {
	$slug = sanitize_key( (string) $slug );
	// home_url() respects permalink structure. If pretty permalinks
	// aren't configured, fall back to the index.php?query path so the
	// iframe still mounts — asset sub-requests resolve relatively
	// against whichever URL shape WP hands back.
	$permalinks = get_option( 'permalink_structure' );
	if ( $permalinks ) {
		return home_url( '/odd-app/' . $slug . '/' );
	}
	return add_query_arg(
		array(
			'odd_app_slug' => $slug,
			'odd_app_path' => '',
		),
		home_url( '/' )
	);
}

register_activation_hook(
	ODD_FILE,
	function () {
		// Register the rule synchronously so flush has something to
		// persist. The init hook registers it for normal page loads;
		// activation runs before the next init so we duplicate here.
		add_rewrite_rule(
			'^odd-app/([a-z0-9-]+)/?(.*)$',
			'index.php?odd_app_slug=$matches[1]&odd_app_path=$matches[2]',
			'top'
		);
		flush_rewrite_rules( false );
		update_option( 'odd_apps_serve_rewrite_version', ODD_APPS_SERVE_REWRITE_VERSION );
	}
);
