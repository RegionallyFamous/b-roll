<?php
/**
 * ODD Apps — WP Desktop native-window + desktop-icon registration.
 *
 * For every enabled installed app we register:
 *
 *   wp_register_desktop_window( 'odd-app-{slug}', [...] )
 *     Title bar reads the manifest's name; content renders through
 *     odd_apps_render_window_template() which injects a sandboxed
 *     iframe pointing at /wp-json/odd/v1/apps/serve/{slug}/.
 *
 *   wp_register_desktop_icon( 'odd-app-{slug}', [...] )
 *     Paired desktop tile that opens the matching window. Label and
 *     position come from manifest.desktopIcon when present, falling
 *     back to the app name.
 *
 * Both IDs are prefixed `odd-app-` so the dock-filter can ignore
 * them when re-skinning icon sets (ODD-native chrome, not WP admin
 * menu icons).
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	function () {
		if ( ! defined( 'ODD_APPS_ENABLED' ) || ! ODD_APPS_ENABLED ) {
			return;
		}
		if ( ! function_exists( 'wp_register_desktop_window' ) || ! function_exists( 'wp_register_desktop_icon' ) ) {
			return;
		}

		foreach ( odd_apps_list() as $row ) {
			if ( empty( $row['enabled'] ) ) {
				continue;
			}
			odd_apps_register_surfaces( $row );
		}
	},
	20
);

function odd_apps_register_surfaces( $row ) {
	$slug = sanitize_key( $row['slug'] );
	if ( '' === $slug ) {
		return;
	}
	$manifest = odd_apps_manifest_load( $slug );

	$window_id = 'odd-app-' . $slug;
	$icon_url  = odd_apps_icon_url( $slug, $manifest );
	$name      = isset( $row['name'] ) ? $row['name'] : $slug;

	$window_defaults = array(
		'title'      => $name,
		'icon'       => $icon_url,
		'script'     => 'odd-apps',
		'template'   => function () use ( $slug, $manifest ) {
			odd_apps_render_window_template( $slug, $manifest );
		},
		'width'      => 860,
		'height'     => 600,
		'min_width'  => 420,
		'min_height' => 320,
		'placement'  => 'none',
	);

	if ( isset( $manifest['window'] ) && is_array( $manifest['window'] ) ) {
		$w = $manifest['window'];
		foreach ( array( 'width', 'height', 'min_width', 'min_height' ) as $k ) {
			if ( isset( $w[ $k ] ) && is_numeric( $w[ $k ] ) ) {
				$window_defaults[ $k ] = (int) $w[ $k ];
			}
		}
		if ( ! empty( $w['title'] ) ) {
			$window_defaults['title'] = sanitize_text_field( (string) $w['title'] );
		}
	}

	wp_register_desktop_window( $window_id, $window_defaults );

	$icon_defaults = array(
		'title'    => $name,
		'icon'     => $icon_url,
		'window'   => $window_id,
		'position' => 200,
	);
	if ( isset( $manifest['desktopIcon'] ) && is_array( $manifest['desktopIcon'] ) ) {
		$d = $manifest['desktopIcon'];
		if ( ! empty( $d['title'] ) ) {
			$icon_defaults['title'] = sanitize_text_field( (string) $d['title'] );
		}
		if ( isset( $d['position'] ) && is_numeric( $d['position'] ) ) {
			$icon_defaults['position'] = (int) $d['position'];
		}
	}

	wp_register_desktop_icon( 'odd-app-' . $slug, $icon_defaults );
}

/**
 * Template rendered inside the WP Desktop native window body.
 *
 * Contains a mount-point div; odd/src/apps/window-host.js sees the
 * `odd.window-opened` event with id `odd-app-{slug}` and installs a
 * sandboxed iframe into this div pointing at
 * /wp-json/odd/v1/apps/serve/{slug}/.
 *
 * Data attributes here are the only client-server handoff — no
 * inline script. That keeps CSP clean and means a broken panel JS
 * load leaves a visible placeholder rather than a silent window.
 */
function odd_apps_render_window_template( $slug, $manifest ) {
	// Apps are served from /odd-app/{slug}/{path} via a cookie-auth
	// rewrite endpoint, not from the REST namespace. Going through
	// REST worked for the initial index.html load (we could tack a
	// _wpnonce onto the query string) but the browser does not
	// propagate that nonce to sub-requests for ./assets/*.js etc., so
	// WP core's rest_cookie_check_errors unsets the current user and
	// 403s every asset — the iframe paints blank white.
	//
	// See odd/includes/apps/serve-cookieauth.php for the endpoint.
	// A fresh rest nonce is still appended so apps that want to call
	// back into /wp-json/odd/v1/ from their own code can read it via
	// `new URLSearchParams( window.location.search ).get( '_wpnonce' )`
	// and send it as X-WP-Nonce on their outgoing fetches.
	$base_url  = odd_apps_cookieauth_url_for( $slug );
	$serve_url = add_query_arg(
		array(
			'_wpnonce' => wp_create_nonce( 'wp_rest' ),
		),
		$base_url
	);
	$serve_url = esc_url( $serve_url );
	$name      = isset( $manifest['name'] ) ? (string) $manifest['name'] : $slug;
	?>
	<div
		class="odd-app-host"
		data-odd-app
		data-odd-app-slug="<?php echo esc_attr( $slug ); ?>"
		data-odd-app-src="<?php echo esc_attr( $serve_url ); ?>"
		style="position:absolute;inset:0;background:#101014;"
	>
		<div class="odd-app-host__loading" style="position:absolute;inset:0;display:grid;place-items:center;color:#d0d0e0;font:13px/1.4 -apple-system,system-ui,sans-serif;opacity:.8">
			<?php
			/* translators: %s: app name */
			printf( esc_html__( 'Loading %s…', 'odd' ), esc_html( $name ) );
			?>
		</div>
	</div>
	<?php
}

function odd_apps_icon_url( $slug, $manifest ) {
	$icon = isset( $manifest['icon'] ) ? (string) $manifest['icon'] : '';
	if ( '' === $icon ) {
		return '';
	}
	// Absolute URL (http / https) — the manifest author is hosting
	// the icon themselves; pass through.
	if ( 0 === stripos( $icon, 'http://' ) || 0 === stripos( $icon, 'https://' ) ) {
		return $icon;
	}
	// data: URIs would be ideal but WP Desktop Mode's dock sanitizer
	// only accepts dashicon classes or http(s) URLs (see
	// wpdm_sanitize_dock_icon). Anything else falls back to a generic
	// cog — so we always return a real URL.
	//
	// Relative path inside the app bundle → route through the public
	// icon endpoint. `<img>` tags don't send X-WP-Nonce, so the
	// standard capability-gated /apps/serve route would 401 when the
	// dock renders the tile. The /apps/icon route serves only the
	// manifest's declared icon with no auth.
	return rest_url( 'odd/v1/apps/icon/' . $slug );
}
