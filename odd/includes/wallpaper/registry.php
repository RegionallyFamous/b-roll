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

/**
 * Return the active scene registry.
 *
 * The on-disk `src/wallpaper/scenes.json` is the seed; third-party
 * plugins can append or modify entries by adding a filter on
 * `odd_scene_registry` (priority 10 is conventional). See
 * odd/includes/extensions.php for the `odd_register_scene()` helper.
 *
 * Result is memoized per request, so filter callbacks should be
 * idempotent — they run once per process.
 */
function odd_wallpaper_scenes() {
	static $cache = null;
	if ( null === $cache ) {
		$path      = ODD_DIR . 'src/wallpaper/scenes.json';
		$raw       = is_readable( $path ) ? file_get_contents( $path ) : '';
		$data      = json_decode( $raw, true );
		$from_disk = is_array( $data ) ? $data : array();
		/**
		 * Filter the ODD scene registry.
		 *
		 * @since 0.14.0
		 *
		 * @param array $registry List of scene descriptors. Each descriptor
		 *                        must have at least a `slug`; ODD also reads
		 *                        `label`, `franchise`, `tags`, `fallbackColor`,
		 *                        and `added`.
		 */
		$cache     = apply_filters( 'odd_scene_registry', $from_disk );
		if ( ! is_array( $cache ) ) {
			$cache = $from_disk;
		}
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
	if ( in_array( 'flux', $slugs, true ) ) {
		return 'flux';
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
