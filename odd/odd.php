<?php
/**
 * Plugin Name:       ODD — Outlandish Desktop Decorator
 * Plugin URI:        https://github.com/RegionallyFamous/odd
 * Description:       Decorator for WP Desktop Mode: generative PixiJS wallpapers, themed icon sets, and a native ODD Shop window to browse and switch between them.
 * Version:           3.5.7
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            regionallyfamous
 * Author URI:        https://github.com/regionallyfamous
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       odd
 *
 * Requires the WordPress Desktop Mode plugin to be active:
 * https://github.com/WordPress/desktop-mode
 */

defined( 'ABSPATH' ) || exit;

define( 'ODD_VERSION', '3.5.7' );
define( 'ODD_FILE', __FILE__ );
define( 'ODD_DIR', plugin_dir_path( __FILE__ ) );
define( 'ODD_URL', untrailingslashit( plugins_url( '', __FILE__ ) ) );

require_once ODD_DIR . 'includes/dependencies.php';
require_once ODD_DIR . 'includes/extensions.php';
require_once ODD_DIR . 'includes/migrations.php';
require_once ODD_DIR . 'includes/wallpaper/registry.php';
require_once ODD_DIR . 'includes/wallpaper/prefs.php';
require_once ODD_DIR . 'includes/icons/registry.php';
require_once ODD_DIR . 'includes/icons/dock-filter.php';
require_once ODD_DIR . 'includes/rest.php';
require_once ODD_DIR . 'includes/accents.php';
require_once ODD_DIR . 'includes/toasts.php';
require_once ODD_DIR . 'includes/native-window.php';
require_once ODD_DIR . 'includes/apps/bootstrap.php';
// Universal bundle installer. Requires the Apps bootstrap above so
// the App type module can delegate to odd_apps_validate_archive() /
// odd_apps_install() for back-compat.
require_once ODD_DIR . 'includes/content/bootstrap.php';
require_once ODD_DIR . 'includes/starter-pack.php';
require_once ODD_DIR . 'includes/enqueue.php';

/**
 * Load translations for PHP, and wire every registered ODD script
 * handle up to `wp_set_script_translations` so strings wrapped with
 * `wp.i18n.__()` in the panel / widgets honour the active locale.
 *
 * The JSON files live at `languages/odd-<locale>-<handle-md5>.json`
 * when they exist. `languages/odd.pot` is generated at release time
 * by `odd/bin/make-pot` and is the source template that translators
 * fork.
 */
add_action(
	'init',
	static function () {
		load_plugin_textdomain( 'odd', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
	}
);

add_action(
	'wp_enqueue_scripts',
	static function () {
		$langs_dir = ODD_DIR . 'languages';
		foreach ( array( 'odd-panel', 'odd-commands', 'odd-api' ) as $handle ) {
			if ( wp_script_is( $handle, 'registered' ) ) {
				wp_set_script_translations( $handle, 'odd', $langs_dir );
			}
		}
	},
	99
);
add_action(
	'admin_enqueue_scripts',
	static function () {
		$langs_dir = ODD_DIR . 'languages';
		foreach ( array( 'odd-panel', 'odd-commands', 'odd-api' ) as $handle ) {
			if ( wp_script_is( $handle, 'registered' ) ) {
				wp_set_script_translations( $handle, 'odd', $langs_dir );
			}
		}
	},
	99
);
