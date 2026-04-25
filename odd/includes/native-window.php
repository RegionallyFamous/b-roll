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
 * The ODD mark — a googly eye with an off-axis gaze.
 *
 * Used as the native-window title-bar icon and the desktop shortcut
 * tile. Full-color SVG (the dock-filter deliberately skips this
 * icon — see `odd/includes/icons/dock-filter.php` — so the brand
 * gradient + iris stay intact no matter which icon set is active).
 *
 * Returned as a data-URI so the shell can drop it straight into
 * `<img src>` with no extra HTTP fetch. Reads cleanly from ~16px
 * (where it resolves to "eye on a purple tile") up to ~128px (where
 * the iris gradient, glints, eyelash flick, and sparkle all land).
 */
function odd_control_icon_svg_data_uri() {
	static $cache = null;
	if ( null !== $cache ) {
		return $cache;
	}
	$svg = <<<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="odd-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4fa8"/><stop offset=".55" stop-color="#b04be1"/><stop offset="1" stop-color="#5a35d6"/></linearGradient><radialGradient id="odd-eyeball" cx=".35" cy=".32" r=".95"><stop offset="0" stop-color="#ffffff"/><stop offset=".85" stop-color="#f3f4fa"/><stop offset="1" stop-color="#d4d8ea"/></radialGradient><radialGradient id="odd-iris" cx=".35" cy=".32" r=".9"><stop offset="0" stop-color="#7ee3ff"/><stop offset=".6" stop-color="#1e7ac9"/><stop offset="1" stop-color="#0a356b"/></radialGradient></defs><rect x="2" y="2" width="60" height="60" rx="14" fill="url(#odd-bg)"/><ellipse cx="32" cy="45" rx="16" ry="2.4" fill="#2a0b52" opacity=".28"/><circle cx="32" cy="33" r="21" fill="url(#odd-eyeball)"/><circle cx="27" cy="29" r="9.5" fill="url(#odd-iris)"/><circle cx="27" cy="29" r="4.2" fill="#091425"/><circle cx="24.8" cy="26.8" r="1.9" fill="#ffffff"/><circle cx="29.5" cy="31.2" r=".9" fill="#ffffff" opacity=".8"/><path d="M45 14 Q54 8 55 3" fill="none" stroke="#1a0d32" stroke-width="2.4" stroke-linecap="round"/><path d="M49.5 46 l1.2 2.8 l2.8 .8 l-2.8 .8 l-1.2 2.8 l-1.2-2.8 l-2.8-.8 l2.8-.8z" fill="#ffe9a8" opacity=".95"/></svg>
SVG;
	$cache = 'data:image/svg+xml;utf8,' . rawurlencode( $svg );
	return $cache;
}
