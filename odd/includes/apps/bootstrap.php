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

require_once ODD_DIR . 'includes/apps/storage.php';
require_once ODD_DIR . 'includes/apps/loader.php';
require_once ODD_DIR . 'includes/apps/registry.php';
require_once ODD_DIR . 'includes/apps/rest.php';
require_once ODD_DIR . 'includes/apps/native-surfaces.php';
require_once ODD_DIR . 'includes/apps/migrate-from-bazaar.php';
require_once ODD_DIR . 'includes/apps/bazaar-compat.php';
require_once ODD_DIR . 'includes/apps/core-controller.php';
