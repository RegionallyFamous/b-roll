<?php
/**
 * Plugin Name:       B-Roll Icons for WP Desktop Mode
 * Plugin URI:        https://github.com/RegionallyFamous/odd
 * Description:       Themed icon sets that re-skin the WP Desktop Mode Dock — pick a set (Code Rain for v0.1, more shipping soon), and Posts / Pages / Media / Users / Settings etc. render in that set's visual language. Sibling to the B-Roll wallpaper plugin; independent pick.
 * Version:           0.1.4
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            regionallyfamous
 * Author URI:        https://github.com/regionallyfamous
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       b-roll-icons
 *
 * Requires the WordPress Desktop Mode plugin to be active:
 * https://github.com/WordPress/desktop-mode
 */

defined( 'ABSPATH' ) || exit;

define( 'B_ROLL_ICONS_VERSION', '0.1.4' );
define( 'B_ROLL_ICONS_DIR', plugin_dir_path( __FILE__ ) );
define( 'B_ROLL_ICONS_URL', untrailingslashit( plugins_url( '', __FILE__ ) ) );

require_once B_ROLL_ICONS_DIR . 'includes/registry.php';
require_once B_ROLL_ICONS_DIR . 'includes/dock-filter.php';
require_once B_ROLL_ICONS_DIR . 'includes/rest.php';
require_once B_ROLL_ICONS_DIR . 'includes/enqueue.php';
