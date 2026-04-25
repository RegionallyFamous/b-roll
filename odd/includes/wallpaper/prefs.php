<?php
/**
 * ODD wallpaper — per-user prefs reader/writer helpers.
 *
 * Reads/writes four user_meta keys:
 *   - odd_wallpaper         current scene slug
 *   - odd_favorites         slug[]
 *   - odd_recents           slug[] (most-recent first, capped)
 *   - odd_shuffle           { enabled: bool, minutes: int 1..240 }
 *   - odd_audio_reactive    bool
 */

defined( 'ABSPATH' ) || exit;

function odd_wallpaper_get_user_scene( $uid ) {
	$scene = get_user_meta( $uid, 'odd_wallpaper', true );
	$slugs = odd_wallpaper_scene_slugs();
	if ( $scene && in_array( $scene, $slugs, true ) ) {
		return $scene;
	}
	return odd_wallpaper_default_scene();
}

function odd_wallpaper_get_user_slug_list( $uid, $key ) {
	$value = get_user_meta( $uid, $key, true );
	if ( ! is_array( $value ) ) {
		return array();
	}
	$valid = odd_wallpaper_scene_slugs();
	$out   = array();
	foreach ( $value as $item ) {
		if ( is_string( $item ) && in_array( $item, $valid, true ) ) {
			$out[] = $item;
		}
	}
	return $out;
}

/**
 * Normalize an incoming shuffle preference into { enabled, minutes }.
 * Accepts booleans (legacy) or an object from the picker toolbar.
 * Minutes are clamped to a sane 1..240 range.
 */
function odd_wallpaper_sanitize_shuffle( $raw ) {
	if ( is_bool( $raw ) ) {
		return array(
			'enabled' => $raw,
			'minutes' => 15,
		);
	}
	if ( ! is_array( $raw ) ) {
		return array(
			'enabled' => false,
			'minutes' => 15,
		);
	}
	$enabled = ! empty( $raw['enabled'] );
	$minutes = isset( $raw['minutes'] ) ? (int) $raw['minutes'] : 15;
	if ( $minutes < 1 ) {
		$minutes = 1;
	}
	if ( $minutes > 240 ) {
		$minutes = 240;
	}
	return array(
		'enabled' => $enabled,
		'minutes' => $minutes,
	);
}

function odd_wallpaper_get_user_shuffle( $uid ) {
	$raw = get_user_meta( $uid, 'odd_shuffle', true );
	return odd_wallpaper_sanitize_shuffle( $raw );
}

function odd_wallpaper_get_user_audio_reactive( $uid ) {
	return (bool) get_user_meta( $uid, 'odd_audio_reactive', true );
}
