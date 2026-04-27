<?php
/**
 * ODD — starter pack runner (cron-free).
 *
 * The plugin ships empty. The starter pack (a handful of scenes + icon
 * sets + widgets pulled from the remote catalog) has to land on every
 * new install so the desktop doesn't boot into a blank, unselectable
 * state. Historically this ran through a one-shot WP-Cron event
 * scheduled on activation. That's fragile: cron only ticks when
 * someone hits the site, DISABLE_WP_CRON is common in production, and
 * a freshly-activated site that never receives a visitor can sit
 * "pending" forever.
 *
 * So: no cron. Install attempts happen synchronously on two hooks:
 *
 *   1. `register_activation_hook` — the user clicked "Activate" in
 *      wp-admin, so we're already in a privileged admin request.
 *      Run the installer inline. If it fails (catalog down, loopback
 *      blocked, whatever), we capture the error into state and fall
 *      through to the safety net below — we never block activation.
 *
 *   2. `init` — on every subsequent page load (admin *or* frontend),
 *      if the state isn't `installed` and the backoff window has
 *      elapsed, run the installer inline for privileged users.
 *      Anonymous/readonly visitors never trigger network I/O.
 *
 * A status=running lock (auto-expires after 120s) keeps concurrent
 * admin tabs from racing each other. A per-request in-memory guard
 * keeps the safety net from firing twice on a single request.
 *
 * State shape, persisted to the `odd_starter_state` option:
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
 * The Shop exposes state via GET /odd/v1/starter and can force an
 * immediate retry (bypassing backoff) via POST /odd/v1/starter/retry.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_STARTER_OPTION' ) ) {
	define( 'ODD_STARTER_OPTION', 'odd_starter_state' );
}

/**
 * Max wall-clock we allow a single running state to sit before we
 * consider the lock stale and retry. Sized for a slow catalog host +
 * a few bundle downloads (~3 × 60s default download_url timeout).
 */
if ( ! defined( 'ODD_STARTER_LOCK_TTL' ) ) {
	define( 'ODD_STARTER_LOCK_TTL', 240 );
}

/**
 * Exponential backoff schedule (in seconds) indexed by attempt count
 * (1-based). Used to gate the `init` safety net so a chronically
 * failing catalog host doesn't hammer every page load.
 */
function odd_starter_backoff_seconds() {
	return array(
		1 => 0,               // first attempt: immediate
		2 => 30,              // 30s
		3 => 2 * MINUTE_IN_SECONDS,
		4 => 10 * MINUTE_IN_SECONDS,
		5 => HOUR_IN_SECONDS,
		6 => 6 * HOUR_IN_SECONDS,
	);
}

