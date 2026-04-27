<?php
/**
 * ODD Apps — registry + install/uninstall API.
 *
 * Public procedural surface:
 *
 *   odd_apps_install( $tmp_path, $filename )  → manifest | WP_Error
 *   odd_apps_uninstall( $slug )               → true | WP_Error
 *   odd_apps_set_enabled( $slug, $bool )      → true | WP_Error
 *   odd_apps_set_surfaces( $slug, $arr )      → true | WP_Error
 *   odd_apps_row_surfaces( $row )             → { desktop: bool, taskbar: bool }
 *   odd_apps_list()                           → array of index rows
 *   odd_apps_get( $slug )                     → full manifest or array()
 *
 * Registry filter (PHP-side, seeds the JS `registries.apps` slice):
 *
 *   apply_filters( 'odd_app_registry', [] ) → [ { slug, name, ...} ]
 *
 * The filter is populated from the on-disk index every request, so
 * installed apps "just appear" — no re-registration hook needed. The
 * same filter is open to third parties that want to register a
 * purely-in-memory app (future use).
 */

defined( 'ABSPATH' ) || exit;

/**
 * Install and activate an app archive.
 *
 * @return array|WP_Error The parsed manifest on success.
 */
function odd_apps_install( $tmp_path, $filename ) {
	$manifest = odd_apps_validate_archive( $tmp_path, $filename );
	if ( is_wp_error( $manifest ) ) {
		return $manifest;
	}

	$slug = sanitize_key( $manifest['slug'] );

	// Atomic install lock: add_option returns false when the key
	// already exists, so concurrent installs of the same slug fail
	// the second caller fast.
	$lock_key = 'odd_apps_install_lock_' . $slug;
	if ( ! add_option( $lock_key, '1', '', false ) ) {
		return new WP_Error( 'install_in_progress', __( 'An installation of this app is already in progress.', 'odd' ) );
	}

	$extracted = odd_apps_extract_archive( $tmp_path, $slug );
	delete_option( $lock_key );
	if ( is_wp_error( $extracted ) ) {
		return $extracted;
	}

	// Manifest authors can declare the default surfaces (desktop
	// icon + taskbar pill) per app; users can override after install.
	// Defaults favor the historical behavior — desktop icon on,
	// taskbar off — so upgrades don't sprout new pills unsolicited.
	$surfaces = array(
		'desktop' => isset( $manifest['surfaces']['desktop'] ) ? (bool) $manifest['surfaces']['desktop'] : true,
		'taskbar' => isset( $manifest['surfaces']['taskbar'] ) ? (bool) $manifest['surfaces']['taskbar'] : false,
	);

	$index          = odd_apps_index_load();
	$index[ $slug ] = array(
		'slug'        => $slug,
		'name'        => sanitize_text_field( $manifest['name'] ),
		'version'     => sanitize_text_field( $manifest['version'] ),
		'enabled'     => true,
		'icon'        => isset( $manifest['icon'] ) ? sanitize_text_field( (string) $manifest['icon'] ) : '',
		'description' => isset( $manifest['description'] ) ? sanitize_text_field( (string) $manifest['description'] ) : '',
		'capability'  => isset( $manifest['capability'] ) ? sanitize_text_field( (string) $manifest['capability'] ) : 'manage_options',
		'surfaces'    => $surfaces,
		'installed'   => time(),
	);
	odd_apps_index_save( $index );

	$manifest['installed'] = $index[ $slug ]['installed'];
	$manifest['enabled']   = true;
	odd_apps_manifest_save( $slug, $manifest );

	odd_apps_apply_manifest_extensions( $manifest );

	/**
	 * Fires after an app is successfully installed.
	 *
	 * @param string $slug
	 * @param array  $manifest
	 */
	do_action( 'odd_app_installed', $slug, $manifest );

	return $manifest;
}

/**
 * Uninstall an app: removes its directory, per-slug option, and
 * index entry. Idempotent — returns true for missing apps.
 */
function odd_apps_uninstall( $slug ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Invalid app slug.', 'odd' ) );
	}
	$dir = odd_apps_dir_for( $slug );
	if ( is_dir( $dir ) ) {
		odd_apps_rrmdir( $dir );
	}
	odd_apps_manifest_delete( $slug );
	$index = odd_apps_index_load();
	if ( isset( $index[ $slug ] ) ) {
		unset( $index[ $slug ] );
		odd_apps_index_save( $index );
	}
	do_action( 'odd_app_uninstalled', $slug );
	return true;
}

