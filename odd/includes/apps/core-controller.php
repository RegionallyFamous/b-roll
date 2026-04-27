<?php
/**
 * ODD Apps — CoreAppsController (v3.0+ compatibility shim).
 *
 * Pre-v3.0 this file shipped a local catalog bootstrapped from
 * `odd/apps/catalog/registry.json` plus built-in apps copied out of
 * the plugin on activation. v3.0 moved every kind of content to the
 * remote catalog at odd.regionallyfamous.com/catalog/v1/ so this
 * file now exists only to keep the legacy REST surface and helper
 * functions alive for third-party code and the panel UI.
 *
 * The legacy endpoints forward to the unified bundles controller:
 *
 *   GET  /odd/v1/apps/catalog              → /odd/v1/bundles/catalog?type=app
 *   POST /odd/v1/apps/install-from-catalog → /odd/v1/bundles/install-from-catalog
 *
 * and the "built-in" concept is retired — every app ships from the
 * remote registry, downloads on install, and is SHA256-verified.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Return the current apps catalog as an array of descriptors shaped
 * like the pre-v3 rows (slug, name, version, author, description,
 * icon_url, download_url, tags, builtin=false). Pulled from the
 * unified remote bundles catalog with `type === 'app'`.
 *
 * @return array<int, array<string, mixed>>
 */
function odd_apps_catalog() {
	if ( ! function_exists( 'odd_bundle_catalog_for_type' ) ) {
		return array();
	}
	$rows = array();
	foreach ( odd_bundle_catalog_for_type( 'app' ) as $entry ) {
		$rows[] = array(
			'slug'         => isset( $entry['slug'] ) ? (string) $entry['slug'] : '',
			'name'         => isset( $entry['name'] ) ? (string) $entry['name'] : ( isset( $entry['slug'] ) ? (string) $entry['slug'] : '' ),
			'version'      => isset( $entry['version'] ) ? (string) $entry['version'] : '',
			'author'       => isset( $entry['author'] ) ? (string) $entry['author'] : '',
			'description'  => isset( $entry['description'] ) ? (string) $entry['description'] : '',
			'icon_url'     => isset( $entry['icon_url'] ) ? (string) $entry['icon_url'] : '',
			'download_url' => isset( $entry['download_url'] ) ? (string) $entry['download_url'] : '',
			'tags'         => isset( $entry['tags'] ) && is_array( $entry['tags'] ) ? $entry['tags'] : array(),
			'builtin'      => false,
			'installed'    => ! empty( $entry['installed'] ),
		);
	}
	return $rows;
}

/**
 * Return the catalog entry for a given slug, or null.
 *
 * @param string $slug
 * @return array|null
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
 * v3.0+: no more built-in apps. This shim stays for third-party code
 * that may still call it — returns a WP_Error so the caller knows
 * nothing happened, rather than pretending success.
 */
function odd_apps_install_builtin( $slug ) {
	return new WP_Error(
		'builtin_removed',
		sprintf(
			/* translators: %s slug */
			__( 'Built-in apps were retired in ODD 3.0. Install "%s" from the remote catalog instead.', 'odd' ),
			(string) $slug
		)
	);
}

/**
 * v3.0+: no-op. The starter pack (defined server-side in the remote
 * catalog) handles first-run app seeding now; see
 * odd/includes/starter-pack.php.
 */
function odd_apps_seed_builtins() {
	// Retired in v3.0.0 — kept as an extension point so third-party
	// activation hooks that still call this don't fatal.
}

/**
 * REST route registration. Priority 5 so the literal routes register
 * BEFORE the generic `/apps/(?P<slug>…)` pattern in
 * includes/apps/rest.php; WP's REST dispatcher walks routes in
 * insertion order and returns the first regex match, so a later
 * registration would be shadowed by the slug wildcard ("catalog"
 * and "install-from-catalog" both satisfy `[a-z0-9-]+`).
 */
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

