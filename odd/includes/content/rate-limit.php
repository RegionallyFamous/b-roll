<?php
/**
 * ODD — per-user rate limits for heavy bundle operations.
 *
 * Counts requests per UTC minute bucket. Defaults are generous for
 * normal dev / shop use but cap abuse of upload + catalog install.
 */

defined( 'ABSPATH' ) || exit;

/**
 * @param string $action e.g. 'bundle_upload' | 'bundle_catalog_install'.
 * @return true|WP_Error
 */
function odd_bundle_rate_limit_check( $action ) {
	$action = (string) $action;
	if ( '' === $action ) {
		return true;
	}

	$uid = (int) get_current_user_id();
	if ( $uid < 1 ) {
		return true;
	}

	$defaults = array(
		'bundle_upload'          => 10,
		'bundle_catalog_install' => 10,
	);
	$max      = (int) apply_filters( 'odd_bundle_rate_limit_max', $defaults[ $action ] ?? 20, $action, $uid );
	if ( $max < 1 ) {
		return true;
	}

	$bucket = (int) floor( time() / 60 );
	$key    = 'odd_rl_v2_' . $action . '_' . $uid . '_' . $bucket;
	$count  = (int) get_transient( $key );
	if ( $count >= $max ) {
		return new WP_Error(
			'rest_too_many_requests',
			__( 'Too many requests. Please wait a minute and try again.', 'odd' ),
			array( 'status' => 429 )
		);
	}

	set_transient( $key, $count + 1, 120 );
	return true;
}
