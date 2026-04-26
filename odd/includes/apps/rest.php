<?php
/**
 * ODD Apps — REST namespace.
 *
 * Routes (all under /wp-json/odd/v1/apps/):
 *
 *   GET  /apps                              List installed apps
 *   GET  /apps/{slug}                       Full manifest
 *   POST /apps/upload                       Install a .wp archive
 *   POST /apps/{slug}/toggle                Enable / disable
 *   DELETE /apps/{slug}                     Uninstall
 *   GET  /apps/serve/{slug}/{path...}       Serve a file from the app bundle
 *   GET  /apps/icon/{slug}                  Public icon for the app (no auth)
 *
 * Authorization:
 *
 *   - Management endpoints require manage_options.
 *   - serve/* requires the per-app `capability` (default manage_options)
 *     and confines the file read to realpath( odd_apps_dir_for($slug) ).
 *   - icon/* is intentionally public: &lt;img src&gt; cannot send an
 *     X-WP-Nonce header, and dock/desktop icons are public branding
 *     anyway. Only the manifest's declared icon path is served.
 *
 * The serve endpoint is the only way app files reach the browser;
 * direct URLs to wp-content/odd-apps are blocked by the .htaccess
 * written on first install.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'odd/v1',
			'/apps',
			array(
				'methods'             => 'GET',
				'callback'            => 'odd_apps_rest_list',
				'permission_callback' => function () {
					return current_user_can( 'read' );
				},
			)
		);

		register_rest_route(
			'odd/v1',
			'/apps/upload',
			array(
				'methods'             => 'POST',
				'callback'            => 'odd_apps_rest_upload',
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);

		register_rest_route(
			'odd/v1',
			'/apps/(?P<slug>[a-z0-9-]+)',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => 'odd_apps_rest_get',
					'permission_callback' => function () {
						return current_user_can( 'read' );
					},
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => 'odd_apps_rest_delete',
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
				),
			)
		);

		register_rest_route(
			'odd/v1',
			'/apps/(?P<slug>[a-z0-9-]+)/toggle',
			array(
				'methods'             => 'POST',
				'callback'            => 'odd_apps_rest_toggle',
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);

		register_rest_route(
			'odd/v1',
			'/apps/serve/(?P<slug>[a-z0-9-]+)(?:/(?P<path>.+))?',
			array(
				'methods'             => 'GET',
				'callback'            => 'odd_apps_rest_serve',
				'permission_callback' => 'odd_apps_rest_serve_permission',
			)
		);

		// Public icon endpoint. REST cookie auth requires an
		// X-WP-Nonce header and an <img src> tag can't send one, so
		// the desktop dock (and every panel card) would 401 otherwise.
		// Icons are already public branding — any enabled app shows
		// its icon on the desktop — so we serve just the manifest's
		// declared icon path with no auth. Path escape is impossible
		// because we never read client-supplied path segments here.
		register_rest_route(
			'odd/v1',
			'/apps/icon/(?P<slug>[a-z0-9-]+)',
			array(
				'methods'             => 'GET',
				'callback'            => 'odd_apps_rest_icon',
				'permission_callback' => '__return_true',
			)
		);
	}
);

function odd_apps_rest_list() {
	return rest_ensure_response(
		array(
			'apps' => odd_apps_list(),
		)
	);
}

function odd_apps_rest_get( WP_REST_Request $req ) {
	$slug     = sanitize_key( $req['slug'] );
	$manifest = odd_apps_manifest_load( $slug );
	if ( empty( $manifest ) ) {
		return new WP_Error( 'not_found', __( 'App not found.', 'odd' ), array( 'status' => 404 ) );
	}
	return rest_ensure_response( $manifest );
}

function odd_apps_rest_upload( WP_REST_Request $req ) {
	$files = $req->get_file_params();
	if ( empty( $files['file'] ) || ! isset( $files['file']['tmp_name'] ) ) {
		return new WP_Error( 'no_file', __( 'No file uploaded. Use multipart field "file".', 'odd' ), array( 'status' => 400 ) );
	}
	$file   = $files['file'];
	$tmp    = $file['tmp_name'];
	$name   = $file['name'];
	$result = odd_apps_install( $tmp, $name );
	if ( is_wp_error( $result ) ) {
		$data              = $result->get_error_data();
		$data['status']    = isset( $data['status'] ) ? $data['status'] : 400;
		$result->add_data( $data );
		return $result;
	}
	return rest_ensure_response(
		array(
			'installed' => true,
			'manifest'  => $result,
		)
	);
}

function odd_apps_rest_delete( WP_REST_Request $req ) {
	$slug   = sanitize_key( $req['slug'] );
	$result = odd_apps_uninstall( $slug );
	if ( is_wp_error( $result ) ) {
		return $result;
	}
	return rest_ensure_response( array( 'uninstalled' => true ) );
}

function odd_apps_rest_toggle( WP_REST_Request $req ) {
	$slug    = sanitize_key( $req['slug'] );
	$enabled = $req->get_param( 'enabled' );
	if ( null === $enabled ) {
		$index   = odd_apps_index_load();
		$enabled = ! ( isset( $index[ $slug ]['enabled'] ) && $index[ $slug ]['enabled'] );
	}
	$result = odd_apps_set_enabled( $slug, (bool) $enabled );
	if ( is_wp_error( $result ) ) {
		return $result;
	}
	return rest_ensure_response( array( 'enabled' => (bool) $enabled ) );
}

/**
 * Serve a file from an app bundle.
 *
 * Safety walk:
 *   - Resolve the requested path via realpath inside the app's own
 *     realpath base — if it escapes, return 403.
 *   - Forbidden extensions from the validator are re-checked here so
 *     a manifest.json that lies about an entry can't slip through.
 *   - Cache-Control is private, no-store — app bundles change on
 *     install/uninstall and must never hit a shared proxy.
 *
 * Content-Type is guessed via a small MIME table covering the common
 * static file types. Unknowns fall back to application/octet-stream.
 */
