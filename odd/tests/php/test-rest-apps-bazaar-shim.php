<?php
/**
 * Bazaar compat shim: legacy `/bazaar/v1/*` routes forward unchanged to
 * `/odd/v1/apps/*`. Verifies route registration + forwarding semantics.
 */

class Test_REST_Apps_Bazaar_Shim extends ODD_REST_Test_Case {

	protected $installed = array();

	public function tear_down() {
		foreach ( $this->installed as $slug ) {
			odd_apps_uninstall( $slug );
		}
		$this->installed = array();
		parent::tear_down();
	}

	protected function install_minimal( $slug ) {
		$zip = tempnam( sys_get_temp_dir(), 'baz_' ) . '.wp';
		$z   = new ZipArchive();
		$this->assertTrue( true === $z->open( $zip, ZipArchive::CREATE | ZipArchive::OVERWRITE ) );
		$manifest = array(
			'name'    => $slug,
			'slug'    => $slug,
			'version' => '1.0.0',
			'entry'   => 'index.html',
		);
		$z->addFromString( 'manifest.json', wp_json_encode( $manifest ) );
		$z->addFromString( 'index.html', '<h1>ok</h1>' );
		$z->close();
		$res = odd_apps_install( $zip, $slug . '.wp' );
		@unlink( $zip );
		$this->assertIsArray( $res, is_wp_error( $res ) ? $res->get_error_message() : '' );
		$this->installed[] = $slug;
	}

	public function test_bazaar_wares_list_mirrors_apps_list() {
		$this->login_as();
		$this->install_minimal( 'shim-list' );

		$res = $this->dispatch_json( 'GET', '/bazaar/v1/wares' );
		$this->assertSame( 200, $res->get_status() );
		$slugs = wp_list_pluck( $res->get_data()['apps'], 'slug' );
		$this->assertContains( 'shim-list', $slugs );
	}

	public function test_bazaar_wares_get_returns_manifest() {
		$this->login_as();
		$this->install_minimal( 'shim-get' );

		$res = $this->dispatch_json( 'GET', '/bazaar/v1/wares/shim-get' );
		$this->assertSame( 200, $res->get_status() );
		$this->assertSame( 'shim-get', $res->get_data()['slug'] );
	}

	public function test_bazaar_wares_toggle_mirrors_apps_toggle() {
		$this->login_as();
		$this->install_minimal( 'shim-toggle' );

		$res = $this->dispatch_json( 'POST', '/bazaar/v1/wares/shim-toggle/toggle', array( 'enabled' => false ) );
		$this->assertSame( 200, $res->get_status() );
		$this->assertFalse( $res->get_data()['enabled'] );
	}

	public function test_bazaar_wares_delete_mirrors_apps_delete() {
		$this->login_as();
		$this->install_minimal( 'shim-delete' );

		$res = $this->dispatch_json( 'DELETE', '/bazaar/v1/wares/shim-delete' );
		$this->assertSame( 200, $res->get_status() );
		$this->assertTrue( $res->get_data()['uninstalled'] );

		// Already gone; stop tear_down from double-uninstalling.
		$this->installed = array_diff( $this->installed, array( 'shim-delete' ) );
	}

	public function test_bazaar_routes_require_manage_options_for_destructive_methods() {
		$this->install_minimal( 'shim-auth' );

		$sub = self::factory()->user->create( array( 'role' => 'subscriber' ) );
		wp_set_current_user( $sub );

		$res = $this->dispatch_json( 'DELETE', '/bazaar/v1/wares/shim-auth' );
		$this->assertContains( $res->get_status(), array( 401, 403 ) );
	}
}
