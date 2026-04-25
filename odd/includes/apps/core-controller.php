<?php
/**
 * ODD Apps — CoreAppsController.
 *
 * Loads the curated catalog at odd/apps/catalog/registry.json and
 * exposes two layers:
 *
 *   1. Built-in apps    — catalog entries marked `builtin: true` are
 *                         auto-installed on first boot (or after a
 *                         migration bump). Their source lives inside
 *                         the plugin at odd/apps/catalog/<slug>/ and
 *                         is copied into wp-content/odd-apps/<slug>/
 *                         so the same serve path works for every app.
 *
 *   2. Catalog          — the full list (builtin + remote) is served
 *                         to the panel so the "Get more apps" tab can
 *                         render a grid with download / install
 *                         buttons.
 *
 * The controller is deliberately tiny: no HTTP fetches happen here —
 * remote apps are installed via /odd/v1/apps/install-from-url which
 * downloads the .wp archive, hands it to odd_apps_install, and is
 * rate-limited by WordPress's standard nonce flow.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_APPS_CATALOG_FILE' ) ) {
	define( 'ODD_APPS_CATALOG_FILE', ODD_DIR . 'apps/catalog/registry.json' );
}
if ( ! defined( 'ODD_APPS_CATALOG_DIR' ) ) {
	define( 'ODD_APPS_CATALOG_DIR', ODD_DIR . 'apps/catalog/' );
}

/**
 * Return the parsed catalog as an array of app descriptors.
 *
 * Cached in memory for the request — the file is tiny but read on
 * every REST call to the panel and every boot check, so a static is
 * worth it.
 *
 * @return array<int, array<string, mixed>>
 */
function odd_apps_catalog() {
	static $cache = null;
	if ( null !== $cache ) {
		return $cache;
	}
	$cache = array();
	if ( ! is_readable( ODD_APPS_CATALOG_FILE ) ) {
		return $cache;
	}
	$raw = file_get_contents( ODD_APPS_CATALOG_FILE );
	if ( false === $raw ) {
		return $cache;
	}
	$data = json_decode( $raw, true );
	if ( ! is_array( $data ) || empty( $data['apps'] ) || ! is_array( $data['apps'] ) ) {
		return $cache;
	}
	$rows = array();
	foreach ( $data['apps'] as $entry ) {
		if ( empty( $entry['slug'] ) || empty( $entry['name'] ) ) {
			continue;
		}
		$rows[] = array(
			'slug'         => sanitize_key( (string) $entry['slug'] ),
			'name'         => sanitize_text_field( (string) $entry['name'] ),
			'version'      => isset( $entry['version'] ) ? sanitize_text_field( (string) $entry['version'] ) : '',
			'author'       => isset( $entry['author'] ) ? sanitize_text_field( (string) $entry['author'] ) : '',
			'description'  => isset( $entry['description'] ) ? wp_kses_post( (string) $entry['description'] ) : '',
			'icon_url'     => isset( $entry['icon_url'] ) ? esc_url_raw( (string) $entry['icon_url'] ) : '',
			'download_url' => isset( $entry['download_url'] ) ? esc_url_raw( (string) $entry['download_url'] ) : '',
			'tags'         => isset( $entry['tags'] ) && is_array( $entry['tags'] ) ? array_values( array_filter( array_map( 'sanitize_text_field', $entry['tags'] ) ) ) : array(),
			'builtin'      => ! empty( $entry['builtin'] ),
		);
	}
	$cache = $rows;
	return $cache;
}

/**
 * Return the catalog entry for a given slug, or null.
 */
function odd_apps_catalog_get( $slug ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return null;
	}
	foreach ( odd_apps_catalog() as $entry ) {
		if ( $entry['slug'] === $slug ) {
			return $entry;
		}
	}
	return null;
}

/**
 * Install a built-in app by copying its on-disk source from the
 * plugin's apps/catalog/<slug>/ directory into wp-content/odd-apps/.
 *
 * Safe to call repeatedly — existing installs are left alone. Returns
 * the manifest on success or a WP_Error on failure (missing source,
 * missing manifest.json, or a filesystem error).
 */