function odd_apps_rest_serve_permission( WP_REST_Request $req ) {
	if ( ! is_user_logged_in() ) {
		return false;
	}
	$slug  = sanitize_key( $req['slug'] );
	$index = odd_apps_index_load();
	if ( ! isset( $index[ $slug ] ) ) {
		return false;
	}
	if ( empty( $index[ $slug ]['enabled'] ) ) {
		return false;
	}
	$cap = isset( $index[ $slug ]['capability'] ) && $index[ $slug ]['capability']
		? $index[ $slug ]['capability']
		: 'manage_options';
	return current_user_can( $cap );
}

function odd_apps_rest_serve( WP_REST_Request $req ) {
	$slug = sanitize_key( $req['slug'] );
	$path = (string) $req['path'];
	if ( '' === $path ) {
		$manifest = odd_apps_manifest_load( $slug );
		$path     = isset( $manifest['entry'] ) && $manifest['entry'] ? (string) $manifest['entry'] : 'index.html';
	}

	if (
		false !== strpos( $path, '..' ) ||
		( strlen( $path ) > 0 && '/' === $path[0] ) ||
		false !== strpos( $path, "\0" ) ||
		! preg_match( '#^[a-zA-Z0-9._/-]+$#', $path )
	) {
		return new WP_Error( 'bad_path', __( 'Bad app path.', 'odd' ), array( 'status' => 400 ) );
	}

	$ext = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );
	if ( in_array( $ext, odd_apps_forbidden_extensions(), true ) ) {
		return new WP_Error( 'forbidden', __( 'This file type cannot be served.', 'odd' ), array( 'status' => 403 ) );
	}

	$base = odd_apps_dir_for( $slug );
	$real_base = realpath( $base );
	$full      = realpath( $base . $path );
	if ( ! $real_base || ! $full || 0 !== strpos( $full, $real_base ) ) {
		return new WP_Error( 'not_found', __( 'File not found.', 'odd' ), array( 'status' => 404 ) );
	}
	if ( ! is_file( $full ) || ! is_readable( $full ) ) {
		return new WP_Error( 'not_found', __( 'File not found.', 'odd' ), array( 'status' => 404 ) );
	}

	$mime = odd_apps_mime_for( $full );
	$body = null;
	$size = filesize( $full );

	if ( 'text/html' === $mime && function_exists( 'odd_apps_inject_runtime_importmap' ) ) {
		$raw = file_get_contents( $full ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		if ( false !== $raw ) {
			$body = odd_apps_inject_runtime_importmap( $raw );
			$size = strlen( $body );
		}
	}

	// Drain any admin-side output buffers so readfile streams the
	// file bytes unmolested. Without this a stray debug notice or
	// admin_head echo ends up prepended to the response body.
	while ( ob_get_level() > 0 ) {
		@ob_end_clean();
	}

	nocache_headers();
	header( 'Content-Type: ' . $mime );
	header( 'X-Content-Type-Options: nosniff' );
	// Content-Length is only meaningful when no transport compression
	// is in play; the PHP runtime may gzip the response otherwise.
	if ( false === $size || ini_get( 'zlib.output_compression' ) ) {
		header_remove( 'Content-Length' );
	} else {
		header( 'Content-Length: ' . (int) $size );
	}
	header( 'Referrer-Policy: no-referrer' );
	// Apps load into a sandboxed iframe. Explicit framing headers
	// prevent a third-party site from embedding the serve URL outside
	// our own admin shell.
	header( 'X-Frame-Options: SAMEORIGIN' );
	if ( null !== $body ) {
		echo $body; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	} else {
		// readfile() is used intentionally: the serve endpoint streams
		// potentially multi-megabyte static assets to a sandboxed iframe
		// and must not buffer the whole payload into memory.
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
		$sent = readfile( $full );
		if ( false === $sent && defined( 'WP_DEBUG' ) && WP_DEBUG && function_exists( 'error_log' ) ) {
			// Headers are already flushed at this point, so we can't
			// surface the failure to the client — but logging lets
			// the admin spot a disk-read or permissions regression.
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( sprintf( '[ODD Apps] readfile() failed for %s', $full ) );
		}
	}
	exit;
}