function odd_starter_get_state() {
	$state = get_option( ODD_STARTER_OPTION, null );
	if ( ! is_array( $state ) ) {
		$state = array();
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
 * Activation hook. Runs in an admin request with the activating user
 * on the line. We try to install the starter pack inline right now
 * so the Shop has content on first open — if the catalog host is
 * slow/unreachable the error is captured to state and the `init`
 * safety net retries on the next page load.
 */
function odd_activate_install_starter() {
	$state = odd_starter_get_state();
	// Reactivations on an already-installed site are no-ops.
	if ( 'installed' === $state['status'] ) {
		return;
	}

	// Reset counters on a fresh activation so attempt #1 gets a
	// clean slate.
	$state['status']       = 'pending';
	$state['attempts']     = 0;
	$state['last_attempt'] = 0;
	$state['last_error']   = '';
	odd_starter_save_state( $state );

	// Give the installer a generous runtime budget. Some hosts cap
	// the activation request at 30s; bumping the ceiling when the
	// function is available is free when it works and silently
	// ignored when safe_mode / disable_functions prevents it.
	// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- disabled function throws a warning we don't care about.
	if ( function_exists( 'set_time_limit' ) ) {
		@set_time_limit( 180 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
	}

	odd_starter_ensure_installed( true );
}
register_activation_hook( ODD_FILE, 'odd_activate_install_starter' );

/**
 * Core entry point: bring the site to a fully-installed starter-pack
 * state. Safe to call from anywhere; no-ops fast if we already
 * succeeded, are already running, or are inside the backoff window.
 *
 * @param bool $force If true, ignore backoff (activation / manual
 *                    retry path). Still respects the running-lock so
 *                    concurrent tabs don't double-install.
 * @return array{installed:string[],prefs_set:bool}|WP_Error|null
 *         array when we ran and succeeded, WP_Error when we ran and
 *         failed, null when we didn't run (locked or backoff).
 */
function odd_starter_ensure_installed( $force = false ) {
	static $ran_this_request = false;
	if ( $ran_this_request ) {
		return null;
	}

	$state = odd_starter_get_state();
	if ( 'installed' === $state['status'] ) {
		return null;
	}

	$now = time();

	// Running-lock: another request is mid-install. Treat the lock
	// as stale after ODD_STARTER_LOCK_TTL seconds (a hung PHP worker
	// or a killed activation can leave status=running behind).
	if ( 'running' === $state['status'] ) {
		$age = $now - (int) $state['last_attempt'];
		if ( $age < ODD_STARTER_LOCK_TTL ) {
			return null;
		}
	}

	// Backoff: only enforced in the non-forced path. The activation
	// hook and the REST retry endpoint both pass $force=true.
	if ( ! $force && 'failed' === $state['status'] ) {
		$backoff = odd_starter_backoff_seconds();
		$want    = max( 1, (int) $state['attempts'] + 1 );
		$delay   = isset( $backoff[ $want ] ) ? $backoff[ $want ] : end( $backoff );
		if ( $now - (int) $state['last_attempt'] < (int) $delay ) {
			return null;
		}
	}

	$ran_this_request = true;

	// Take the lock.
	$state['status']       = 'running';
	$state['attempts']     = (int) $state['attempts'] + 1;
	$state['last_attempt'] = $now;
	odd_starter_save_state( $state );

	$result = odd_starter_install_now();

	// Refetch in case another request stomped state while we ran.
	$after = odd_starter_get_state();

	if ( is_wp_error( $result ) ) {
		$after['status']     = 'failed';
		$after['last_error'] = $result->get_error_message();
		odd_starter_save_state( $after );
		return $result;
	}

	$after['status']     = 'installed';
	$after['last_error'] = '';
	$after['installed']  = $result['installed'];
	$after['prefs_set']  = (bool) $result['prefs_set'];
	odd_starter_save_state( $after );
	return $result;
}

/**
 * Back-compat alias. Older code and CI shims call `odd_starter_run()`.
 * Keep it as a thin forwarder so nothing downstream breaks.
 */
function odd_starter_run() {
	odd_starter_ensure_installed( false );
}

/**
 * The actual installer. Walks the starter pack from the loaded
 * catalog, calls odd_catalog_install_entry() for each bundle, and
 * sets initial user prefs.
 *
 * Idempotent: already-installed slugs are skipped, so partial
 * failures resume naturally on the next attempt.
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
 * Two layers get seeded:
 *
 *   1. ODD's *inner* prefs — `odd_wallpaper` (which scene renders
 *      inside ODD's card) and `odd_icon_set` (which dock re-skin is
 *      active). These are pure user meta.
 *
 *   2. WP Desktop Mode's *outer* wallpaper selection — the host
 *      plugin's `desktop_mode_os_settings.wallpaper` key, which
 *      decides which registered wallpaper card mounts at all. If
 *      that's left at the host default (`"dark"`), ODD's card never
 *      runs and the user sees the host's built-in gradient instead
 *      of whatever ODD installed. Point it at `"odd"` so our
 *      wallpaper engine actually gets a chance to paint. We only do
 *      this for users who haven't already picked something else
 *      explicitly, so people who set e.g. `"image"` or a third-party
 *      wallpaper aren't silently switched.
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
			if ( odd_starter_seed_host_wallpaper( $uid ) ) {
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
 * Point WP Desktop Mode's outer wallpaper selection at `"odd"` for a
 * single user — but only if they haven't picked something non-default
 * already.
 *
 * Desktop Mode stores its settings as a single JSON-ish array in user
 * meta `desktop_mode_os_settings` (key exposed as
 * `DESKTOP_MODE_OS_SETTINGS_META_KEY`). Its sanitizer rebuilds the
 * entire shape on write, so we can't just merge — we read the current
 * full shape through `desktop_mode_get_os_settings()`, flip
 * `wallpaper`, and hand the complete array back to
 * `desktop_mode_save_os_settings()`. That preserves accent / dockSize
 * / AI settings / etc.
 *
 * Returns true when a write occurred, false otherwise (already seeded,
 * user picked something else, or host plugin not loaded yet).
 *
 * @param int $user_id
 * @return bool
 */
function odd_starter_seed_host_wallpaper( $user_id ) {
	$user_id = (int) $user_id;
	if ( $user_id <= 0 ) {
		return false;
	}
	if ( ! function_exists( 'desktop_mode_get_os_settings' )
		|| ! function_exists( 'desktop_mode_save_os_settings' )
		|| ! function_exists( 'desktop_mode_default_os_settings' ) ) {
		return false;
	}

	$defaults = desktop_mode_default_os_settings();
	$current  = desktop_mode_get_os_settings( $user_id );
	if ( ! is_array( $current ) ) {
		return false;
	}

	$current_wallpaper = isset( $current['wallpaper'] ) ? (string) $current['wallpaper'] : '';
	$default_wallpaper = isset( $defaults['wallpaper'] ) ? (string) $defaults['wallpaper'] : 'dark';

	// Already on ODD — nothing to do.
	if ( 'odd' === $current_wallpaper ) {
		return false;
	}
	// User (or another plugin) picked something other than the host
	// default. Respect that choice; don't silently switch them.
	if ( '' !== $current_wallpaper && $current_wallpaper !== $default_wallpaper ) {
		return false;
	}

	$next              = $current;
	$next['wallpaper'] = 'odd';

	return (bool) desktop_mode_save_os_settings( $user_id, $next );
}

/**
 * Safety net: on every request, if the starter pack isn't installed
 * yet and the caller is privileged, run the installer inline.
 *
 * We attach to `init` (rather than `admin_init`) because WP Desktop
 * Mode users typically land on the frontend and never visit wp-admin.
 * Privilege check (`activate_plugins` / `manage_options`) keeps
 * anonymous frontend traffic from triggering network I/O. Backoff is
 * enforced by `odd_starter_ensure_installed()` so a chronically
 * failing catalog doesn't run on every request.
 */
function odd_starter_safety_net() {
	if ( ( defined( 'DOING_CRON' ) && DOING_CRON ) || ( defined( 'WP_INSTALLING' ) && WP_INSTALLING ) ) {
		return;
	}
	$state = odd_starter_get_state();
	if ( 'installed' === $state['status'] ) {
		return;
	}
	if ( ! is_user_logged_in() ) {
		return;
	}
	if ( ! current_user_can( 'activate_plugins' ) && ! current_user_can( 'manage_options' ) ) {
		return;
	}
	odd_starter_ensure_installed( false );
}
add_action( 'init', 'odd_starter_safety_net', 20 );

/**
 * Clean up any cron events from pre-3.0.2 installs that might still
 * be floating in wp_options. No-op on sites that never had one.
 */
add_action(
	'init',
	function () {
		if ( get_option( 'odd_starter_cron_cleaned', '' ) === ODD_VERSION ) {
			return;
		}
		if ( function_exists( 'wp_clear_scheduled_hook' ) ) {
			wp_clear_scheduled_hook( 'odd_install_starter_pack' );
		}
		update_option( 'odd_starter_cron_cleaned', ODD_VERSION, false );
	},
	5
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
					$result = odd_starter_ensure_installed( true );
					$state  = odd_starter_get_state();
					if ( is_wp_error( $result ) ) {
						return new WP_Error(
							'starter_failed',
							$result->get_error_message(),
							array(
								'status' => 502,
								'state'  => $state,
							)
						);
					}
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
