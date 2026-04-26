<?php
/**
 * ODD Apps — bootstrap.
 *
 * Single file required from odd.php so the apps engine comes online
 * in one explicit line. Order:
 *
 *   storage.php              option + filesystem helpers
 *   loader.php               zip validate + extract
 *   registry.php             install/uninstall API + odd_app_registry
 *   rest.php                 /odd/v1/apps/* routes
 *   native-surfaces.php      wp_register_desktop_icon + _window per app
 *
 * Feature flag:
 *
 *   define( 'ODD_APPS_ENABLED', true );
 *
 * is the single gate for the whole feature. The constant is also
 * re-derivable through the `odd_apps_enabled` filter so test harnesses
 * can toggle without editing wp-config.php.
 *
 * The flag ships **off by default** in the initial v0.16.0 release.
 * It flips on by default in v0.16.2 (see PR C in the apps plan).
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_APPS_ENABLED' ) ) {
	// Flipped ON by default in v0.16.2. Third-party code or wp-config
	// can still set the constant explicitly to false to disable.
	define( 'ODD_APPS_ENABLED', (bool) apply_filters( 'odd_apps_enabled', true ) );
}

// Always-loaded files.
//
//   - storage.php defines the filesystem + option helpers that every
//     other apps file leans on.
//   - registry.php exposes odd_apps_list() / odd_apps_manifest_load()
//     — called from enqueue, main REST, and serve-cookieauth on every
//     request that hits an /odd-app/ URL.
//   - serve-cookieauth.php registers the init-priority-1 matcher that
//     serves iframe sub-requests.
//   - loader.php owns odd_apps_forbidden_extensions(), needed by the
//     cookie-auth serve path on any /odd-app/ URL.
//   - rest.php owns odd_apps_mime_for(), used by the cookie-auth serve
//     path. Its register_rest_route() calls are hooked inside
//     rest_api_init so the parse is cheap.
//
// All five are required on every request because a `/odd-app/...`
// URL can be hit from the public front-end (the iframe asset
// sub-requests are not flagged as REST/admin) and the serve path
// would fatal without them.
require_once ODD_DIR . 'includes/apps/storage.php';
require_once ODD_DIR . 'includes/apps/registry.php';
require_once ODD_DIR . 'includes/apps/loader.php';
require_once ODD_DIR . 'includes/apps/rest.php';
require_once ODD_DIR . 'includes/apps/serve-cookieauth.php';

// Context-gated files.
//
// These implement WP Desktop window/icon registration, the Bazaar →
// ODD migration, catalog install, and Bazaar-compat shims. None of
// it is needed on the public front-end (where a logged-out visitor
// never sees the Desktop shell) or for iframe asset sub-requests.
// Admin / REST / ajax / cron / CLI all still load everything.
$odd_apps_bootstrap_needs_admin_surfaces = (
	is_admin() ||
	wp_doing_ajax() ||
	wp_doing_cron() ||
	( defined( 'WP_CLI' ) && WP_CLI ) ||
	( isset( $_SERVER['REQUEST_URI'] ) && false !== strpos( (string) $_SERVER['REQUEST_URI'], '/wp-json/' ) )
);
if ( $odd_apps_bootstrap_needs_admin_surfaces ) {
	require_once ODD_DIR . 'includes/apps/native-surfaces.php';
	require_once ODD_DIR . 'includes/apps/migrate-from-bazaar.php';
	require_once ODD_DIR . 'includes/apps/bazaar-compat.php';
	require_once ODD_DIR . 'includes/apps/core-controller.php';
}
unset( $odd_apps_bootstrap_needs_admin_surfaces );
