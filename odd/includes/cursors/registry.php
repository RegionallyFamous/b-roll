<?php
/**
 * ODD cursors — set registry + active preference.
 *
 * Cursor sets mirror icon sets: a manifest.json plus SVG assets can be
 * shipped by the remote catalog, installed under wp-content, and selected
 * per user. The selected set is rendered as CSS by css-endpoint.php.
 */

defined( 'ABSPATH' ) || exit;

function odd_cursors_resolve_set_path( $set_dir, $rel ) {
	$rel = (string) $rel;
	if ( '' === $rel || false !== strpos( $rel, "\0" ) || false !== strpos( $rel, '..' ) || false !== strpos( $rel, '\\' ) ) {
		return '';
	}
	$rel = ltrim( $rel, '/' );
	if ( '' === $rel || basename( $rel ) !== $rel ) {
		return '';
	}

	$abs      = $set_dir . '/' . $rel;
	$abs_real = realpath( $abs );
	$dir_real = realpath( $set_dir );
	if ( false === $abs_real || false === $dir_real || 0 !== strpos( $abs_real, $dir_real . DIRECTORY_SEPARATOR ) ) {
		return '';
	}
	return $abs_real;
}

function odd_cursors_registry_transient_key() {
	return 'odd_cursor_registry_v' . ( defined( 'ODD_VERSION' ) ? ODD_VERSION : '0' );
}

add_action(
	'odd_cursors_invalidate_cache',
	function () {
		odd_cursors_get_sets( true );
	}
);

function odd_cursors_allowed_kinds() {
	return array( 'default', 'pointer', 'text', 'grab', 'grabbing', 'crosshair', 'not-allowed', 'wait', 'help', 'progress' );
}

