<?php
/**
 * Tests for cursor-set registry, prefs, and CSS rendering.
 */

class Test_Cursors extends WP_UnitTestCase {

	public function tear_down() {
		remove_all_filters( 'odd_cursor_set_registry' );
		delete_transient( odd_cursors_registry_transient_key() );
		odd_cursors_get_sets( true );
		parent::tear_down();
	}

	private function add_fixture_cursor_set() {
		add_filter(
			'odd_cursor_set_registry',
			static function ( $sets ) {
				$sets['test-cursors'] = array(
					'slug'        => 'test-cursors',
					'label'       => 'Test Cursors',
					'franchise'   => 'Tests',
					'accent'      => '#38e8ff',
					'description' => 'Fixture cursor set.',
					'version'     => '1.0.0',
					'preview'     => 'https://example.com/preview.svg',
					'cursors'     => array(
						'default' => array(
							'url'     => 'https://example.com/default.svg',
							'hotspot' => array( 2, 3 ),
						),
						'text'    => array(
							'url'     => 'https://example.com/text.svg',
							'hotspot' => array( 16, 16 ),
						),
					),
					'source'      => 'test',
				);
				return $sets;
			}
		);
		odd_cursors_get_sets( true );
	}

	public function test_registry_accepts_filtered_cursor_sets() {
		$this->add_fixture_cursor_set();
		$set = odd_cursors_get_set( 'test-cursors' );
		$this->assertIsArray( $set );
		$this->assertSame( 'Test Cursors', $set['label'] );
		$this->assertArrayHasKey( 'default', $set['cursors'] );
	}

	public function test_active_cursor_set_is_per_user_and_validated() {
		$this->add_fixture_cursor_set();
		$user_id = self::factory()->user->create();
		wp_set_current_user( $user_id );

		$this->assertTrue( odd_cursors_set_active_slug( 'test-cursors', $user_id ) );
		$this->assertSame( 'test-cursors', odd_cursors_get_active_slug( $user_id ) );
		$this->assertFalse( odd_cursors_set_active_slug( 'missing-cursors', $user_id ) );
	}

	public function test_css_builder_outputs_cursor_rules_with_hotspots() {
		$this->add_fixture_cursor_set();
		$css = odd_cursors_build_css( odd_cursors_get_set( 'test-cursors' ) );

		$this->assertStringContainsString( 'url("https://example.com/default.svg") 2 3, default', $css );
		$this->assertStringContainsString( 'url("https://example.com/text.svg") 16 16, text', $css );
		$this->assertStringContainsString( 'input:not([type="button"])', $css );
	}

	public function test_cursor_urls_upgrade_for_playground_https_proxy() {
		$server = $_SERVER;
		try {
			unset( $_SERVER['HTTPS'], $_SERVER['HTTP_X_FORWARDED_PROTO'], $_SERVER['SERVER_PORT'] );
			$_SERVER['HTTP_HOST'] = 'playground.wordpress.net';

			$this->assertSame(
				'https://playground.wordpress.net/scope:test/wp-content/odd-cursor-sets/default.svg',
				odd_cursors_url_current_scheme( 'http://playground.wordpress.net/scope:test/wp-content/odd-cursor-sets/default.svg' )
			);
			$this->assertSame(
				'https://example.com/default.svg',
				odd_cursors_url_current_scheme( 'https://example.com/default.svg' )
			);
		} finally {
			$_SERVER = $server;
		}
	}
}
