<?php
/**
 * Tests for odd/includes/native-window.php — specifically the
 * desktop_mode_shell_config filter that governs how the ODD Shop
 * window participates in WP Desktop Mode's shell boot config.
 *
 * These exercise two classes of fix:
 *
 *  1. Make sure the registered native window advertises a small
 *     minimum size (420x420) on BOTH the `nativeWindows[]` entries
 *     (snake_case and camelCase) AND any `session.windows[]` entries
 *     the shell replays on boot. Shell builds read from different
 *     surfaces; without this, users can end up stuck at an older
 *     720x520 or 960x620 minimum that predates the resizable Shop.
 *
 *  2. Force-migrate legacy saved widths that exactly match an older
 *     hard minimum (720, 960) so returning users don't see a Shop
 *     that "refuses to shrink" even though min_width is now 420.
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
						'placement' => 'taskbar',
					),
					array(
						'id'        => 'other',
						'title'     => 'Another',
						'placement' => 'taskbar',
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
	 * @dataProvider legacy_sizes
	 */
	public function test_legacy_saved_sizes_get_migrated_to_new_default( $in_width, $in_height, $expected_width, $expected_height ) {
		$config = apply_filters(
			'desktop_mode_shell_config',
			array(
				'session' => array(
					'windows' => array(
						array(
							'id'     => 'odd',
							'width'  => $in_width,
							'height' => $in_height,
						),
					),
				),
			)
		);

		$window = $config['session']['windows'][0];
		$this->assertSame( $expected_width, $window['width'] );
		$this->assertSame( $expected_height, $window['height'] );
	}

	public function legacy_sizes() {
		return array(
			'720x520 stuck-at-old-min'  => array( 720, 520, 1080, 720 ),
			'960x620 pre-luxe default'  => array( 960, 620, 1080, 720 ),
			'720x480 older hardcode'    => array( 720, 480, 1080, 720 ),
			'420x420 valid narrow keep' => array( 420, 420, 420, 420 ),
		);
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
