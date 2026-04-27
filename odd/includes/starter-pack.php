<?php
/**
 * ODD — starter pack runner.
 *
 * The plugin ships empty. On activation we schedule a one-off cron
 * that fetches the remote registry, installs every bundle listed in
 * `starter_pack`, and sets the initial user prefs (default scene +
 * icon set) so the desktop looks finished on first load.
 *
 * State is persisted in the `odd_starter_state` option:
 *
 *   {
 *     "status":       "pending" | "running" | "installed" | "failed",
 *     "attempts":     int,
 *     "last_attempt": unix timestamp,
 *     "last_error":   string,
 *     "installed":    [ "<slug>", ... ],   // what made it to disk
 *     "prefs_set":    bool
 *   }
 *
 * Retry behaviour (because the catalog host can be down or the site
 * can be offline on first boot):
 *   - Attempt 1 at activation + ~5s.
 *   - Failure 1 → schedule attempt 2 at +1 min.
 *   - Failure 2 → +5 min. Failure 3 → +30 min. Failure 4+ → +6 hr.
 *   - On every admin page load, if status != 'installed' and
 *     enough time has passed since the last attempt, reschedule cron.
 *
 * Users can kick a retry from the Shop panel via
 * POST /odd/v1/starter/retry, which runs the installer inline.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_STARTER_OPTION' ) ) {
	define( 'ODD_STARTER_OPTION', 'odd_starter_state' );
}
if ( ! defined( 'ODD_STARTER_CRON_HOOK' ) ) {
	define( 'ODD_STARTER_CRON_HOOK', 'odd_install_starter_pack' );
}

/**
 * Exponential backoff schedule (in seconds) indexed by attempt count
 * (1-based). Anything past the last slot uses the last value.
 */
function odd_starter_backoff_seconds() {
	return array(
		1 => 5,        // first attempt: 5s after activation
		2 => 60,       // 1 min
		3 => 5 * 60,   // 5 min
		4 => 30 * 60,  // 30 min
		5 => 6 * HOUR_IN_SECONDS,
	);
}

function odd_starter_get_state() {
	$state = get_option( ODD_STARTER_OPTION, null );
	if ( ! is_array( $state ) ) {
		$state = array(
			'status'       => 'pending',
			'attempts'     => 0,
			'last_attempt' => 0,
			'last_error'   => '',
			'installed'    => array(),
			'prefs_set'    => false,
		);
	}
	return wp_parse_args(
		$state,
		array(
			'status'       => 'pending',
			'attempts'     => 0,
			'last_attempt' => 0,
			'last_error'   => '',
			'installed'    => array(),
			'prefs_set'    => false,
		)
	);
}

function odd_starter_save_state( array $state ) {
	update_option( ODD_STARTER_OPTION, $state, false );
}

function odd_starter_reset() {
	delete_option( ODD_STARTER_OPTION );
}

/**
 * Activation hook. Called once when someone activates ODD from the
 * plugins screen.
 */
function odd_activate_install_starter() {
	$state = odd_starter_get_state();
	// Don't clobber state if the user reactivates after a successful
	// install — they already have the starter pack, no need to
	// re-download. If they've disabled + reset it'll stay 'pending'.
	if ( 'installed' !== $state['status'] ) {
		$state['status']       = 'pending';
		$state['attempts']     = 0;
		$state['last_attempt'] = 0;
		$state['last_error']   = '';
		odd_starter_save_state( $state );
	}
	odd_starter_schedule_run( 1 );
}
register_activation_hook( ODD_FILE, 'odd_activate_install_starter' );

/**
 * Schedule the next run. Called on activation and after every failed
 * attempt. Uses a one-off cron event with a unique hook so double
 * schedules collapse to one entry.
 */
