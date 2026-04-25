<?php
/**
 * B-Roll Icons — dock item + desktop icon override.
 *
 * Hooks into WP Desktop Mode's `wp_desktop_dock_items` filter (which
 * fires inside `wpdm_build_dock_items()`) and replaces each item's
 * `icon` field with a URL pointing at the active icon set's SVG when
 * a mapping exists for that menu slug. Same treatment for desktop
 * icons via `wp_desktop_icons`.
 *
 * Why slug-based mapping: the shell ships dock items keyed by their
 * admin menu file (`edit.php`, `upload.php`, `options-general.php`
 * …). Icon sets declare their icons under those same keys in
 * `manifest.json#icons`, so the mapping is a single hash lookup with
 * no server-side per-set PHP.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Canonical menu-slug → icon-set-key normalization. Lets sets use
 * short, friendly keys (`posts`, `pages`, `media`) instead of the
 * raw `edit.php` / `upload.php` / `edit.php?post_type=page` strings.
 */
function b_roll_icons_slug_to_key( $slug ) {
	$slug = (string) $slug;
	$map  = array(
		'index.php'                 => 'dashboard',
		'edit.php'                  => 'posts',
		'edit.php?post_type=page'   => 'pages',
		'upload.php'                => 'media',
		'edit-comments.php'         => 'comments',
		'themes.php'                => 'appearance',
		'plugins.php'               => 'plugins',
		'users.php'                 => 'users',
		'tools.php'                 => 'tools',
		'options-general.php'       => 'settings',
		'profile.php'               => 'profile',
		'link-manager.php'          => 'links',
	);
	if ( isset( $map[ $slug ] ) ) {
		return $map[ $slug ];
	}
	// Heuristic: any `edit.php?post_type=X` falls under 'posts' unless
	// the set happens to ship an override for the CPT explicitly.
	if ( 0 === strpos( $slug, 'edit.php?post_type=' ) ) {
		return 'posts';
	}
	return '';
}

/**
 * Per-item dock filter — fires once per tile inside
 * `wpdm_build_dock_items()` with the real admin menu slug
 * (`edit.php`, `upload.php`, `options-general.php`…) as the 2nd
 * argument. We prefer this over the plural `wp_desktop_dock_items`
 * filter because the items array itself only carries a normalized
 * CSS-ish `id` (`menu-posts`, `menu-dashboard`…), which isn't what
 * sets' manifests key off.
 */
add_filter( 'wp_desktop_dock_item', function ( $item, $menu_slug ) {
	if ( ! is_array( $item ) ) {
		return $item;
	}
	$slug = b_roll_icons_get_active_slug();
	if ( '' === $slug ) {
		return $item;
	}
	$set = b_roll_icons_get_set( $slug );
	if ( ! $set || empty( $set['icons'] ) ) {
		return $item;
	}

	$key = b_roll_icons_slug_to_key( (string) $menu_slug );
	if ( '' !== $key && ! empty( $set['icons'][ $key ] ) ) {
		$item['icon'] = (string) $set['icons'][ $key ];
		return $item;
	}
	// Always-on fallback so every dock tile feels themed even when
	// a set ships no match for e.g. a third-party admin page.
	if ( ! empty( $set['icons']['fallback'] ) ) {
		$item['icon'] = (string) $set['icons']['fallback'];
	}
	return $item;
}, 20, 2 );

/**
 * Desktop-icons filter — shell surface tiles registered via
 * `wp_register_desktop_icon()`. Same slug mapping.
 */
add_filter( 'wp_desktop_icons', function ( $registry ) {
	if ( ! is_array( $registry ) || empty( $registry ) ) {
		return $registry;
	}
	$slug = b_roll_icons_get_active_slug();
	if ( '' === $slug ) {
		return $registry;
	}
	$set = b_roll_icons_get_set( $slug );
	if ( ! $set || empty( $set['icons'] ) ) {
		return $registry;
	}

	foreach ( $registry as $id => $entry ) {
		if ( ! is_array( $entry ) ) {
			continue;
		}
		$window = isset( $entry['window'] ) ? (string) $entry['window'] : '';
		$key    = b_roll_icons_slug_to_key( $window );
		if ( '' === $key ) {
			// Desktop icons can also target URLs — try matching by the
			// icon id as a last-ditch key.
			$key = sanitize_key( (string) ( $entry['id'] ?? $id ) );
		}
		if ( '' !== $key && ! empty( $set['icons'][ $key ] ) ) {
			$registry[ $id ]['icon'] = (string) $set['icons'][ $key ];
			continue;
		}
		if ( ! empty( $set['icons']['fallback'] ) ) {
			$registry[ $id ]['icon'] = (string) $set['icons']['fallback'];
		}
	}
	return $registry;
}, 20 );
