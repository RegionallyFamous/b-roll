<?php
/**
 * Tests for the universal .wp bundle installer — exercises round-trip
 * install/register/uninstall for icon-set (no-JS) and scene (JS) types,
 * plus the cross-type global slug uniqueness guarantee.
 *
 * The underlying per-type installers are smoke-tested through the same
 * dispatcher the REST endpoint + Shop chrome rely on, so a regression
 * in either the dispatcher routing or a single type's validator shows
 * up as a failing assertion here rather than a 500 in the browser.
 */

class Test_Bundle_Install extends ODD_REST_Test_Case {

	/**
	 * @var array<array{slug:string, type:string}> Cleanup register.
	 */
	protected $installed = array();

	public function tear_down() {
		foreach ( $this->installed as $row ) {
			odd_bundle_uninstall( $row['slug'] );
		}
		$this->installed = array();
		parent::tear_down();
	}

	protected function build_bundle_zip( array $manifest, array $files = array() ) {
		$path = tempnam( sys_get_temp_dir(), 'oddbundle_' ) . '.wp';
		$zip  = new ZipArchive();
		$this->assertTrue(
			true === $zip->open( $path, ZipArchive::CREATE | ZipArchive::OVERWRITE ),
			'Failed to open fixture zip for writing.'
		);
		$zip->addFromString( 'manifest.json', wp_json_encode( $manifest ) );
		foreach ( $files as $name => $body ) {
			$zip->addFromString( $name, $body );
		}
		$zip->close();
		return $path;
	}

	/**
	 * @return string Path to a minimal valid icon-set .wp archive.
	 */
	protected function make_iconset_zip( $slug = 'test-set' ) {
		$keys  = array(
			'dashboard',
			'posts',
			'pages',
			'media',
			'comments',
			'appearance',
			'plugins',
			'users',
			'tools',
			'settings',
			'profile',
			'links',
			'fallback',
		);
		$icons = array();
		$files = array();
		foreach ( $keys as $k ) {
			$icons[ $k ]                     = 'icons/' . $k . '.svg';
			$files[ 'icons/' . $k . '.svg' ] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="currentColor"/></svg>';
		}
		return $this->build_bundle_zip(
			array(
				'type'    => 'icon-set',
				'slug'    => $slug,
				'name'    => 'Test Set',
				'label'   => 'Test Set',
				'version' => '1.0.0',
				'accent'  => '#ff00aa',
				'icons'   => $icons,
			),
			$files
		);
	}

	protected function make_scene_zip( $slug = 'test-scene' ) {
		return $this->build_bundle_zip(
			array(
				'type'          => 'scene',
				'slug'          => $slug,
				'name'          => 'Test Scene',
				'label'         => 'Test Scene',
				'version'       => '1.0.0',
				'franchise'     => 'Test',
				'tags'          => array( 'test' ),
				'fallbackColor' => '#112233',
				'added'         => '2025-01-01',
				'entry'         => 'scene.js',
				'preview'       => 'preview.webp',
				'wallpaper'     => 'wallpaper.webp',
			),
			array(
				'scene.js'       => "(function(){window.__odd=window.__odd||{};window.__odd.scenes=window.__odd.scenes||{};window.__odd.scenes['" . $slug . "']={setup:function(){},tick:function(){}};})();",
				'preview.webp'   => str_repeat( "\x00", 32 ),
				'wallpaper.webp' => str_repeat( "\x00", 32 ),
			)
		);
	}

