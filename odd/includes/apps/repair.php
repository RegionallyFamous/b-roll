<?php
/**
 * ODD Apps — catalog-owned repair helpers.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_APPS_REPAIR_META_OPTION' ) ) {
	define( 'ODD_APPS_REPAIR_META_OPTION', 'odd_apps_repair_meta' );
}
if ( ! defined( 'ODD_APPS_REPAIR_LOCK_TTL' ) ) {
	define( 'ODD_APPS_REPAIR_LOCK_TTL', 180 );
}

function odd_apps_repair_meta_all() {
	$meta = get_option( ODD_APPS_REPAIR_META_OPTION, array() );
	return is_array( $meta ) ? $meta : array();
}

function odd_apps_repair_meta_for( $slug ) {
	$slug = sanitize_key( (string) $slug );
	$all  = odd_apps_repair_meta_all();
	return isset( $all[ $slug ] ) && is_array( $all[ $slug ] ) ? $all[ $slug ] : array();
}

function odd_apps_repair_record( $slug, array $row ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return array();
	}
	$all          = odd_apps_repair_meta_all();
	$row['at']    = isset( $row['at'] ) ? (int) $row['at'] : time();
	$all[ $slug ] = wp_parse_args(
		$row,
		array(
			'status'         => 'unknown',
			'requested_path' => '',
			'catalog_owned'  => false,
			'catalog_source' => function_exists( 'odd_catalog_meta' ) ? ( odd_catalog_meta()['source'] ?? '' ) : '',
			'error_code'     => '',
			'error_message'  => '',
		)
	);
	update_option( ODD_APPS_REPAIR_META_OPTION, $all, false );
	return $all[ $slug ];
}

function odd_apps_repair_lock_key( $slug ) {
	return 'odd_apps_repair_lock_' . sanitize_key( (string) $slug );
}

function odd_apps_repair_lock_acquire( $slug ) {
	$key = odd_apps_repair_lock_key( $slug );
	$now = time();
	if ( add_option( $key, (string) $now, '', false ) ) {
		return true;
	}
	$started = (int) get_option( $key, 0 );
	if ( $started > 0 && ( $now - $started ) > ODD_APPS_REPAIR_LOCK_TTL ) {
		update_option( $key, (string) $now, false );
		return true;
	}
	return new WP_Error( 'repair_in_progress', __( 'An app repair is already in progress.', 'odd' ) );
}

function odd_apps_repair_lock_release( $slug ) {
	delete_option( odd_apps_repair_lock_key( $slug ) );
}

function odd_apps_catalog_app_row( $slug ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug || ! function_exists( 'odd_catalog_row_for' ) ) {
		return null;
	}
	$row = odd_catalog_row_for( $slug );
	return is_array( $row ) && isset( $row['type'] ) && 'app' === $row['type'] ? $row : null;
}

function odd_apps_icon_file_path( $slug, $manifest = null ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return '';
	}
	if ( null === $manifest ) {
		$manifest = odd_apps_manifest_load( $slug );
	}
	$manifest = is_array( $manifest ) ? $manifest : array();
	$icon     = isset( $manifest['icon'] ) ? (string) $manifest['icon'] : '';
	if ( '' === $icon ) {
		return '';
	}
	if ( 0 === stripos( $icon, 'http://' ) || 0 === stripos( $icon, 'https://' ) ) {
		return '';
	}
	if (
		false !== strpos( $icon, '..' ) ||
		( strlen( $icon ) > 0 && '/' === $icon[0] ) ||
		false !== strpos( $icon, "\0" ) ||
		! preg_match( '#^[a-zA-Z0-9._/-]+$#', $icon )
	) {
		return '';
	}
	$ext = strtolower( pathinfo( $icon, PATHINFO_EXTENSION ) );
	if ( ! in_array( $ext, array( 'svg', 'png', 'webp', 'jpg', 'jpeg', 'gif', 'ico' ), true ) ) {
		return '';
	}
	$base      = odd_apps_dir_for( $slug );
	$real_base = realpath( $base );
	$full      = realpath( $base . $icon );
	if ( ! $real_base || ! $full || 0 !== strpos( $full, $real_base ) ) {
		return '';
	}
	return ( is_file( $full ) && is_readable( $full ) ) ? $full : '';
}

function odd_apps_manifest_icon_health( $slug, $manifest = null ) {
	$slug = sanitize_key( (string) $slug );
	if ( null === $manifest ) {
		$manifest = odd_apps_manifest_load( $slug );
	}
	$manifest = is_array( $manifest ) ? $manifest : array();
	$icon     = isset( $manifest['icon'] ) ? (string) $manifest['icon'] : '';
	$out      = array(
		'slug'          => $slug,
		'manifest_icon' => $icon,
		'status'        => 'missing_icon',
		'file_exists'   => false,
		'resolved_url'  => '',
		'fallback'      => true,
	);
	if ( '' === $slug || '' === $icon ) {
		return $out;
	}
	$file                = odd_apps_icon_file_path( $slug, $manifest );
	$out['file_exists']  = is_string( $file ) && '' !== $file && is_file( $file ) && is_readable( $file );
	$out['resolved_url'] = odd_apps_icon_url( $slug, $manifest );
	$out['fallback']     = '' === $out['resolved_url'] || ! $out['file_exists'];
	$out['status']       = $out['fallback'] ? 'missing_icon' : 'ok';
	return $out;
}

/**
 * Repair a catalog-owned app by re-extracting its verified catalog bundle.
 *
 * @return true|WP_Error
 */
