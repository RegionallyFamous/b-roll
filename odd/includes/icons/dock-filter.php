<?php
/**
 * ODD icons — dock item + desktop icon overrides.
 *
 * Hooks into WP Desktop Mode's singular `desktop_mode_dock_item` filter
 * (fires once per tile inside `desktop_mode_build_dock_items()` with
 * the real admin menu slug — `edit.php`, `upload.php`,
 * `options-general.php`… — as the 2nd argument) and replaces each
 * item's `icon` field with a URL pointing at the active icon set's
 * SVG when a mapping exists for that menu slug. Desktop icons are
 * themed through the matching `desktop_mode_icons` filter.
 *
 * Why slug-based: dock items ship keyed by their admin menu file and
 * sets declare icons under those same keys in `manifest.json#icons`,
 * so the mapping is a single hash lookup with no per-set PHP.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Canonical menu-slug → icon-set-key normalization. Lets sets use
 * short, friendly keys (`posts`, `pages`, `media`) instead of the
 * raw `edit.php` / `upload.php` / `edit.php?post_type=page` strings.
 */
function odd_icons_slug_to_key( $slug ) {
	$slug = (string) $slug;
	$map  = array(
		'index.php'               => 'dashboard',
		'edit.php'                => 'posts',
		'edit.php?post_type=page' => 'pages',
		'upload.php'              => 'media',
		'edit-comments.php'       => 'comments',
		'themes.php'              => 'appearance',
		'plugins.php'             => 'plugins',
		'users.php'               => 'users',
		'tools.php'               => 'tools',
		'options-general.php'     => 'settings',
		'profile.php'             => 'profile',
		'link-manager.php'        => 'links',
	);
	if ( isset( $map[ $slug ] ) ) {
		return $map[ $slug ];
	}
	// Heuristic: any `edit.php?post_type=X` falls under 'posts' unless
	// the set ships an override for the CPT explicitly.
	if ( 0 === strpos( $slug, 'edit.php?post_type=' ) ) {
		return 'posts';
	}
	return '';
}

add_filter(
	'desktop_mode_dock_item',
	function ( $item, $menu_slug ) {
		if ( ! is_array( $item ) ) {
			return $item;
		}
		$slug = odd_icons_get_active_slug();
		if ( '' === $slug ) {
			return $item;
		}
		$set = odd_icons_get_set( $slug );
		if ( ! $set || empty( $set['icons'] ) ) {
			return $item;
		}

		$key = odd_icons_slug_to_key( (string) $menu_slug );
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
	},
	20,
	2
);

add_filter(
	'desktop_mode_icons',
	function ( $registry ) {
		if ( ! is_array( $registry ) || empty( $registry ) ) {
			return $registry;
		}
		$slug = odd_icons_get_active_slug();
		if ( '' === $slug ) {
			return $registry;
		}
		$set = odd_icons_get_set( $slug );
		if ( ! $set || empty( $set['icons'] ) ) {
			return $registry;
		}

		foreach ( $registry as $id => $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			// Skip ODD-owned native launchers — keep their app-specific art.
			$entry_id = isset( $entry['id'] ) ? (string) $entry['id'] : (string) $id;
			if ( 'odd' === $entry_id || 0 === strpos( $entry_id, 'odd-app-' ) ) {
				continue;
			}
			$window = isset( $entry['window'] ) ? (string) $entry['window'] : '';
			if ( 0 === strpos( $window, 'odd-app-' ) ) {
				continue;
			}
			$key = odd_icons_slug_to_key( $window );
			if ( '' === $key ) {
				// Desktop icons can also target URLs — try matching by the
				// icon id as a last-ditch key.
				$key = sanitize_key( $entry_id );
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
	},
	20
);

/**
 * Desktop Mode's Code editor is both a desktop shortcut and a native
 * window with `placement: taskbar`. The desktop shortcut passes
 * through `desktop_mode_icons`; the taskbar tile is rendered from
 * `nativeWindows[]`, so mirror the themed desktop icon there.
 */
add_filter(
	'desktop_mode_shell_config',
	function ( $config ) {
		if ( ! is_array( $config ) || empty( $config['nativeWindows'] ) || empty( $config['desktopIcons'] ) ) {
			return $config;
		}

		$code_icon = '';
		foreach ( (array) $config['desktopIcons'] as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$id     = isset( $entry['id'] ) ? (string) $entry['id'] : '';
			$window = isset( $entry['window'] ) ? (string) $entry['window'] : '';
			if ( 'wpdc-editor' !== $id && 'wpdc-editor' !== $window ) {
				continue;
			}
			if ( ! empty( $entry['icon'] ) ) {
				$code_icon = (string) $entry['icon'];
				break;
			}
		}

		if ( '' === $code_icon ) {
			return $config;
		}

		foreach ( $config['nativeWindows'] as $i => $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			$id = isset( $entry['id'] ) ? (string) $entry['id'] : '';
			if ( 'wpdc-editor' === $id ) {
				$config['nativeWindows'][ $i ]['icon'] = $code_icon;
			}
		}

		return $config;
	},
	30
);
