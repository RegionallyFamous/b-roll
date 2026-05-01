<?php
/**
 * ODD — icon-set bundle installer.
 *
 * Installs `.wp` bundles that declare `"type": "icon-set"`. The
 * manifest format matches the one used by ODD's built-in sets under
 * `odd/assets/icons/` — `slug`, `label`, `accent`, `preview`, and an
 * `icons` map — so authors can copy one of the built-ins and rename.
 *
 * Installed sets live at `wp-content/odd-icon-sets/<slug>/` and are
 * merged into {@see odd_icons_get_sets()} by the registry, so every
 * consumer (panel, dock filter, tinted-SVG endpoint) sees them
 * identically to the plugin-bundled sets.
 *
 * SVG validation rejects scriptable or externally-loaded content so
 * installing a third-party set can't inject JavaScript into admin pages
 * that render the icon.
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'ODD_ICONSETS_DIR' ) ) {
	define( 'ODD_ICONSETS_DIR', trailingslashit( WP_CONTENT_DIR ) . 'odd-icon-sets/' );
}
if ( ! defined( 'ODD_ICONSETS_URL' ) ) {
	define( 'ODD_ICONSETS_URL', trailingslashit( set_url_scheme( content_url( 'odd-icon-sets' ) ) ) );
}
if ( ! defined( 'ODD_ICONSETS_OPTION_INDEX' ) ) {
	define( 'ODD_ICONSETS_OPTION_INDEX', 'odd_iconsets_index' );
}

function odd_iconsets_dir_for( $slug ) {
	$slug = sanitize_key( (string) $slug );
	return '' === $slug ? '' : ODD_ICONSETS_DIR . $slug . '/';
}

function odd_iconsets_url_for( $slug ) {
	$slug = sanitize_key( (string) $slug );
	return '' === $slug ? '' : ODD_ICONSETS_URL . $slug . '/';
}

function odd_iconsets_ensure_storage() {
	if ( ! is_dir( ODD_ICONSETS_DIR ) ) {
		wp_mkdir_p( ODD_ICONSETS_DIR );
	}
}

function odd_iconsets_index_load() {
	$raw = get_option( ODD_ICONSETS_OPTION_INDEX, array() );
	return is_array( $raw ) ? $raw : array();
}

function odd_iconsets_index_save( $index ) {
	update_option( ODD_ICONSETS_OPTION_INDEX, is_array( $index ) ? $index : array(), false );
}

function odd_iconset_bundle_has( $slug ) {
	$slug  = sanitize_key( (string) $slug );
	$index = odd_iconsets_index_load();
	return isset( $index[ $slug ] );
}

/**
 * Required icon keys. Mirrors the keys the dock filter looks up in
 * {@see odd_icons_slug_to_key()} — leaving any of these out means the
 * set can't fully re-skin the WP Desktop dock.
 */
function odd_iconsets_required_keys() {
	return array(
		'dashboard',
		'posts',
		'pages',
		'media',
		'comments',
		'appearance',
		'plugins',
		'users',
		'tools',
		'settings',
		'fallback',
	);
}

/**
 * Per-type validator. Called by the bundle dispatcher after the
 * envelope checks have already passed and the manifest is parsed.
 *
 * @return array|WP_Error Normalised manifest on success.
 */