function odd_cursors_get_sets( $reset = false ) {
	static $cache = null;
	if ( $reset ) {
		$cache = null;
		if ( function_exists( 'delete_transient' ) ) {
			delete_transient( odd_cursors_registry_transient_key() );
		}
	}
	if ( null !== $cache ) {
		return $cache;
	}

	$transient_key = odd_cursors_registry_transient_key();
	$persisted     = get_transient( $transient_key );
	if ( is_array( $persisted ) ) {
		$filtered = apply_filters( 'odd_cursor_set_registry', $persisted );
		$cache    = is_array( $filtered ) ? $filtered : $persisted;
		return $cache;
	}

	$sources = array();
	$root    = ODD_DIR . 'assets/cursors';
	if ( is_dir( $root ) ) {
		$dirs = glob( $root . '/*', GLOB_ONLYDIR );
		if ( is_array( $dirs ) ) {
			foreach ( $dirs as $dir ) {
				$slug = basename( $dir );
				if ( '' === $slug || '.' === $slug[0] ) {
					continue;
				}
				$manifest_path = $dir . '/manifest.json';
				if ( ! is_readable( $manifest_path ) ) {
					continue;
				}
				$raw  = file_get_contents( $manifest_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
				$data = is_string( $raw ) ? json_decode( $raw, true ) : null;
				if ( ! is_array( $data ) ) {
					if ( function_exists( 'odd_registry_report_bad_manifest' ) ) {
						odd_registry_report_bad_manifest( $manifest_path, json_last_error_msg() );
					}
					continue;
				}
				$sources[ $slug ] = array(
					'data'     => $data,
					'base_dir' => $dir,
					'base_url' => ODD_URL . '/assets/cursors/' . rawurlencode( $slug ),
					'source'   => 'plugin',
				);
			}
		}
	}

	if ( function_exists( 'odd_cursorsets_scan_installed' ) ) {
		foreach ( odd_cursorsets_scan_installed() as $slug => $entry ) {
			$sources[ $slug ] = $entry;
		}
	}

	$cache   = array();
	$allowed = odd_cursors_allowed_kinds();
	foreach ( $sources as $slug => $entry ) {
		$data     = $entry['data'];
		$base_dir = $entry['base_dir'];
		$base_url = $entry['base_url'];
		$cursors  = array();
		if ( isset( $data['cursors'] ) && is_array( $data['cursors'] ) ) {
			foreach ( $data['cursors'] as $kind => $def ) {
				$kind = sanitize_key( (string) $kind );
				if ( ! in_array( $kind, $allowed, true ) || ! is_array( $def ) ) {
					continue;
				}
				$file = isset( $def['file'] ) ? (string) $def['file'] : '';
				$abs  = odd_cursors_resolve_set_path( $base_dir, $file );
				if ( '' === $abs || ! is_readable( $abs ) ) {
					continue;
				}
				$hotspot          = isset( $def['hotspot'] ) && is_array( $def['hotspot'] ) ? array_values( $def['hotspot'] ) : array( 0, 0 );
				$x                = isset( $hotspot[0] ) ? max( 0, min( 128, (int) $hotspot[0] ) ) : 0;
				$y                = isset( $hotspot[1] ) ? max( 0, min( 128, (int) $hotspot[1] ) ) : 0;
				$cursors[ $kind ] = array(
					'file'    => basename( $abs ),
					'url'     => $base_url . '/' . rawurlencode( basename( $abs ) ),
					'hotspot' => array( $x, $y ),
				);
			}
		}
		if ( empty( $cursors['default'] ) ) {
			continue;
		}
		$preview = '';
		if ( ! empty( $data['preview'] ) ) {
			$preview_abs = odd_cursors_resolve_set_path( $base_dir, (string) $data['preview'] );
			if ( '' !== $preview_abs && is_readable( $preview_abs ) ) {
				$preview = $base_url . '/' . rawurlencode( basename( $preview_abs ) );
			}
		}
		$cache[ $slug ] = array(
			'slug'        => $slug,
			'label'       => isset( $data['label'] ) ? (string) $data['label'] : $slug,
			'franchise'   => isset( $data['franchise'] ) ? (string) $data['franchise'] : '',
			'accent'      => isset( $data['accent'] ) ? (string) $data['accent'] : '#38e8ff',
			'description' => isset( $data['description'] ) ? (string) $data['description'] : '',
			'version'     => isset( $data['version'] ) ? (string) $data['version'] : '',
			'preview'     => $preview,
			'cursors'     => $cursors,
			'source'      => $entry['source'],
		);
	}

	set_transient( $transient_key, $cache, DAY_IN_SECONDS );

	$filtered = apply_filters( 'odd_cursor_set_registry', $cache );
	if ( is_array( $filtered ) ) {
		$cache = $filtered;
	}
	return $cache;
}

function odd_cursors_get_set( $slug ) {
	$sets = odd_cursors_get_sets();
	return isset( $sets[ $slug ] ) ? $sets[ $slug ] : null;
}

function odd_cursors_get_active_slug( $user_id = 0 ) {
	$user_id = $user_id ? (int) $user_id : get_current_user_id();
	if ( $user_id > 0 ) {
		$saved = get_user_meta( $user_id, 'odd_cursor_set', true );
		if ( is_string( $saved ) && '' !== $saved ) {
			if ( 'none' === $saved ) {
				return '';
			}
			if ( odd_cursors_get_set( $saved ) ) {
				return $saved;
			}
		}
	}

	$default = (string) apply_filters( 'odd_cursors_default_slug', '' );
	return ( '' !== $default && odd_cursors_get_set( $default ) ) ? $default : '';
}

function odd_cursors_set_active_slug( $slug, $user_id = 0 ) {
	$user_id = $user_id ? (int) $user_id : get_current_user_id();
	if ( $user_id <= 0 ) {
		return false;
	}
	$slug = (string) $slug;
	if ( 'none' === $slug || '' === $slug ) {
		return (bool) update_user_meta( $user_id, 'odd_cursor_set', 'none' );
	}
	if ( ! odd_cursors_get_set( $slug ) ) {
		return false;
	}
	return (bool) update_user_meta( $user_id, 'odd_cursor_set', $slug );
}

function odd_cursors_request_uses_https() {
	if ( is_ssl() ) {
		return true;
	}

	$forwarded = isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) ? strtolower( (string) wp_unslash( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) ) : '';
	if ( preg_match( '/(^|,\s*)https(\s*,|$)/', $forwarded ) ) {
		return true;
	}

	$https = isset( $_SERVER['HTTPS'] ) ? strtolower( (string) wp_unslash( $_SERVER['HTTPS'] ) ) : '';
	if ( in_array( $https, array( 'on', '1', 'https' ), true ) ) {
		return true;
	}

	$port = isset( $_SERVER['SERVER_PORT'] ) ? (string) wp_unslash( $_SERVER['SERVER_PORT'] ) : '';
	if ( '443' === $port ) {
		return true;
	}

	$host = isset( $_SERVER['HTTP_HOST'] ) ? strtolower( (string) wp_unslash( $_SERVER['HTTP_HOST'] ) ) : '';
	$host = preg_replace( '/:\d+$/', '', $host );
	return 'playground.wordpress.net' === $host || '.playground.wordpress.net' === substr( $host, -25 );
}

function odd_cursors_url_current_scheme( $url ) {
	$url = (string) $url;
	if ( '' === $url ) {
		return '';
	}
	$parts = wp_parse_url( $url );
	if ( ! is_array( $parts ) || ! isset( $parts['scheme'] ) || 'http' !== strtolower( (string) $parts['scheme'] ) ) {
		return $url;
	}
	return odd_cursors_request_uses_https() ? set_url_scheme( $url, 'https' ) : $url;
}

function odd_cursors_active_stylesheet_url( $slug = null ) {
	$slug = null === $slug ? odd_cursors_get_active_slug() : sanitize_key( (string) $slug );
	$args = array(
		'v' => ( defined( 'ODD_VERSION' ) ? ODD_VERSION : '0' ) . '-' . ( '' === $slug ? 'none' : $slug ),
	);
	if ( '' !== $slug ) {
		$args['set'] = $slug;
	}
	return esc_url_raw( odd_cursors_url_current_scheme( add_query_arg( $args, rest_url( 'odd/v1/cursors/active.css' ) ) ) );
}
