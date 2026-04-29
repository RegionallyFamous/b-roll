<?php
/**
 * ODD — scene bundle installer.
 *
 * Installs `.wp` bundles that declare `"type": "scene"`. A scene
 * bundle is self-contained:
 *
 *   manifest.json          slug / name / version / type / entry /
 *                          preview / wallpaper / label / franchise /
 *                          tags[] / fallbackColor
 *   scene.js               self-registers into window.__odd.scenes
 *   preview.webp           640×360, shown on Shop cards
 *   wallpaper.webp         1920×1080, the painted backdrop
 *
 * Installed scenes live at `wp-content/odd-scenes/<slug>/`. The
 * scene descriptor added to `odd_scene_registry` carries
 * `previewUrl` + `wallpaperUrl` pointing at `content_url()` so the
 * static WebPs stream directly — no REST hop, no authenticated
 * serve endpoint. The scene `scene.js` gets enqueued on
 * `admin_enqueue_scripts` with a dependency on `odd` so it runs
 * immediately after the wallpaper engine initialises — the scene
 * self-registers into `window.__odd.scenes[slug]` before the engine
 * ever calls `loadScene()`, so the engine's lazy-load short-circuits.
 *
 * Security posture: scene JavaScript runs in the admin frame with
 * full wp.desktop privileges. Installation therefore requires
 * `manage_options`, and the universal installer's JS-content
 * confirmation toast fires before the upload hits REST.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_SCENES_DIR' ) ) {
	define( 'ODD_SCENES_DIR', trailingslashit( WP_CONTENT_DIR ) . 'odd-scenes/' );
}
if ( ! defined( 'ODD_SCENES_URL' ) ) {
	define( 'ODD_SCENES_URL', trailingslashit( content_url( 'odd-scenes' ) ) );
}
if ( ! defined( 'ODD_SCENES_OPTION_INDEX' ) ) {
	define( 'ODD_SCENES_OPTION_INDEX', 'odd_scenes_index' );
}

function odd_scenes_dir_for( $slug ) {
	$slug = sanitize_key( (string) $slug );
	return '' === $slug ? '' : ODD_SCENES_DIR . $slug . '/';
}

function odd_scenes_url_for( $slug ) {
	$slug = sanitize_key( (string) $slug );
	return '' === $slug ? '' : ODD_SCENES_URL . $slug . '/';
}

function odd_scenes_ensure_storage() {
	if ( ! is_dir( ODD_SCENES_DIR ) ) {
		wp_mkdir_p( ODD_SCENES_DIR );
	}
}

function odd_scenes_index_load() {
	$raw = get_option( ODD_SCENES_OPTION_INDEX, array() );
	return is_array( $raw ) ? $raw : array();
}

function odd_scenes_index_save( $index ) {
	update_option( ODD_SCENES_OPTION_INDEX, is_array( $index ) ? $index : array(), false );
}

function odd_scene_bundle_has( $slug ) {
	$slug  = sanitize_key( (string) $slug );
	$index = odd_scenes_index_load();
	return isset( $index[ $slug ] );
}

/**
 * Per-type validator. Called after archive-envelope checks pass and
 * the manifest is parsed. Returns the normalised manifest or a
 * WP_Error.
 */
function odd_scene_bundle_validate( $tmp_path, $filename, ZipArchive $zip, array $manifest ) {
	$header = odd_content_validate_header( $manifest );
	if ( is_wp_error( $header ) ) {
		return $header;
	}

	$entry = isset( $manifest['entry'] ) ? (string) $manifest['entry'] : 'scene.js';
	$entry = odd_content_sanitize_relative_path( $entry );
	if ( '' === $entry || '.js' !== strtolower( substr( $entry, -3 ) ) ) {
		return new WP_Error( 'invalid_entry', __( 'Scene bundle entry must be a .js file.', 'odd' ) );
	}
	if ( false === $zip->getFromName( $entry ) ) {
		return new WP_Error(
			'missing_entry',
			sprintf( /* translators: %s entry path */ __( 'Entry file "%s" not found in bundle.', 'odd' ), $entry )
		);
	}

	$preview = isset( $manifest['preview'] ) ? (string) $manifest['preview'] : 'preview.webp';
	$preview = odd_content_sanitize_relative_path( $preview );
	if ( '' === $preview || false === $zip->getFromName( $preview ) ) {
		return new WP_Error( 'missing_preview', __( 'Scene bundle is missing preview.webp.', 'odd' ) );
	}

	$wallpaper = isset( $manifest['wallpaper'] ) ? (string) $manifest['wallpaper'] : 'wallpaper.webp';
	$wallpaper = odd_content_sanitize_relative_path( $wallpaper );
	if ( '' === $wallpaper || false === $zip->getFromName( $wallpaper ) ) {
		return new WP_Error( 'missing_wallpaper', __( 'Scene bundle is missing wallpaper.webp.', 'odd' ) );
	}

	$tags = array();
	if ( isset( $manifest['tags'] ) && is_array( $manifest['tags'] ) ) {
		foreach ( $manifest['tags'] as $t ) {
			if ( is_string( $t ) && '' !== trim( $t ) ) {
				$tags[] = sanitize_text_field( $t );
			}
		}
	}

	$fallback = isset( $manifest['fallbackColor'] ) ? trim( (string) $manifest['fallbackColor'] ) : '';
	if ( '' !== $fallback && ! preg_match( '/^#[0-9A-Fa-f]{3,8}$/', $fallback ) ) {
		return new WP_Error( 'invalid_fallback', __( 'fallbackColor must be a hex colour like #0a0a1f.', 'odd' ) );
	}

	return array(
		'slug'          => $header['slug'],
		'name'          => $header['name'],
		'label'         => isset( $manifest['label'] ) ? sanitize_text_field( (string) $manifest['label'] ) : $header['name'],
		'version'       => $header['version'],
		'type'          => 'scene',
		'author'        => $header['author'],
		'description'   => isset( $manifest['description'] ) ? sanitize_text_field( (string) $manifest['description'] ) : $header['description'],
		'franchise'     => isset( $manifest['franchise'] ) ? sanitize_text_field( (string) $manifest['franchise'] ) : 'Community',
		'tags'          => $tags,
		'fallbackColor' => $fallback ? $fallback : '#111',
		'entry'         => $entry,
		'preview'       => $preview,
		'wallpaper'     => $wallpaper,
	);
}

