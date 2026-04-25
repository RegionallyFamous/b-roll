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

		wp_register_desktop_window(
			'odd',
			array(
				'title'      => __( 'ODD Control Panel', 'odd' ),
				'icon'       => odd_control_icon_svg_data_uri(),
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
				'icon'     => odd_control_icon_svg_data_uri(),
				'window'   => 'odd',
				'position' => 100,
			)
		);
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
 * Settings-dial SVG used as the window icon and desktop icon.
 * Returned as a data-URI so the shell can drop it straight into
 * `<img src>` without an extra HTTP fetch. Rendered at 32×32 in most
 * surfaces; we keep it monochrome so WP Desktop Mode's tint controls
 * still work.
 */
function odd_control_icon_svg_data_uri() {
	static $cache = null;
	if ( null !== $cache ) {
		return $cache;
	}
	$svg = <<<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm9 3.5a9.3 9.3 0 0 0-.2-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.4a.5.5 0 0 0-.6-.2l-2.5 1a7 7 0 0 0-1.7-1L15.8 1a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7 7 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.4a.5.5 0 0 0 .1.6L5.2 10a9.3 9.3 0 0 0 0 4L3.1 15.6a.5.5 0 0 0-.1.6l2 3.4a.5.5 0 0 0 .6.2l2.5-1c.5.4 1 .8 1.7 1l.4 2.6a.5.5 0 0 0 .5.4h4a.5.5 0 0 0 .5-.4l.4-2.6a7 7 0 0 0 1.7-1l2.5 1a.5.5 0 0 0 .6-.2l2-3.4a.5.5 0 0 0-.1-.6L20.8 14c.1-.7.2-1.3.2-2z"/></svg>
SVG;
	$cache = 'data:image/svg+xml;utf8,' . rawurlencode( $svg );
	return $cache;
}
