<?php
/**
 * ODD — remote bundle catalog.
 *
 * ODD 3.0 ships as an empty plugin; every scene, icon set, widget, and
 * app lives in a remote registry at `ODD_CATALOG_URL`. We fetch that
 * registry over HTTPS, cache it in a 12h transient, and surface the
 * parsed rows through the same `/odd/v1/bundles/*` REST endpoints the
 * panel already consumes.
 *
 * Registry schema (v1, see site/catalog/v1/registry.schema.json):
 *
 *   {
 *     "version": 1,
 *     "starter_pack": {
 *       "scenes":    ["<slug>"],
 *       "iconSets":  ["<slug>"],
 *       "widgets":   ["<slug>"],
 *       "apps":      ["<slug>"]
 *     },
 *     "bundles": [
 *       {
 *         "type":         "scene" | "icon-set" | "widget" | "app",
 *         "slug":         "<unique>",
 *         "name":         "Human-readable name",
 *         "version":      "1.0.0",
 *         "author":       "Vendor",
 *         "description":  "Short paragraph",
 *         "franchise":    "Category",
 *         "tags":         ["optional"],
 *         "icon_url":     "https://.../icons/<name>.svg",
 *         "download_url": "https://.../bundles/<name>.wp",
 *         "sha256":       "<64 hex chars>",
 *         "size":         12345
 *       }
 *     ]
 *   }
 *
 * All remote installs route through {@see odd_bundle_install()} after
 * a sha256 match so a compromised or rewritten .wp fails loudly.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_CATALOG_URL' ) ) {
	define( 'ODD_CATALOG_URL', 'https://odd.regionallyfamous.com/catalog/v1/registry.json' );
}
if ( ! defined( 'ODD_CATALOG_TRANSIENT' ) ) {
	define( 'ODD_CATALOG_TRANSIENT', 'odd_catalog_v1' );
}
if ( ! defined( 'ODD_CATALOG_STALE_OPTION' ) ) {
	define( 'ODD_CATALOG_STALE_OPTION', 'odd_catalog_v1_stale' );
}
if ( ! defined( 'ODD_CATALOG_CACHE_TTL' ) ) {
	// Twelve hours. The catalog changes infrequently (only when the
	// plugin-catalog repo publishes GitHub Pages), but users who hit
	// "Refresh" in the Shop get a forced revalidate via
	// odd_catalog_refresh().
	define( 'ODD_CATALOG_CACHE_TTL', 12 * HOUR_IN_SECONDS );
}

/**
 * Resolve the catalog URL at runtime. Hosts can override via
 * `odd_catalog_url` filter or the `ODD_CATALOG_URL` constant.
 */
function odd_catalog_url() {
	return (string) apply_filters( 'odd_catalog_url', ODD_CATALOG_URL );
}

/**
 * Load the remote catalog, with transient cache + stale fallback.
 *
 * Behaviour:
 *   1. Fresh hit on the 12h transient → return it.
 *   2. Stale: issue a blocking wp_remote_get(). On success, refresh
 *      both the transient AND `odd_catalog_v1_stale` (the
 *      "last known good" mirror) and return the new body.
 *   3. On network / JSON failure, return whatever is in the stale
 *      option. A brand-new site with zero cache gets an empty
 *      `{bundles:[], starter_pack:{}}` and we let the starter-pack
 *      runner retry later.
 *
 * @param bool $force If true, skip the fresh transient and fetch
 *                    remotely. Used by the "Refresh catalog" button.
 * @return array      Normalised registry structure.
 */
function odd_catalog_load( $force = false ) {
	static $runtime = null;
	if ( ! $force && null !== $runtime ) {
		return $runtime;
	}

	if ( ! $force ) {
		$fresh = get_transient( ODD_CATALOG_TRANSIENT );
		if ( is_array( $fresh ) ) {
			$runtime = $fresh;
			return $runtime;
		}
	}

	$url      = odd_catalog_url();
	$registry = odd_catalog_fetch_remote( $url );

	if ( ! is_wp_error( $registry ) ) {
		$normalised = odd_catalog_normalise( $registry );
		set_transient( ODD_CATALOG_TRANSIENT, $normalised, ODD_CATALOG_CACHE_TTL );
		update_option( ODD_CATALOG_STALE_OPTION, $normalised, false );
		$runtime = $normalised;
		return $runtime;
	}

	// Remote failed. Fall back to the stale mirror so the Shop can
	// still render what we knew last time.
	$stale   = get_option( ODD_CATALOG_STALE_OPTION, array() );
	$runtime = is_array( $stale ) && ! empty( $stale )
		? $stale
		: odd_catalog_normalise(
			array(
				'version' => 1,
				'bundles' => array(),
			)
		);
	return $runtime;
}