	public function test_iconset_round_trip_install_register_uninstall() {
		$zip = $this->make_iconset_zip( 'test-set' );
		$res = odd_bundle_install( $zip, 'test-set.wp' );
		@unlink( $zip );
		$this->assertIsArray( $res, is_wp_error( $res ) ? $res->get_error_message() : 'icon-set install returned non-array' );
		$this->assertSame( 'icon-set', $res['type'] );
		$this->installed[] = array(
			'slug' => 'test-set',
			'type' => 'icon-set',
		);

		$sets  = odd_icons_get_sets( true );
		$slugs = wp_list_pluck( $sets, 'slug' );
		$this->assertContains( 'test-set', $slugs, 'installed icon set must surface in the icon registry' );

		$uninstall = odd_bundle_uninstall( 'test-set' );
		$this->assertTrue( true === $uninstall || is_array( $uninstall ), is_wp_error( $uninstall ) ? $uninstall->get_error_message() : 'uninstall failed' );
		$this->installed = array();

		$slugs = wp_list_pluck( odd_icons_get_sets( true ), 'slug' );
		$this->assertNotContains( 'test-set', $slugs, 'uninstalled icon set must vanish from the registry' );
	}

	public function test_scene_round_trip_install_register_uninstall() {
		$zip = $this->make_scene_zip( 'test-scene' );
		$res = odd_bundle_install( $zip, 'test-scene.wp' );
		@unlink( $zip );
		$this->assertIsArray( $res, is_wp_error( $res ) ? $res->get_error_message() : 'scene install returned non-array' );
		$this->assertSame( 'scene', $res['type'] );
		$this->installed[] = array(
			'slug' => 'test-scene',
			'type' => 'scene',
		);

		$scenes = apply_filters( 'odd_scene_registry', array() );
		$found  = false;
		foreach ( $scenes as $s ) {
			if ( isset( $s['slug'] ) && 'test-scene' === $s['slug'] ) {
				$found = true;
				break; }
		}
		$this->assertTrue( $found, 'installed scene must surface in odd_scene_registry' );

		$uninstall = odd_bundle_uninstall( 'test-scene' );
		$this->assertTrue( true === $uninstall || is_array( $uninstall ), is_wp_error( $uninstall ) ? $uninstall->get_error_message() : 'uninstall failed' );
		$this->installed = array();
	}

	public function test_global_slug_uniqueness_across_types() {
		$zip1 = $this->make_iconset_zip( 'shared-slug' );
		$res1 = odd_bundle_install( $zip1, 'shared-slug.wp' );
		@unlink( $zip1 );
		$this->assertIsArray( $res1 );
		$this->installed[] = array(
			'slug' => 'shared-slug',
			'type' => 'icon-set',
		);

		// Second install with a different type but the same slug must
		// be rejected by the global uniqueness gate, not by a per-type
		// "already installed" check.
		$zip2 = $this->make_scene_zip( 'shared-slug' );
		$res2 = odd_bundle_install( $zip2, 'shared-slug.wp' );
		@unlink( $zip2 );
		$this->assertWPError( $res2, 'second install with same slug must be rejected' );
		$this->assertSame( 'slug_exists', $res2->get_error_code() );
	}

	public function test_invalid_extension_rejected() {
		$zip = $this->make_iconset_zip( 'ignore-me' );
		$res = odd_bundle_install( $zip, 'ignore-me.zip' );
		@unlink( $zip );
		$this->assertWPError( $res );
		$this->assertSame( 'invalid_extension', $res->get_error_code() );
	}

	public function test_unknown_type_defaults_to_app() {
		// Omitting manifest.type falls back to "app" — preserves the
		// v1.7.2-era contract so existing .wp bundles keep installing.
		$zip = $this->build_bundle_zip(
			array(
				'slug'    => 'legacy-app',
				'name'    => 'Legacy',
				'version' => '1.0.0',
				'entry'   => 'index.html',
			),
			array( 'index.html' => '<h1>legacy</h1>' )
		);
		$res = odd_bundle_install( $zip, 'legacy-app.wp' );
		@unlink( $zip );
		$this->assertIsArray( $res, is_wp_error( $res ) ? $res->get_error_message() : 'legacy install returned non-array' );
		$this->assertSame( 'app', $res['type'] );
		$this->installed[] = array(
			'slug' => 'legacy-app',
			'type' => 'app',
		);
	}
}
