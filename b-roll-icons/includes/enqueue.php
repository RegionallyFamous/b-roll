<?php
/**
 * B-Roll Icons — enqueue the picker shell JS + CSS.
 *
 * Only loads when WP Desktop Mode is active (same guard pattern the
 * sibling b-roll plugin uses in b-roll.php). The picker is a small
 * vanilla-DOM floating pill — no Pixi, no build step, no deps. It
 * renders a single button in the bottom-right of the shell and opens
 * a popover listing the installed sets.
 *
 * If b-roll is also active, the pill slides to sit left of b-roll's
 * gear so they don't stack on top of each other. Both plugins check
 * for the other's DOM sentinel (`data-b-roll-gear`, `data-b-roll-icons-pill`)
 * and nudge accordingly; if only one is active, it takes the slot.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'wp_desktop_mode_init', function () {
	if ( ! function_exists( 'wpdm_is_enabled' ) ) {
		return;
	}

	wp_enqueue_script(
		'b-roll-icons',
		plugins_url( 'src/picker.js', dirname( __FILE__ ) ),
		array( 'wp-desktop' ),
		B_ROLL_ICONS_VERSION,
		true
	);

	$uid = get_current_user_id();

	$sets = array();
	foreach ( b_roll_icons_get_sets() as $set ) {
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

	wp_localize_script(
		'b-roll-icons',
		'bRollIcons',
		array(
			'pluginUrl'   => B_ROLL_ICONS_URL,
			'version'     => B_ROLL_ICONS_VERSION,
			'restUrl'     => esc_url_raw( rest_url( 'b-roll-icons/v1/prefs' ) ),
			'restNonce'   => wp_create_nonce( 'wp_rest' ),
			'active'      => b_roll_icons_get_active_slug( $uid ),
			'sets'        => $sets,
		)
	);
} );