function odd_scene_bundle_install( $tmp_path, array $manifest ) {
	odd_scenes_ensure_storage();
	$slug = $manifest['slug'];

	$extracted = odd_content_archive_extract( $tmp_path, ODD_SCENES_DIR, $slug );
	if ( is_wp_error( $extracted ) ) {
		return $extracted;
	}

	$dir = odd_scenes_dir_for( $slug );

	// Persist the normalised manifest alongside the author's source.
	$canonical = wp_json_encode( $manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
	if ( is_string( $canonical ) ) {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents,WordPress.WP.AlternativeFunctions.file_put_contents_file_put_contents
		file_put_contents( $dir . 'manifest.json', $canonical );
	}

	$index          = odd_scenes_index_load();
	$index[ $slug ] = array(
		'slug'          => $slug,
		'name'          => $manifest['name'],
		'label'         => $manifest['label'],
		'version'       => $manifest['version'],
		'franchise'     => $manifest['franchise'],
		'tags'          => $manifest['tags'],
		'fallbackColor' => $manifest['fallbackColor'],
		'entry'         => $manifest['entry'],
		'preview'       => $manifest['preview'],
		'wallpaper'     => $manifest['wallpaper'],
		'installed'     => time(),
	);
	odd_scenes_index_save( $index );

	// The scene registry memoises per request. A fresh page load
	// picks up the new scene via the filter below; the install
	// request itself doesn't need to see it.
	return true;
}

function odd_scene_bundle_uninstall( $slug ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Invalid slug.', 'odd' ) );
	}
	$index = odd_scenes_index_load();
	if ( ! isset( $index[ $slug ] ) ) {
		return new WP_Error( 'not_installed', __( 'Scene is not installed.', 'odd' ) );
	}

	$dir = odd_scenes_dir_for( $slug );
	if ( $dir && is_dir( $dir ) ) {
		odd_content_rrmdir( rtrim( $dir, '/' ) );
	}

	unset( $index[ $slug ] );
	odd_scenes_index_save( $index );

	return true;
}

/**
 * Filter callback: merge installed scenes into the scene registry.
 *
 * The built-in wallpaper engine uses `cfg.scenes` as-is for card
 * rendering and `cfg.sceneMap[slug]` for descriptor lookups. By
 * adding `previewUrl` + `wallpaperUrl` on installed descriptors the
 * panel paints cards without a REST hop and installed `scene.js`
 * files can read `window.odd.sceneMap[slug].wallpaperUrl` for the
 * painted backdrop.
 */
add_filter(
	'odd_scene_registry',
	function ( $registry ) {
		if ( ! is_array( $registry ) ) {
			$registry = array();
		}
		$index = odd_scenes_index_load();
		if ( empty( $index ) ) {
			return $registry;
		}

		$seen = array();
		foreach ( $registry as $scene ) {
			if ( isset( $scene['slug'] ) ) {
				$seen[ $scene['slug'] ] = true;
			}
		}

		foreach ( $index as $slug => $row ) {
			if ( isset( $seen[ $slug ] ) ) {
				continue;
			}
			$registry[] = array(
				'slug'          => $slug,
				'label'         => isset( $row['label'] ) ? $row['label'] : $slug,
				'franchise'     => isset( $row['franchise'] ) ? $row['franchise'] : 'Community',
				'tags'          => isset( $row['tags'] ) && is_array( $row['tags'] ) ? $row['tags'] : array(),
				'fallbackColor' => isset( $row['fallbackColor'] ) ? $row['fallbackColor'] : '#111',
				'added'         => '',
				'installed'     => true,
				'previewUrl'    => odd_scenes_url_for( $slug ) . rawurlencode( isset( $row['preview'] ) ? $row['preview'] : 'preview.webp' ),
				'wallpaperUrl'  => odd_scenes_url_for( $slug ) . rawurlencode( isset( $row['wallpaper'] ) ? $row['wallpaper'] : 'wallpaper.webp' ),
			);
		}
		return $registry;
	},
	20
);

/**
 * Enqueue installed scene JS on admin_enqueue_scripts. Each file
 * self-registers into `window.__odd.scenes[slug]`, so when the
 * wallpaper engine's `loadScene()` runs it short-circuits on the
 * pre-populated entry and never issues a network request.
 */
add_action(
	'admin_enqueue_scripts',
	function () {
		if ( ! odd_desktop_mode_available() ) {
			return;
		}
		$index = odd_scenes_index_load();
		if ( empty( $index ) ) {
			return;
		}
		foreach ( $index as $slug => $row ) {
			$entry = isset( $row['entry'] ) ? (string) $row['entry'] : 'scene.js';
			$url   = odd_scenes_url_for( $slug ) . rawurlencode( $entry );
			$ver   = isset( $row['version'] ) ? $row['version'] : ODD_VERSION;
			wp_enqueue_script(
				'odd-scene-' . $slug,
				$url,
				array( 'odd' ),
				$ver,
				true
			);
		}
	},
	20
);
