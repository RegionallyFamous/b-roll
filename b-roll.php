<?php
/**
 * Plugin Name:       B-Roll for WP Desktop Mode
 * Plugin URI:        https://github.com/RegionallyFamous/b-roll
 * Description:       A pack of pop-culture-themed PixiJS wallpapers for WP Desktop Mode. Scenes are lazy-loaded per-selection so adding hundreds stays cheap.
 * Version:           0.4.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            regionallyfamous
 * Author URI:        https://github.com/regionallyfamous
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       b-roll
 *
 * Requires the WordPress Desktop Mode plugin to be active:
 * https://github.com/WordPress/desktop-mode
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'admin_enqueue_scripts',
	function () {
		if ( ! function_exists( 'wpdm_is_enabled' ) ) {
			return;
		}

		wp_enqueue_script(
			'b-roll',
			plugins_url( 'src/index.js', __FILE__ ),
			array( 'wp-desktop', 'wp-hooks' ),
			'0.4.0',
			true
		);

		wp_localize_script(
			'b-roll',
			'bRoll',
			array(
				'pluginUrl' => untrailingslashit( plugins_url( '', __FILE__ ) ),
				'version'   => '0.4.0',
			)
		);
	}
);
