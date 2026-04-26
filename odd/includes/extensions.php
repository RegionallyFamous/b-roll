<?php
/**
 * ODD — extension API.
 *
 * Public surface for plugins that want to extend ODD without forking it.
 * Each helper is a thin `add_filter()` on the corresponding registry
 * filter, so registrations run in normal WP priority order and late
 * registrations win over earlier ones.
 *
 * Registry filters (PHP):
 *   - odd_scene_registry            (odd/includes/wallpaper/registry.php)
 *   - odd_icon_set_registry         (odd/includes/icons/registry.php)
 *   - odd_muse_registry             (this file)
 *   - odd_command_registry          (this file)
 *   - odd_widget_registry           (this file)
 *   - odd_ritual_registry           (this file)
 *   - odd_motion_primitive_registry (this file)
 *   - odd_app_registry              (odd/includes/apps/registry.php)
 *
 * Helper registration functions:
 *   - odd_register_scene( $scene )
 *   - odd_register_icon_set( $set )
 *   - odd_register_muse( $muse )
 *   - odd_register_command( $command )
 *   - odd_register_widget( $widget )
 *   - odd_register_ritual( $ritual )
 *   - odd_register_motion_primitive( $primitive )
 *   - odd_register_app( $app )
 *
 * Each accepts an associative array with at least a `slug`. The
 * collector function `odd_extensions_collect( 'muses' )` returns the
 * filtered list for that registry — used by the enqueue to seed the
 * JS side of the store.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Insert `$entry` into `$registry` unless an entry with the same
 * slug already exists. Callers can override by adding a filter at
 * a higher priority.
 */
function odd_extensions_upsert( $registry, $entry ) {
	if ( ! is_array( $registry ) ) {
		$registry = array();
	}
	if ( ! is_array( $entry ) || empty( $entry['slug'] ) ) {
		return $registry;
	}
	$slug = sanitize_key( (string) $entry['slug'] );
	if ( '' === $slug ) {
		return $registry;
	}
	$entry['slug'] = $slug;

	// Dedupe: skip when the same slug is already registered. Callers
	// that want to *replace* an entry can remove_filter() + re-add at
	// priority > 10.
	foreach ( $registry as $existing ) {
		if ( is_array( $existing ) && isset( $existing['slug'] ) && $existing['slug'] === $slug ) {
			return $registry;
		}
	}

	$registry[] = $entry;
	return $registry;
}

/**
 * Run the registry filter with an empty seed. Used by the enqueue
 * layer to hydrate JS-side registries (muses, commands, widgets,
 * rituals, motion primitives) that don't have an on-disk canonical
 * source yet.
 */
function odd_extensions_collect( $name ) {
	$name   = (string) $name;
	$filter = '';
	switch ( $name ) {
		case 'muses':
			$filter = 'odd_muse_registry';
			break;
		case 'commands':
			$filter = 'odd_command_registry';
			break;
		case 'widgets':
			$filter = 'odd_widget_registry';
			break;
		case 'rituals':
			$filter = 'odd_ritual_registry';
			break;
		case 'motionPrimitives':
			$filter = 'odd_motion_primitive_registry';
			break;
		case 'apps':
			$filter = 'odd_app_registry';
			break;
		default:
			return array();
	}
	/**
	 * Filter a JS-only ODD registry. See odd/includes/extensions.php
	 * for the helper functions that wrap this.
	 *
	 * @since 0.14.0
	 *
	 * @param array $registry List of entries. Each entry is a loose
	 *                        associative array keyed by `slug`.
	 */
	$list = apply_filters( $filter, array() );
	return is_array( $list ) ? array_values( $list ) : array();
}

function odd_register_scene( $scene ) {
	if ( ! is_array( $scene ) || empty( $scene['slug'] ) ) {
		return false;
	}
	add_filter(
		'odd_scene_registry',
		function ( $registry ) use ( $scene ) {
			return odd_extensions_upsert( $registry, $scene );
		}
	);
	return true;
}

function odd_register_icon_set( $set ) {
	if ( ! is_array( $set ) || empty( $set['slug'] ) ) {
		return false;
	}
	add_filter(
		'odd_icon_set_registry',
		function ( $registry ) use ( $set ) {
			$slug = sanitize_key( (string) $set['slug'] );
			if ( '' === $slug ) {
				return $registry;
			}
			if ( is_array( $registry ) && isset( $registry[ $slug ] ) ) {
				return $registry;
			}
			if ( ! is_array( $registry ) ) {
				$registry = array();
			}
			$registry[ $slug ] = array_merge( array( 'slug' => $slug ), $set );
			return $registry;
		}
	);
	return true;
}

function odd_register_muse( $muse ) {
	if ( ! is_array( $muse ) || empty( $muse['slug'] ) ) {
		return false;
	}
	add_filter(
		'odd_muse_registry',
		function ( $registry ) use ( $muse ) {
			return odd_extensions_upsert( $registry, $muse );
		}
	);
	return true;
}

function odd_register_command( $command ) {
	if ( ! is_array( $command ) || empty( $command['slug'] ) ) {
		return false;
	}
	add_filter(
		'odd_command_registry',
		function ( $registry ) use ( $command ) {
			return odd_extensions_upsert( $registry, $command );
		}
	);
	return true;
}

function odd_register_widget( $widget ) {
	if ( ! is_array( $widget ) || empty( $widget['slug'] ) ) {
		return false;
	}
	add_filter(
		'odd_widget_registry',
		function ( $registry ) use ( $widget ) {
			return odd_extensions_upsert( $registry, $widget );
		}
	);
	return true;
}

function odd_register_ritual( $ritual ) {
	if ( ! is_array( $ritual ) || empty( $ritual['slug'] ) ) {
		return false;
	}
	add_filter(
		'odd_ritual_registry',
		function ( $registry ) use ( $ritual ) {
			return odd_extensions_upsert( $registry, $ritual );
		}
	);
	return true;
}

function odd_register_motion_primitive( $primitive ) {
	if ( ! is_array( $primitive ) || empty( $primitive['slug'] ) ) {
		return false;
	}
	add_filter(
		'odd_motion_primitive_registry',
		function ( $registry ) use ( $primitive ) {
			return odd_extensions_upsert( $registry, $primitive );
		}
	);
	return true;
}

function odd_register_app( $app ) {
	if ( ! is_array( $app ) || empty( $app['slug'] ) ) {
		return false;
	}
	add_filter(
		'odd_app_registry',
		function ( $registry ) use ( $app ) {
			return odd_extensions_upsert( $registry, $app );
		}
	);
	return true;
}
