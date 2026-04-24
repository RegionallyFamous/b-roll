<?php
/**
 * B-Roll Icons — REST prefs endpoint.
 *
 * Minimal surface so the picker JS can GET the current selection and
 * POST a new one. Mirrors the b-roll `POST /b-roll/v1/prefs` pattern
 * (nonce-gated, logged-in users only, writes to user_meta). Keeping
 * the route under its own namespace makes it easy to split the plugin
 * out of this repo later without colliding with b-roll's routes.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', function () {

	register_rest_route(
		'b-roll-icons/v1',
		'/prefs',
		array(
			array(
				'methods'             => 'GET',
				'permission_callback' => function () {
					return is_user_logged_in();
				},
				'callback'            => function () {
					$sets = array();
					foreach ( b_roll_icons_get_sets() as $slug => $set ) {
						$sets[] = array(
							'slug'        => $set['slug'],
							'label'       => $set['label'],
							'franchise'   => $set['franchise'],
							'accent'      => $set['accent'],
							'description' => $set['description'],
							'preview'     => $set['preview'],
							'icons'       => $set['icons'],
						);
					}
					return array(
						'active' => b_roll_icons_get_active_slug(),
						'sets'   => $sets,
					);
				},
			),
			array(
				'methods'             => 'POST',
				'permission_callback' => function () {
					return is_user_logged_in();
				},
				'args'                => array(
					'set' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
				'callback'            => function ( $req ) {
					$slug = (string) $req->get_param( 'set' );
					$ok   = b_roll_icons_set_active_slug( $slug );
					if ( ! $ok ) {
						return new WP_Error(
							'b_roll_icons_invalid_set',
							__( 'Unknown icon set.', 'b-roll-icons' ),
							array( 'status' => 400 )
						);
					}
					return array(
						'ok'     => true,
						'active' => b_roll_icons_get_active_slug(),
					);
				},
			),
		)
	);
} );
