<?php
/**
 * ODD — widget bundle installer.
 *
 * Installs `.wp` bundles that declare `"type": "widget"`. A widget
 * bundle is:
 *
 *   manifest.json          slug / name / version / type / entry
 *   widget.js              self-registers via wp.desktop.registerWidget
 *   preview.webp           (optional) 640×360, shown on Shop cards
 *
 * Installed widgets live at `wp-content/odd-widgets/<slug>/`. Each
 * `widget.js` is enqueued on `admin_enqueue_scripts` so it runs
 * after `wp-desktop` initialises, which is enough for
 * `wp.desktop.registerWidget()` to hook the widget into the desktop
 * right column.
 *
 * Security posture mirrors scenes: widget JS runs in the admin frame
 * with full privileges, so installation requires `manage_options`
 * plus the one-time JS-content confirmation toast.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_WIDGETS_DIR' ) ) {
	define( 'ODD_WIDGETS_DIR', trailingslashit( WP_CONTENT_DIR ) . 'odd-widgets/' );
}
if ( ! defined( 'ODD_WIDGETS_URL' ) ) {
	define( 'ODD_WIDGETS_URL', trailingslashit( content_url( 'odd-widgets' ) ) );
}
if ( ! defined( 'ODD_WIDGETS_OPTION_INDEX' ) ) {
	define( 'ODD_WIDGETS_OPTION_INDEX', 'odd_widgets_index' );
}

function odd_widgets_dir_for( $slug ) {
	$slug = sanitize_key( (string) $slug );
	return '' === $slug ? '' : ODD_WIDGETS_DIR . $slug . '/';
}

function odd_widgets_url_for( $slug ) {
	$slug = sanitize_key( (string) $slug );
	return '' === $slug ? '' : ODD_WIDGETS_URL . $slug . '/';
}

function odd_widgets_ensure_storage() {
	if ( ! is_dir( ODD_WIDGETS_DIR ) ) {
		wp_mkdir_p( ODD_WIDGETS_DIR );
	}
}

function odd_widgets_index_load() {
	$raw = get_option( ODD_WIDGETS_OPTION_INDEX, array() );
	return is_array( $raw ) ? $raw : array();
}

function odd_widgets_index_save( $index ) {
	update_option( ODD_WIDGETS_OPTION_INDEX, is_array( $index ) ? $index : array(), false );
}

function odd_widget_bundle_has( $slug ) {
	$slug  = sanitize_key( (string) $slug );
	$index = odd_widgets_index_load();
	return isset( $index[ $slug ] );
}

function odd_widget_bundle_validate( $tmp_path, $filename, ZipArchive $zip, array $manifest ) {
	$header = odd_content_validate_header( $manifest );
	if ( is_wp_error( $header ) ) {
		return $header;
	}

	$entry = isset( $manifest['entry'] ) ? (string) $manifest['entry'] : 'widget.js';
	$entry = odd_content_sanitize_relative_path( $entry );
	if ( '' === $entry || '.js' !== strtolower( substr( $entry, -3 ) ) ) {
		return new WP_Error( 'invalid_entry', __( 'Widget bundle entry must be a .js file.', 'odd' ) );
	}
	if ( false === $zip->getFromName( $entry ) ) {
		return new WP_Error(
			'missing_entry',
			sprintf( /* translators: %s entry path */ __( 'Entry file "%s" not found in bundle.', 'odd' ), $entry )
		);
	}

	$preview = '';
	if ( ! empty( $manifest['preview'] ) ) {
		$preview_rel = odd_content_sanitize_relative_path( (string) $manifest['preview'] );
		if ( '' === $preview_rel || false === $zip->getFromName( $preview_rel ) ) {
			return new WP_Error( 'invalid_preview', __( 'Preview file is not present in the bundle.', 'odd' ) );
		}
		$preview = $preview_rel;
	}

	return array(
		'slug'        => $header['slug'],
		'name'        => $header['name'],
		'label'       => isset( $manifest['label'] ) ? sanitize_text_field( (string) $manifest['label'] ) : $header['name'],
		'version'     => $header['version'],
		'type'        => 'widget',
		'author'      => $header['author'],
		'description' => isset( $manifest['description'] ) ? sanitize_text_field( (string) $manifest['description'] ) : $header['description'],
		'franchise'   => isset( $manifest['franchise'] ) ? sanitize_text_field( (string) $manifest['franchise'] ) : 'Community',
		'entry'       => $entry,
		'preview'     => $preview,
	);
}

function odd_widget_bundle_install( $tmp_path, array $manifest ) {
	odd_widgets_ensure_storage();
	$slug = $manifest['slug'];

	$extracted = odd_content_archive_extract( $tmp_path, ODD_WIDGETS_DIR, $slug );
	if ( is_wp_error( $extracted ) ) {
		return $extracted;
	}

	$dir = odd_widgets_dir_for( $slug );

	$canonical = wp_json_encode( $manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
	if ( is_string( $canonical ) ) {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents,WordPress.WP.AlternativeFunctions.file_put_contents_file_put_contents
		file_put_contents( $dir . 'manifest.json', $canonical );
	}

	$index          = odd_widgets_index_load();
	$index[ $slug ] = array(
		'slug'      => $slug,
		'name'      => $manifest['name'],
		'label'     => $manifest['label'],
		'version'   => $manifest['version'],
		'franchise' => $manifest['franchise'],
		'entry'     => $manifest['entry'],
		'preview'   => $manifest['preview'],
		'installed' => time(),
	);
	odd_widgets_index_save( $index );

	return true;
}

function odd_widget_bundle_uninstall( $slug ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Invalid slug.', 'odd' ) );
	}
	$index = odd_widgets_index_load();
	if ( ! isset( $index[ $slug ] ) ) {
		return new WP_Error( 'not_installed', __( 'Widget is not installed.', 'odd' ) );
	}

	$dir = odd_widgets_dir_for( $slug );
	if ( $dir && is_dir( $dir ) ) {
		odd_content_rrmdir( rtrim( $dir, '/' ) );
	}

	unset( $index[ $slug ] );
	odd_widgets_index_save( $index );

	return true;
}

/**
 * Enqueue installed widget JS on admin_enqueue_scripts. Each file
 * calls wp.desktop.registerWidget() at load time, so the widget
 * appears in the desktop right column without any extra wiring.
 */
add_action(
	'admin_enqueue_scripts',
	function () {
		if ( ! function_exists( 'wpdm_is_enabled' ) ) {
			return;
		}
		$index = odd_widgets_index_load();
		if ( empty( $index ) ) {
			return;
		}
		foreach ( $index as $slug => $row ) {
			$entry = isset( $row['entry'] ) ? (string) $row['entry'] : 'widget.js';
			$url   = odd_widgets_url_for( $slug ) . rawurlencode( $entry );
			$ver   = isset( $row['version'] ) ? $row['version'] : ODD_VERSION;
			wp_enqueue_script(
				'odd-widget-' . $slug,
				$url,
				array( 'wp-desktop', 'odd-api' ),
				$ver,
				true
			);
		}
	},
	20
);
