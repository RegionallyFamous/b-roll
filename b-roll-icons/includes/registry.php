<?php
/**
 * B-Roll Icons — set registry.
 *
 * Walks `sets/<slug>/manifest.json` at plugin boot and exposes:
 *   - b_roll_icons_get_sets()          : full list (for the picker + REST).
 *   - b_roll_icons_get_set( $slug )    : one entry, or null.
 *   - b_roll_icons_get_active_slug()   : current user's pick, falling back
 *                                        to site default, falling back to
 *                                        the first-registered set, else ''.
 *   - b_roll_icons_set_active_slug()   : save pick to user meta.
 *
 * Rationale: the registry mirrors the `src/scenes.json` pattern in
 * b-roll (single source of truth on disk, read by both PHP and JS)
 * except sets are themselves directories containing manifest + SVGs,
 * so instead of one big JSON we scan the directory tree.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Returns the full registry of installed icon sets.
 *
 * @return array<string, array> Keyed by slug; each entry has `slug`,
 *                              `label`, `franchise`, `accent`, `icons`
 *                              (map of menu-key → URL), `preview` URL,
 *                              `description`.
 */
function b_roll_icons_get_sets() {
	static $cache = null;
	if ( null !== $cache ) {
		return $cache;
	}
	$cache = array();

	$root = B_ROLL_ICONS_DIR . 'sets';
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

		$icons = array();
		if ( isset( $data['icons'] ) && is_array( $data['icons'] ) ) {
			foreach ( $data['icons'] as $key => $rel ) {
				$rel = (string) $rel;
				if ( '' === $rel ) {
					continue;
				}
				$abs = $dir . '/' . ltrim( $rel, '/' );
				if ( ! is_readable( $abs ) ) {
					continue;
				}
				$icons[ sanitize_key( (string) $key ) ] =
					B_ROLL_ICONS_URL . '/sets/' . rawurlencode( $slug ) . '/' . rawurlencode( ltrim( $rel, '/' ) );
			}
		}

		$preview = '';
		if ( ! empty( $data['preview'] ) && is_readable( $dir . '/' . ltrim( (string) $data['preview'], '/' ) ) ) {
			$preview = B_ROLL_ICONS_URL . '/sets/' . rawurlencode( $slug ) . '/' . rawurlencode( ltrim( (string) $data['preview'], '/' ) );
		}

		$cache[ $slug ] = array(
			'slug'        => $slug,
			'label'       => isset( $data['label'] ) ? (string) $data['label'] : $slug,
			'franchise'   => isset( $data['franchise'] ) ? (string) $data['franchise'] : '',
			'accent'      => isset( $data['accent'] ) ? (string) $data['accent'] : '#3858e9',
			'description' => isset( $data['description'] ) ? (string) $data['description'] : '',
			'preview'     => $preview,
			'icons'       => $icons,
		);
	}

	return $cache;
}

function b_roll_icons_get_set( $slug ) {
	$sets = b_roll_icons_get_sets();
	return isset( $sets[ $slug ] ) ? $sets[ $slug ] : null;
}

/**
 * Active set for the given (or current) user. `''` means "don't
 * re-skin the dock" — pass-through behaviour.
 */
function b_roll_icons_get_active_slug( $user_id = 0 ) {
	$user_id = $user_id ? (int) $user_id : get_current_user_id();
	if ( $user_id > 0 ) {
		$saved = get_user_meta( $user_id, 'b_roll_icons_set', true );
		if ( is_string( $saved ) && '' !== $saved ) {
			if ( 'none' === $saved ) {
				return '';
			}
			$set = b_roll_icons_get_set( $saved );
			if ( $set ) {
				return $saved;
			}
		}
	}

	$default = (string) apply_filters( 'b_roll_icons_default_slug', '' );
	if ( '' !== $default && b_roll_icons_get_set( $default ) ) {
		return $default;
	}
	return '';
}

function b_roll_icons_set_active_slug( $slug, $user_id = 0 ) {
	$user_id = $user_id ? (int) $user_id : get_current_user_id();
	if ( $user_id <= 0 ) {
		return false;
	}
	$slug = (string) $slug;
	if ( 'none' === $slug ) {
		return (bool) update_user_meta( $user_id, 'b_roll_icons_set', 'none' );
	}
	if ( '' !== $slug && ! b_roll_icons_get_set( $slug ) ) {
		return false;
	}
	return (bool) update_user_meta( $user_id, 'b_roll_icons_set', $slug );
}