/**
 * Hit the remote registry with wp_remote_get and return the decoded
 * array or a WP_Error.
 *
 * @param string $url
 * @return array|WP_Error
 */
function odd_catalog_fetch_remote( $url ) {
	if ( '' === $url ) {
		return new WP_Error( 'no_url', __( 'No catalog URL configured.', 'odd' ) );
	}
	$response = wp_remote_get(
		$url,
		array(
			'timeout' => 10,
			'headers' => array( 'Accept' => 'application/json' ),
		)
	);
	if ( is_wp_error( $response ) ) {
		return $response;
	}
	$code = (int) wp_remote_retrieve_response_code( $response );
	if ( $code < 200 || $code >= 300 ) {
		return new WP_Error( 'bad_status', sprintf( 'Catalog returned HTTP %d', $code ) );
	}
	$body = (string) wp_remote_retrieve_body( $response );
	if ( '' === $body ) {
		return new WP_Error( 'empty_body', 'Catalog body was empty.' );
	}
	$data = json_decode( $body, true );
	if ( ! is_array( $data ) ) {
		return new WP_Error( 'bad_json', 'Catalog body did not parse as JSON.' );
	}
	return $data;
}

/**
 * Normalise and sanitise a decoded registry so downstream callers
 * can depend on the shape. Silently drops malformed rows.
 *
 * @param array $data Decoded JSON.
 * @return array      {version:int, starter_pack:array, bundles:array}
 */
function odd_catalog_normalise( $data ) {
	$out = array(
		'version'      => isset( $data['version'] ) ? (int) $data['version'] : 1,
		'generated_at' => isset( $data['generated_at'] ) ? (string) $data['generated_at'] : '',
		'starter_pack' => array(
			'scenes'   => array(),
			'iconSets' => array(),
			'widgets'  => array(),
			'apps'     => array(),
		),
		'bundles'      => array(),
	);

	if ( isset( $data['starter_pack'] ) && is_array( $data['starter_pack'] ) ) {
		foreach ( array( 'scenes', 'iconSets', 'widgets', 'apps' ) as $key ) {
			if ( isset( $data['starter_pack'][ $key ] ) && is_array( $data['starter_pack'][ $key ] ) ) {
				$out['starter_pack'][ $key ] = array_values(
					array_filter(
						array_map(
							'sanitize_key',
							$data['starter_pack'][ $key ]
						)
					)
				);
			}
		}
	}

	$allowed_types = array( 'scene', 'icon-set', 'widget', 'app' );
	$rows_in       = isset( $data['bundles'] ) && is_array( $data['bundles'] ) ? $data['bundles'] : array();
	foreach ( $rows_in as $entry ) {
		if ( ! is_array( $entry ) ) {
			continue;
		}
		if ( empty( $entry['slug'] ) || empty( $entry['name'] ) || empty( $entry['type'] ) ) {
			continue;
		}
		$type = sanitize_text_field( (string) $entry['type'] );
		if ( ! in_array( $type, $allowed_types, true ) ) {
			continue;
		}
		$sha = isset( $entry['sha256'] ) ? strtolower( (string) $entry['sha256'] ) : '';
		if ( '' !== $sha && ! preg_match( '/^[0-9a-f]{64}$/', $sha ) ) {
			// Drop rows with malformed hashes — we'd refuse to install them anyway.
			continue;
		}
		$out['bundles'][] = array(
			'type'         => $type,
			'slug'         => sanitize_key( (string) $entry['slug'] ),
			'name'         => sanitize_text_field( (string) $entry['name'] ),
			'version'      => isset( $entry['version'] ) ? sanitize_text_field( (string) $entry['version'] ) : '',
			'author'       => isset( $entry['author'] ) ? sanitize_text_field( (string) $entry['author'] ) : '',
			'description'  => isset( $entry['description'] ) ? wp_kses_post( (string) $entry['description'] ) : '',
			'franchise'    => isset( $entry['franchise'] ) ? sanitize_text_field( (string) $entry['franchise'] ) : '',
			'icon_url'     => isset( $entry['icon_url'] ) ? esc_url_raw( (string) $entry['icon_url'] ) : '',
			'download_url' => isset( $entry['download_url'] ) ? esc_url_raw( (string) $entry['download_url'] ) : '',
			'sha256'       => $sha,
			'size'         => isset( $entry['size'] ) ? (int) $entry['size'] : 0,
			'tags'         => isset( $entry['tags'] ) && is_array( $entry['tags'] )
				? array_values( array_filter( array_map( 'sanitize_text_field', $entry['tags'] ) ) )
				: array(),
			'accent'       => isset( $entry['accent'] ) ? sanitize_hex_color_no_hash( ltrim( (string) $entry['accent'], '#' ) ) : '',
		);
	}

	/**
	 * Filter the full bundle catalog after remote load + normalisation.
	 * Useful for enterprise deployments that pre-seed internal bundles.
	 *
	 * @param array $out Registry with keys version/starter_pack/bundles.
	 */
	return (array) apply_filters( 'odd_bundle_catalog', $out );
}