function odd_apps_install_builtin( $slug ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Invalid built-in slug.', 'odd' ) );
	}
	if ( odd_apps_exists( $slug ) ) {
		return odd_apps_manifest_load( $slug );
	}

	$source = ODD_APPS_CATALOG_DIR . $slug . '/';
	if ( ! is_dir( $source ) ) {
		return new WP_Error( 'builtin_missing', sprintf( /* translators: %s slug */ __( 'Built-in app "%s" has no source on disk.', 'odd' ), $slug ) );
	}
	$manifest_path = $source . 'manifest.json';
	if ( ! is_readable( $manifest_path ) ) {
		return new WP_Error( 'builtin_manifest_missing', sprintf( /* translators: %s slug */ __( 'Built-in app "%s" is missing manifest.json.', 'odd' ), $slug ) );
	}
	$raw      = file_get_contents( $manifest_path );
	$manifest = json_decode( $raw, true );
	if ( ! is_array( $manifest ) || empty( $manifest['slug'] ) || $manifest['slug'] !== $slug ) {
		return new WP_Error( 'builtin_manifest_invalid', sprintf( /* translators: %s slug */ __( 'Built-in app "%s" has an invalid manifest.', 'odd' ), $slug ) );
	}

	odd_apps_ensure_storage();
	$dest = odd_apps_dir_for( $slug );
	if ( is_dir( $dest ) ) {
		odd_apps_rrmdir( $dest );
	}
	if ( ! wp_mkdir_p( $dest ) ) {
		return new WP_Error( 'builtin_mkdir_failed', __( 'Could not create app directory.', 'odd' ) );
	}
	if ( ! odd_apps_recursive_copy_dir( rtrim( $source, '/' ), rtrim( $dest, '/' ) ) ) {
		odd_apps_rrmdir( $dest );
		return new WP_Error( 'builtin_copy_failed', __( 'Could not copy built-in app files.', 'odd' ) );
	}

	$index          = odd_apps_index_load();
	$index[ $slug ] = array(
		'slug'        => $slug,
		'name'        => isset( $manifest['name'] ) ? sanitize_text_field( (string) $manifest['name'] ) : $slug,
		'version'     => isset( $manifest['version'] ) ? sanitize_text_field( (string) $manifest['version'] ) : '0.0.0',
		'enabled'     => true,
		'icon'        => isset( $manifest['icon'] ) ? sanitize_text_field( (string) $manifest['icon'] ) : 'icon.svg',
		'description' => isset( $manifest['description'] ) ? sanitize_text_field( (string) $manifest['description'] ) : '',
		'capability'  => isset( $manifest['capability'] ) ? sanitize_text_field( (string) $manifest['capability'] ) : 'read',
		'installed'   => time(),
		'builtin'     => true,
	);
	odd_apps_index_save( $index );

	$manifest['installed'] = $index[ $slug ]['installed'];
	$manifest['enabled']   = true;
	$manifest['builtin']   = true;
	odd_apps_manifest_save( $slug, $manifest );
	odd_apps_apply_manifest_extensions( $manifest );

	do_action( 'odd_app_installed', $slug, $manifest );
	return $manifest;
}

/**
 * Seed all built-in apps. Called from the activation hook and from
 * migration #4 so a fresh install and an upgrade both wind up with
 * the same set of apps pre-installed.
 */
function odd_apps_seed_builtins() {
	foreach ( odd_apps_catalog() as $entry ) {
		if ( empty( $entry['builtin'] ) ) {
			continue;
		}
		odd_apps_install_builtin( $entry['slug'] );
	}
}

/**
 * Recursive directory copy for the built-in installer. Returns true
 * on total success, false on any failure.
 */
function odd_apps_recursive_copy_dir( $src, $dst ) {
	if ( ! is_dir( $src ) ) {
		return false;
	}
	if ( ! is_dir( $dst ) && ! wp_mkdir_p( $dst ) ) {
		return false;
	}
	$items = scandir( $src );
	if ( false === $items ) {
		return false;
	}
	foreach ( $items as $item ) {
		if ( '.' === $item || '..' === $item ) {
			continue;
		}
		$s = $src . DIRECTORY_SEPARATOR . $item;
		$d = $dst . DIRECTORY_SEPARATOR . $item;
		if ( is_link( $s ) ) {
			continue;
		}
		if ( is_dir( $s ) ) {
			if ( ! odd_apps_recursive_copy_dir( $s, $d ) ) {
				return false;
			}
		} else {
			if ( ! @copy( $s, $d ) ) {
				return false;
			}
		}
	}
	return true;
}

/**
 * REST: GET /odd/v1/apps/catalog
 * Returns the full curated catalog (built-ins + remote). Each row
 * carries an `installed` flag so the panel can flip a download
 * button straight to "Open".
 */
// Priority 5 so these literal routes register BEFORE the generic
// /apps/(?P<slug>…) pattern in includes/apps/rest.php; WP's REST
// dispatcher walks routes in insertion order and returns the first
// regex match, so a later-registered literal would be shadowed by
// the slug wildcard ("catalog" and "install-from-catalog" both
// satisfy `[a-z0-9-]+`).
add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'odd/v1',
			'/apps/catalog',
			array(
				'methods'             => 'GET',
				'callback'            => 'odd_apps_rest_catalog',
				'permission_callback' => function () {
					return current_user_can( 'read' );
				},
			)
		);
		register_rest_route(
			'odd/v1',
			'/apps/install-from-catalog',
			array(
				'methods'             => 'POST',
				'callback'            => 'odd_apps_rest_install_from_catalog',
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);
	},
	5
);