function odd_apps_set_enabled( $slug, $enabled ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Invalid app slug.', 'odd' ) );
	}
	$index = odd_apps_index_load();
	if ( ! isset( $index[ $slug ] ) ) {
		return new WP_Error( 'not_installed', __( 'App is not installed.', 'odd' ) );
	}
	$index[ $slug ]['enabled'] = (bool) $enabled;
	odd_apps_index_save( $index );

	$manifest = odd_apps_manifest_load( $slug );
	if ( $manifest ) {
		$manifest['enabled'] = (bool) $enabled;
		odd_apps_manifest_save( $slug, $manifest );
	}
	do_action( $enabled ? 'odd_app_enabled' : 'odd_app_disabled', $slug );
	return true;
}

/**
 * Update the per-app `surfaces` preference — which of the two Desktop
 * Mode launch affordances (the desktop icon, the taskbar pill) this
 * app should register on the next shell paint.
 *
 * The row is the source of truth; `odd_apps_register_surfaces()` reads
 * it on every `init` and forwards `surfaces.taskbar` into the
 * `placement` argument of `desktop_mode_register_window()`, and skips
 * `desktop_mode_register_icon()` entirely when `surfaces.desktop` is
 * false. Callers in the Shop POST the new shape; live apply is a soft
 * page reload (mirrors icon-set swap) because native-window
 * registration runs once per request.
 *
 * @param string $slug
 * @param array  $surfaces { desktop?: bool, taskbar?: bool }
 * @return true|WP_Error
 */
function odd_apps_set_surfaces( $slug, $surfaces ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Invalid app slug.', 'odd' ) );
	}
	$index = odd_apps_index_load();
	if ( ! isset( $index[ $slug ] ) ) {
		return new WP_Error( 'not_installed', __( 'App is not installed.', 'odd' ) );
	}
	if ( ! is_array( $surfaces ) ) {
		return new WP_Error( 'invalid_surfaces', __( 'Invalid surfaces payload.', 'odd' ) );
	}

	// Merge onto the existing (or defaulted) surfaces so a partial
	// payload like { taskbar: true } leaves `desktop` untouched — the
	// Shop checkboxes are independent and shouldn't clobber each other.
	$current                    = odd_apps_row_surfaces( $index[ $slug ] );
	$clean                      = array(
		'desktop' => isset( $surfaces['desktop'] ) ? ! empty( $surfaces['desktop'] ) : $current['desktop'],
		'taskbar' => isset( $surfaces['taskbar'] ) ? ! empty( $surfaces['taskbar'] ) : $current['taskbar'],
	);
	$index[ $slug ]['surfaces'] = $clean;
	odd_apps_index_save( $index );

	$manifest = odd_apps_manifest_load( $slug );
	if ( $manifest ) {
		$manifest['surfaces'] = $clean;
		odd_apps_manifest_save( $slug, $manifest );
	}

	/**
	 * Fires after an app's surface preferences change.
	 *
	 * @param string $slug
	 * @param array  $surfaces { desktop: bool, taskbar: bool }
	 */
	do_action( 'odd_app_surfaces_changed', $slug, $clean );

	return true;
}

/**
 * Normalize the `surfaces` field on an app index row, filling any
 * missing keys with the back-compat defaults. Pre-upgrade rows that
 * lack the field entirely behave as if `{ desktop: true, taskbar:
 * false }` was persisted — identical to the historical register_icon
 * + placement: 'none' behavior.
 *
 * @param array $row
 * @return array { desktop: bool, taskbar: bool }
 */
function odd_apps_row_surfaces( $row ) {
	$s = isset( $row['surfaces'] ) && is_array( $row['surfaces'] ) ? $row['surfaces'] : array();
	return array(
		'desktop' => isset( $s['desktop'] ) ? (bool) $s['desktop'] : true,
		'taskbar' => isset( $s['taskbar'] ) ? (bool) $s['taskbar'] : false,
	);
}

/**
 * Flat list of installed apps, sorted alphabetically by name. Each
 * entry is the row from the index. The enqueue layer ships this same
 * list to the JS store as `registries.apps`.
 */
function odd_apps_list() {
	$index = odd_apps_index_load();
	$rows  = array_values( $index );
	foreach ( $rows as &$row ) {
		// Backfill surfaces so the REST response (and, by extension,
		// the Shop panel's JS) always sees the full shape, even for
		// rows installed before the `surfaces` field existed.
		$row['surfaces'] = odd_apps_row_surfaces( $row );
	}
	unset( $row );
	usort(
		$rows,
		function ( $a, $b ) {
			$an = isset( $a['name'] ) ? (string) $a['name'] : '';
			$bn = isset( $b['name'] ) ? (string) $b['name'] : '';
			return strcmp( $an, $bn );
		}
	);
	return $rows;
}