function odd_starter_schedule_run( $next_attempt ) {
	$backoff = odd_starter_backoff_seconds();
	$delay   = isset( $backoff[ $next_attempt ] )
		? $backoff[ $next_attempt ]
		: end( $backoff );
	$when    = time() + (int) $delay;
	// Clear any stale scheduled events so we don't get two installers
	// racing against each other.
	wp_clear_scheduled_hook( ODD_STARTER_CRON_HOOK );
	wp_schedule_single_event( $when, ODD_STARTER_CRON_HOOK );
}

/**
 * Cron target: try to install the starter pack right now.
 */
function odd_starter_run() {
	$state = odd_starter_get_state();
	if ( 'installed' === $state['status'] ) {
		return;
	}
	if ( 'running' === $state['status'] ) {
		// Another process is already working. Reschedule a conservative
		// check in 60s so we don't lose visibility if it hung.
		return;
	}
	$state['status']       = 'running';
	$state['attempts']    += 1;
	$state['last_attempt'] = time();
	odd_starter_save_state( $state );

	$result = odd_starter_install_now();
	$state  = odd_starter_get_state();

	if ( is_wp_error( $result ) ) {
		$state['status']     = 'failed';
		$state['last_error'] = $result->get_error_message();
		odd_starter_save_state( $state );
		odd_starter_schedule_run( $state['attempts'] + 1 );
		return;
	}

	$state['status']     = 'installed';
	$state['last_error'] = '';
	$state['installed']  = $result['installed'];
	$state['prefs_set']  = (bool) $result['prefs_set'];
	odd_starter_save_state( $state );
}
add_action( ODD_STARTER_CRON_HOOK, 'odd_starter_run' );

/**
 * The actual installer. Walks the starter pack from the loaded
 * catalog, calls odd_catalog_install_entry() for each bundle, and
 * sets initial user prefs.
 *
 * @return array{installed:string[],prefs_set:bool}|WP_Error
 */
function odd_starter_install_now() {
	if ( ! function_exists( 'odd_catalog_load' ) || ! function_exists( 'odd_catalog_install_entry' ) ) {
		return new WP_Error( 'catalog_unavailable', 'Catalog module not loaded.' );
	}
	// Force a fresh fetch so first-activation doesn't hit a stale
	// empty cache.
	$registry = odd_catalog_load( true );
	if ( empty( $registry['bundles'] ) ) {
		return new WP_Error( 'empty_catalog', 'Remote catalog returned no bundles.' );
	}

	$starter    = isset( $registry['starter_pack'] ) && is_array( $registry['starter_pack'] )
		? $registry['starter_pack']
		: array();
	$want_slugs = array();
	foreach ( array( 'scenes', 'iconSets', 'widgets', 'apps' ) as $group ) {
		if ( ! empty( $starter[ $group ] ) && is_array( $starter[ $group ] ) ) {
			foreach ( $starter[ $group ] as $slug ) {
				$want_slugs[] = sanitize_key( (string) $slug );
			}
		}
	}
	$want_slugs = array_values( array_filter( array_unique( $want_slugs ) ) );
	if ( empty( $want_slugs ) ) {
		// No starter pack defined. Mark installed so we stop retrying.
		return array(
			'installed' => array(),
			'prefs_set' => odd_starter_apply_prefs( $starter ),
		);
	}

	$already       = odd_bundle_catalog_installed_slugs();
	$installed_now = array();
	$errors        = array();
	foreach ( $want_slugs as $slug ) {
		if ( isset( $already[ $slug ] ) ) {
			continue;
		}
		$row = odd_catalog_row_for( $slug );
		if ( null === $row ) {
			$errors[] = sprintf( 'starter-pack slug %s not in registry', $slug );
			continue;
		}
		$res = odd_catalog_install_entry( $row );
		if ( is_wp_error( $res ) ) {
			$errors[] = sprintf( '%s: %s', $slug, $res->get_error_message() );
			continue;
		}
		$installed_now[] = $slug;
	}
	if ( ! empty( $errors ) ) {
		return new WP_Error( 'partial_failure', implode( '; ', $errors ) );
	}

	$prefs_set = odd_starter_apply_prefs( $starter );

	return array(
		'installed' => $installed_now,
		'prefs_set' => $prefs_set,
	);
}

