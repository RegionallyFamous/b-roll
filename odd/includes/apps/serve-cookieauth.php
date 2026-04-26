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
 *   /odd-app-runtime/<runtime-module>.js
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

	// Optional one-shot JSON trace, gated on manage_options. Lets
	// an admin hit /odd-app/<slug>/?odd_debug=1 and see the exact
	// branch this matcher took — including auth + capability
	// decisions — without stopping the iframe to attach a debugger.
	$debug_trace = array();
	$debug_on    = false;
	if ( isset( $_GET['odd_debug'] ) && '1' === (string) $_GET['odd_debug'] ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$debug_on             = true;
		$debug_trace['entry'] = array(
			'request_uri' => $uri,
			'path'        => $path,
		);
	}

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

	if ( preg_match( '#^/odd-app-runtime/(react|react-dom|react-dom-client|react-jsx-runtime)\.js$#', $path, $runtime_match ) ) {
		odd_apps_serve_runtime_module( $runtime_match[1] );
		exit;
	}

	// Expect `/odd-app/<slug>[/<rest>]`.
	if ( ! preg_match( '#^/odd-app/([a-z0-9-]+)(?:/(.*))?$#', $path, $m ) ) {
		if ( $debug_on && false !== strpos( $path, 'odd-app' ) ) {
			// Only emit when the request nominally targeted us —
			// otherwise every unrelated page load would return JSON.
			odd_apps_debug_emit(
				array_merge(
					$debug_trace,
					array(
						'matched' => false,
						'reason'  => 'regex_miss',
					)
				)
			);
		}
		return;
	}

	$slug = $m[1];
	$sub  = isset( $m[2] ) ? (string) $m[2] : '';

	if ( $debug_on ) {
		$debug_trace['matched'] = true;
		$debug_trace['slug']    = $slug;
		$debug_trace['sub']     = $sub;
	}

	odd_apps_serve_cookieauth( $slug, $sub, $debug_trace );
	exit;
}

/**
 * Emit a JSON debug payload and exit. Only reached when the caller
 * is logged in as manage_options AND passed `?odd_debug=1`, so no
 * session info is exposed to anonymous visitors.
 *
 * @param array $data
 */
function odd_apps_debug_emit( array $data ) {
	$user_id = wp_validate_auth_cookie( '', 'logged_in' );
	if ( ! $user_id ) {
		status_header( 401 );
		exit;
	}
	wp_set_current_user( $user_id );
	if ( ! current_user_can( 'manage_options' ) ) {
		status_header( 403 );
		exit;
	}
	while ( ob_get_level() > 0 ) {
		@ob_end_clean();
	}
	nocache_headers();
	header( 'Content-Type: application/json; charset=utf-8' );
	header( 'X-Content-Type-Options: nosniff' );
	echo wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
	exit;
}

/**
 * Serve an app bundle file using cookie auth only.
 *
 * @param string $slug App slug.
 * @param string $path Requested file path relative to the app root.
 */