function odd_apps_get( $slug ) {
	return odd_apps_manifest_load( $slug );
}

/**
 * Populate the odd_app_registry filter with installed apps. Runs at
 * priority 5 so later filters can override or hide entries.
 */
add_filter(
	'odd_app_registry',
	function ( $registry ) {
		if ( ! is_array( $registry ) ) {
			$registry = array();
		}
		$seen = array();
		foreach ( $registry as $e ) {
			if ( isset( $e['slug'] ) ) {
				$seen[ $e['slug'] ] = true;
			}
		}
		foreach ( odd_apps_list() as $row ) {
			if ( isset( $seen[ $row['slug'] ] ) ) {
				continue;
			}
			$registry[] = $row;
		}
		return $registry;
	},
	5
);

/**
 * Reapply manifest.extensions for every installed app on every load
 * of a context that actually renders the Desktop shell or speaks to
 * the ODD REST namespace. This is how apps' muses / commands /
 * widgets / rituals / motion primitives stay registered.
 *
 * Gated to admin / REST / ajax: the public front-end, wp-cron,
 * WP-CLI, and `wp_installing()` have no use for these filters, and
 * the loop costs one get_option + JSON decode + filter registration
 * per enabled app. Skipping them on irrelevant requests adds up when
 * you consider cron waking the site dozens of times an hour.
 */
add_action(
	'init',
	function () {
		if ( ! defined( 'ODD_APPS_ENABLED' ) || ! ODD_APPS_ENABLED ) {
			return;
		}
		if ( wp_installing() ) {
			return;
		}
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			return;
		}
		if ( wp_doing_cron() ) {
			return;
		}
		$needs_extensions = is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST );
		if ( ! $needs_extensions ) {
			return;
		}
		foreach ( odd_apps_list() as $row ) {
			if ( empty( $row['enabled'] ) ) {
				continue;
			}
			try {
				$manifest = odd_apps_manifest_load( $row['slug'] );
				if ( $manifest ) {
					odd_apps_apply_manifest_extensions( $manifest );
				}
			} catch ( \Throwable $e ) {
				// A malformed third-party manifest must never crash the
				// admin. Swallow, log when debugging, and move on.
				if ( defined( 'WP_DEBUG' ) && WP_DEBUG && function_exists( 'error_log' ) ) {
					// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
					error_log( sprintf( '[ODD Apps] skipped manifest for %s: %s', $row['slug'], $e->getMessage() ) );
				}
			}
		}
	},
	6
);

/**
 * Wire `manifest.extensions` into ODD's existing extension helpers.
 *
 * Shape:
 *   extensions: {
 *     muses: [ { slug, ... } ],
 *     commands: [ ... ],
 *     widgets: [ ... ],
 *     rituals: [ ... ],
 *     motionPrimitives: [ ... ],
 *   }
 *
 * Each array calls into the matching odd_register_* helper so third-
 * party apps get the same lifecycle + dedupe guarantees as core code.
 * Invalid entries are skipped silently — a bad manifest must never
 * crash the admin.
 */
function odd_apps_apply_manifest_extensions( $manifest ) {
	if ( ! is_array( $manifest ) || empty( $manifest['extensions'] ) || ! is_array( $manifest['extensions'] ) ) {
		return;
	}
	$ext = $manifest['extensions'];

	$handlers = array(
		'muses'            => 'odd_register_muse',
		'commands'         => 'odd_register_command',
		'widgets'          => 'odd_register_widget',
		'rituals'          => 'odd_register_ritual',
		'motionPrimitives' => 'odd_register_motion_primitive',
	);
	foreach ( $handlers as $key => $fn ) {
		if ( empty( $ext[ $key ] ) || ! is_array( $ext[ $key ] ) || ! function_exists( $fn ) ) {
			continue;
		}
		foreach ( $ext[ $key ] as $entry ) {
			if ( ! is_array( $entry ) || empty( $entry['slug'] ) ) {
				continue;
			}
			// Tag origin so the debug inspector can tell app-sourced
			// registrations from core and plugin ones.
			if ( ! isset( $entry['source'] ) ) {
				$entry['source'] = 'app:' . sanitize_key( $manifest['slug'] );
			}
			call_user_func( $fn, $entry );
		}
	}
}