function odd_apps_repair_from_catalog( $slug, $requested_path = '' ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Invalid app slug.', 'odd' ) );
	}
	if ( ! function_exists( 'odd_catalog_download_entry_file' ) || ! function_exists( 'odd_apps_extract_archive' ) ) {
		return new WP_Error( 'repair_unavailable', __( 'App repair is not available on this install.', 'odd' ) );
	}

	$row = odd_apps_catalog_app_row( $slug );
	if ( ! $row ) {
		odd_apps_repair_record(
			$slug,
			array(
				'status'         => 'repair_unavailable',
				'requested_path' => (string) $requested_path,
				'catalog_owned'  => false,
				'error_code'     => 'not_catalog_owned',
				'error_message'  => __( 'Only catalog-owned apps can be repaired automatically.', 'odd' ),
			)
		);
		return new WP_Error( 'repair_unavailable', __( 'Only catalog-owned apps can be repaired automatically.', 'odd' ) );
	}
	if ( empty( $row['sha256'] ) ) {
		odd_apps_repair_record(
			$slug,
			array(
				'status'         => 'failed',
				'requested_path' => (string) $requested_path,
				'catalog_owned'  => true,
				'error_code'     => 'missing_sha256',
				'error_message'  => __( 'Catalog row is missing sha256, so repair cannot verify the archive.', 'odd' ),
			)
		);
		return new WP_Error( 'missing_sha256', __( 'Catalog row is missing sha256, so repair cannot verify the archive.', 'odd' ) );
	}

	$lock = odd_apps_repair_lock_acquire( $slug );
	if ( is_wp_error( $lock ) ) {
		return $lock;
	}

	$tmp = odd_catalog_download_entry_file( $row, 'app_repair' );
	if ( is_wp_error( $tmp ) ) {
		odd_apps_repair_lock_release( $slug );
		odd_apps_repair_record(
			$slug,
			array(
				'status'         => 'failed',
				'requested_path' => (string) $requested_path,
				'catalog_owned'  => true,
				'error_code'     => $tmp->get_error_code(),
				'error_message'  => $tmp->get_error_message(),
			)
		);
		return $tmp;
	}

	$result = odd_apps_extract_archive( $tmp, $slug );
	wp_delete_file( $tmp );
	odd_apps_repair_lock_release( $slug );

	if ( is_wp_error( $result ) ) {
		odd_apps_repair_record(
			$slug,
			array(
				'status'         => 'failed',
				'requested_path' => (string) $requested_path,
				'catalog_owned'  => true,
				'error_code'     => $result->get_error_code(),
				'error_message'  => $result->get_error_message(),
			)
		);
		return $result;
	}

	clearstatcache();
	odd_apps_repair_record(
		$slug,
		array(
			'status'         => 'repaired',
			'requested_path' => (string) $requested_path,
			'catalog_owned'  => true,
			'error_code'     => '',
			'error_message'  => '',
		)
	);
	return true;
}