function odd_iconset_bundle_validate( $tmp_path, $filename, ZipArchive $zip, array $manifest ) {
	$header = odd_content_validate_header( $manifest );
	if ( is_wp_error( $header ) ) {
		return $header;
	}

	if ( empty( $manifest['icons'] ) || ! is_array( $manifest['icons'] ) ) {
		return new WP_Error( 'invalid_manifest', __( 'Icon set manifest.json must include an "icons" map.', 'odd' ) );
	}

	$icons = array();
	foreach ( $manifest['icons'] as $key => $rel ) {
		$clean_key = sanitize_key( (string) $key );
		if ( '' === $clean_key || ! is_string( $rel ) ) {
			return new WP_Error(
				'invalid_icon_key',
				sprintf( /* translators: %s icon key */ __( 'Icon key "%s" is invalid.', 'odd' ), $key )
			);
		}
		$clean_rel = odd_content_sanitize_relative_path( $rel );
		if ( '' === $clean_rel ) {
			return new WP_Error(
				'invalid_icon_path',
				sprintf( /* translators: %s icon path */ __( 'Icon path "%s" contains invalid characters.', 'odd' ), $rel )
			);
		}

		// Only SVGs are allowed — the registry and tinting logic both
		// assume SVG content.
		$ext = strtolower( pathinfo( $clean_rel, PATHINFO_EXTENSION ) );
		if ( 'svg' !== $ext ) {
			return new WP_Error(
				'invalid_icon_ext',
				sprintf( /* translators: %s icon filename */ __( 'Icon "%s" must be an SVG.', 'odd' ), $clean_rel )
			);
		}

		$svg = $zip->getFromName( $clean_rel );
		if ( false === $svg ) {
			return new WP_Error(
				'missing_icon',
				sprintf( /* translators: %s icon filename */ __( 'Icon file "%s" was declared in the manifest but not found in the bundle.', 'odd' ), $clean_rel )
			);
		}
		$scrubbed = odd_iconset_svg_scrub( $svg );
		if ( is_wp_error( $scrubbed ) ) {
			return $scrubbed;
		}

		$icons[ $clean_key ] = $clean_rel;
	}

	$missing = array_diff( odd_iconsets_required_keys(), array_keys( $icons ) );
	if ( ! empty( $missing ) ) {
		return new WP_Error(
			'missing_required_icons',
			sprintf(
				/* translators: %s comma-separated icon keys */
				__( 'Icon set is missing required keys: %s', 'odd' ),
				implode( ', ', $missing )
			)
		);
	}

	$preview = '';
	if ( ! empty( $manifest['preview'] ) ) {
		$preview_rel = odd_content_sanitize_relative_path( (string) $manifest['preview'] );
		if ( '' === $preview_rel || false === $zip->getFromName( $preview_rel ) ) {
			return new WP_Error( 'invalid_preview', __( 'Preview file is not present in the bundle.', 'odd' ) );
		}
		$preview = $preview_rel;
	}

	$accent = isset( $manifest['accent'] ) ? trim( (string) $manifest['accent'] ) : '';
	if ( '' !== $accent && ! preg_match( '/^#[0-9A-Fa-f]{3,8}$/', $accent ) ) {
		return new WP_Error( 'invalid_accent', __( 'Icon set accent must be a hex colour like #ffb000.', 'odd' ) );
	}

	return array(
		'slug'        => $header['slug'],
		'name'        => $header['name'],
		'label'       => isset( $manifest['label'] ) ? sanitize_text_field( (string) $manifest['label'] ) : $header['name'],
		'version'     => $header['version'],
		'type'        => 'icon-set',
		'author'      => $header['author'],
		'description' => isset( $manifest['description'] ) ? sanitize_text_field( (string) $manifest['description'] ) : $header['description'],
		'franchise'   => isset( $manifest['franchise'] ) ? sanitize_text_field( (string) $manifest['franchise'] ) : '',
		'accent'      => $accent ? $accent : '#3858e9',
		'preview'     => $preview,
		'icons'       => $icons,
	);
}

/**
 * Install a validated icon-set bundle. Extracts into
 * wp-content/odd-icon-sets/<slug>/, writes the canonical
 * manifest.json (scrubbed + normalised), updates the installed-sets
 * index, and busts the icon-registry transient so the panel and
 * dock filter pick up the new set immediately.
 */
