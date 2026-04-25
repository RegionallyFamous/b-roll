<?php
/**
 * ODD — custom toast tone for scene / icon swap announcements.
 *
 * Registers an `odd-muse` tone on `wp_desktop_toast_types`. Once
 * WP Desktop Mode surfaces a public `wp.desktop.toast()` API (the
 * hooks reference already describes it — the implementation is
 * planned), widgets and slash commands will emit `odd-muse`
 * notifications through it. Until then, the registered tone is a
 * forward-compat reservation that also ensures the id survives
 * WPDM's `sanitize_key()` allow-list pass.
 */

defined( 'ABSPATH' ) || exit;

add_filter(
	'wp_desktop_toast_types',
	function ( $types ) {
		if ( ! is_array( $types ) ) {
			$types = array();
		}
		$types[] = array(
			'id'    => 'odd-muse',
			'label' => __( 'ODD', 'odd' ),
			'icon'  => 'dashicons-art',
			'tone'  => 'neutral',
		);
		return $types;
	}
);
