<?php
/**
 * ODD — host-plugin dependency guards.
 *
 * ODD is an add-on for WP Desktop Mode. In normal installs WordPress loads
 * Desktop Mode first, then ODD. In Playground or manual installs, though, the
 * host plugin can fail to download or activate. Keep ODD loadable in that
 * state so recovery is possible, but never call host APIs unless they exist.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Minimum set of WP Desktop Mode APIs that ODD needs before it can
 * safely register windows, icons, widgets, or wallpapers. Checked on
 * every integration touchpoint — see odd_desktop_mode_available().
 */
function odd_desktop_mode_required_functions() {
	return array(
		'desktop_mode_is_enabled',
		'desktop_mode_register_window',
		'desktop_mode_register_icon',
	);
}

/**
 * OS-settings helpers are a secondary Desktop Mode API group used by
 * the starter-pack runner to seed the host wallpaper selection. They
 * are optional — older Desktop Mode builds don't expose them — so
 * they live in their own capability group and callers use
 * odd_desktop_mode_supports( 'os_settings' ) before invoking them.
 */
function odd_desktop_mode_capability_functions( $capability ) {
	$map = array(
		'core'        => odd_desktop_mode_required_functions(),
		'os_settings' => array(
			'desktop_mode_get_os_settings',
			'desktop_mode_save_os_settings',
			'desktop_mode_default_os_settings',
		),
		'registry'    => array(
			'desktop_mode_native_window_registry',
		),
	);
	return isset( $map[ $capability ] ) ? $map[ $capability ] : array();
}

function odd_desktop_mode_missing_functions( $capability = 'core' ) {
	$missing = array();
	foreach ( odd_desktop_mode_capability_functions( $capability ) as $fn ) {
		if ( ! function_exists( $fn ) ) {
			$missing[] = $fn;
		}
	}
	return $missing;
}

/**
 * Whether the core Desktop Mode integration surface is available.
 * Pass a capability slug to check a secondary group (e.g. `os_settings`).
 */
function odd_desktop_mode_available() {
	return array() === odd_desktop_mode_missing_functions( 'core' );
}

function odd_desktop_mode_supports( $capability ) {
	return array() === odd_desktop_mode_missing_functions( $capability );
}

add_action(
	'admin_notices',
	static function () {
		if ( odd_desktop_mode_available() || ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		$missing = odd_desktop_mode_missing_functions();
		?>
		<div class="notice notice-warning">
			<p>
				<?php
				printf(
					/* translators: %s: comma-separated missing function names. */
					esc_html__( 'ODD is active, but WP Desktop Mode is not fully loaded. Desktop surfaces are paused until the host plugin is installed and active. Missing APIs: %s', 'odd' ),
					esc_html( implode( ', ', $missing ) )
				);
				?>
			</p>
		</div>
		<?php
	}
);
