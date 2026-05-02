<?php
/**
 * Tests for odd/includes/native-window.php — specifically the
 * desktop_mode_shell_config filter that governs how the ODD Shop
 * window participates in WP Desktop Mode's shell boot config.
 *
 * These exercise two classes of behavior:
 *
 *  1. Make sure the registered native window advertises a small
 *     minimum size (420x420) on BOTH the `nativeWindows[]` entries
 *     (snake_case and camelCase) AND any `session.windows[]` entries
 *     the shell replays on boot. Shell builds read from different
 *     surfaces.
 *
 *  2. Preserve Desktop Mode's own persisted state values so fullscreen
 *     and maximized host presentation survive across boots.
 */

class Test_Native_Window extends WP_UnitTestCase {

	public function test_native_window_entry_gets_camelcase_and_snakecase_mins() {
		$config = apply_filters(
			'desktop_mode_shell_config',
			array(
				'nativeWindows' => array(
					array(
						'id'        => 'odd',
						'title'     => 'ODD Shop',
						'placement' => 'dock',
					),
					array(
						'id'        => 'other',
						'title'     => 'Another',
						'placement' => 'dock',
					),
				),
			)
		);

		$odd = $config['nativeWindows'][0];

		$this->assertSame( 420, $odd['min_width'] );
		$this->assertSame( 420, $odd['min_height'] );
		$this->assertSame( 420, $odd['minWidth'] );
		$this->assertSame( 420, $odd['minHeight'] );
		$this->assertArrayNotHasKey( 'min_width', $config['nativeWindows'][1], 'Other windows must not be touched.' );
	}

	public function test_session_window_for_odd_preserves_user_size_within_bounds() {
		$config = apply_filters(
			'desktop_mode_shell_config',
			array(
				'session' => array(
					'windows' => array(
						array(
							'id'     => 'odd',
							'width'  => 500,
							'height' => 500,
						),
					),
				),
			)
		);

		$window = $config['session']['windows'][0];
		$this->assertSame( 500, $window['width'], 'Intentional user resize preserved.' );
		$this->assertSame( 500, $window['height'], 'Intentional user resize preserved.' );
		$this->assertSame( 'normal', $window['state'] );
		$this->assertSame( 420, $window['min_width'] );
		$this->assertSame( 420, $window['minWidth'] );
	}

	/**
	 * @dataProvider valid_window_states
	 */
	public function test_session_window_for_odd_preserves_valid_host_state( $state ) {
		$config = apply_filters(
			'desktop_mode_shell_config',
			array(
				'session' => array(
					'windows' => array(
						array(
							'id'     => 'odd',
							'state'  => $state,
							'width'  => 720,
							'height' => 520,
						),
					),
				),
			)
		);

		$window = $config['session']['windows'][0];
		$this->assertSame( $state, $window['state'] );
		$this->assertSame( 720, $window['width'], 'Fresh-start config no longer migrates old saved widths.' );
		$this->assertSame( 520, $window['height'], 'Fresh-start config no longer migrates old saved heights.' );
	}

	public function valid_window_states() {
		return array(
			'normal'     => array( 'normal' ),
			'minimized'  => array( 'minimized' ),
			'maximized'  => array( 'maximized' ),
			'fullscreen' => array( 'fullscreen' ),
		);
	}

	public function test_session_window_for_odd_normalizes_invalid_state() {
		$config = apply_filters(
			'desktop_mode_shell_config',
			array(
				'session' => array(
					'windows' => array(
						array(
							'id'     => 'odd',
							'state'  => 'bogus',
							'width'  => 500,
							'height' => 500,
						),
					),
				),
			)
		);

		$this->assertSame( 'normal', $config['session']['windows'][0]['state'] );
	}

	public function test_oversized_saved_widths_are_clamped() {
		$config = apply_filters(
			'desktop_mode_shell_config',
			array(
				'session' => array(
					'windows' => array(
						array(
							'id'     => 'odd',
							'width'  => 2400,
							'height' => 1400,
						),
					),
				),
			)
		);

		$window = $config['session']['windows'][0];
		$this->assertSame( 1080, $window['width'] );
		$this->assertSame( 720, $window['height'] );
	}

	public function test_non_odd_session_windows_are_untouched() {
		$config = apply_filters(
			'desktop_mode_shell_config',
			array(
				'session' => array(
					'windows' => array(
						array(
							'id'     => 'plugins',
							'width'  => 720,
							'height' => 520,
						),
					),
				),
			)
		);

		$window = $config['session']['windows'][0];
		$this->assertSame( 720, $window['width'], 'Migrations must only touch the ODD window.' );
		$this->assertSame( 520, $window['height'], 'Migrations must only touch the ODD window.' );
		$this->assertArrayNotHasKey( 'min_width', $window );
	}
}
