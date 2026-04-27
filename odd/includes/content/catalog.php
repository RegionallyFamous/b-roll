<?php
/**
 * ODD — curated bundle catalog for non-app content types.
 *
 * Apps already have their own catalog (odd/apps/catalog/registry.json →
 * `apps[]`). This module extends the same file with a top-level
 * `bundles[]` array so scenes, icon sets, and widgets can surface in a
 * "Discover" shelf inside their respective ODD Shop departments.
 *
 * Schema (per entry in `bundles[]`):
 *
 *   {
 *     "type":         "scene" | "icon-set" | "widget" | "app",
 *     "slug":         "<unique slug>",
 *     "name":         "Human-readable name",
 *     "description":  "Short paragraph, kses_post sanitised",
 *     "version":      "1.0.0",
 *     "author":       "Vendor",
 *     "icon_url":     "https://…",  // optional preview icon
 *     "download_url": "https://…",  // remote `.wp` archive
 *     "tags":         ["optional", "strings"]
 *   }
 *
 * Remote installs flow through {@see odd_bundle_install()} so every
 * security gate (HTTPS requirement, ZIP magic sniff, cross-type slug
 * uniqueness, admin capability) lives in exactly one place.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_BUNDLE_CATALOG_FILE' ) ) {
	// Reuse the existing curated catalog file so maintainers edit
	// one registry.json, not two. The `bundles[]` key is additive —
	// the pre-1.9 `apps[]` key keeps working untouched.
	define( 'ODD_BUNDLE_CATALOG_FILE', ODD_DIR . 'apps/catalog/registry.json' );
}

/**
 * Return every `bundles[]` row, normalised and sanitised. Memoized
 * for the request.
 *
 * @return array<int, array<string, mixed>>
 */
function odd_bundle_catalog() {
	static $cache = null;
	if ( null !== $cache ) {
		return $cache;
	}
	$cache = array();
	if ( ! is_readable( ODD_BUNDLE_CATALOG_FILE ) ) {
		return $cache;
	}
	$raw = file_get_contents( ODD_BUNDLE_CATALOG_FILE );
	if ( false === $raw ) {
		return $cache;
	}
	$data = json_decode( $raw, true );
	if ( ! is_array( $data ) || empty( $data['bundles'] ) || ! is_array( $data['bundles'] ) ) {
		return $cache;
	}
	$allowed_types = array( 'app', 'scene', 'icon-set', 'widget' );
	$rows          = array();
	foreach ( $data['bundles'] as $entry ) {
		if ( empty( $entry['slug'] ) || empty( $entry['name'] ) || empty( $entry['type'] ) ) {
			continue;
		}
		$type = sanitize_text_field( (string) $entry['type'] );
		if ( ! in_array( $type, $allowed_types, true ) ) {
			continue;
		}
		$rows[] = array(
			'type'         => $type,
			'slug'         => sanitize_key( (string) $entry['slug'] ),
			'name'         => sanitize_text_field( (string) $entry['name'] ),
			'version'      => isset( $entry['version'] ) ? sanitize_text_field( (string) $entry['version'] ) : '',
			'author'       => isset( $entry['author'] ) ? sanitize_text_field( (string) $entry['author'] ) : '',
			'description'  => isset( $entry['description'] ) ? wp_kses_post( (string) $entry['description'] ) : '',
			'icon_url'     => isset( $entry['icon_url'] ) ? esc_url_raw( (string) $entry['icon_url'] ) : '',
			'download_url' => isset( $entry['download_url'] ) ? esc_url_raw( (string) $entry['download_url'] ) : '',
			'tags'         => isset( $entry['tags'] ) && is_array( $entry['tags'] )
				? array_values( array_filter( array_map( 'sanitize_text_field', $entry['tags'] ) ) )
				: array(),
		);
	}
	/**
	 * Filter the full bundle catalog after disk load + sanitisation.
	 *
	 * Use-case: an enterprise deployment pre-populates a hand-curated
	 * list of internal bundles for its employees without editing the
	 * plugin file. Returning an array adds rows; filtering rows out
	 * is a valid strategy too.
	 *
	 * @param array $rows Catalog rows, normalised + sanitised.
	 */
	$cache = (array) apply_filters( 'odd_bundle_catalog', $rows );
	return $cache;
}

