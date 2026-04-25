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
 * Build a data URI for an SVG on disk, substituting `currentColor` with
 * the set's accent hex so the rendered color actually matches what the
 * manifest declares. Returns '' if the SVG doesn't opt in to currentColor
 * or the file can't be read — callers should fall back to a plain URL.
 *
 * Why data URIs: icons are rendered by WP Desktop Mode inside <img src="">
 * tags (and the panel's thumb grid does the same). Browsers sandbox
 * <img>-loaded SVGs, so CSS `color` / CSS variables on the surrounding
 * page can't reach inside. Baking the accent into the SVG payload is the
 * only way to make one `accent` manifest value actually drive the paint.
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

function odd_icons_tint_svg_data_uri( $abs_path, $accent ) {
	if ( ! is_readable( $abs_path ) ) {
		return '';
	}
	$svg = file_get_contents( $abs_path );
	if ( false === $svg || '' === $svg ) {
		return '';
	}
	if ( false === strpos( $svg, 'currentColor' ) ) {
		return '';
	}
	$accent = is_string( $accent ) ? trim( $accent ) : '';
	if ( ! preg_match( '/^#[0-9A-Fa-f]{3,8}$/', $accent ) ) {
		return '';
	}
	$svg = str_replace( 'currentColor', $accent, $svg );
	return 'data:image/svg+xml;utf8,' . rawurlencode( $svg );
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
				$basename = basename( $abs );
				$tinted   = odd_icons_tint_svg_data_uri( $abs, $accent );
				$icons[ sanitize_key( (string) $key ) ] = ( '' !== $tinted )
					? $tinted
					: ODD_URL . '/assets/icons/' . rawurlencode( $slug ) . '/' . rawurlencode( $basename );
			}
		}

		$preview = '';
		if ( ! empty( $data['preview'] ) ) {
			$preview_abs = odd_icons_resolve_set_path( $dir, $data['preview'] );
			if ( '' !== $preview_abs && is_readable( $preview_abs ) ) {
				$preview_basename = basename( $preview_abs );
				$preview_tinted   = odd_icons_tint_svg_data_uri( $preview_abs, $accent );
				$preview          = ( '' !== $preview_tinted )
					? $preview_tinted
					: ODD_URL . '/assets/icons/' . rawurlencode( $slug ) . '/' . rawurlencode( $preview_basename );
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