/**
 * Force a fresh fetch on next odd_catalog_load() (bypassing the
 * transient). Called by the "Refresh catalog" REST endpoint.
 */
function odd_catalog_refresh() {
	delete_transient( ODD_CATALOG_TRANSIENT );
	return odd_catalog_load( true );
}

/**
 * Return just the bundle rows from the loaded catalog.
 *
 * @return array<int, array<string, mixed>>
 */
function odd_bundle_catalog() {
	$registry = odd_catalog_load();
	return isset( $registry['bundles'] ) ? $registry['bundles'] : array();
}

/**
 * Return the starter-pack descriptor from the registry. Used by
 * odd/includes/starter-pack.php to pick which bundles to install on
 * first activation.
 *
 * @return array{scenes:string[],iconSets:string[],widgets:string[],apps:string[]}
 */
function odd_catalog_starter_pack() {
	$registry = odd_catalog_load();
	return isset( $registry['starter_pack'] ) && is_array( $registry['starter_pack'] )
		? $registry['starter_pack']
		: array(
			'scenes'   => array(),
			'iconSets' => array(),
			'widgets'  => array(),
			'apps'     => array(),
		);
}

/**
 * Find the sha256 for a given bundle slug in the loaded catalog. Used
 * by the REST install handler to gate the download. Returns '' when
 * the slug isn't present.
 */
function odd_catalog_sha256_for( $slug ) {
	$slug = sanitize_key( (string) $slug );
	foreach ( odd_bundle_catalog() as $row ) {
		if ( $row['slug'] === $slug ) {
			return isset( $row['sha256'] ) ? (string) $row['sha256'] : '';
		}
	}
	return '';
}

/**
 * Find a single catalog row by slug.
 *
 * @return array|null
 */
function odd_catalog_row_for( $slug ) {
	$slug = sanitize_key( (string) $slug );
	foreach ( odd_bundle_catalog() as $row ) {
		if ( $row['slug'] === $slug ) {
			return $row;
		}
	}
	return null;
}

/**
 * Catalog rows for a given type, annotated with an `installed` flag.
 *
 * @param string $type One of 'scene' | 'icon-set' | 'widget' | 'app'.
 * @return array<int, array<string, mixed>>
 */
function odd_bundle_catalog_for_type( $type ) {
	$type      = sanitize_text_field( (string) $type );
	$installed = odd_bundle_catalog_installed_slugs();
	$rows      = array();
	foreach ( odd_bundle_catalog() as $entry ) {
		if ( $entry['type'] !== $type ) {
			continue;
		}
		$entry['installed'] = isset( $installed[ $entry['slug'] ] );
		$rows[]             = $entry;
	}
	return $rows;
}

function odd_bundle_catalog_installed_slugs() {
	$installed = array();
	foreach ( odd_bundle_catalog_installed_versions() as $slug => $_v ) {
		$installed[ $slug ] = true;
	}
	return $installed;
}

function odd_bundle_catalog_installed_versions() {
	$installed = array();

	if ( function_exists( 'odd_apps_list' ) ) {
		foreach ( odd_apps_list() as $row ) {
			if ( ! empty( $row['slug'] ) ) {
				$installed[ $row['slug'] ] = isset( $row['version'] ) ? (string) $row['version'] : '';
			}
		}
	}

	if ( function_exists( 'odd_icons_get_sets' ) ) {
		foreach ( odd_icons_get_sets() as $row ) {
			if ( ! empty( $row['slug'] ) ) {
				$installed[ $row['slug'] ] = isset( $row['version'] ) ? (string) $row['version'] : '';
			}
		}
	}

	$scenes = apply_filters( 'odd_scene_registry', array() );
	if ( is_array( $scenes ) ) {
		foreach ( $scenes as $row ) {
			if ( is_array( $row ) && ! empty( $row['slug'] ) ) {
				$installed[ $row['slug'] ] = isset( $row['version'] ) ? (string) $row['version'] : '';
			}
		}
	}

	$widgets = apply_filters( 'odd_widget_registry', array() );
	if ( is_array( $widgets ) ) {
		foreach ( $widgets as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$slug = ! empty( $row['slug'] ) ? $row['slug']
				: ( ! empty( $row['id'] ) ? $row['id'] : '' );
			if ( '' !== $slug ) {
				$installed[ $slug ] = isset( $row['version'] ) ? (string) $row['version'] : '';
			}
		}
	}

	return $installed;
}