function odd_apps_rest_catalog() {
	$installed = array();
	foreach ( odd_apps_list() as $row ) {
		$installed[ $row['slug'] ] = true;
	}
	$rows = array();
	foreach ( odd_apps_catalog() as $entry ) {
		$entry['installed'] = isset( $installed[ $entry['slug'] ] );
		$rows[]             = $entry;
	}
	return rest_ensure_response(
		array(
			'apps' => $rows,
		)
	);
}

/**
 * Install from the catalog by slug. Built-ins are copied from disk;
 * remote entries are downloaded via download_url, validated, and
 * installed through the standard odd_apps_install path.
 */
function odd_apps_rest_install_from_catalog( WP_REST_Request $req ) {
	$slug = sanitize_key( (string) $req->get_param( 'slug' ) );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Missing slug.', 'odd' ), array( 'status' => 400 ) );
	}
	$entry = odd_apps_catalog_get( $slug );
	if ( null === $entry ) {
		return new WP_Error( 'not_in_catalog', __( 'App is not in the catalog.', 'odd' ), array( 'status' => 404 ) );
	}
	if ( odd_apps_exists( $slug ) ) {
		return new WP_Error( 'already_installed', __( 'App is already installed.', 'odd' ), array( 'status' => 409 ) );
	}

	if ( ! empty( $entry['builtin'] ) ) {
		$result = odd_apps_install_builtin( $slug );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response(
			array(
				'installed' => true,
				'manifest'  => $result,
			)
		);
	}

	$download_url = isset( $entry['download_url'] ) ? (string) $entry['download_url'] : '';
	if ( '' === $download_url ) {
		return new WP_Error( 'no_download', __( 'Catalog entry has no download URL.', 'odd' ), array( 'status' => 400 ) );
	}

	// Enforce HTTPS for remote installs. An HTTP source could be MITM'd
	// to swap the archive we validate+extract with root-equivalent
	// capability. Sites that genuinely need HTTP (localhost dev) can
	// override via the `odd_apps_allow_insecure_catalog` filter.
	$scheme      = strtolower( (string) wp_parse_url( $download_url, PHP_URL_SCHEME ) );
	$allow_plain = (bool) apply_filters( 'odd_apps_allow_insecure_catalog', false, $entry );
	if ( 'https' !== $scheme && ! $allow_plain ) {
		return new WP_Error( 'insecure_download', __( 'Catalog downloads must use HTTPS.', 'odd' ), array( 'status' => 400 ) );
	}
	/**
	 * Filter the URL before it is fetched. Return a WP_Error to block
	 * (e.g. enforce a host allow-list in an enterprise deployment).
	 *
	 * @param string|WP_Error $url   The download URL.
	 * @param array           $entry The full catalog row.
	 */
	$download_url = apply_filters( 'odd_apps_catalog_download_url', $download_url, $entry );
	if ( is_wp_error( $download_url ) ) {
		return $download_url;
	}

	if ( ! function_exists( 'download_url' ) ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
	}
	$tmp = download_url( $download_url, 30 );
	if ( is_wp_error( $tmp ) ) {
		return $tmp;
	}
	$filename = wp_parse_url( $download_url, PHP_URL_PATH );
	$filename = $filename ? basename( $filename ) : $slug . '.wp';
	$result   = odd_apps_install( $tmp, $filename );
	wp_delete_file( $tmp );
	if ( is_wp_error( $result ) ) {
		return $result;
	}
	return rest_ensure_response(
		array(
			'installed' => true,
			'manifest'  => $result,
		)
	);
}

/**
 * Activation + migration hook-up. Built-ins used to seed the Hello ODD
 * demo app; v1.0.5 removes that app, so the seed path stays as an
 * extension point but is a no-op for ODD's own catalog.
 */
register_activation_hook(
	ODD_FILE,
	function () {
		odd_apps_ensure_storage();
		odd_apps_seed_builtins();
	}
);

add_filter(
	'odd_migrations',
	function ( $migrations ) {
		$migrations[4] = 'odd_migration_4_seed_builtins';
		$migrations[5] = 'odd_migration_5_remove_hello_odd';
		return $migrations;
	}
);

function odd_migration_4_seed_builtins( $user_id ) {
	unset( $user_id );
	if ( function_exists( 'odd_apps_seed_builtins' ) ) {
		odd_apps_seed_builtins();
	}
}

function odd_migration_5_remove_hello_odd( $user_id ) {
	unset( $user_id );
	if ( function_exists( 'odd_apps_uninstall' ) ) {
		odd_apps_uninstall( 'hello-odd' );
	}
}