function odd_apps_serve_cookieauth( $slug, $path, $debug_trace = null ) {
	$debug_on = is_array( $debug_trace );
	$slug     = sanitize_key( $slug );
	if ( '' === $slug ) {
		if ( $debug_on ) {
			odd_apps_debug_emit( array_merge( $debug_trace, array( 'reason' => 'invalid_slug' ) ) );
		}
		status_header( 404 );
		exit;
	}

	// Re-validate the logged-in cookie directly. REST's nonce
	// requirement doesn't apply because we never entered the REST
	// pipeline. The cookie's HMAC is still verified.
	$user_id = wp_validate_auth_cookie( '', 'logged_in' );
	if ( $debug_on ) {
		$debug_trace['auth_user_id'] = $user_id ? (int) $user_id : 0;
	}
	if ( ! $user_id ) {
		if ( $debug_on ) {
			odd_apps_debug_emit( array_merge( $debug_trace, array( 'reason' => 'auth_missing' ) ) );
		}
		status_header( 401 );
		exit;
	}
	wp_set_current_user( $user_id );

	if ( ! function_exists( 'odd_apps_index_load' ) ) {
		// Registry wasn't loaded — this can happen during very early
		// bootstrap errors. Fail closed rather than serve nothing.
		if ( $debug_on ) {
			odd_apps_debug_emit( array_merge( $debug_trace, array( 'reason' => 'registry_not_loaded' ) ) );
		}
		status_header( 500 );
		exit;
	}

	$index = odd_apps_index_load();
	if ( ! isset( $index[ $slug ] ) ) {
		if ( $debug_on ) {
			odd_apps_debug_emit(
				array_merge(
					$debug_trace,
					array(
						'reason'      => 'slug_not_in_index',
						'known_slugs' => array_keys( $index ),
					)
				)
			);
		}
		status_header( 404 );
		exit;
	}
	if ( empty( $index[ $slug ]['enabled'] ) ) {
		if ( $debug_on ) {
			odd_apps_debug_emit( array_merge( $debug_trace, array( 'reason' => 'slug_disabled' ) ) );
		}
		status_header( 404 );
		exit;
	}
	$cap = isset( $index[ $slug ]['capability'] ) && $index[ $slug ]['capability']
		? (string) $index[ $slug ]['capability']
		: 'manage_options';
	if ( $debug_on ) {
		$debug_trace['required_cap'] = $cap;
		$debug_trace['cap_ok']       = current_user_can( $cap );
	}
	if ( ! current_user_can( $cap ) ) {
		if ( $debug_on ) {
			odd_apps_debug_emit( array_merge( $debug_trace, array( 'reason' => 'capability_denied' ) ) );
		}
		status_header( 403 );
		exit;
	}

	if ( '' === $path ) {
		$manifest = odd_apps_manifest_load( $slug );
		$path     = isset( $manifest['entry'] ) && $manifest['entry']
			? (string) $manifest['entry']
			: 'index.html';
	}
	if ( $debug_on ) {
		$debug_trace['path_resolved'] = $path;
	}

	if (
		false !== strpos( $path, '..' ) ||
		( strlen( $path ) > 0 && '/' === $path[0] ) ||
		false !== strpos( $path, "\0" ) ||
		! preg_match( '#^[a-zA-Z0-9._/-]+$#', $path )
	) {
		if ( $debug_on ) {
			odd_apps_debug_emit( array_merge( $debug_trace, array( 'reason' => 'bad_path' ) ) );
		}
		status_header( 400 );
		exit;
	}

	$ext = strtolower( pathinfo( $path, PATHINFO_EXTENSION ) );
	if ( in_array( $ext, odd_apps_forbidden_extensions(), true ) ) {
		if ( $debug_on ) {
			odd_apps_debug_emit(
				array_merge(
					$debug_trace,
					array(
						'reason' => 'forbidden_ext',
						'ext'    => $ext,
					)
				)
			);
		}
		status_header( 403 );
		exit;
	}

	$base      = odd_apps_dir_for( $slug );
	$real_base = realpath( $base );
	$full      = realpath( $base . $path );
	if ( $debug_on ) {
		$debug_trace['base']      = $base;
		$debug_trace['real_base'] = $real_base;
		$debug_trace['full']      = $full;
	}
	if ( ! $real_base || ! $full || 0 !== strpos( $full, $real_base ) ) {
		if ( $debug_on ) {
			odd_apps_debug_emit( array_merge( $debug_trace, array( 'reason' => 'realpath_escape_or_missing' ) ) );
		}
		status_header( 404 );
		exit;
	}
	if ( ! is_file( $full ) || ! is_readable( $full ) ) {
		if ( $debug_on ) {
			odd_apps_debug_emit( array_merge( $debug_trace, array( 'reason' => 'file_not_found_or_unreadable' ) ) );
		}
		status_header( 404 );
		exit;
	}

	$mime = odd_apps_mime_for( $full );
	$body = null;
	$size = filesize( $full );

	if ( $debug_on ) {
		$debug_trace['mime']      = $mime;
		$debug_trace['size']      = (int) $size;
		$head                     = (string) @file_get_contents( $full, false, null, 0, 512 );
		$debug_trace['body_head'] = $head;
		odd_apps_debug_emit( array_merge( $debug_trace, array( 'reason' => 'ok_would_serve' ) ) );
	}

	if ( 'text/html' === $mime ) {
		// Browser-built app archives may leave React as bare module
		// imports (`react`, `react-dom`, `react/jsx-runtime`). The
		// sandbox iframe has no bundler, so those imports fail before
		// the app can render. Injecting a same-origin import map here
		// fixes fresh and already-installed apps without rewriting
		// their archives on disk.
		$raw = file_get_contents( $full ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		if ( false !== $raw ) {
			$body = odd_apps_inject_runtime_importmap( $raw );
			$size = strlen( $body );
		}
	}

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
	if ( null !== $body ) {
		echo $body; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	} else {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
		$sent = readfile( $full );
		if ( false === $sent && defined( 'WP_DEBUG' ) && WP_DEBUG && function_exists( 'error_log' ) ) {
			// Headers are already flushed by the time we're streaming,
			// so we can't change the status — but logging makes a
			// disk-read regression visible to admins.
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( sprintf( '[ODD Apps] cookie-auth readfile() failed for %s', $full ) );
		}
	}
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

function odd_apps_runtime_importmap_html() {
	$imports = array(
		'react'             => home_url( '/odd-app-runtime/react.js' ),
		'react-dom'         => home_url( '/odd-app-runtime/react-dom.js' ),
		'react-dom/client'  => home_url( '/odd-app-runtime/react-dom-client.js' ),
		'react/jsx-runtime' => home_url( '/odd-app-runtime/react-jsx-runtime.js' ),
	);
	return '<script type="importmap">' . wp_json_encode( array( 'imports' => $imports ) ) . '</script>';
}

function odd_apps_inject_runtime_importmap( $html ) {
	if ( false !== stripos( $html, 'type="importmap"' ) || false !== stripos( $html, "type='importmap'" ) ) {
		return $html;
	}
	$map = odd_apps_runtime_importmap_html();
	if ( false !== stripos( $html, '<head>' ) ) {
		return preg_replace( '#<head>#i', "<head>\n" . $map, $html, 1 );
	}
	if ( false !== stripos( $html, '<head ' ) ) {
		return preg_replace( '#(<head\b[^>]*>)#i', '$1' . "\n" . $map, $html, 1 );
	}
	return $map . "\n" . $html;
}

function odd_apps_serve_runtime_module( $module ) {
	$user_id = wp_validate_auth_cookie( '', 'logged_in' );
	if ( ! $user_id ) {
		status_header( 401 );
		exit;
	}
	wp_set_current_user( $user_id );
	if ( ! current_user_can( 'read' ) ) {
		status_header( 403 );
		exit;
	}

	$source = odd_apps_runtime_module_source( $module );
	if ( '' === $source ) {
		status_header( 404 );
		exit;
	}

	while ( ob_get_level() > 0 ) {
		@ob_end_clean();
	}
	nocache_headers();
	header( 'Content-Type: text/javascript; charset=utf-8' );
	header( 'X-Content-Type-Options: nosniff' );
	header( 'Content-Length: ' . strlen( $source ) );
	echo $source; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}

function odd_apps_runtime_module_source( $module ) {
	// Shared preamble baked into every runtime shim. If React can't
	// be resolved we paint a visible error banner into the iframe's
	// own <body> *before* throwing, so the user sees an actionable
	// failure message directly inside the app window — no DevTools
	// scope-switching required. (The parent-side watchdog in
	// window-host.js also catches this, but this inner fallback is
	// robust even if cross-frame DOM access is ever blocked.)
	$missing_banner = "(function(){\n" .
		"  try {\n" .
		"    var d = document;\n" .
		"    if (!d || !d.body) return;\n" .
		"    var prev = d.getElementById('odd-runtime-error');\n" .
		"    if (prev) return;\n" .
		"    var b = d.createElement('div');\n" .
		"    b.id = 'odd-runtime-error';\n" .
		"    b.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#1a1420;color:#eaeaf0;font:13px/1.5 -apple-system,system-ui,sans-serif;padding:24px;text-align:center;z-index:2147483647;';\n" .
		"    b.innerHTML = '<div style=\"max-width:460px;display:grid;gap:10px;\"><div style=\"font-weight:600;font-size:14px;color:#ffd9a3;\">ODD runtime: React is unavailable</div><div style=\"opacity:.88;\">The WordPress React runtime (<code>wp.element</code>) is not loaded on the parent page, so this app\\u2019s bare <code>react</code> imports cannot resolve. Reload the desktop once; if it persists, the ODD plugin host is missing the <code>wp-element</code> script dependency.</div></div>';\n" .
		"    d.body.appendChild(b);\n" .
		"  } catch (e) { /* best-effort */ }\n" .
		"})();\n";

	$react_loader = "const host = window.parent || window;\n" .
		"const wpElement = host.wp && host.wp.element ? host.wp.element : null;\n" .
		"const React = host.React || wpElement;\n" .
		'if (!React) { ' . $missing_banner . "throw new Error('ODD app runtime: React is unavailable.'); }\n";

	if ( 'react' === $module ) {
		return $react_loader .
			"export default React;\n" .
			"export const Children = React.Children;\n" .
			"export const Component = React.Component;\n" .
			"export const Fragment = React.Fragment;\n" .
			"export const StrictMode = React.StrictMode;\n" .
			"export const cloneElement = React.cloneElement;\n" .
			"export const createContext = React.createContext;\n" .
			"export const createElement = React.createElement;\n" .
			"export const createRef = React.createRef;\n" .
			"export const forwardRef = React.forwardRef;\n" .
			"export const isValidElement = React.isValidElement;\n" .
			"export const lazy = React.lazy;\n" .
			"export const memo = React.memo;\n" .
			"export const startTransition = React.startTransition;\n" .
			"export const Suspense = React.Suspense;\n" .
			"export const useCallback = React.useCallback;\n" .
			"export const useContext = React.useContext;\n" .
			"export const useDebugValue = React.useDebugValue;\n" .
			"export const useDeferredValue = React.useDeferredValue;\n" .
			"export const useEffect = React.useEffect;\n" .
			"export const useId = React.useId;\n" .
			"export const useImperativeHandle = React.useImperativeHandle;\n" .
			"export const useInsertionEffect = React.useInsertionEffect;\n" .
			"export const useLayoutEffect = React.useLayoutEffect;\n" .
			"export const useMemo = React.useMemo;\n" .
			"export const useReducer = React.useReducer;\n" .
			"export const useRef = React.useRef;\n" .
			"export const useState = React.useState;\n" .
			"export const useSyncExternalStore = React.useSyncExternalStore;\n" .
			"export const useTransition = React.useTransition;\n";
	}

	if ( 'react-jsx-runtime' === $module ) {
		return $react_loader .
			"export const Fragment = React.Fragment;\n" .
			"export function jsx(type, props, key) { return React.createElement(type, key === undefined ? props : Object.assign({}, props, { key })); }\n" .
			"export const jsxs = jsx;\n" .
			"export const jsxDEV = jsx;\n";
	}

	if ( 'react-dom' === $module || 'react-dom-client' === $module ) {
		return "const host = window.parent || window;\n" .
			"const wpElement = host.wp && host.wp.element ? host.wp.element : null;\n" .
			"const ReactDOM = host.ReactDOM || wpElement;\n" .
			'if (!ReactDOM) { ' . $missing_banner . "throw new Error('ODD app runtime: ReactDOM is unavailable.'); }\n" .
			"export default ReactDOM;\n" .
			"export const createPortal = ReactDOM.createPortal;\n" .
			"export const flushSync = ReactDOM.flushSync;\n" .
			"export const createRoot = ReactDOM.createRoot;\n" .
			"export const hydrateRoot = ReactDOM.hydrateRoot;\n" .
			"export const render = ReactDOM.render;\n" .
			"export const unmountComponentAtNode = ReactDOM.unmountComponentAtNode;\n";
	}

	return '';
}
