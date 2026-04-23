<?php
/**
 * Plugin Name:       B-Roll for WP Desktop Mode
 * Plugin URI:        https://github.com/regionallyfamous/b-roll
 * Description:       A pack of pop-culture-themed PixiJS wallpapers for WP Desktop Mode. Scenes include Code Rain (Matrix), Hyperspace (Star Wars), Neon Rain (Blade Runner), The Grid (Tron), Couch Gag (Simpsons), Rainbow Road (Mario Kart), Soot Sprites (Ghibli), Upside Down (Stranger Things), Refinery (Severance), and Shimmer (Arcane).
 * Version:           0.1.0
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

/**
 * Enqueue the scenes bundle.
 *
 * Depends on the `wp-desktop` handle, which the host plugin only registers
 * when the desktop shell is being rendered. That dependency effectively gates
 * our code to desktop-mode contexts.
 */
add_action(
	'admin_enqueue_scripts',
	function () {
		if ( ! function_exists( 'wpdm_is_enabled' ) ) {
			return;
		}

		wp_enqueue_script(
			'b-roll-scenes',
			plugins_url( 'src/scenes.js', __FILE__ ),
			array( 'wp-desktop', 'wp-hooks' ),
			'0.1.0',
			true
		);

		wp_localize_script(
			'b-roll-scenes',
			'bRoll',
			array(
				'pluginUrl' => untrailingslashit( plugins_url( '', __FILE__ ) ),
				'version'   => '0.1.0',
			)
		);
	}
);