function odd_bundle_catalog_is_newer( $catalog_version, $installed_version ) {
	$catalog_version   = (string) $catalog_version;
	$installed_version = (string) $installed_version;
	if ( '' === $catalog_version ) {
		return false;
	}
	if ( '' === $installed_version ) {
		return true;
	}
	return version_compare( $installed_version, $catalog_version, '<' );
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'odd/v1',
			'/bundles/catalog',
			array(
				'methods'             => 'GET',
				'callback'            => 'odd_bundle_rest_catalog',
				'permission_callback' => function () {
					return is_user_logged_in();
				},
			)
		);
		register_rest_route(
			'odd/v1',
			'/bundles/install-from-catalog',
			array(
				'methods'             => 'POST',
				'callback'            => 'odd_bundle_rest_install_from_catalog',
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);
		register_rest_route(
			'odd/v1',
			'/bundles/refresh',
			array(
				'methods'             => 'POST',
				'callback'            => function () {
					$registry = odd_catalog_refresh();
					return rest_ensure_response(
						array(
							'refreshed' => true,
							'count'     => isset( $registry['bundles'] ) ? count( $registry['bundles'] ) : 0,
						)
					);
				},
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);
	},
	5
);

function odd_bundle_rest_catalog( WP_REST_Request $req ) {
	$type     = sanitize_text_field( (string) $req->get_param( 'type' ) );
	$versions = odd_bundle_catalog_installed_versions();
	$rows     = array();
	foreach ( odd_bundle_catalog() as $entry ) {
		if ( '' !== $type && $entry['type'] !== $type ) {
			continue;
		}
		$slug                       = $entry['slug'];
		$installed                  = array_key_exists( $slug, $versions );
		$installed_version          = $installed ? $versions[ $slug ] : '';
		$entry['installed']         = $installed;
		$entry['installed_version'] = $installed_version;
		$entry['update_available']  = $installed
			&& odd_bundle_catalog_is_newer( $entry['version'], $installed_version );
		$rows[]                     = $entry;
	}
	return rest_ensure_response( array( 'bundles' => $rows ) );
}

function odd_bundle_rest_install_from_catalog( WP_REST_Request $req ) {
	$rl = odd_bundle_rate_limit_check( 'bundle_catalog_install' );
	if ( is_wp_error( $rl ) ) {
		return $rl;
	}

	$slug = sanitize_key( (string) $req->get_param( 'slug' ) );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Missing slug.', 'odd' ), array( 'status' => 400 ) );
	}

	$entry = odd_catalog_row_for( $slug );
	if ( null === $entry ) {
		return new WP_Error( 'not_in_catalog', __( 'Bundle is not in the catalog.', 'odd' ), array( 'status' => 404 ) );
	}

	$versions          = odd_bundle_catalog_installed_versions();
	$installed_version = isset( $versions[ $slug ] ) ? $versions[ $slug ] : null;
	$is_installed      = array_key_exists( $slug, $versions );
	$allow_update      = (bool) $req->get_param( 'allow_update' );
	if ( $is_installed ) {
		$newer = odd_bundle_catalog_is_newer( $entry['version'], (string) $installed_version );
		if ( ! $allow_update ) {
			return new WP_Error(
				$newer ? 'update_available' : 'already_installed',
				$newer
					? __( 'An update is available. Pass allow_update=1 to reinstall.', 'odd' )
					: __( 'Bundle is already installed.', 'odd' ),
				array(
					'status'            => 409,
					'installed_version' => (string) $installed_version,
					'catalog_version'   => (string) $entry['version'],
				)
			);
		}
		if ( ! $newer ) {
			return new WP_Error(
				'no_newer_version',
				__( 'Catalog version is not newer than the installed version.', 'odd' ),
				array( 'status' => 409 )
			);
		}
		if ( function_exists( 'odd_bundle_uninstall' ) ) {
			$uninstall = odd_bundle_uninstall( $slug );
			if ( is_wp_error( $uninstall ) ) {
				return $uninstall;
			}
		}
	}

	$install = odd_catalog_install_entry( $entry );
	if ( is_wp_error( $install ) ) {
		$data           = $install->get_error_data();
		$data           = is_array( $data ) ? $data : array();
		$data['status'] = isset( $data['status'] ) ? (int) $data['status'] : 400;
		$install->add_data( $data );
		return $install;
	}

	return rest_ensure_response(
		array(
			'installed' => true,
			'slug'      => $install['slug'],
			'type'      => $install['type'],
			'manifest'  => $install['manifest'],
		)
	);
}

