<?php
/**
 * ODD cursors — active set stylesheet endpoint.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'odd/v1',
			'/cursors/active\.css',
			array(
				'methods'             => 'GET',
				'callback'            => 'odd_cursors_rest_active_css',
				'permission_callback' => '__return_true',
			)
		);
	}
);

function odd_cursors_css_url_value( array $cursor, $fallback ) {
	$url     = isset( $cursor['url'] ) ? esc_url_raw( (string) $cursor['url'] ) : '';
	$hotspot = isset( $cursor['hotspot'] ) && is_array( $cursor['hotspot'] ) ? array_values( $cursor['hotspot'] ) : array( 0, 0 );
	$x       = isset( $hotspot[0] ) ? (int) $hotspot[0] : 0;
	$y       = isset( $hotspot[1] ) ? (int) $hotspot[1] : 0;
	if ( '' === $url ) {
		return $fallback;
	}
	$url = set_url_scheme( $url );
	return sprintf( 'url("%s") %d %d, %s', esc_url_raw( $url ), $x, $y, $fallback );
}

function odd_cursors_css_cursor( array $set, $kind, $fallback ) {
	$cursors = isset( $set['cursors'] ) && is_array( $set['cursors'] ) ? $set['cursors'] : array();
	if ( isset( $cursors[ $kind ] ) && is_array( $cursors[ $kind ] ) ) {
		return odd_cursors_css_url_value( $cursors[ $kind ], $fallback );
	}
	if ( 'default' !== $kind && isset( $cursors['default'] ) && is_array( $cursors['default'] ) ) {
		return odd_cursors_css_url_value( $cursors['default'], $fallback );
	}
	return $fallback;
}

function odd_cursors_build_css( array $set ) {
	$default     = odd_cursors_css_cursor( $set, 'default', 'default' );
	$pointer     = odd_cursors_css_cursor( $set, 'pointer', 'pointer' );
	$text        = odd_cursors_css_cursor( $set, 'text', 'text' );
	$grab        = odd_cursors_css_cursor( $set, 'grab', 'grab' );
	$grabbing    = odd_cursors_css_cursor( $set, 'grabbing', 'grabbing' );
	$crosshair   = odd_cursors_css_cursor( $set, 'crosshair', 'crosshair' );
	$not_allowed = odd_cursors_css_cursor( $set, 'not-allowed', 'not-allowed' );
	$wait        = odd_cursors_css_cursor( $set, 'wait', 'wait' );
	$help        = odd_cursors_css_cursor( $set, 'help', 'help' );
	$progress    = odd_cursors_css_cursor( $set, 'progress', 'progress' );

	return implode(
		"\n",
		array(
			'/* ODD custom cursors: ' . ( isset( $set['slug'] ) ? sanitize_key( (string) $set['slug'] ) : 'active' ) . ' */',
			'html, body { cursor: ' . $default . ' !important; }',
			'a, button, .button, [role="button"], [tabindex]:not([tabindex="-1"]), summary, label[for], input[type="button"], input[type="submit"], input[type="reset"], select { cursor: ' . $pointer . '; }',
			'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"], [contenteditable=""], .CodeMirror, .components-text-control__input { cursor: ' . $text . '; }',
			'[draggable="true"], [data-drag], .ui-sortable-handle, .components-draggable { cursor: ' . $grab . '; }',
			'body.is-dragging, body.odd-is-dragging, .is-dragging, [aria-grabbed="true"] { cursor: ' . $grabbing . '; }',
			'[data-cursor="crosshair"], .components-color-picker, .components-circular-option-picker__option { cursor: ' . $crosshair . '; }',
			':disabled, [disabled], [aria-disabled="true"], .disabled, .is-disabled { cursor: ' . $not_allowed . '; }',
			'body.is-busy, body.odd-is-busy, .is-busy, .updating-message { cursor: ' . $progress . '; }',
			'body.odd-is-waiting, .odd-is-waiting { cursor: ' . $wait . '; }',
			'[data-cursor="help"], abbr[title], .help, .dashicons-editor-help { cursor: ' . $help . '; }',
			'',
		)
	);
}

function odd_cursors_rest_active_css( WP_REST_Request $request ) {
	$slug = $request->get_param( 'set' );
	$slug = is_string( $slug ) ? sanitize_key( $slug ) : odd_cursors_get_active_slug();
	$set  = '' === $slug ? null : odd_cursors_get_set( $slug );
	$css  = $set ? odd_cursors_build_css( $set ) : '';
	$etag = '"' . md5( ( defined( 'ODD_VERSION' ) ? ODD_VERSION : '0' ) . '|' . $slug . '|' . $css ) . '"';

	while ( ob_get_level() > 0 ) {
		@ob_end_clean();
	}

	header( 'Content-Type: text/css; charset=UTF-8' );
	header( 'Cache-Control: private, max-age=300, must-revalidate' );
	header( 'ETag: ' . $etag );
	header( 'X-Content-Type-Options: nosniff' );
	if ( isset( $_SERVER['HTTP_IF_NONE_MATCH'] ) && trim( (string) $_SERVER['HTTP_IF_NONE_MATCH'] ) === $etag ) {
		status_header( 304 );
		exit;
	}
	echo $css; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CSS generated from validated URLs and integer hotspots.
	exit;
}
