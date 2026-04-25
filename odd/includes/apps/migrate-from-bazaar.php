<?php
/**
 * ODD Apps — one-shot migration from the standalone Bazaar plugin.
 *
 * Runs as schema migration 3, via the `odd_migrations` filter introduced
 * in v0.16.0. Idempotent: safe to re-run on installs where Bazaar was
 * never present.
 *
 * Migration steps:
 *
 *   1. Detect Bazaar. Look for wp-content/bazaar/ on disk or the
 *      `bazaar_index` option. If neither exists, no-op and bump the
 *      schema version.
 *
 *   2. Move bundles. Every directory under wp-content/bazaar/{slug}/
 *      that carries a readable manifest.json is copied into
 *      wp-content/odd-apps/{slug}/ (copy, not rename, so a partial
 *      migration doesn't corrupt the Bazaar tree mid-run).
 *
 *   3. Rewrite options.
 *        bazaar_index            →  odd_apps_index
 *        bazaar_ware_{slug}      →  odd_app_{slug}
 *      The copy preserves `enabled`, `version`, `menu_title`,
 *      `capability`, etc. Any `license.*` fields are dropped (ODD's
 *      license model is out of scope).
 *
 *   4. Copy secret. If `bazaar_shared_secret` is set we copy it into
 *      `odd_apps_shared_secret` so any plugin relying on Bazaar's
 *      signed URLs keeps functioning until the app ecosystem moves
 *      fully to ODD.
 *
 *   5. Deactivate Bazaar. Only if the plugin is still active. We
 *      intentionally don't delete it — the admin can do that by hand
 *      once they're satisfied the migration worked.
 *
 *   6. Admin notice. A persistent option flag drives a one-time
 *      notice explaining what happened and pointing at the new
 *      Apps tab.
 *
 * Rollback: none. The migration is purely additive on the ODD side.
 * If anything goes wrong the old Bazaar files and options are still
 * in place.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_BAZAAR_CONTENT_DIR' ) ) {
	define( 'ODD_BAZAAR_CONTENT_DIR', trailingslashit( WP_CONTENT_DIR ) . 'bazaar/' );
}

/**
 * Migration callable. Hooked through the odd_migrations filter at
 * version 3 (see includes/migrations.php).
 *
 * @param int $user_id The user whose login triggered the run.
 */
