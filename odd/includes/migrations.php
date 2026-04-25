<?php
/**
 * ODD — schema migrations.
 *
 * Runs a versioned list of one-shot migrations on each login. Schema
 * version is tracked per-user via the `odd_schema_version` meta key;
 * each migration bumps it by one. No-op migrations are cheap and
 * exercise the runner so problems surface early.
 *
 * Migrations ship as `migration_<n>_<label>()` callables in this file.
 * Keep the list append-only: never edit a past migration, only add a
 * new one at the tail.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_SCHEMA_VERSION' ) ) {
	define( 'ODD_SCHEMA_VERSION', 1 );
}

function odd_migrations_all() {
	return array(
		1 => 'odd_migration_1_baseline',
	);
}

function odd_run_migrations( $user_id = 0 ) {
	$user_id = $user_id ? (int) $user_id : get_current_user_id();
	if ( $user_id <= 0 ) {
		return;
	}
	$current = (int) get_user_meta( $user_id, 'odd_schema_version', true );
	$target  = (int) ODD_SCHEMA_VERSION;
	if ( $current >= $target ) {
		return;
	}
	$migrations = odd_migrations_all();
	ksort( $migrations );
	foreach ( $migrations as $version => $callable ) {
		if ( $version <= $current ) {
			continue;
		}
		if ( ! is_callable( $callable ) ) {
			continue;
		}
		try {
			call_user_func( $callable, $user_id );
		} catch ( \Throwable $e ) {
			if ( function_exists( 'error_log' ) ) {
				error_log( sprintf( '[ODD] migration %d failed for user %d: %s', $version, $user_id, $e->getMessage() ) );
			}
			return;
		}
		update_user_meta( $user_id, 'odd_schema_version', $version );
	}
}

/**
 * Baseline. Sets `odd_schema_version = 1` for every user that logs
 * in after the migration runner ships, without touching any data.
 * Exists so the runner is exercised on every install — if the meta
 * key or update path ever breaks, the next release catches it.
 */
function odd_migration_1_baseline( $user_id ) {
	unset( $user_id );
	// Intentionally no-op. The runner updates the version marker.
}

// Run on every admin pageload for the current user. Cheap when the
// version already matches target; a single integer meta read.
add_action(
	'admin_init',
	function () {
		if ( ! function_exists( 'wpdm_is_enabled' ) ) {
			return;
		}
		odd_run_migrations();
	},
	5
);
