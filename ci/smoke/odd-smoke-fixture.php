<?php
/**
 * Plugin Name: ODD Smoke Fixture
 * Description: MU-plugin used only by the install-smoke CI job. Short-circuits
 *              outbound HTTP requests for the ODD remote catalog (registry.json
 *              and any .wp bundle under /catalog/v1/bundles/) so the smoke
 *              suite can prove the starter-pack installer works hermetically,
 *              with no dependency on the live GitHub Pages deployment.
 *
 *              DO NOT INSTALL IN PRODUCTION. This intercepts catalog HTTP
 *              traffic and swaps the response in-process.
 *
 * The fixture catalog + bundles live at the path in the
 * `ODD_SMOKE_FIXTURE_ROOT` constant (defined in wp-config via the smoke
 * workflow). Inside that root we expect:
 *
 *   registry.json              — the registry payload to return for
 *                                catalog URL fetches.
 *   bundles/<slug>-<type>-<v>.wp — on-disk .wp archives whose paths match
 *                                the download_url entries in registry.json.
 *
 * Matching is by URL path suffix so the real `ODD_CATALOG_URL` doesn't need
 * to be overridden — any GET to `/catalog/v1/registry.json` or
 * `/catalog/v1/bundles/<file>.wp` on any host resolves to the local file.
 *
 * @package ODD_Smoke
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_SMOKE_FIXTURE_ROOT' ) ) {
	// Conventional default so running the MU-plugin locally without the
	// workflow env still finds the fixture — `site/catalog/v1/` is a
	// byte-identical superset of the prod registry on every branch.
	define( 'ODD_SMOKE_FIXTURE_ROOT', WP_CONTENT_DIR . '/odd-smoke-fixture' );
}

/**
 * Intercept HTTP requests to the ODD catalog domain and serve fixtures
 * from disk. Returning anything other than `false` short-circuits the
 * standard HTTP API pipeline with our fabricated response.
 *
 * @param false|array|WP_Error $preempt The filter's short-circuit sentinel.
 * @param array                $args    Request args (method, headers, …).
 * @param string               $url     Target URL.
 * @return false|array                 Fabricated response or `false` to pass through.
 */
add_filter(
	'pre_http_request',
	function ( $preempt, $args, $url ) {
		unset( $args );
		if ( false !== $preempt ) {
			// Some other filter already claimed this request. Don't
			// fight them — let the first interceptor win.
			return $preempt;
		}
		if ( ! is_string( $url ) || '' === $url ) {
			return false;
		}

		$path = wp_parse_url( $url, PHP_URL_PATH );
		if ( ! is_string( $path ) ) {
			return false;
		}

		$root = rtrim( ODD_SMOKE_FIXTURE_ROOT, '/\\' );
		if ( '' === $root || ! is_dir( $root ) ) {
			return false;
		}

		// Catalog registry.
		if ( false !== strpos( $path, '/catalog/v1/registry.json' ) ) {
			$file = $root . '/registry.json';
			return odd_smoke_serve_file( $file, 'application/json' );
		}

		// Catalog bundle (.wp).
		if ( preg_match( '#/catalog/v1/bundles/([^/]+\.wp)$#', $path, $m ) ) {
			$file = $root . '/bundles/' . $m[1];
			return odd_smoke_serve_file( $file, 'application/zip' );
		}

		// Catalog icon (optional — nothing in the installer reads these
		// as HTTP requests today, but the Shop catalog endpoint does).
		if ( preg_match( '#/catalog/v1/icons/(.+)$#', $path, $m ) ) {
			$file = $root . '/icons/' . $m[1];
			if ( is_readable( $file ) ) {
				return odd_smoke_serve_file( $file, 'image/svg+xml' );
			}
		}

		return false;
	},
	10,
	3
);

/**
 * Build a WP_HTTP-shaped response array from a local file. Returns a
 * `404` response when the file is missing so the caller sees a well-
 * formed failure it can log, rather than a passthrough to the network.
 */
function odd_smoke_serve_file( $file, $content_type ) {
	if ( ! is_readable( $file ) ) {
		return array(
			'headers'  => array(),
			'body'     => '',
			'response' => array(
				'code'    => 404,
				'message' => 'smoke fixture missing',
			),
			'cookies'  => array(),
			'filename' => null,
		);
	}

	$body    = (string) file_get_contents( $file );
	$headers = array(
		'content-type'   => $content_type,
		'content-length' => (string) strlen( $body ),
	);

	// `download_url()` calls `wp_remote_get()` which does not honour
	// `filename` in the default transport — it writes the body to a
	// tempfile itself and hands us a 200. No-op here.
	return array(
		'headers'  => $headers,
		'body'     => $body,
		'response' => array(
			'code'    => 200,
			'message' => 'OK',
		),
		'cookies'  => array(),
		'filename' => null,
	);
}

