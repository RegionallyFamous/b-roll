<?php
/**
 * ODD — native window + desktop icon registration.
 *
 * Registers the ODD Control Panel as a WP Desktop Mode native window
 * (content renders in the parent DOM, not an iframe — see
 * /wp-desktop-mode/docs/native-windows-proposal.md) and pairs it with
 * a clickable desktop-wallpaper shortcut tile.
 *
 * Double-clicking the desktop icon registered below is the canonical
 * entry point. Slash commands (`/odd-panel`) and widgets (Now Playing
 * "Open ODD" button, Postcard click) also call
 *   wp.desktop.registerWindow( { id: 'odd' } )
 * so every surface lands on the same single-instance window.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	function () {
		if ( ! function_exists( 'wp_register_desktop_window' ) || ! function_exists( 'wp_register_desktop_icon' ) ) {
			return;
		}

		$icon_url = odd_control_icon_url();

		wp_register_desktop_window(
			'odd',
			array(
				'title'      => __( 'ODD Control Panel', 'odd' ),
				'icon'       => $icon_url,
				'script'     => 'odd-panel',
				'template'   => 'odd_render_panel_template',
				'width'      => 820,
				'height'     => 560,
				'min_width'  => 640,
				'min_height' => 440,
				'placement'  => 'none',
			)
		);

		wp_register_desktop_icon(
			'odd',
			array(
				'title'    => __( 'ODD', 'odd' ),
				'icon'     => $icon_url,
				'window'   => 'odd',
				'position' => 100,
			)
		);
	}
);

add_filter(
	'wp_desktop_shell_config',
	function ( $config ) {
		if ( empty( $config['session']['windows'] ) || ! is_array( $config['session']['windows'] ) ) {
			return $config;
		}

		foreach ( $config['session']['windows'] as $i => $window ) {
			if ( ! is_array( $window ) ) {
				continue;
			}
			$id      = isset( $window['id'] ) ? (string) $window['id'] : '';
			$base_id = isset( $window['baseId'] ) ? (string) $window['baseId'] : '';
			$url     = isset( $window['url'] ) ? (string) $window['url'] : '';

			if ( 'odd' !== $id && 'odd' !== $base_id && '#odd' !== $url ) {
				continue;
			}

			// The Control Panel should always come back as a compact
			// utility window. WP Desktop Mode persists window state, so
			// a single accidental maximize would otherwise stick forever.
			$config['session']['windows'][ $i ]['state']  = 'normal';
			$config['session']['windows'][ $i ]['width']  = 820;
			$config['session']['windows'][ $i ]['height'] = 560;
		}

		return $config;
	}
);

/**
 * Panel template — the shell clones this into the native window body
 * when the JS render callback hasn't finished hydrating yet, and keeps
 * it around as a fallback if the plugin's script failed to load. Once
 * odd/src/panel/index.js runs, it replaces the contents with the live
 * UI and attaches listeners.
 */
function odd_render_panel_template() {
	?>
	<div class="odd-panel" data-odd-panel>
		<div class="odd-panel__loading" data-odd-panel-loading>
			<?php esc_html_e( 'Loading ODD…', 'odd' ); ?>
		</div>
	</div>
	<?php
}

/**
 * The ODD mark — a googly eye with an off-axis gaze.
 *
 * Shipped as a real SVG file (`assets/odd-eye.svg`) so it can go
 * straight into an `<img src>`. Data-URIs would be cleaner in theory
 * but WP Desktop Mode's `wpdm_sanitize_dock_icon` only allows
 * dashicon classes and http(s) URLs — anything else is silently
 * swapped for `dashicons-admin-generic`, which is how we ended up
 * with a cog on the desktop for a while.
 */
function odd_control_icon_url() {
	return ODD_URL . '/assets/odd-eye.svg';
}
