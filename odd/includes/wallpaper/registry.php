<?php
/**
 * ODD wallpaper — scene registry.
 *
 * Canonical scene list is shipped on disk as src/wallpaper/scenes.json
 * and hydrated into the browser via wp_localize_script. This file is
 * the single PHP-side reader; both the REST validator and the localized
 * bundle read from these helpers so the disk manifest is the one source
 * of truth for "what scenes exist".
 */

defined( 'ABSPATH' ) || exit;

function odd_wallpaper_scenes() {
	static $cache = null;
	if ( null === $cache ) {
		$path  = ODD_DIR . 'src/wallpaper/scenes.json';
		$raw   = is_readable( $path ) ? file_get_contents( $path ) : '';
		$data  = json_decode( $raw, true );
		$cache = is_array( $data ) ? $data : array();
	}
	return $cache;
}

function odd_wallpaper_scene_slugs() {
	$slugs = array();
	foreach ( odd_wallpaper_scenes() as $scene ) {
		if ( isset( $scene['slug'] ) ) {
			$slugs[] = $scene['slug'];
		}
	}
	return $slugs;
}

function odd_wallpaper_default_scene() {
	$slugs = odd_wallpaper_scene_slugs();
	if ( in_array( 'rainbow-road', $slugs, true ) ) {
		return 'rainbow-road';
	}
	return $slugs ? $slugs[0] : '';
}

function odd_wallpaper_sanitize_slug_list( $value, $cap ) {
	if ( ! is_array( $value ) ) {
		return array();
	}
	$valid = odd_wallpaper_scene_slugs();
	$out   = array();
	foreach ( $value as $item ) {
		$slug = is_string( $item ) ? sanitize_key( $item ) : '';
		if ( $slug && in_array( $slug, $valid, true ) && ! in_array( $slug, $out, true ) ) {
			$out[] = $slug;
		}
		if ( count( $out ) >= (int) $cap ) {
			break;
		}
	}
	return $out;
}
