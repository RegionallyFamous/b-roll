<?php
/**
 * ODD — universal `.wp` bundle installer.
 *
 * Single public entry for every content type:
 *
 *   odd_bundle_install( $tmp_path, $filename ) → array{ slug, type, manifest } | WP_Error
 *   odd_bundle_uninstall( $slug )              → true | WP_Error
 *   odd_bundle_type_for_slug( $slug )          → 'app' | 'icon-set' | 'scene' | 'widget' | ''
 *   odd_bundle_slug_in_use( $slug )            → bool
 *
 * The dispatcher reads `manifest.type` (defaulting to `app` for
 * back-compat with every bundle shipped before v1.8.0), routes to the
 * per-type validator for field-level checks, and then to the per-type
 * installer to extract + register.
 *
 * Slugs are a single global namespace across all four types — the
 * same slug can't be installed as both a scene and a widget. That
 * guarantees uninstall is unambiguous: look up which of four indexes
 * holds the slug, dispatch.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Map of manifest.type → per-type module. Each module exposes:
 *
 *   odd_{type}_validate_archive( $tmp_path, $filename, $zip, $manifest )
 *       → normalised manifest | WP_Error
 *   odd_{type}_install( $tmp_path, $manifest ) → true | WP_Error
 *   odd_{type}_uninstall( $slug )              → true | WP_Error
 *   odd_{type}_has( $slug )                    → bool
 *
 * Apps are listed first so the lookup falls through to the existing
 * Apps implementation — no second code path for the common case.
 */
function odd_bundle_type_modules() {
	return array(
		'app'      => array(
			'validate'  => 'odd_bundle_app_validate',
			'install'   => 'odd_bundle_app_install',
			'uninstall' => 'odd_bundle_app_uninstall',
			'has'       => 'odd_bundle_app_has',
		),
		'icon-set' => array(
			'validate'  => 'odd_iconset_bundle_validate',
			'install'   => 'odd_iconset_bundle_install',
			'uninstall' => 'odd_iconset_bundle_uninstall',
			'has'       => 'odd_iconset_bundle_has',
		),
		'scene'    => array(
			'validate'  => 'odd_scene_bundle_validate',
			'install'   => 'odd_scene_bundle_install',
			'uninstall' => 'odd_scene_bundle_uninstall',
			'has'       => 'odd_scene_bundle_has',
		),
		'widget'   => array(
			'validate'  => 'odd_widget_bundle_validate',
			'install'   => 'odd_widget_bundle_install',
			'uninstall' => 'odd_widget_bundle_uninstall',
			'has'       => 'odd_widget_bundle_has',
		),
	);
}

/**
 * Install any bundle. Returns the normalised descriptor on success
 * or a WP_Error on any validation / extraction failure.
 *
 * @return array|WP_Error { slug, type, manifest }
 */
function odd_bundle_install( $tmp_path, $filename ) {
	list( $zip, $open_err ) = odd_content_archive_open( $tmp_path, $filename );
	if ( $open_err ) {
		return $open_err;
	}

	$scanned = odd_content_archive_scan( $zip );
	if ( is_wp_error( $scanned ) ) {
		$zip->close();
		return $scanned;
	}

	$manifest = odd_content_archive_read_manifest( $zip );
	if ( is_wp_error( $manifest ) ) {
		$zip->close();
		return $manifest;
	}

	$header = odd_content_validate_header( $manifest );
	if ( is_wp_error( $header ) ) {
		$zip->close();
		return $header;
	}

	$slug = $header['slug'];
	$type = $header['type'];

	if ( odd_bundle_slug_in_use( $slug ) ) {
		$zip->close();
		return new WP_Error(
			'slug_exists',
			sprintf( /* translators: %s slug */ __( 'A bundle named "%s" is already installed. Remove it before reinstalling.', 'odd' ), $slug )
		);
	}

	$modules = odd_bundle_type_modules();
	if ( empty( $modules[ $type ] ) || ! function_exists( $modules[ $type ]['validate'] ) ) {
		$zip->close();
		return new WP_Error(
			'unsupported_type',
			sprintf( /* translators: %s manifest.type */ __( 'ODD does not know how to install bundles of type "%s".', 'odd' ), $type )
		);
	}

	$normalised = call_user_func( $modules[ $type ]['validate'], $tmp_path, $filename, $zip, $manifest );
	$zip->close();
	if ( is_wp_error( $normalised ) ) {
		return $normalised;
	}

	// Atomic install lock per slug — add_option returns false when
	// the key already exists, so a concurrent install of the same
	// slug fails fast.
	$lock_key = 'odd_bundle_install_lock_' . $slug;
	if ( ! add_option( $lock_key, '1', '', false ) ) {
		return new WP_Error(
			'install_in_progress',
			__( 'An installation of this bundle is already in progress.', 'odd' )
		);
	}

	$installed = call_user_func( $modules[ $type ]['install'], $tmp_path, $normalised );
	delete_option( $lock_key );
	if ( is_wp_error( $installed ) ) {
		return $installed;
	}

	do_action( 'odd_bundle_installed', $slug, $type, $normalised );

	return array(
		'slug'     => $slug,
		'type'     => $type,
		'manifest' => $normalised,
	);
}