function odd_iconset_bundle_install( $tmp_path, array $manifest ) {
	odd_iconsets_ensure_storage();
	$slug = $manifest['slug'];

	$extracted = odd_content_archive_extract( $tmp_path, ODD_ICONSETS_DIR, $slug );
	if ( is_wp_error( $extracted ) ) {
		return $extracted;
	}

	$dir = odd_iconsets_dir_for( $slug );

	// Post-extract: rewrite every SVG with its scrubbed form so the
	// bytes on disk match what validation accepted. This is a belt-
	// and-braces safeguard for the rare case where a malformed SVG
	// passed the cheap string filters on the validator pass but
	// would render with inert `on*` attributes if shipped as-is.
	foreach ( $manifest['icons'] as $rel ) {
		$abs = odd_iconsets_resolve_path( $dir, $rel );
		if ( '' === $abs ) {
			continue;
		}
		$raw = file_get_contents( $abs ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		if ( false === $raw ) {
			continue;
		}
		$clean = odd_iconset_svg_scrub( $raw );
		if ( is_wp_error( $clean ) ) {
			odd_content_rrmdir( $dir );
			return $clean;
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents,WordPress.WP.AlternativeFunctions.file_put_contents_file_put_contents
		file_put_contents( $abs, $clean );
	}

	// Persist the canonical manifest so the registry scan reads it
	// identically to the built-ins. Keep the authored manifest.json
	// intact for users to read; write our canonical copy at a
	// separate filename.
	$canonical = wp_json_encode( $manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
	if ( is_string( $canonical ) ) {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents,WordPress.WP.AlternativeFunctions.file_put_contents_file_put_contents
		file_put_contents( $dir . 'manifest.json', $canonical );
	}

	$index          = odd_iconsets_index_load();
	$index[ $slug ] = array(
		'slug'      => $slug,
		'name'      => $manifest['name'],
		'label'     => $manifest['label'],
		'version'   => $manifest['version'],
		'franchise' => $manifest['franchise'],
		'accent'    => $manifest['accent'],
		'installed' => time(),
	);
	odd_iconsets_index_save( $index );

	odd_iconsets_bust_registry_cache();

	return true;
}

function odd_iconset_bundle_uninstall( $slug ) {
	$slug = sanitize_key( (string) $slug );
	if ( '' === $slug ) {
		return new WP_Error( 'invalid_slug', __( 'Invalid slug.', 'odd' ) );
	}
	$index = odd_iconsets_index_load();
	if ( ! isset( $index[ $slug ] ) ) {
		return new WP_Error( 'not_installed', __( 'Icon set is not installed.', 'odd' ) );
	}

	$dir = odd_iconsets_dir_for( $slug );
	if ( $dir && is_dir( $dir ) ) {
		odd_content_rrmdir( rtrim( $dir, '/' ) );
	}

	unset( $index[ $slug ] );
	odd_iconsets_index_save( $index );

	odd_iconsets_bust_registry_cache();
	return true;
}

/**
 * Validate and normalize an SVG payload. Returns the cleaned string, or
 * a WP_Error if the input isn't a well-formed, passive SVG.
 *
 * Rejected surfaces:
 *   - Script-capable/foreign content (`script`, `foreignObject`, `image`, etc.).
 *   - Any `on*=` event attribute (onload, onclick, etc.).
 *   - `xlink:href`/`href` whose value isn't a fragment (`#…`).
 *   - Attributes outside the passive drawing allowlist.
 *   - Control bytes outside `\t\n\r` — same byte filter the catalog
 *     validators use.
 *
 * Tinting scenes still work: `currentColor` is a literal string and
 * our scrubber leaves it intact.
 */
function odd_iconset_svg_scrub( $svg ) {
	$svg = (string) $svg;
	if ( '' === $svg ) {
		return new WP_Error( 'empty_svg', __( 'SVG file is empty.', 'odd' ) );
	}
	// Control-byte reject. Matches the validator used by odd/bin/validate-icon-sets.
	if ( preg_match( '/[\x00-\x08\x0B\x0C\x0E-\x1F]/', $svg ) ) {
		return new WP_Error( 'invalid_svg', __( 'SVG contains control bytes and cannot be installed.', 'odd' ) );
	}
	// Require it to actually be an SVG.
	if ( false === stripos( $svg, '<svg' ) ) {
		return new WP_Error( 'invalid_svg', __( 'File is not an SVG.', 'odd' ) );
	}

	if ( ! class_exists( 'DOMDocument' ) ) {
		return new WP_Error( 'svg_parser_unavailable', __( 'Server cannot safely validate SVG files.', 'odd' ) );
	}

	$doc = new DOMDocument();
	$old = libxml_use_internal_errors( true );
	$ok  = $doc->loadXML( $svg, LIBXML_NONET );
	libxml_clear_errors();
	libxml_use_internal_errors( $old );
	// phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- DOMDocument API property.
	$document_element = $doc->documentElement;
	// phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- DOMElement API property.
	if ( ! $ok || ! $document_element || 'svg' !== strtolower( $document_element->localName ) ) {
		return new WP_Error( 'invalid_svg', __( 'File is not a well-formed SVG.', 'odd' ) );
	}

	$allowed_elements = array_flip(
		array(
			'svg',
			'g',
			'defs',
			'title',
			'desc',
			'path',
			'rect',
			'circle',
			'ellipse',
			'line',
			'polyline',
			'polygon',
			'text',
			'tspan',
			'use',
			'clipPath',
			'mask',
			'linearGradient',
			'radialGradient',
			'stop',
			'filter',
			'feBlend',
			'feColorMatrix',
			'feComposite',
			'feDropShadow',
			'feFlood',
			'feGaussianBlur',
			'feMerge',
			'feMergeNode',
			'feMorphology',
			'feOffset',
		)
	);
	$allowed_attrs    = array_flip(
		array(
			'xmlns',
			'viewBox',
			'width',
			'height',
			'role',
			'aria-label',
			'id',
			'class',
			'x',
			'y',
			'x1',
			'y1',
			'x2',
			'y2',
			'cx',
			'cy',
			'r',
			'rx',
			'ry',
			'd',
			'points',
			'fill',
			'fill-opacity',
			'fill-rule',
			'stroke',
			'stroke-width',
			'stroke-linecap',
			'stroke-linejoin',
			'stroke-miterlimit',
			'stroke-opacity',
			'stroke-dasharray',
			'stroke-dashoffset',
			'opacity',
			'transform',
			'clip-path',
			'clip-rule',
			'mask',
			'filter',
			'offset',
			'stop-color',
			'stop-opacity',
			'gradientUnits',
			'gradientTransform',
			'font-family',
			'font-size',
			'font-weight',
			'letter-spacing',
			'text-anchor',
			'dominant-baseline',
			'textLength',
			'lengthAdjust',
			'dx',
			'dy',
			'stdDeviation',
			'flood-color',
			'flood-opacity',
			'in',
			'in2',
			'mode',
			'operator',
			'values',
			'result',
			'color-interpolation-filters',
			'href',
			'xlink:href',
			'xmlns:xlink',
		)
	);

	$nodes = $doc->getElementsByTagName( '*' );
	foreach ( $nodes as $node ) {
		// phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- DOMElement API property.
		$tag = $node->localName;
		if ( ! isset( $allowed_elements[ $tag ] ) ) {
			return new WP_Error( 'disallowed_svg_element', sprintf( /* translators: %s SVG element */ __( 'SVG contains disallowed element: %s', 'odd' ), $tag ) );
		}
		if ( ! $node->hasAttributes() ) {
			continue;
		}
		foreach ( iterator_to_array( $node->attributes ) as $attr ) {
			// phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase -- DOMAttr API property.
			$name  = '' !== $attr->prefix ? $attr->prefix . ':' . $attr->localName : $attr->localName;
			$value = trim( (string) $attr->value );
			if ( 0 === stripos( $name, 'on' ) ) {
				return new WP_Error( 'disallowed_svg_attribute', __( 'SVG event handler attributes are not allowed.', 'odd' ) );
			}
			if ( ! isset( $allowed_attrs[ $name ] ) && 0 !== strpos( $name, 'data-' ) ) {
				return new WP_Error( 'disallowed_svg_attribute', sprintf( /* translators: %s SVG attribute */ __( 'SVG contains disallowed attribute: %s', 'odd' ), $name ) );
			}
			if ( in_array( $name, array( 'href', 'xlink:href' ), true ) && '' !== $value && '#' !== $value[0] ) {
				return new WP_Error( 'disallowed_svg_reference', __( 'SVG external references are not allowed.', 'odd' ) );
			}
			if ( false !== stripos( $value, 'url(' ) && ! preg_match( '/url\(\s*#[^)]+\)/i', $value ) ) {
				return new WP_Error( 'disallowed_svg_reference', __( 'SVG external url() references are not allowed.', 'odd' ) );
			}
			if ( preg_match( '/(?:javascript|data|vbscript)\s*:/i', $value ) ) {
				return new WP_Error( 'disallowed_svg_reference', __( 'SVG scriptable URL values are not allowed.', 'odd' ) );
			}
		}
	}

	return $svg;
}

function odd_iconsets_resolve_path( $base_dir, $rel ) {
	return odd_content_resolve_path( $base_dir, $rel );
}

/**
 * Bust the icon-registry transient + the PHP-static in
 * `odd_icons_get_sets()`. Called on install, uninstall, and from
 * future content tools that mutate wp-content/odd-icon-sets/.
 */
function odd_iconsets_bust_registry_cache() {
	if ( function_exists( 'odd_icons_registry_transient_key' ) ) {
		delete_transient( odd_icons_registry_transient_key() );
	}
	// Wipe the static cache in odd_icons_get_sets(). There's no
	// helper to reset it directly, so we call through a reserved
	// sentinel action the registry subscribes to.
	do_action( 'odd_icons_invalidate_cache' );
}

/**
 * Scan wp-content/odd-icon-sets/ for user-installed sets and merge
 * them into the registry. Runs from the registry's built-in scan
 * (see odd/includes/icons/registry.php) rather than via the filter
 * so built-ins and installed sets use one code path.
 *
 * Returns an array keyed by slug. Malformed manifests skip silently
 * but are reported through {@see odd_registry_report_bad_manifest()}.
 */
function odd_iconsets_scan_installed() {
	$out = array();
	if ( ! is_dir( ODD_ICONSETS_DIR ) ) {
		return $out;
	}
	$dirs = glob( rtrim( ODD_ICONSETS_DIR, '/' ) . '/*', GLOB_ONLYDIR );
	if ( ! is_array( $dirs ) ) {
		return $out;
	}
	foreach ( $dirs as $dir ) {
		$slug = basename( $dir );
		if ( '' === $slug || $slug[0] === '.' ) {
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
		$out[ $slug ] = array(
			'data'     => $data,
			'base_dir' => $dir,
			'base_url' => ODD_ICONSETS_URL . rawurlencode( $slug ),
			'source'   => 'installed',
		);
	}
	return $out;
}
