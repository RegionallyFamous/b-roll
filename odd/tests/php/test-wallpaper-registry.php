<?php
/**
 * Wallpaper registry contract. Reads odd/src/wallpaper/scenes.json and
 * asserts every entry lines up with assets on disk.
 */

class Test_Wallpaper_Registry extends WP_UnitTestCase {

	public function test_scene_slugs_returns_non_empty_array() {
		$slugs = odd_wallpaper_scene_slugs();
		$this->assertIsArray( $slugs );
		$this->assertNotEmpty( $slugs, 'scenes.json produced no slugs.' );
	}

	public function test_each_scene_has_required_fields() {
		$scenes = odd_wallpaper_scenes();
		$this->assertNotEmpty( $scenes );

		foreach ( $scenes as $s ) {
			$this->assertArrayHasKey( 'slug', $s );
			$this->assertArrayHasKey( 'label', $s );
			$this->assertArrayHasKey( 'franchise', $s );
			$this->assertArrayHasKey( 'tags', $s );
			$this->assertArrayHasKey( 'fallbackColor', $s );
			$this->assertIsArray( $s['tags'] );
			$this->assertMatchesRegularExpression( '/^#[0-9a-fA-F]{6}$/', $s['fallbackColor'] );
			$this->assertMatchesRegularExpression( '/^[a-z0-9][a-z0-9-]*$/', $s['slug'] );
		}
	}

	public function test_each_scene_slug_is_unique() {
		$scenes = odd_wallpaper_scenes();
		$slugs  = array_column( $scenes, 'slug' );
		$this->assertCount( count( array_unique( $slugs ) ), $slugs, 'Duplicate slugs in scenes.json.' );
	}

	public function test_each_scene_has_js_preview_and_wallpaper_on_disk() {
		$plugin_dir = dirname( __DIR__, 3 ) . '/odd';
		foreach ( odd_wallpaper_scenes() as $s ) {
			$slug = $s['slug'];
			$this->assertFileExists( $plugin_dir . "/src/wallpaper/scenes/{$slug}.js", "Scene JS missing for {$slug}." );
			$this->assertFileExists( $plugin_dir . "/assets/previews/{$slug}.webp", "Preview missing for {$slug}." );
			$this->assertFileExists( $plugin_dir . "/assets/wallpapers/{$slug}.webp", "Wallpaper missing for {$slug}." );
		}
	}
}