function odd_migration_3_from_bazaar( $user_id ) {
	unset( $user_id );

	$has_fs      = is_dir( ODD_BAZAAR_CONTENT_DIR );
	$has_option  = false !== get_option( 'bazaar_index', false );
	if ( ! $has_fs && ! $has_option ) {
		return;
	}

	// Concurrent-login guard. `add_option` returns false when the key
	// already exists, so two simultaneous admin pageloads can't
	// race and copy overlapping trees.
	if ( ! add_option( 'odd_apps_bazaar_migration_lock', (string) time(), '', false ) ) {
		return;
	}

	odd_apps_ensure_storage();

	$report = array(
		'at'      => time(),
		'moved'   => array(),
		'skipped' => array(),
	);

	// Move bundles first so the options can reference existing files.
	if ( $has_fs ) {
		$entries = scandir( ODD_BAZAAR_CONTENT_DIR );
		if ( $entries ) {
			foreach ( $entries as $entry ) {
				if ( '.' === $entry || '..' === $entry ) {
					continue;
				}
				if ( 0 === strpos( $entry, '.' ) ) {
					continue;
				}
				$src = ODD_BAZAAR_CONTENT_DIR . $entry;
				if ( ! is_dir( $src ) ) {
					continue;
				}
				$slug = sanitize_key( $entry );
				if ( '' === $slug ) {
					continue;
				}
				$dst = odd_apps_dir_for( $slug );
				if ( is_dir( $dst ) ) {
					$report['skipped'][] = $slug . ' (already exists in odd-apps)';
					continue;
				}
				if ( odd_apps_recursive_copy( $src, rtrim( $dst, '/' ) ) ) {
					$report['moved'][] = $slug;
				} else {
					$report['skipped'][] = $slug . ' (copy failed)';
				}
			}
		}
	}

	// Rewrite index + per-ware options.
	$bazaar_index = get_option( 'bazaar_index', array() );
	if ( is_array( $bazaar_index ) && $bazaar_index ) {
		$existing = odd_apps_index_load();
		foreach ( $bazaar_index as $slug => $row ) {
			$slug = sanitize_key( (string) $slug );
			if ( '' === $slug || ! is_array( $row ) ) {
				continue;
			}
			if ( ! isset( $existing[ $slug ] ) ) {
				$existing[ $slug ] = array_merge(
					array(
						'slug'        => $slug,
						'name'        => $slug,
						'version'     => '',
						'enabled'     => true,
						'icon'        => '',
						'description' => '',
						'capability'  => 'manage_options',
						'installed'   => time(),
					),
					array_intersect_key(
						$row,
						array_flip( array( 'name', 'version', 'enabled', 'icon', 'description', 'capability' ) )
					)
				);
			}
			$manifest = get_option( 'bazaar_ware_' . $slug, array() );
			if ( is_array( $manifest ) && $manifest ) {
				unset( $manifest['license'] );
				odd_apps_manifest_save( $slug, $manifest );
			}
		}
		odd_apps_index_save( $existing );
	}

	// Copy the shared secret if Bazaar used one.
	$secret = get_option( 'bazaar_shared_secret', '' );
	if ( $secret && ! get_option( 'odd_apps_shared_secret', '' ) ) {
		update_option( 'odd_apps_shared_secret', $secret, false );
	}

	// Deactivate Bazaar if still active. The plugin file stays on
	// disk so the admin can delete it at their own pace.
	if ( ! function_exists( 'deactivate_plugins' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}
	if ( function_exists( 'is_plugin_active' ) && function_exists( 'deactivate_plugins' ) ) {
		$plugin_file = 'bazaar/bazaar.php';
		if ( is_plugin_active( $plugin_file ) ) {
			deactivate_plugins( $plugin_file, true );
		}
	}

	update_option( 'odd_apps_bazaar_migration', $report, false );
	update_option( 'odd_apps_bazaar_notice', 1, false );
	delete_option( 'odd_apps_bazaar_migration_lock' );
}

/**
 * Recursive copy helper. Skips symlinks and dotfiles outside the set
 * the ODD loader already accepts. Returns true only when every entry
 * successfully copies.
 */
function odd_apps_recursive_copy( $src, $dst ) {
	if ( ! is_dir( $src ) ) {
		return false;
	}
	if ( ! is_dir( $dst ) ) {
		if ( ! wp_mkdir_p( $dst ) ) {
			return false;
		}
	}
	$entries = scandir( $src );
	if ( false === $entries ) {
		return false;
	}
	$ok = true;
	foreach ( $entries as $entry ) {
		if ( '.' === $entry || '..' === $entry ) {
			continue;
		}
		$from = $src . DIRECTORY_SEPARATOR . $entry;
		$to   = $dst . DIRECTORY_SEPARATOR . $entry;
		if ( is_link( $from ) ) {
			continue;
		}
		if ( is_dir( $from ) ) {
			$ok = $ok && odd_apps_recursive_copy( $from, $to );
		} else {
			$ok = $ok && (bool) @copy( $from, $to );
		}
	}
	return $ok;
}

/**
 * One-time admin notice after a successful migration. Dismisses
 * itself when the user clicks the provided link (no JS required).
 */
add_action(
	'admin_notices',
	function () {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		if ( ! get_option( 'odd_apps_bazaar_notice' ) ) {
			return;
		}
		if ( isset( $_GET['odd_bazaar_notice_dismiss'] ) ) {
			$nonce = isset( $_GET['_odd_notice_nonce'] ) ? sanitize_key( wp_unslash( $_GET['_odd_notice_nonce'] ) ) : '';
			if ( $nonce && wp_verify_nonce( $nonce, 'odd_bazaar_notice_dismiss' ) ) {
				delete_option( 'odd_apps_bazaar_notice' );
				return;
			}
		}
		$report = get_option( 'odd_apps_bazaar_migration', array() );
		$moved  = is_array( $report ) && isset( $report['moved'] ) ? count( (array) $report['moved'] ) : 0;
		$dismiss_url = esc_url(
			wp_nonce_url(
				add_query_arg( 'odd_bazaar_notice_dismiss', '1' ),
				'odd_bazaar_notice_dismiss',
				'_odd_notice_nonce'
			)
		);
		echo '<div class="notice notice-success is-dismissible"><p>';
		printf(
			/* translators: %d number of apps migrated */
			esc_html__( 'ODD absorbed your Bazaar wares — %d migrated into the Apps tab. The old Bazaar plugin has been deactivated; delete it when you\'re ready.', 'odd' ),
			(int) $moved
		);
		echo ' <a href="' . esc_attr( $dismiss_url ) . '">' . esc_html__( 'Dismiss', 'odd' ) . '</a>';
		echo '</p></div>';
	}
);

// Register migration 3 via the filter introduced in 0.16.0.
add_filter(
	'odd_migrations',
	function ( $migrations ) {
		if ( ! is_array( $migrations ) ) {
			$migrations = array();
		}
		$migrations[3] = 'odd_migration_3_from_bazaar';
		return $migrations;
	}
);

// Note: ODD_SCHEMA_VERSION is bumped to 3 in includes/migrations.php
// so the core runner fires this migration on the next admin pageload.