/**
 * Apply the starter pack's default scene + icon set to every
 * existing user (so the desktop picks a wallpaper on first boot
 * without asking). Returns true if any pref was written.
 *
 * We write at the user-meta level so individual users can still pick
 * something else later; this just seeds the initial state.
 */
function odd_starter_apply_prefs( array $starter ) {
	$default_scene   = ! empty( $starter['scenes'] ) ? sanitize_key( (string) $starter['scenes'][0] ) : '';
	$default_iconset = ! empty( $starter['iconSets'] ) ? sanitize_key( (string) $starter['iconSets'][0] ) : '';
	if ( '' === $default_scene && '' === $default_iconset ) {
		return false;
	}

	// Only seed fresh sites. If a user already has a wallpaper
	// preference, don't overwrite it.
	$wrote = false;
	$users = get_users(
		array(
			'fields' => array( 'ID' ),
			'number' => 500,
		)
	);
	foreach ( $users as $u ) {
		$uid = (int) $u->ID;
		if ( '' !== $default_scene ) {
			$current = get_user_meta( $uid, 'odd_wallpaper', true );
			if ( '' === $current ) {
				update_user_meta( $uid, 'odd_wallpaper', $default_scene );
				$wrote = true;
			}
		}
		if ( '' !== $default_iconset ) {
			$current = get_user_meta( $uid, 'odd_icon_set', true );
			if ( '' === $current ) {
				update_user_meta( $uid, 'odd_icon_set', $default_iconset );
				$wrote = true;
			}
		}
	}
	return $wrote;
}

/**
 * On every admin page load, poke the starter pack state. If the
 * initial cron never fired (e.g. WP-Cron disabled in wp-config) or a
 * retry is overdue, fire it inline via a non-blocking spawn.
 */
add_action(
	'admin_init',
	function () {
		$state = odd_starter_get_state();
		if ( 'installed' === $state['status'] ) {
			return;
		}
		// If there's already a scheduled event, let it run.
		if ( false !== wp_next_scheduled( ODD_STARTER_CRON_HOOK ) ) {
			return;
		}
		$backoff = odd_starter_backoff_seconds();
		$want    = $state['attempts'] + 1;
		$delay   = isset( $backoff[ $want ] ) ? $backoff[ $want ] : end( $backoff );
		$overdue = ( time() - (int) $state['last_attempt'] ) > (int) $delay;
		if ( $state['attempts'] === 0 || $overdue ) {
			odd_starter_schedule_run( $want );
		}
	},
	20
);

/**
 * REST: GET the current starter-pack state so the Shop can render
 * progress; POST to force a retry right now.
 */
add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'odd/v1',
			'/starter',
			array(
				'methods'             => 'GET',
				'callback'            => function () {
					return rest_ensure_response( odd_starter_get_state() );
				},
				'permission_callback' => 'is_user_logged_in',
			)
		);
		register_rest_route(
			'odd/v1',
			'/starter/retry',
			array(
				'methods'             => 'POST',
				'callback'            => function () {
					$result = odd_starter_install_now();
					$state  = odd_starter_get_state();
					if ( is_wp_error( $result ) ) {
						$state['status']      = 'failed';
						$state['attempts']   += 1;
						$state['last_error']  = $result->get_error_message();
						$state['last_attempt'] = time();
						odd_starter_save_state( $state );
						return new WP_Error(
							'starter_failed',
							$result->get_error_message(),
							array(
								'status' => 502,
								'state'  => $state,
							)
						);
					}
					$state['status']       = 'installed';
					$state['attempts']    += 1;
					$state['last_error']   = '';
					$state['last_attempt'] = time();
					$state['installed']    = $result['installed'];
					$state['prefs_set']    = (bool) $result['prefs_set'];
					odd_starter_save_state( $state );
					return rest_ensure_response( $state );
				},
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);
	},
	5
);
