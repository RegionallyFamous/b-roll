<?php
/**
 * Plugin Name:       ODD — Outlandish Desktop Decorator
 * Plugin URI:        https://github.com/RegionallyFamous/odd
 * Description:       Decorator for WP Desktop Mode: generative PixiJS wallpapers, themed icon sets, and a native ODD Control Panel window to switch between them.
 * Version:           1.5.1
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

define( 'ODD_VERSION', '1.5.1' );
define( 'ODD_FILE', __FILE__ );
define( 'ODD_DIR', plugin_dir_path( __FILE__ ) );
define( 'ODD_URL', untrailingslashit( plugins_url( '', __FILE__ ) ) );

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
require_once ODD_DIR . 'includes/enqueue.php';