/**
 * GET /odd/v1/apps/catalog — compatibility wrapper over the unified
 * bundles catalog filtered to `type=app`. Shape mirrors pre-v3:
 *
 *   { apps: [ { slug, name, version, …, installed, builtin } ] }
 *
 * `builtin` is always false; the field stays for BC with any UI that
 * still checks it.
 */
function odd_apps_rest_catalog() {
	return rest_ensure_response(
		array(
			'apps' => odd_apps_catalog(),
		)
	);
}

/**
 * POST /odd/v1/apps/install-from-catalog — thin wrapper that forwards
 * to the unified installer so the SHA256 gate, rate limiter, and
 * download flow stay consolidated in one place.
 *
 * @param WP_REST_Request $req
 * @return WP_REST_Response|WP_Error
 */
function odd_apps_rest_install_from_catalog( WP_REST_Request $req ) {
	if ( ! function_exists( 'odd_bundle_rest_install_from_catalog' ) ) {
		return new WP_Error(
			'catalog_unavailable',
			__( 'Bundle catalog is unavailable. Refresh the page and try again.', 'odd' ),
			array( 'status' => 500 )
		);
	}

	$slug = sanitize_key( (string) $req->get_param( 'slug' ) );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Missing slug.', 'odd' ), array( 'status' => 400 ) );
	}

	// Reject non-app slugs up front so a caller to the apps-namespaced
	// endpoint can't install a scene / icon-set / widget through it.
	if ( function_exists( 'odd_catalog_row_for' ) ) {
		$entry = odd_catalog_row_for( $slug );
		if ( null === $entry ) {
			return new WP_Error( 'not_in_catalog', __( 'App is not in the catalog.', 'odd' ), array( 'status' => 404 ) );
		}
		if ( 'app' !== ( isset( $entry['type'] ) ? $entry['type'] : '' ) ) {
			return new WP_Error( 'not_an_app', __( 'That slug is not an app.', 'odd' ), array( 'status' => 400 ) );
		}
	}

	$forwarded = new WP_REST_Request( 'POST', '/odd/v1/bundles/install-from-catalog' );
	$forwarded->set_param( 'slug', $slug );
	$result = odd_bundle_rest_install_from_catalog( $forwarded );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	// Normalise the response shape to what legacy callers expect:
	// `{ installed: true, manifest: { … } }`. The unified endpoint
	// returns `{ installed, slug, version, type }`; we re-load the
	// manifest from disk so the panel's "Open" button can light up.
	$data = $result->get_data();
	if ( function_exists( 'odd_apps_manifest_load' ) ) {
		$manifest = odd_apps_manifest_load( $slug );
		if ( ! is_wp_error( $manifest ) ) {
			return rest_ensure_response(
				array(
					'installed' => ! empty( $data['installed'] ),
					'manifest'  => $manifest,
				)
			);
		}
	}
	return $result;
}

/**
 * Activation hook. No-op seed — the starter pack installer in
 * odd/includes/starter-pack.php downloads whatever the remote catalog
 * declares as the first-run set. We still ensure `wp-content/odd-apps/`
 * exists so the very first install doesn't race on mkdir.
 */
register_activation_hook(
	ODD_FILE,
	function () {
		if ( function_exists( 'odd_apps_ensure_storage' ) ) {
			odd_apps_ensure_storage();
		}
	}
);

/**
 * Legacy migration hooks retained as no-ops so the migration runner
 * doesn't re-execute stale built-in seeding on upgrade. Third-party
 * filters that append higher-numbered migrations still work.
 */
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
	// v3.0.0: retired. Built-ins are no longer seeded client-side;
	// the remote catalog's starter_pack handles first-run content.
}

function odd_migration_5_remove_hello_odd( $user_id ) {
	unset( $user_id );
	if ( function_exists( 'odd_apps_uninstall' ) ) {
		odd_apps_uninstall( 'hello-odd' );
	}
}