/**
 * Public icon endpoint.
 *
 * Resolves the app's manifest.icon path (defaults to icon.svg) and
 * streams it with a long cache header. No client-supplied path is
 * honoured, so there's no traversal surface — the slug is the only
 * variable input and the regex constrains it.
 *
 * Returns 404 for missing / disabled / iconless apps so enumerating
 * slugs reveals nothing extra beyond "an app with this slug either
 * exists or doesn't".
 */
function odd_apps_rest_icon( WP_REST_Request $req ) {
	$slug  = sanitize_key( $req['slug'] );
	$index = odd_apps_index_load();
	if ( ! isset( $index[ $slug ] ) || empty( $index[ $slug ]['enabled'] ) ) {
		return new WP_Error( 'not_found', __( 'App not found.', 'odd' ), array( 'status' => 404 ) );
	}

	$manifest = odd_apps_manifest_load( $slug );
	$icon     = isset( $manifest['icon'] ) && $manifest['icon']
		? (string) $manifest['icon']
		: 'icon.svg';

	// Restrict to a safe character set and forbid path escape.
	if (
		false !== strpos( $icon, '..' ) ||
		( strlen( $icon ) > 0 && '/' === $icon[0] ) ||
		false !== strpos( $icon, "\0" ) ||
		! preg_match( '#^[a-zA-Z0-9._/-]+$#', $icon )
	) {
		return new WP_Error( 'not_found', __( 'App not found.', 'odd' ), array( 'status' => 404 ) );
	}

	$ext = strtolower( pathinfo( $icon, PATHINFO_EXTENSION ) );
	if ( ! in_array( $ext, array( 'svg', 'png', 'webp', 'jpg', 'jpeg', 'gif', 'ico' ), true ) ) {
		return new WP_Error( 'not_found', __( 'App not found.', 'odd' ), array( 'status' => 404 ) );
	}

	$base      = odd_apps_dir_for( $slug );
	$real_base = realpath( $base );
	$full      = realpath( $base . $icon );
	if ( ! $real_base || ! $full || 0 !== strpos( $full, $real_base ) ) {
		return new WP_Error( 'not_found', __( 'App not found.', 'odd' ), array( 'status' => 404 ) );
	}
	if ( ! is_file( $full ) || ! is_readable( $full ) ) {
		return new WP_Error( 'not_found', __( 'App not found.', 'odd' ), array( 'status' => 404 ) );
	}

	$mime = odd_apps_mime_for( $full );
	$size = filesize( $full );

	while ( ob_get_level() > 0 ) {
		@ob_end_clean();
	}

	header( 'Content-Type: ' . $mime );
	header( 'X-Content-Type-Options: nosniff' );
	header( 'Cache-Control: public, max-age=86400' );
	if ( $size && ! ini_get( 'zlib.output_compression' ) ) {
		header( 'Content-Length: ' . (int) $size );
	}
	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
	$sent = readfile( $full );
	if ( false === $sent && defined( 'WP_DEBUG' ) && WP_DEBUG && function_exists( 'error_log' ) ) {
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log( sprintf( '[ODD Apps] readfile() failed for icon %s', $full ) );
	}
	exit;
}

function odd_apps_mime_for( $path ) {
	$ext = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );
	$map = array(
		'html' => 'text/html; charset=utf-8',
		'htm'  => 'text/html; charset=utf-8',
		'css'  => 'text/css; charset=utf-8',
		'js'   => 'application/javascript; charset=utf-8',
		'mjs'  => 'application/javascript; charset=utf-8',
		'json' => 'application/json; charset=utf-8',
		'svg'  => 'image/svg+xml',
		'webp' => 'image/webp',
		'png'  => 'image/png',
		'jpg'  => 'image/jpeg',
		'jpeg' => 'image/jpeg',
		'gif'  => 'image/gif',
		'ico'  => 'image/x-icon',
		'woff' => 'font/woff',
		'woff2'=> 'font/woff2',
		'ttf'  => 'font/ttf',
		'otf'  => 'font/otf',
		'txt'  => 'text/plain; charset=utf-8',
		'md'   => 'text/markdown; charset=utf-8',
		'wasm' => 'application/wasm',
		'map'  => 'application/json; charset=utf-8',
	);
	return isset( $map[ $ext ] ) ? $map[ $ext ] : 'application/octet-stream';
}
