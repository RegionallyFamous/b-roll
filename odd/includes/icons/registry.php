<?php
/**
 * ODD icons — set registry.
 *
 * Walks `assets/icons/<slug>/manifest.json` at plugin boot and exposes:
 *   - odd_icons_get_sets()          full list (for the panel + REST).
 *   - odd_icons_get_set( $slug )    one entry, or null.
 *   - odd_icons_get_active_slug()   current user's pick, falling back
 *                                   to the `odd_icons_default_slug`
 *                                   filter, else `''` (= pass-through).
 *   - odd_icons_set_active_slug()   save pick to user meta (odd_icon_set).
 *
 * Sets are directories containing manifest + SVGs, so instead of one
 * big JSON we scan the directory tree.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Why not data URIs any more: in v1.0.4 we stopped emitting
 * `data:image/svg+xml;utf8,...` icons because WP Desktop Mode's
 * client-side `resolveIcon()` only accepts `data:image/svg+xml;base64,`
 * for dock tiles and HTTP(S) URLs for desktop shortcuts — URL-encoded
 * data URIs (and base64 data URIs for desktop icons) silently fall
 * through to letter-badge rendering. Serving tinted icons through a
 * real REST URL (`/odd/v1/icons/<set>/<key>`) gives us a single
 * representation that works across both surfaces, benefits from HTTP
 * caching, and stays under 8 KB per request.
 */
/**
 * Resolve a manifest-declared relative path against a set directory, refusing
 * anything that escapes it. Returns the absolute path on success, or '' if
 * the entry is missing, unreadable, contains `..` / absolute components, or
 * resolves outside the set root. Paths are also required to be flat — sets
 * ship SVGs next to the manifest, no subdirectories, no symlinks to elsewhere.
 */
function odd_icons_resolve_set_path( $set_dir, $rel ) {
	$rel = (string) $rel;
	if ( '' === $rel ) {
		return '';
	}
	if ( false !== strpos( $rel, "\0" ) ) {
		return '';
	}
	if ( false !== strpos( $rel, '..' ) ) {
		return '';
	}
	if ( false !== strpos( $rel, '\\' ) ) {
		return '';
	}
	$rel = ltrim( $rel, '/' );
	if ( '' === $rel || basename( $rel ) !== $rel ) {
		return '';
	}

	$abs      = $set_dir . '/' . $rel;
	$abs_real = realpath( $abs );
	$dir_real = realpath( $set_dir );
	if ( false === $abs_real || false === $dir_real ) {
		return '';
	}
	if ( 0 !== strpos( $abs_real, $dir_real . DIRECTORY_SEPARATOR ) ) {
		return '';
	}
	return $abs_real;
}

/**
 * Does the SVG at the given absolute path opt in to currentColor
 * tinting? Used by the registry to decide whether to route an icon
 * through the tinted-SVG REST endpoint or serve the static file
 * directly via plugins_url().
 */
function odd_icons_svg_uses_current_color( $abs_path ) {
	if ( ! is_readable( $abs_path ) ) {
		return false;
	}
	$svg = file_get_contents( $abs_path );
	if ( false === $svg || '' === $svg ) {
		return false;
	}
	return false !== strpos( $svg, 'currentColor' );
}

/**
 * Build the public REST URL for a tinted icon. Set and key are
 * sanitized inputs; the endpoint itself still re-validates both.
 */
function odd_icons_tinted_svg_url( $set_slug, $key ) {
	return rest_url( 'odd/v1/icons/' . $set_slug . '/' . $key );
}