/**
 * Uninstall any bundle by slug. Looks up which type owns the slug
 * and dispatches to the matching per-type uninstaller.
 */
function odd_bundle_uninstall( $slug ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Invalid bundle slug.', 'odd' ) );
	}

	$type = odd_bundle_type_for_slug( $slug );
	if ( '' === $type ) {
		return new WP_Error( 'not_installed', __( 'No bundle with that slug is installed.', 'odd' ) );
	}

	$modules = odd_bundle_type_modules();
	if ( empty( $modules[ $type ]['uninstall'] ) || ! function_exists( $modules[ $type ]['uninstall'] ) ) {
		return new WP_Error( 'unsupported_type', __( 'Internal error: type module missing.', 'odd' ) );
	}

	$result = call_user_func( $modules[ $type ]['uninstall'], $slug );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	do_action( 'odd_bundle_uninstalled', $slug, $type );
	return true;
}

/**
 * Which type owns the slug? Returns '' if the slug is not installed
 * in any type index.
 */
function odd_bundle_type_for_slug( $slug ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return '';
	}
	foreach ( odd_bundle_type_modules() as $type => $module ) {
		if ( ! empty( $module['has'] ) && function_exists( $module['has'] ) && call_user_func( $module['has'], $slug ) ) {
			return $type;
		}
	}
	return '';
}

function odd_bundle_slug_in_use( $slug ) {
	return '' !== odd_bundle_type_for_slug( $slug );
}

// ============================================================ //
// App type module — thin adapters onto the existing Apps API so
// the dispatcher doesn't need to know Apps-specific internals.
// ============================================================ //

function odd_bundle_app_validate( $tmp_path, $filename, ZipArchive $zip, array $manifest ) {
	// Defer to the existing loader's field-level validation. It
	// opens its own ZipArchive handle, which is fine — we've
	// already enforced the envelope once here.
	if ( ! function_exists( 'odd_apps_validate_archive' ) ) {
		return new WP_Error( 'apps_disabled', __( 'ODD Apps are disabled on this site.', 'odd' ) );
	}
	$result = odd_apps_validate_archive( $tmp_path, $filename );
	return is_wp_error( $result ) ? $result : $result;
}

function odd_bundle_app_install( $tmp_path, array $manifest ) {
	if ( ! function_exists( 'odd_apps_install' ) ) {
		return new WP_Error( 'apps_disabled', __( 'ODD Apps are disabled on this site.', 'odd' ) );
	}
	// odd_apps_install() re-validates + extracts. The double-
	// validate is cheap (one ZIP open) and keeps the Apps installer
	// usable as a standalone API.
	$filename = isset( $manifest['slug'] ) ? $manifest['slug'] . '.wp' : 'bundle.wp';
	$result   = odd_apps_install( $tmp_path, $filename );
	return is_wp_error( $result ) ? $result : true;
}

function odd_bundle_app_uninstall( $slug ) {
	if ( ! function_exists( 'odd_apps_uninstall' ) ) {
		return new WP_Error( 'apps_disabled', __( 'ODD Apps are disabled on this site.', 'odd' ) );
	}
	return odd_apps_uninstall( $slug );
}

function odd_bundle_app_has( $slug ) {
	return function_exists( 'odd_apps_exists' ) && odd_apps_exists( $slug );
}