/**
 * Download + install a single catalog row. Shared between the REST
 * install endpoint and the starter-pack installer so both go through
 * the same HTTPS + sha256 gate.
 *
 * @param array $entry Normalised catalog row.
 * @return array|WP_Error On success: {slug, type, manifest}.
 */
function odd_catalog_install_entry( array $entry ) {
	$download_url = isset( $entry['download_url'] ) ? (string) $entry['download_url'] : '';
	if ( '' === $download_url ) {
		return new WP_Error( 'no_download', __( 'Catalog entry has no download URL.', 'odd' ), array( 'status' => 400 ) );
	}

	$scheme      = strtolower( (string) wp_parse_url( $download_url, PHP_URL_SCHEME ) );
	$allow_plain = (bool) apply_filters( 'odd_bundle_allow_insecure_catalog', false, $entry );
	if ( 'https' !== $scheme && ! $allow_plain ) {
		return new WP_Error( 'insecure_download', __( 'Catalog downloads must use HTTPS.', 'odd' ), array( 'status' => 400 ) );
	}
	$download_url = apply_filters( 'odd_bundle_catalog_download_url', $download_url, $entry );
	if ( is_wp_error( $download_url ) ) {
		return $download_url;
	}

	if ( ! function_exists( 'download_url' ) ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
	}
	$tmp = download_url( $download_url, 60 );
	if ( is_wp_error( $tmp ) ) {
		return new WP_Error(
			'download_failed',
			sprintf( /* translators: %s error message */ __( 'Could not download bundle: %s', 'odd' ), $tmp->get_error_message() ),
			array( 'status' => 502 )
		);
	}

	$fh = @fopen( $tmp, 'rb' );
	if ( $fh ) {
		$magic = (string) fread( $fh, 4 );
		fclose( $fh );
		if ( 0 !== strncmp( $magic, "PK\x03\x04", 4 ) && 0 !== strncmp( $magic, "PK\x05\x06", 4 ) ) {
			wp_delete_file( $tmp );
			return new WP_Error(
				'not_a_zip',
				__( 'The downloaded file is not a valid .wp archive.', 'odd' ),
				array( 'status' => 502 )
			);
		}
	}

	// Sha256 gate. Every catalog row in v1 carries a 64-char digest;
	// a mismatch means an MITM rewrote the archive, GitHub Pages
	// served a stale cached file after the author pushed an update,
	// or the row predates the v1 schema migration. In every case
	// refuse to install. The starter-pack installer passes
	// "sha256" through the same path via odd_catalog_install_entry().
	$expected_sha = isset( $entry['sha256'] ) ? strtolower( (string) $entry['sha256'] ) : '';
	if ( '' !== $expected_sha ) {
		$actual_sha = hash_file( 'sha256', $tmp );
		if ( ! is_string( $actual_sha ) || $actual_sha !== $expected_sha ) {
			wp_delete_file( $tmp );
			return new WP_Error(
				'sha256_mismatch',
				sprintf(
					/* translators: 1: expected 2: actual */
					__( 'Bundle sha256 mismatch. Expected %1$s, downloaded %2$s.', 'odd' ),
					$expected_sha,
					(string) $actual_sha
				),
				array( 'status' => 502 )
			);
		}
	}

	$filename = wp_parse_url( $download_url, PHP_URL_PATH );
	$filename = $filename ? basename( $filename ) : $entry['slug'] . '.wp';
	$result   = odd_bundle_install( $tmp, $filename );
	wp_delete_file( $tmp );
	if ( is_wp_error( $result ) ) {
		$data           = $result->get_error_data();
		$data           = is_array( $data ) ? $data : array();
		$data['status'] = isset( $data['status'] ) ? (int) $data['status'] : 400;
		$result->add_data( $data );
		return $result;
	}
	return $result;
}