/**
 * Catalog rows for a given type, annotated with an `installed` flag
 * so the panel can flip "Install" to "Installed" without a second
 * registry lookup.
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

/**
 * Build a set of currently-installed slugs across every content type,
 * so the catalog view can show an "Installed" pill instead of an
 * "Install" button for bundles already on disk.
 *
 * @return array<string, true>
 */
function odd_bundle_catalog_installed_slugs() {
	$installed = array();

	// Apps.
	if ( function_exists( 'odd_apps_list' ) ) {
		foreach ( odd_apps_list() as $row ) {
			if ( ! empty( $row['slug'] ) ) {
				$installed[ $row['slug'] ] = true;
			}
		}
	}

	// Icon sets.
	if ( function_exists( 'odd_icons_get_sets' ) ) {
		foreach ( odd_icons_get_sets() as $row ) {
			if ( ! empty( $row['slug'] ) ) {
				$installed[ $row['slug'] ] = true;
			}
		}
	}

	// Scenes.
	$scenes = apply_filters( 'odd_scene_registry', array() );
	if ( is_array( $scenes ) ) {
		foreach ( $scenes as $row ) {
			if ( is_array( $row ) && ! empty( $row['slug'] ) ) {
				$installed[ $row['slug'] ] = true;
			}
		}
	}

	// Widgets.
	$widgets = apply_filters( 'odd_widget_registry', array() );
	if ( is_array( $widgets ) ) {
		foreach ( $widgets as $row ) {
			$slug = is_array( $row ) && ! empty( $row['slug'] ) ? $row['slug']
				: ( is_array( $row ) && ! empty( $row['id'] ) ? $row['id'] : '' );
			if ( '' !== $slug ) {
				$installed[ $slug ] = true;
			}
		}
	}

	return $installed;
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
					// Matches /odd/v1/prefs — any logged-in user sees
					// the catalog; only `manage_options` can actually
					// install from it (enforced downstream).
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
	},
	5
);

function odd_bundle_rest_catalog() {
	$installed = odd_bundle_catalog_installed_slugs();
	$rows      = array();
	foreach ( odd_bundle_catalog() as $entry ) {
		$entry['installed'] = isset( $installed[ $entry['slug'] ] );
		$rows[]             = $entry;
	}
	return rest_ensure_response( array( 'bundles' => $rows ) );
}

function odd_bundle_rest_install_from_catalog( WP_REST_Request $req ) {
	$slug = sanitize_key( (string) $req->get_param( 'slug' ) );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Missing slug.', 'odd' ), array( 'status' => 400 ) );
	}

	$entry = null;
	foreach ( odd_bundle_catalog() as $row ) {
		if ( $row['slug'] === $slug ) {
			$entry = $row;
			break;
		}
	}
	if ( null === $entry ) {
		return new WP_Error( 'not_in_catalog', __( 'Bundle is not in the catalog.', 'odd' ), array( 'status' => 404 ) );
	}
	if ( isset( odd_bundle_catalog_installed_slugs()[ $slug ] ) ) {
		return new WP_Error( 'already_installed', __( 'Bundle is already installed.', 'odd' ), array( 'status' => 409 ) );
	}

	$download_url = (string) $entry['download_url'];
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

	// Reject obvious non-ZIP responses (captive portals, error pages)
	// before handing to the heavier validator.
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

	$filename = wp_parse_url( $download_url, PHP_URL_PATH );
	$filename = $filename ? basename( $filename ) : $slug . '.wp';
	$result   = odd_bundle_install( $tmp, $filename );
	wp_delete_file( $tmp );
	if ( is_wp_error( $result ) ) {
		$data           = $result->get_error_data();
		$data           = is_array( $data ) ? $data : array();
		$data['status'] = isset( $data['status'] ) ? (int) $data['status'] : 400;
		$result->add_data( $data );
		return $result;
	}

	return rest_ensure_response(
		array(
			'installed' => true,
			'slug'      => $result['slug'],
			'type'      => $result['type'],
			'manifest'  => $result['manifest'],
		)
	);
}
