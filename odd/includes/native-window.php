<?php
/**
 * ODD — native window + desktop icon registration.
 *
 * Registers the ODD Shop (user-facing name; window id stays `odd`
 * for back-compat with WP Desktop Mode session state, tests, slash
 * commands, and third-party extensions) as a WP Desktop Mode native
 * window — content renders in the parent DOM, not an iframe — see
 * /wp-desktop-mode/docs/native-windows-proposal.md — and pairs it
 * with a clickable desktop-wallpaper shortcut tile.
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
		if ( ! function_exists( 'desktop_mode_register_window' ) || ! function_exists( 'desktop_mode_register_icon' ) ) {
			return;
		}

		$icon_url = odd_control_icon_url();

		desktop_mode_register_window(
			'odd',
			array(
				'title'      => __( 'ODD Shop', 'odd' ),
				'icon'       => $icon_url,
				'script'     => 'odd-panel',
				'template'   => 'odd_render_panel_template',
				'width'      => 960,
				'height'     => 620,
				'min_width'  => 720,
				'min_height' => 480,
				'placement'  => 'none',
			)
		);

		desktop_mode_register_icon(
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
	'desktop_mode_shell_config',
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

			// The ODD Shop should always come back at its current
			// default footprint. WP Desktop Mode persists window
			// state per user, so a single accidental maximize (or a
			// pre-redesign 820×560 save) would otherwise stick forever.
			$config['session']['windows'][ $i ]['state']  = 'normal';
			$config['session']['windows'][ $i ]['width']  = 960;
			$config['session']['windows'][ $i ]['height'] = 620;
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
	<div class="odd-panel odd-shop" data-odd-panel data-odd-shop>
		<div class="odd-panel__loading odd-shop__loading" data-odd-panel-loading>
			<?php esc_html_e( 'Loading ODD Shop…', 'odd' ); ?>
		</div>
	</div>
	<?php
}

/**
 * The ODD mark — a googly eye with an off-axis gaze.
 *
 * Shipped as a real SVG file (`assets/odd-eye.svg`) so it can go
 * straight into an `<img src>`. Data-URIs would be cleaner in theory
 * but WP Desktop Mode's `desktop_mode_sanitize_dock_icon` only allows
 * dashicon classes and http(s) URLs — anything else is silently
 * swapped for `dashicons-admin-generic`, which is how we ended up
 * with a cog on the desktop for a while.
 */
function odd_control_icon_url() {
	return ODD_URL . '/assets/odd-eye.svg';
}