function odd_icons_get_sets() {
	static $cache = null;
	if ( null !== $cache ) {
		return $cache;
	}
	$cache = array();

	$root = ODD_DIR . 'assets/icons';
	if ( ! is_dir( $root ) ) {
		return $cache;
	}
	$dirs = glob( $root . '/*', GLOB_ONLYDIR );
	if ( ! is_array( $dirs ) ) {
		return $cache;
	}

	foreach ( $dirs as $dir ) {
		$slug = basename( $dir );
		if ( '' === $slug || $slug[0] === '.' ) {
			continue;
		}
		$manifest_path = $dir . '/manifest.json';
		if ( ! is_readable( $manifest_path ) ) {
			continue;
		}
		$raw = file_get_contents( $manifest_path );
		if ( false === $raw ) {
			continue;
		}
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			continue;
		}

		$accent = isset( $data['accent'] ) ? (string) $data['accent'] : '#3858e9';

		$icons = array();
		if ( isset( $data['icons'] ) && is_array( $data['icons'] ) ) {
			foreach ( $data['icons'] as $key => $rel ) {
				$abs = odd_icons_resolve_set_path( $dir, $rel );
				if ( '' === $abs || ! is_readable( $abs ) ) {
					continue;
				}
				$basename  = basename( $abs );
				$clean_key = sanitize_key( (string) $key );
				if ( odd_icons_svg_uses_current_color( $abs ) ) {
					$icons[ $clean_key ] = odd_icons_tinted_svg_url( $slug, $clean_key );
				} else {
					$icons[ $clean_key ] = ODD_URL . '/assets/icons/' . rawurlencode( $slug ) . '/' . rawurlencode( $basename );
				}
			}
		}

		$preview = '';
		if ( ! empty( $data['preview'] ) ) {
			$preview_abs = odd_icons_resolve_set_path( $dir, $data['preview'] );
			if ( '' !== $preview_abs && is_readable( $preview_abs ) ) {
				$preview_basename = basename( $preview_abs );
				// The preview is one of the set's existing icon keys
				// most of the time (e.g. `dashboard.svg` or
				// `fallback.svg`). Fall back to the static file URL
				// when it doesn't use currentColor — same logic as
				// individual icons.
				if ( odd_icons_svg_uses_current_color( $preview_abs ) ) {
					$preview_key = '__preview__';
					foreach ( (array) $data['icons'] as $k => $rel ) {
						if ( basename( (string) $rel ) === $preview_basename ) {
							$preview_key = sanitize_key( (string) $k );
							break;
						}
					}
					$preview = odd_icons_tinted_svg_url( $slug, $preview_key );
				} else {
					$preview = ODD_URL . '/assets/icons/' . rawurlencode( $slug ) . '/' . rawurlencode( $preview_basename );
				}
			}
		}

		$cache[ $slug ] = array(
			'slug'        => $slug,
			'label'       => isset( $data['label'] ) ? (string) $data['label'] : $slug,
			'franchise'   => isset( $data['franchise'] ) ? (string) $data['franchise'] : '',
			'accent'      => $accent,
			'description' => isset( $data['description'] ) ? (string) $data['description'] : '',
			'preview'     => $preview,
			'icons'       => $icons,
		);
	}

	/**
	 * Filter the ODD icon-set registry.
	 *
	 * Runs once per request, after on-disk sets are scanned. Third-party
	 * plugins can register external sets (served as plain URLs, not data
	 * URIs) by returning a modified array keyed by slug.
	 *
	 * @since 0.14.0
	 *
	 * @param array $registry Map of slug → set descriptor.
	 */
	$filtered = apply_filters( 'odd_icon_set_registry', $cache );
	if ( is_array( $filtered ) ) {
		$cache = $filtered;
	}

	return $cache;
}

function odd_icons_get_set( $slug ) {
	$sets = odd_icons_get_sets();
	return isset( $sets[ $slug ] ) ? $sets[ $slug ] : null;
}

/**
 * Active set for the given (or current) user. `''` means "don't
 * re-skin the dock" — pass-through behaviour.
 */
function odd_icons_get_active_slug( $user_id = 0 ) {
	$user_id = $user_id ? (int) $user_id : get_current_user_id();
	if ( $user_id > 0 ) {
		$saved = get_user_meta( $user_id, 'odd_icon_set', true );
		if ( is_string( $saved ) && '' !== $saved ) {
			if ( 'none' === $saved ) {
				return '';
			}
			$set = odd_icons_get_set( $saved );
			if ( $set ) {
				return $saved;
			}
		}
	}

	$default = (string) apply_filters( 'odd_icons_default_slug', '' );
	if ( '' !== $default && odd_icons_get_set( $default ) ) {
		return $default;
	}
	return '';
}

function odd_icons_set_active_slug( $slug, $user_id = 0 ) {
	$user_id = $user_id ? (int) $user_id : get_current_user_id();
	if ( $user_id <= 0 ) {
		return false;
	}
	$slug = (string) $slug;
	if ( 'none' === $slug ) {
		return (bool) update_user_meta( $user_id, 'odd_icon_set', 'none' );
	}
	if ( '' !== $slug && ! odd_icons_get_set( $slug ) ) {
		return false;
	}
	return (bool) update_user_meta( $user_id, 'odd_icon_set', $slug );
}

