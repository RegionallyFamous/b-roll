<?php
/**
 * Tests for the dock-item + desktop-icons filters in
 * odd/includes/icons/dock-filter.php.
 */

class Test_Icons_Dock_Filter extends WP_UnitTestCase {

	/**
	 * Return the first icon set slug that has at least one mapping
	 * and a fallback — safe to run the filter tests against.
	 */
	protected function pick_set_with_fallback() {
		foreach ( odd_icons_get_sets() as $set ) {
			if ( ! empty( $set['icons']['fallback'] ) ) {
				return $set['slug'];
			}
		}
		$this->fail( 'Fixture safety: no icon set with a fallback icon installed.' );
	}

	public function test_menu_slug_to_key_mapping() {
		$this->assertSame( 'dashboard', odd_icons_slug_to_key( 'index.php' ) );
		$this->assertSame( 'posts', odd_icons_slug_to_key( 'edit.php' ) );
		$this->assertSame( 'pages', odd_icons_slug_to_key( 'edit.php?post_type=page' ) );
		$this->assertSame( 'media', odd_icons_slug_to_key( 'upload.php' ) );
		$this->assertSame( 'settings', odd_icons_slug_to_key( 'options-general.php' ) );
		$this->assertSame( 'posts', odd_icons_slug_to_key( 'edit.php?post_type=book' ), 'CPT edit screen routes to posts key.' );
		$this->assertSame( '', odd_icons_slug_to_key( 'something-else' ) );
		$this->assertSame( '', odd_icons_slug_to_key( '' ) );
	}

	public function test_dock_item_filter_rewrites_icon_for_known_menu_slug() {
		$set_slug = $this->pick_set_with_fallback();
		odd_icons_set_active_slug( $set_slug );

		$item_before = array(
			'icon' => 'original.svg',
			'menu' => 'Posts',
		);
		$item_after  = apply_filters( 'wp_desktop_dock_item', $item_before, 'edit.php' );

		$this->assertIsArray( $item_after );
		$this->assertArrayHasKey( 'icon', $item_after );
		$this->assertNotSame( 'original.svg', $item_after['icon'], 'Icon must be rewritten for a mapped slug.' );
	}

	public function test_dock_item_filter_falls_back_for_unknown_menu_slug() {
		$set_slug = $this->pick_set_with_fallback();
		odd_icons_set_active_slug( $set_slug );

		$item_before = array( 'icon' => 'original.svg' );
		$item_after  = apply_filters( 'wp_desktop_dock_item', $item_before, 'third-party-plugin.php' );

		$this->assertIsArray( $item_after );
		$this->assertNotSame( 'original.svg', $item_after['icon'], 'Unknown slug should still hit the set fallback.' );
	}

	public function test_dock_item_filter_is_noop_when_no_set_active() {
		odd_icons_set_active_slug( 'none' );

		$item_before = array( 'icon' => 'original.svg' );
		$item_after  = apply_filters( 'wp_desktop_dock_item', $item_before, 'edit.php' );

		$this->assertSame( 'original.svg', $item_after['icon'], 'No active set = icon unchanged.' );
	}

	public function test_desktop_icons_filter_skips_odd_control_panel() {
		$set_slug = $this->pick_set_with_fallback();
		odd_icons_set_active_slug( $set_slug );

		$registry_before = array(
			'odd'   => array(
				'id'     => 'odd',
				'icon'   => 'odd-gear.svg',
				'window' => '',
			),
			'posts' => array(
				'id'     => 'posts',
				'icon'   => 'original-posts.svg',
				'window' => 'edit.php',
			),
		);
		$registry_after  = apply_filters( 'wp_desktop_icons', $registry_before );

		$this->assertSame( 'odd-gear.svg', $registry_after['odd']['icon'], 'ODD Control Panel icon must be preserved.' );
		$this->assertNotSame( 'original-posts.svg', $registry_after['posts']['icon'], 'Regular desktop icon gets re-themed.' );
	}

	public function test_desktop_icons_filter_handles_empty_registry() {
		$set_slug = $this->pick_set_with_fallback();
		odd_icons_set_active_slug( $set_slug );

		$this->assertSame( array(), apply_filters( 'wp_desktop_icons', array() ) );
	}
}