/**
 * Public REST route that serves a single tinted SVG from a set.
 *
 *   GET /wp-json/odd/v1/icons/{set}/{key}
 *
 * This endpoint is intentionally public: dock and desktop-shortcut
 * icons are painted via `<img src>` which cannot send a nonce, and
 * icon SVGs are branding-level content already on disk under
 * `odd/assets/icons/<set>/`. The only things we vary by request are
 * which key the caller asked for and the set's accent color
 * substituted for `currentColor`.
 *
 * Inputs are route-validated by regex (`[a-z0-9-]+`) and then
 * re-checked against the scanned registry so unknown sets/keys 404.
 * The SVG is always served from the realpath inside the set
 * directory (see odd_icons_resolve_set_path()), no arbitrary file
 * traversal is possible.
 */
add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'odd/v1',
			'/icons/(?P<set>[a-z0-9-]+)/(?P<key>[a-z0-9-_]+)',
			array(
				'methods'             => 'GET',
				'callback'            => 'odd_icons_rest_serve_tinted',
				'permission_callback' => '__return_true',
				'args'                => array(
					'set' => array( 'type' => 'string' ),
					'key' => array( 'type' => 'string' ),
				),
			)
		);
	}
);

function odd_icons_rest_serve_tinted( WP_REST_Request $request ) {
	$set_slug = sanitize_key( (string) $request->get_param( 'set' ) );
	$key      = sanitize_key( (string) $request->get_param( 'key' ) );

	if ( '' === $set_slug || '' === $key ) {
		return new WP_Error( 'odd_icon_invalid', __( 'Unknown icon.', 'odd' ), array( 'status' => 404 ) );
	}

	$root = ODD_DIR . 'assets/icons/' . $set_slug;
	if ( ! is_dir( $root ) ) {
		return new WP_Error( 'odd_icon_invalid', __( 'Unknown icon set.', 'odd' ), array( 'status' => 404 ) );
	}
	$manifest_path = $root . '/manifest.json';
	if ( ! is_readable( $manifest_path ) ) {
		return new WP_Error( 'odd_icon_invalid', __( 'Unknown icon set.', 'odd' ), array( 'status' => 404 ) );
	}
	$raw  = file_get_contents( $manifest_path );
	$data = is_string( $raw ) ? json_decode( $raw, true ) : null;
	if ( ! is_array( $data ) || empty( $data['icons'] ) || ! is_array( $data['icons'] ) ) {
		return new WP_Error( 'odd_icon_invalid', __( 'Unknown icon set.', 'odd' ), array( 'status' => 404 ) );
	}

	$rel = null;
	foreach ( $data['icons'] as $k => $v ) {
		if ( sanitize_key( (string) $k ) === $key ) {
			$rel = (string) $v;
			break;
		}
	}
	if ( null === $rel ) {
		return new WP_Error( 'odd_icon_invalid', __( 'Unknown icon.', 'odd' ), array( 'status' => 404 ) );
	}

	$abs = odd_icons_resolve_set_path( $root, $rel );
	if ( '' === $abs || ! is_readable( $abs ) ) {
		return new WP_Error( 'odd_icon_invalid', __( 'Unknown icon.', 'odd' ), array( 'status' => 404 ) );
	}

	$svg = file_get_contents( $abs );
	if ( false === $svg || '' === $svg ) {
		return new WP_Error( 'odd_icon_invalid', __( 'Unknown icon.', 'odd' ), array( 'status' => 404 ) );
	}

	$accent = isset( $data['accent'] ) ? (string) $data['accent'] : '';
	$accent = trim( $accent );
	if ( preg_match( '/^#[0-9A-Fa-f]{3,8}$/', $accent ) ) {
		$svg = str_replace( 'currentColor', $accent, $svg );
	}

	while ( ob_get_level() > 0 ) {
		@ob_end_clean();
	}

	nocache_headers();
	header( 'Content-Type: image/svg+xml' );
	header( 'Cache-Control: public, max-age=3600, immutable' );
	header( 'X-Content-Type-Options: nosniff' );
	echo $svg; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- raw SVG body, not HTML
	exit;
}
