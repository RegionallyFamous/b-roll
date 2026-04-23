/**
 * B-Roll for WP Desktop Mode — polished v0.2
 * ---------------------------------------------------------------
 * A pack of pop-culture PixiJS wallpapers. Each scene registers
 * itself with wp.desktop.registerWallpaper under a b-roll/<slug>
 * id. Scenes respect prefersReducedMotion, subscribe to the shell's
 * wp-desktop.wallpaper.visibility action to pause when hidden, and
 * fully release GL resources on teardown.
 *
 * This build adds:
 *   - Per-scene SVG preview swatches (not generic gradients)
 *   - Cheap bloom via core BlurFilter + additive blending
 *   - More density, more motion, more characteristic motifs per scene
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	// ================================================================ //
	// Shared helpers
	// ================================================================ //

	var rand   = function ( a, b ) { return a + Math.random() * ( b - a ); };
	var irand  = function ( a, b ) { return ( a + Math.random() * ( b - a ) ) | 0; };
	var choose = function ( arr ) { return arr[ ( Math.random() * arr.length ) | 0 ]; };
	var clamp  = function ( v, a, b ) { return v < a ? a : v > b ? b : v; };
	var tau    = Math.PI * 2;
	var phi    = ( 1 + Math.sqrt( 5 ) ) / 2;

	function lerpColor( a, b, t ) {
		var ar = ( a >> 16 ) & 0xff, ag = ( a >> 8 ) & 0xff, ab = a & 0xff;
		var br = ( b >> 16 ) & 0xff, bg = ( b >> 8 ) & 0xff, bb = b & 0xff;
		return ( ( ar + ( br - ar ) * t ) | 0 ) << 16
		     | ( ( ag + ( bg - ag ) * t ) | 0 ) << 8
		     | ( ( ab + ( bb - ab ) * t ) | 0 );
	}

	function paintVGradient( g, w, h, c0, c1, steps ) {
		steps = steps || 24;
		g.clear();
		for ( var i = 0; i < steps; i++ ) {
			var t = i / ( steps - 1 );
			g.rect( 0, ( i * h ) / steps, w, h / steps + 1 )
				.fill( lerpColor( c0, c1, t ) );
		}
	}

	function paintRadial( g, w, h, cx, cy, r, c0, c1, steps ) {
		steps = steps || 18;
		g.clear();
		for ( var i = steps - 1; i >= 0; i-- ) {
			var t = i / ( steps - 1 );
			g.circle( cx, cy, r * ( i + 1 ) / steps )
				.fill( { color: lerpColor( c1, c0, t ), alpha: 1 - t * 0.6 } );
		}
	}

	// Cheap bloom helper: apply a BlurFilter + additive blend to a container.
	// The caller draws the "bright" content into the returned container and
	// then draws the crisp content on top in the main layer.
	function makeBloomLayer( PIXI, strength ) {
		var c = new PIXI.Container();
		c.blendMode = 'add';
		c.filters = [ new PIXI.BlurFilter( { strength: strength || 8, quality: 2 } ) ];
		return c;
	}

	// Convert inline SVG to a data URL for use as the wallpaper swatch.
	function svgDataUrl( markup ) {
		return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent( markup );
	}

	// ================================================================ //
	// Preview SVGs — one per scene, ~120x80 viewBox.
	// ================================================================ //

	var PREVIEWS = {};

	PREVIEWS[ 'code-rain' ] = svgDataUrl(
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' preserveAspectRatio='xMidYMid slice'>" +
			"<rect width='120' height='80' fill='#000'/>" +
			"<g font-family='ui-monospace,monospace' font-size='9' text-anchor='middle'>" +
				// Column 1
				"<text x='16' y='16' fill='#003a18'>ア</text>" +
				"<text x='16' y='28' fill='#006b2b'>カ</text>" +
				"<text x='16' y='40' fill='#00a43f'>ミ</text>" +
				"<text x='16' y='52' fill='#00ff66'>W</text>" +
				"<text x='16' y='64' fill='#e2fff0'>ナ</text>" +
				// Column 2
				"<text x='40' y='10' fill='#003a18'>0</text>" +
				"<text x='40' y='22' fill='#006b2b'>1</text>" +
				"<text x='40' y='34' fill='#00a43f'>W</text>" +
				"<text x='40' y='46' fill='#00d452'>サ</text>" +
				"<text x='40' y='58' fill='#e2fff0'>タ</text>" +
				// Column 3
				"<text x='64' y='18' fill='#006b2b'>ヒ</text>" +
				"<text x='64' y='30' fill='#00a43f'>ネ</text>" +
				"<text x='64' y='42' fill='#00d452'>W</text>" +
				"<text x='64' y='54' fill='#00ff66'>ラ</text>" +
				"<text x='64' y='66' fill='#e2fff0'>ホ</text>" +
				// Column 4
				"<text x='88' y='12' fill='#003a18'>W</text>" +
				"<text x='88' y='24' fill='#006b2b'>ヌ</text>" +
				"<text x='88' y='36' fill='#00a43f'>エ</text>" +
				"<text x='88' y='48' fill='#00ff66'>4</text>" +
				"<text x='88' y='60' fill='#e2fff0'>W</text>" +
				// Column 5
				"<text x='108' y='20' fill='#006b2b'>キ</text>" +
				"<text x='108' y='32' fill='#00a43f'>0</text>" +
				"<text x='108' y='44' fill='#00d452'>W</text>" +
				"<text x='108' y='56' fill='#e2fff0'>ム</text>" +
			"</g>" +
		"</svg>"
	);

	PREVIEWS[ 'hyperspace' ] = svgDataUrl(
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' preserveAspectRatio='xMidYMid slice'>" +
			"<defs><radialGradient id='c' cx='0.5' cy='0.5' r='0.5'>" +
				"<stop offset='0' stop-color='#5a8cff' stop-opacity='0.8'/>" +
				"<stop offset='1' stop-color='#000010' stop-opacity='1'/>" +
			"</radialGradient></defs>" +
			"<rect width='120' height='80' fill='#000010'/>" +
			"<rect width='120' height='80' fill='url(#c)' opacity='0.55'/>" +
			"<g stroke='#ffffff' stroke-linecap='round'>" +
				"<line x1='60' y1='40' x2='8'  y2='8'  stroke-width='0.9' opacity='0.95'/>" +
				"<line x1='60' y1='40' x2='20' y2='22' stroke-width='0.7' opacity='0.8'/>" +
				"<line x1='60' y1='40' x2='112' y2='10' stroke-width='1' opacity='0.95'/>" +
				"<line x1='60' y1='40' x2='100' y2='24' stroke-width='0.6' opacity='0.7'/>" +
				"<line x1='60' y1='40' x2='118' y2='50' stroke-width='0.8' opacity='0.85'/>" +
				"<line x1='60' y1='40' x2='96'  y2='64' stroke-width='0.7' opacity='0.8'/>" +
				"<line x1='60' y1='40' x2='60'  y2='74' stroke-width='0.9' opacity='0.9'/>" +
				"<line x1='60' y1='40' x2='30'  y2='70' stroke-width='0.7' opacity='0.8'/>" +
				"<line x1='60' y1='40' x2='6'   y2='56' stroke-width='0.8' opacity='0.85'/>" +
				"<line x1='60' y1='40' x2='16'  y2='34' stroke-width='0.6' opacity='0.7'/>" +
				"<line x1='60' y1='40' x2='40'  y2='18' stroke-width='0.5' opacity='0.6'/>" +
				"<line x1='60' y1='40' x2='78'  y2='14' stroke-width='0.5' opacity='0.6'/>" +
			"</g>" +
			"<circle cx='60' cy='40' r='3' fill='#e0ecff'/>" +
		"</svg>"
	);

	PREVIEWS[ 'neon-rain' ] = svgDataUrl(
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' preserveAspectRatio='xMidYMid slice'>" +
			"<defs><linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>" +
				"<stop offset='0' stop-color='#2a0a28'/>" +
				"<stop offset='1' stop-color='#06040c'/>" +
			"</linearGradient></defs>" +
			"<rect width='120' height='80' fill='url(#sky)'/>" +
			// City silhouette
			"<g fill='#0a070e'>" +
				"<rect x='0' y='48' width='18' height='32'/>" +
				"<rect x='18' y='40' width='14' height='40'/>" +
				"<rect x='32' y='52' width='10' height='28'/>" +
				"<rect x='42' y='32' width='16' height='48'/>" +
				"<rect x='58' y='46' width='12' height='34'/>" +
				"<rect x='70' y='38' width='18' height='42'/>" +
				"<rect x='88' y='50' width='8' height='30'/>" +
				"<rect x='96' y='36' width='14' height='44'/>" +
				"<rect x='110' y='48' width='10' height='32'/>" +
			"</g>" +
			// Lit windows
			"<g fill='#ffcc66'>" +
				"<rect x='22' y='48' width='1.5' height='2' opacity='0.8'/>" +
				"<rect x='26' y='54' width='1.5' height='2' opacity='0.6'/>" +
				"<rect x='46' y='40' width='1.5' height='2' opacity='0.9'/>" +
				"<rect x='50' y='46' width='1.5' height='2' opacity='0.7'/>" +
				"<rect x='74' y='46' width='1.5' height='2' opacity='0.8'/>" +
				"<rect x='100' y='44' width='1.5' height='2' opacity='0.75'/>" +
			"</g>" +
			// Neon sign (glow + crisp)
			"<text x='40' y='24' font-family='Impact,sans-serif' font-size='11' font-weight='bold' fill='#ff4aa0' opacity='0.4' filter='blur(2px)'>TYRELL</text>" +
			"<text x='40' y='24' font-family='Impact,sans-serif' font-size='11' font-weight='bold' fill='#ff4aa0'>TYRELL</text>" +
			"<text x='88' y='14' font-family='Impact,sans-serif' font-size='7' fill='#64d8ff' opacity='0.7'>NEXUS</text>" +
			// Rain
			"<g stroke='#a8c8ff' stroke-width='0.6' opacity='0.7'>" +
				"<line x1='10' y1='4' x2='6' y2='12'/>" +
				"<line x1='22' y1='6' x2='18' y2='14'/>" +
				"<line x1='36' y1='2' x2='32' y2='10'/>" +
				"<line x1='54' y1='8' x2='50' y2='16'/>" +
				"<line x1='70' y1='4' x2='66' y2='12'/>" +
				"<line x1='86' y1='6' x2='82' y2='14'/>" +
				"<line x1='102' y1='2' x2='98' y2='10'/>" +
				"<line x1='16' y1='22' x2='12' y2='30'/>" +
				"<line x1='64' y1='24' x2='60' y2='32'/>" +
				"<line x1='108' y1='26' x2='104' y2='34'/>" +
			"</g>" +
		"</svg>"
	);

	PREVIEWS[ 'tron-grid' ] = svgDataUrl(
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' preserveAspectRatio='xMidYMid slice'>" +
			"<defs><linearGradient id='sk' x1='0' y1='0' x2='0' y2='1'>" +
				"<stop offset='0' stop-color='#001626'/>" +
				"<stop offset='0.55' stop-color='#000810'/>" +
				"<stop offset='1' stop-color='#000'/>" +
			"</linearGradient></defs>" +
			"<rect width='120' height='80' fill='url(#sk)'/>" +
			// Horizon glow
			"<rect x='0' y='40' width='120' height='2' fill='#ff7a1a' opacity='0.95'/>" +
			"<rect x='0' y='38' width='120' height='4' fill='#ff6d1f' opacity='0.35'/>" +
			"<rect x='0' y='42' width='120' height='6' fill='#ff6d1f' opacity='0.2'/>" +
			// Floor horizontal lines
			"<g stroke='#00aaff' fill='none'>" +
				"<line x1='0' y1='46' x2='120' y2='46' stroke-width='0.4' opacity='0.4'/>" +
				"<line x1='0' y1='52' x2='120' y2='52' stroke-width='0.5' opacity='0.55'/>" +
				"<line x1='0' y1='60' x2='120' y2='60' stroke-width='0.6' opacity='0.7'/>" +
				"<line x1='0' y1='70' x2='120' y2='70' stroke-width='0.7' opacity='0.85'/>" +
			"</g>" +
			// Converging verticals
			"<g stroke='#00aaff' fill='none' stroke-width='0.4' opacity='0.5'>" +
				"<line x1='60' y1='42' x2='-10' y2='80'/>" +
				"<line x1='60' y1='42' x2='20' y2='80'/>" +
				"<line x1='60' y1='42' x2='45' y2='80'/>" +
				"<line x1='60' y1='42' x2='60' y2='80'/>" +
				"<line x1='60' y1='42' x2='75' y2='80'/>" +
				"<line x1='60' y1='42' x2='100' y2='80'/>" +
				"<line x1='60' y1='42' x2='130' y2='80'/>" +
			"</g>" +
			// Cycle trail
			"<path d='M 15 78 L 15 64 L 30 64' stroke='#00eaff' stroke-width='1.8' fill='none' opacity='0.95'/>" +
			"<circle cx='30' cy='64' r='1.8' fill='#fff'/>" +
			"<circle cx='30' cy='64' r='3.5' fill='#00eaff' opacity='0.45'/>" +
			// Opposing cycle
			"<path d='M 108 62 L 95 62' stroke='#ff6d1f' stroke-width='1.6' fill='none' opacity='0.9'/>" +
			"<circle cx='95' cy='62' r='1.4' fill='#fff'/>" +
			"<circle cx='95' cy='62' r='3' fill='#ff6d1f' opacity='0.4'/>" +
		"</svg>"
	);

	PREVIEWS[ 'couch-gag' ] = svgDataUrl(
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' preserveAspectRatio='xMidYMid slice'>" +
			"<defs><linearGradient id='sk2' x1='0' y1='0' x2='0' y2='1'>" +
				"<stop offset='0' stop-color='#7ab9f0'/>" +
				"<stop offset='1' stop-color='#c8e4fa'/>" +
			"</linearGradient></defs>" +
			"<rect width='120' height='80' fill='url(#sk2)'/>" +
			// Sun
			"<circle cx='98' cy='16' r='9' fill='#fff2a6'/>" +
			"<circle cx='98' cy='16' r='6' fill='#ffde3a'/>" +
			// Clouds
			"<g fill='#ffffff'>" +
				"<circle cx='20' cy='18' r='7'/><circle cx='28' cy='14' r='6'/>" +
				"<circle cx='34' cy='20' r='7'/><circle cx='24' cy='22' r='6'/>" +
				"<circle cx='60' cy='30' r='5'/><circle cx='66' cy='28' r='6'/>" +
				"<circle cx='70' cy='32' r='5'/>" +
			"</g>" +
			// Couch
			"<g>" +
				"<rect x='36' y='58' width='48' height='14' rx='2' fill='#c36a1e'/>" +
				"<rect x='40' y='54' width='11' height='7' rx='1.5' fill='#e2894a'/>" +
				"<rect x='54' y='54' width='11' height='7' rx='1.5' fill='#e2894a'/>" +
				"<rect x='68' y='54' width='11' height='7' rx='1.5' fill='#e2894a'/>" +
				"<rect x='33' y='56' width='5' height='17' rx='1.5' fill='#8a4812'/>" +
				"<rect x='82' y='56' width='5' height='17' rx='1.5' fill='#8a4812'/>" +
				"<rect x='38' y='72' width='3' height='4' fill='#3d1e08'/>" +
				"<rect x='80' y='72' width='3' height='4' fill='#3d1e08'/>" +
			"</g>" +
		"</svg>"
	);

	PREVIEWS[ 'rainbow-road' ] = svgDataUrl(
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' preserveAspectRatio='xMidYMid slice'>" +
			"<defs><linearGradient id='sp' x1='0' y1='0' x2='0' y2='1'>" +
				"<stop offset='0' stop-color='#0b0024'/>" +
				"<stop offset='1' stop-color='#000'/>" +
			"</linearGradient></defs>" +
			"<rect width='120' height='80' fill='url(#sp)'/>" +
			// stars
			"<g fill='#fff'>" +
				"<circle cx='12' cy='10' r='0.8'/><circle cx='30' cy='6' r='0.6'/>" +
				"<circle cx='46' cy='14' r='0.8'/><circle cx='64' cy='8' r='0.7'/>" +
				"<circle cx='82' cy='12' r='0.6'/><circle cx='100' cy='6' r='0.9'/>" +
				"<circle cx='112' cy='16' r='0.7'/><circle cx='20' cy='22' r='0.5'/>" +
				"<circle cx='90' cy='22' r='0.6'/>" +
			"</g>" +
			// road stripes (perspective)
			"<g>" +
				"<polygon points='56,36 64,36 80,80 40,80' fill='#ff2d5a'/>" +
				"<polygon points='54,38 66,38 84,80 36,80' fill='#ff993d' opacity='0.8'/>" +
				"<polygon points='52,40 68,40 88,80 32,80' fill='#ffe84a' opacity='0.7'/>" +
				"<polygon points='50,42 70,42 92,80 28,80' fill='#31d16a' opacity='0.65'/>" +
				"<polygon points='48,44 72,44 96,80 24,80' fill='#3dc3ff' opacity='0.5'/>" +
				"<polygon points='46,48 74,48 104,80 16,80' fill='#8a5bff' opacity='0.3'/>" +
			"</g>" +
			// centre line
			"<line x1='60' y1='38' x2='60' y2='80' stroke='#fff' stroke-width='1' opacity='0.5'/>" +
			// item box
			"<g transform='translate(88,28) rotate(8)'>" +
				"<rect x='-6' y='-6' width='12' height='12' rx='2' fill='#ff9e1a'/>" +
				"<rect x='-5' y='-5' width='10' height='10' rx='1.5' fill='#ffcc4a'/>" +
				"<text x='0' y='3' font-size='8' font-family='Impact,sans-serif' fill='#fff' text-anchor='middle' stroke='#5b3300' stroke-width='0.6'>?</text>" +
			"</g>" +
		"</svg>"
	);

	PREVIEWS[ 'soot-sprites' ] = svgDataUrl(
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' preserveAspectRatio='xMidYMid slice'>" +
			"<defs><linearGradient id='pg' x1='0' y1='0' x2='0' y2='1'>" +
				"<stop offset='0' stop-color='#ffd7ea'/>" +
				"<stop offset='1' stop-color='#cce7ff'/>" +
			"</linearGradient></defs>" +
			"<rect width='120' height='80' fill='url(#pg)'/>" +
			// fluffy sprites with fringe
			"<g fill='#161616'>" +
				// Sprite 1 (big, left)
				"<circle cx='28' cy='50' r='10'/>" +
				"<circle cx='20' cy='44' r='3'/><circle cx='36' cy='44' r='3'/>" +
				"<circle cx='38' cy='52' r='3'/><circle cx='18' cy='54' r='3'/>" +
				"<circle cx='30' cy='60' r='3'/><circle cx='24' cy='42' r='2.2'/>" +
				// Sprite 2 (medium, center-top)
				"<circle cx='62' cy='30' r='7'/>" +
				"<circle cx='56' cy='26' r='2'/><circle cx='68' cy='26' r='2'/>" +
				"<circle cx='69' cy='33' r='2'/><circle cx='54' cy='33' r='2'/>" +
				// Sprite 3 (medium, center-bottom)
				"<circle cx='72' cy='58' r='8'/>" +
				"<circle cx='65' cy='54' r='2.5'/><circle cx='80' cy='54' r='2.2'/>" +
				"<circle cx='78' cy='63' r='2.5'/><circle cx='66' cy='64' r='2.2'/>" +
				// Sprite 4 (small, right)
				"<circle cx='98' cy='40' r='6'/>" +
				"<circle cx='94' cy='36' r='2'/><circle cx='104' cy='38' r='2'/>" +
				"<circle cx='101' cy='45' r='2'/>" +
			"</g>" +
			// eyes on one sprite
			"<circle cx='24' cy='48' r='1.4' fill='#fff'/>" +
			"<circle cx='32' cy='48' r='1.4' fill='#fff'/>" +
		"</svg>"
	);

	PREVIEWS[ 'upside-down' ] = svgDataUrl(
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' preserveAspectRatio='xMidYMid slice'>" +
			"<defs><radialGradient id='ud' cx='0.5' cy='0.5' r='0.7'>" +
				"<stop offset='0' stop-color='#580820'/>" +
				"<stop offset='0.55' stop-color='#200410'/>" +
				"<stop offset='1' stop-color='#000'/>" +
			"</radialGradient></defs>" +
			"<rect width='120' height='80' fill='url(#ud)'/>" +
			// Tendrils creeping from edges
			"<g stroke='#3a0614' stroke-width='1' fill='none' opacity='0.8'>" +
				"<path d='M 0 10 Q 15 20, 20 36 Q 25 52, 40 60'/>" +
				"<path d='M 120 70 Q 105 62, 100 44 Q 95 26, 80 16'/>" +
				"<path d='M 0 70 Q 10 58, 30 62'/>" +
			"</g>" +
			// Spores
			"<g fill='#ffccdd' opacity='0.85'>" +
				"<circle cx='26' cy='18' r='1'/><circle cx='44' cy='32' r='1.2'/>" +
				"<circle cx='60' cy='22' r='0.8'/><circle cx='72' cy='48' r='1.1'/>" +
				"<circle cx='90' cy='28' r='0.9'/><circle cx='106' cy='54' r='1'/>" +
				"<circle cx='20' cy='60' r='0.8'/><circle cx='50' cy='66' r='1'/>" +
				"<circle cx='82' cy='68' r='0.9'/><circle cx='36' cy='46' r='0.7'/>" +
				"<circle cx='12' cy='40' r='0.8'/><circle cx='100' cy='12' r='0.7'/>" +
			"</g>" +
			// Title card (glitch)
			"<g font-family='Georgia,serif' font-weight='bold' font-size='12' letter-spacing='2'>" +
				"<text x='60' y='46' fill='#64e0ff' text-anchor='middle' opacity='0.55'>CHAPTER</text>" +
				"<text x='60' y='46' fill='#ff2420' text-anchor='middle'>CHAPTER</text>" +
			"</g>" +
		"</svg>"
	);

	PREVIEWS[ 'refinery' ] = svgDataUrl(
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' preserveAspectRatio='xMidYMid slice'>" +
			"<defs><linearGradient id='lg' x1='0' y1='0' x2='0' y2='1'>" +
				"<stop offset='0' stop-color='#e6f0ea'/>" +
				"<stop offset='1' stop-color='#b8cec3'/>" +
			"</linearGradient></defs>" +
			"<rect width='120' height='80' fill='url(#lg)'/>" +
			// Scattered numerals in a soft ring formation
			"<g font-family='ui-monospace,monospace' font-size='8' fill='#0d2d4e' text-anchor='middle'>" +
				// ring cluster centre-left
				"<text x='30' y='30'>7</text><text x='38' y='26'>1</text><text x='46' y='30'>9</text>" +
				"<text x='26' y='38'>4</text><text x='50' y='38'>2</text><text x='30' y='46'>0</text>" +
				"<text x='38' y='50'>5</text><text x='46' y='46'>8</text>" +
				// scattered elsewhere
				"<text x='68' y='16' opacity='0.7'>3</text><text x='82' y='22' opacity='0.6'>6</text>" +
				"<text x='92' y='14' opacity='0.5'>1</text><text x='74' y='40' opacity='0.7'>9</text>" +
				"<text x='88' y='48' opacity='0.8'>2</text><text x='102' y='36' opacity='0.6'>7</text>" +
				"<text x='78' y='60' opacity='0.5'>4</text><text x='66' y='68' opacity='0.7'>0</text>" +
				"<text x='54' y='64' opacity='0.6'>8</text><text x='90' y='66' opacity='0.5'>5</text>" +
			"</g>" +
			// MDR selector box
			"<rect x='24' y='22' width='28' height='32' fill='none' stroke='#0d2d4e' stroke-width='0.8' opacity='0.7'/>" +
			// Lumon mark (bottom right)
			"<g transform='translate(104,68)' stroke='#0d2d4e' fill='none' opacity='0.7'>" +
				"<circle cx='0' cy='0' r='6' stroke-width='0.8'/>" +
				"<circle cx='0' cy='0' r='3.5' stroke-width='0.6'/>" +
				"<line x1='-6' y1='0' x2='6' y2='0' stroke-width='0.4'/>" +
				"<line x1='0' y1='-6' x2='0' y2='6' stroke-width='0.4'/>" +
			"</g>" +
		"</svg>"
	);

	PREVIEWS[ 'shimmer' ] = svgDataUrl(
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' preserveAspectRatio='xMidYMid slice'>" +
			"<defs><linearGradient id='sh' x1='0' y1='0' x2='0' y2='1'>" +
				"<stop offset='0' stop-color='#c29033'/>" +
				"<stop offset='0.35' stop-color='#8a2c5b'/>" +
				"<stop offset='1' stop-color='#16051a'/>" +
			"</linearGradient></defs>" +
			"<rect width='120' height='80' fill='url(#sh)'/>" +
			// Hex outlines
			"<g stroke='#ff7ad0' fill='none' stroke-width='0.5' opacity='0.55'>" +
				"<polygon points='24,40 30,36 36,40 36,46 30,50 24,46'/>" +
				"<polygon points='36,46 42,42 48,46 48,52 42,56 36,52'/>" +
				"<polygon points='48,40 54,36 60,40 60,46 54,50 48,46'/>" +
				"<polygon points='60,46 66,42 72,46 72,52 66,56 60,52'/>" +
				"<polygon points='72,40 78,36 84,40 84,46 78,50 72,46'/>" +
			"</g>" +
			// Zaun buildings silhouette
			"<g fill='#0a0210'>" +
				"<rect x='0' y='62' width='14' height='18'/>" +
				"<rect x='14' y='56' width='12' height='24'/>" +
				"<rect x='26' y='66' width='10' height='14'/>" +
				"<rect x='36' y='60' width='16' height='20'/>" +
				"<rect x='52' y='66' width='8' height='14'/>" +
				"<rect x='60' y='58' width='14' height='22'/>" +
				"<rect x='74' y='62' width='10' height='18'/>" +
				"<rect x='84' y='56' width='14' height='24'/>" +
				"<rect x='98' y='64' width='10' height='16'/>" +
				"<rect x='108' y='60' width='12' height='20'/>" +
			"</g>" +
			// Window lights
			"<g fill='#ff8c5a'>" +
				"<rect x='18' y='62' width='1.5' height='2'/>" +
				"<rect x='42' y='66' width='1.5' height='2'/>" +
				"<rect x='64' y='62' width='1.5' height='2'/>" +
				"<rect x='88' y='62' width='1.5' height='2'/>" +
			"</g>" +
			// Rising particles
			"<g>" +
				"<circle cx='14' cy='48' r='1.4' fill='#ff4ab8' opacity='0.8'/>" +
				"<circle cx='32' cy='30' r='1.2' fill='#ff7cc8' opacity='0.75'/>" +
				"<circle cx='50' cy='22' r='1.5' fill='#ffa4d4' opacity='0.8'/>" +
				"<circle cx='70' cy='30' r='1.3' fill='#ff8ad0' opacity='0.7'/>" +
				"<circle cx='92' cy='20' r='1.5' fill='#ffc6e0' opacity='0.85'/>" +
				"<circle cx='104' cy='34' r='1.2' fill='#ff7cc8' opacity='0.7'/>" +
			"</g>" +
			// Gold glints top
			"<g fill='#ffe08a'>" +
				"<circle cx='20' cy='8' r='0.9'/><circle cx='40' cy='10' r='0.7'/>" +
				"<circle cx='60' cy='6' r='0.9'/><circle cx='80' cy='10' r='0.7'/>" +
				"<circle cx='100' cy='8' r='0.8'/>" +
			"</g>" +
		"</svg>"
	);

	// ================================================================ //
	// Scene framework
	// ================================================================ //

	function makeScene( def ) {
		return {
			id:      'b-roll/' + def.id,
			label:   def.label,
			type:    'canvas',
			preview: PREVIEWS[ def.id ] || def.preview || '#111',
			needs:   def.needs || [ 'pixijs' ],
			mount:   async function ( container, ctx ) {
				var PIXI = window.PIXI;
				var app = new PIXI.Application();
				await app.init( {
					resizeTo: container,
					backgroundAlpha: 0,
					antialias: true,
					resolution: Math.min( 2, window.devicePixelRatio || 1 ),
					autoDensity: true,
				} );
				container.appendChild( app.canvas );
				app.canvas.style.position = 'absolute';
				app.canvas.style.inset = '0';
				app.canvas.style.width = '100%';
				app.canvas.style.height = '100%';

				var state = await def.setup( { app: app, PIXI: PIXI, ctx: ctx, helpers: helpers } );

				function step( ticker ) {
					var dt = Math.min( 2.5, ticker.deltaTime );
					if ( def.tick ) def.tick( state, { app: app, PIXI: PIXI, dt: dt, ctx: ctx, helpers: helpers } );
				}
				function onResize() {
					if ( def.onResize ) def.onResize( state, { app: app, PIXI: PIXI, ctx: ctx } );
				}
				app.renderer.on( 'resize', onResize );

				if ( ctx.prefersReducedMotion ) {
					if ( def.tick ) def.tick( state, { app: app, PIXI: PIXI, dt: 0, ctx: ctx, helpers: helpers } );
					app.ticker.stop();
				} else {
					app.ticker.add( step );
				}

				var visHook = 'b-roll/' + def.id + '/visibility';
				function onVis( detail ) {
					if ( ! detail || detail.id !== ctx.id ) return;
					if ( detail.state === 'hidden' ) app.ticker.stop();
					else if ( ! ctx.prefersReducedMotion ) app.ticker.start();
				}
				if ( window.wp && window.wp.hooks ) {
					window.wp.hooks.addAction( 'wp-desktop.wallpaper.visibility', visHook, onVis );
				}

				return function teardown() {
					if ( window.wp && window.wp.hooks ) {
						window.wp.hooks.removeAction( 'wp-desktop.wallpaper.visibility', visHook );
					}
					app.renderer.off( 'resize', onResize );
					if ( def.cleanup ) def.cleanup( state, { app: app, PIXI: PIXI } );
					app.destroy( true, { children: true, texture: true } );
				};
			},
		};
	}

	var helpers = {
		rand: rand, irand: irand, choose: choose, clamp: clamp, tau: tau, phi: phi,
		lerpColor: lerpColor, paintVGradient: paintVGradient, paintRadial: paintRadial,
		makeBloomLayer: makeBloomLayer,
	};

	// ================================================================ //
	// 1. CODE RAIN — The Matrix
	// ================================================================ //
	// Denser columns. Each column has a bright white lead glyph, a long
	// green trail fading through green-to-black, and an additive-blended
	// bloom copy beneath. Occasional rare "white flash" cascade.

	function sceneCodeRain() {
		var GLYPHS = (
			'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ' +
			'0123456789WWWWWW@#$%&*+='
		).split( '' );
		var FONT_SIZE = 16;

		return makeScene( {
			id: 'code-rain',
			label: 'Code Rain',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, app.renderer.width, app.renderer.height, 0x000100, 0x011209, 8 );

				// Scanlines overlay (subtle)
				var scan = new PIXI.Graphics();
				scan.alpha = 0.06;
				app.stage.addChild( scan );
				function drawScan() {
					var w = app.renderer.width, h = app.renderer.height;
					scan.clear();
					for ( var y = 0; y < h; y += 2 ) scan.rect( 0, y, w, 1 ).fill( 0x000000 );
				}
				drawScan();

				var bloom = makeBloomLayer( PIXI, 6 );
				app.stage.addChild( bloom );
				var bloomContainer = new PIXI.Container();
				bloom.addChild( bloomContainer );

				var crisp = new PIXI.Container();
				app.stage.addChild( crisp );

				function makeCol( x ) {
					var col = {
						x: x,
						y: rand( -600, 0 ),
						speed: rand( 0.8, 2.4 ),
						length: irand( 14, 34 ),
						chars: [], bloomChars: [],
						interval: irand( 3, 10 ),
						tick: 0,
						flash: 0,
					};
					col.head = new PIXI.Text( {
						text: choose( GLYPHS ),
						style: { fontFamily: 'ui-monospace,monospace', fontSize: FONT_SIZE, fill: 0xffffff },
					} );
					col.headBloom = new PIXI.Text( {
						text: col.head.text,
						style: { fontFamily: 'ui-monospace,monospace', fontSize: FONT_SIZE, fill: 0xb0ffc8 },
					} );
					col.head.x = col.headBloom.x = x;
					crisp.addChild( col.head );
					bloomContainer.addChild( col.headBloom );
					for ( var i = 0; i < col.length; i++ ) {
						var alpha = Math.pow( 1 - i / col.length, 1.3 );
						var shade = lerpColor( 0x00ff66, 0x002a0e, Math.min( 1, i / col.length * 1.3 ) );
						var t = new PIXI.Text( {
							text: choose( GLYPHS ),
							style: { fontFamily: 'ui-monospace,monospace', fontSize: FONT_SIZE, fill: shade },
						} );
						t.x = x; t.alpha = alpha;
						col.chars.push( t );
						crisp.addChild( t );
						// bloom copy for first 6 chars
						if ( i < 6 ) {
							var b = new PIXI.Text( {
								text: t.text,
								style: { fontFamily: 'ui-monospace,monospace', fontSize: FONT_SIZE, fill: 0x2bff80 },
							} );
							b.x = x; b.alpha = alpha * 0.7;
							col.bloomChars.push( b );
							bloomContainer.addChild( b );
						} else {
							col.bloomChars.push( null );
						}
					}
					return col;
				}

				var cols = [];
				function layout() {
					for ( var i = 0; i < cols.length; i++ ) {
						var c = cols[ i ];
						c.head.destroy(); c.headBloom.destroy();
						c.chars.forEach( function ( t ) { t.destroy(); } );
						c.bloomChars.forEach( function ( t ) { if ( t ) t.destroy(); } );
					}
					cols = [];
					var spacing = FONT_SIZE * 0.78;
					var count = Math.ceil( app.renderer.width / spacing ) + 2;
					for ( var k = 0; k < count; k++ ) cols.push( makeCol( k * spacing ) );
				}
				layout();

				return { bg: bg, scan: scan, drawScan: drawScan, bloomContainer: bloomContainer, crisp: crisp, cols: cols, layout: layout };
			},
			onResize: function ( state, env ) {
				paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x000100, 0x011209, 8 );
				state.drawScan();
				state.layout();
			},
			tick: function ( state, env ) {
				var h = env.app.renderer.height;
				for ( var i = 0; i < state.cols.length; i++ ) {
					var c = state.cols[ i ];
					c.y += c.speed * env.dt * 3;
					c.tick++;
					if ( c.tick >= c.interval ) {
						c.tick = 0;
						// shift trail
						for ( var j = c.chars.length - 1; j > 0; j-- ) {
							c.chars[ j ].text = c.chars[ j - 1 ].text;
							if ( c.bloomChars[ j ] ) c.bloomChars[ j ].text = c.chars[ j - 1 ].text;
						}
						c.chars[ 0 ].text = c.head.text;
						if ( c.bloomChars[ 0 ] ) c.bloomChars[ 0 ].text = c.head.text;
						c.head.text = choose( GLYPHS );
						c.headBloom.text = c.head.text;
					}
					// Occasional rare white cascade
					if ( c.flash > 0 ) {
						c.flash = Math.max( 0, c.flash - 0.03 * env.dt );
						var flashColor = lerpColor( 0x00ff66, 0xffffff, c.flash );
						for ( var k2 = 0; k2 < 4; k2++ ) c.chars[ k2 ].style.fill = flashColor;
					}
					if ( Math.random() < 0.0003 * env.dt ) c.flash = 1;
					// layout positions
					c.head.y = c.headBloom.y = c.y;
					for ( var kk = 0; kk < c.chars.length; kk++ ) {
						var yy = c.y - ( kk + 1 ) * FONT_SIZE;
						c.chars[ kk ].y = yy;
						if ( c.bloomChars[ kk ] ) c.bloomChars[ kk ].y = yy;
					}
					if ( c.y - c.chars.length * FONT_SIZE > h + 40 ) {
						c.y = rand( -300, -20 );
						c.speed = rand( 0.8, 2.4 );
					}
				}
			},
		} );
	}

	// ================================================================ //
	// 2. HYPERSPACE — Star Wars
	// ================================================================ //
	// 3D-parallax starfield stretched into lines. Central blue warp
	// glow (additive bloom). Occasional cinematic warp flash.

	function sceneHyperspace() {
		return makeScene( {
			id: 'hyperspace',
			label: 'Hyperspace',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );

				var glow = new PIXI.Graphics();
				app.stage.addChild( glow );

				var linesFar = new PIXI.Graphics();
				var linesNear = new PIXI.Graphics();
				app.stage.addChild( linesFar );
				app.stage.addChild( linesNear );

				var bloom = makeBloomLayer( PIXI, 8 );
				var bloomGlow = new PIXI.Graphics();
				bloom.addChild( bloomGlow );
				app.stage.addChild( bloom );

				var flash = new PIXI.Graphics();
				flash.alpha = 0;
				app.stage.addChild( flash );

				function drawBg() {
					var w = app.renderer.width, h = app.renderer.height;
					paintVGradient( bg, w, h, 0x000010, 0x000000, 8 );
					// radial glow
					var cx = w / 2, cy = h / 2;
					var R = Math.min( w, h ) * 0.35;
					glow.clear();
					for ( var i = 14; i >= 0; i-- ) {
						var t = i / 14;
						glow.circle( cx, cy, R * ( i + 1 ) / 14 )
							.fill( { color: lerpColor( 0x000000, 0x183c7a, 1 - t ), alpha: 0.08 * ( 1 - t ) + 0.01 } );
					}
				}
				drawBg();

				var NUM = 340;
				var stars = [];
				function spawn( s ) {
					s.angle = Math.random() * tau;
					s.r = rand( 6, 40 );
					s.depth = rand( 0.3, 1 );
					s.speed = rand( 0.35, 1.8 ) * s.depth;
					s.tint = lerpColor( 0x88ccff, 0xffffff, Math.random() );
				}
				for ( var i = 0; i < NUM; i++ ) {
					var s = {};
					spawn( s );
					s.r = rand( 10, Math.min( app.renderer.width, app.renderer.height ) * 0.6 );
					stars.push( s );
				}

				return {
					bg: bg, glow: glow, drawBg: drawBg,
					linesFar: linesFar, linesNear: linesNear,
					bloom: bloom, bloomGlow: bloomGlow, flash: flash,
					stars: stars, spawn: spawn,
					tFlash: 60 * rand( 18, 30 ),
				};
			},
			onResize: function ( state, env ) { state.drawBg(); },
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;
				var cx = w / 2, cy = h / 2;
				var maxR = Math.sqrt( cx * cx + cy * cy );

				// Center glow pulse
				state.bloomGlow.clear();
				var pulse = 0.55 + 0.25 * Math.sin( env.app.ticker.lastTime * 0.002 );
				state.bloomGlow.circle( cx, cy, maxR * 0.11 ).fill( { color: 0x4a82ff, alpha: pulse } );
				state.bloomGlow.circle( cx, cy, maxR * 0.18 ).fill( { color: 0x183c7a, alpha: pulse * 0.55 } );

				state.linesFar.clear();
				state.linesNear.clear();

				for ( var i = 0; i < state.stars.length; i++ ) {
					var s = state.stars[ i ];
					var prevR = s.r;
					s.r += ( 0.5 + s.speed * 6 ) * env.dt;
					if ( s.r > maxR ) { state.spawn( s ); continue; }
					var cos = Math.cos( s.angle ), sin = Math.sin( s.angle );
					var x0 = cx + cos * prevR, y0 = cy + sin * prevR;
					var x1 = cx + cos * s.r, y1 = cy + sin * s.r;
					var prog = s.r / maxR;
					var alpha = clamp( ( prog - 0.05 ) * 1.3, 0, 1 );
					var width = 0.5 + s.depth * 2.0 * prog;
					var layer = s.depth > 0.65 ? state.linesNear : state.linesFar;
					layer.moveTo( x0, y0 ).lineTo( x1, y1 )
						.stroke( { color: s.tint, alpha: alpha, width: width } );
					// Lead dot on near layer
					if ( s.depth > 0.65 && prog > 0.3 ) {
						state.linesNear.circle( x1, y1, width * 0.9 ).fill( { color: 0xffffff, alpha: alpha } );
					}
				}

				// Warp flash
				state.tFlash -= env.dt;
				if ( state.tFlash <= 0 && state.flash.alpha < 0.02 ) {
					state.tFlash = 60 * rand( 18, 35 );
					state.flash.clear().rect( 0, 0, w, h ).fill( 0xdbe8ff );
					state.flash.alpha = 1;
					// Extend all stars instantly (cinematic jump)
					for ( var k = 0; k < state.stars.length; k++ ) state.stars[ k ].r += rand( 40, 180 );
				}
				if ( state.flash.alpha > 0 ) state.flash.alpha = Math.max( 0, state.flash.alpha - 0.05 * env.dt );
			},
		} );
	}

	// ================================================================ //
	// 3. NEON RAIN — Blade Runner 2049
	// ================================================================ //
	// Multi-layer parallax city (far/mid/near), flickering signs with
	// bloom halos, diagonal rain with tiny splashes at the ground, the
	// occasional lightning flash + spinner glide.

	function sceneNeonRain() {
		var SIGN_TEXTS = [ 'ATARI', 'TYRELL', 'WALLACE', 'シティ', 'NEXUS', '強化', '2049', 'JOI' ];
		var SIGN_COLORS = [ 0xff4aa0, 0xff6a3d, 0x64d8ff, 0xfff14d, 0xd65bff ];

		function drawCityLayer( g, w, h, base, minH, maxH, color, windowOpacity, windowColor ) {
			g.clear();
			var x = 0;
			while ( x < w + 20 ) {
				var bw = rand( 28, 120 );
				var bh = rand( minH, maxH );
				g.rect( x, base - bh, bw, h ).fill( color );
				// lit windows
				for ( var wy = base - bh + 8; wy < h - 4; wy += 10 ) {
					for ( var wx = x + 3; wx < x + bw - 5; wx += 7 ) {
						if ( Math.random() < windowOpacity ) {
							g.rect( wx, wy, 2.5, 3 ).fill( { color: windowColor, alpha: rand( 0.45, 0.95 ) } );
						}
					}
				}
				x += bw + rand( 1, 5 );
			}
		}

		return makeScene( {
			id: 'neon-rain',
			label: 'Neon Rain',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;
				var w = app.renderer.width, h = app.renderer.height;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, w, h, 0x1a0420, 0x000000, 12 );

				var sky = new PIXI.Graphics();
				app.stage.addChild( sky );
				function drawSky() {
					sky.clear();
					var w = app.renderer.width;
					// Far pink-orange horizon haze
					for ( var i = 0; i < 12; i++ ) {
						var t = i / 11;
						sky.rect( 0, h * 0.45 + t * h * 0.1, w, h * 0.02 )
							.fill( { color: lerpColor( 0x3a1a2e, 0x000008, t ), alpha: 0.6 } );
					}
				}
				drawSky();

				// Lightning (flash layer)
				var lightning = new PIXI.Graphics();
				lightning.alpha = 0;
				app.stage.addChild( lightning );

				// City layers
				var cityFar  = new PIXI.Graphics();
				var cityMid  = new PIXI.Graphics();
				var cityNear = new PIXI.Graphics();
				app.stage.addChild( cityFar );
				app.stage.addChild( cityMid );
				app.stage.addChild( cityNear );
				function drawCity() {
					drawCityLayer( cityFar,  app.renderer.width, h, h * 0.68, 30, 120, 0x0c0812, 0.10, 0xff8866 );
					drawCityLayer( cityMid,  app.renderer.width, h, h * 0.78, 60, 200, 0x050308, 0.18, 0xffcc66 );
					drawCityLayer( cityNear, app.renderer.width, h, h * 0.92, 40, 160, 0x020104, 0.24, 0xffe08a );
				}
				drawCity();

				// Signs with bloom
				var bloom = makeBloomLayer( PIXI, 10 );
				app.stage.addChild( bloom );
				var bloomSigns = new PIXI.Container();
				bloom.addChild( bloomSigns );

				var signLayer = new PIXI.Container();
				app.stage.addChild( signLayer );

				var signs = [];
				for ( var i = 0; i < 6; i++ ) {
					var color = choose( SIGN_COLORS );
					var crisp = new PIXI.Text( {
						text: choose( SIGN_TEXTS ),
						style: {
							fontFamily: 'Impact, "Helvetica Neue", sans-serif',
							fontSize: irand( 22, 48 ),
							fill: color, letterSpacing: 2,
						},
					} );
					crisp.x = rand( 20, app.renderer.width - 180 );
					crisp.y = rand( 20, app.renderer.height * 0.5 );
					signLayer.addChild( crisp );
					var glowSign = new PIXI.Text( {
						text: crisp.text,
						style: { fontFamily: crisp.style.fontFamily, fontSize: crisp.style.fontSize, fill: color, letterSpacing: 2 },
					} );
					glowSign.x = crisp.x; glowSign.y = crisp.y;
					bloomSigns.addChild( glowSign );
					signs.push( { crisp: crisp, glow: glowSign, color: color, flickerCD: rand( 60, 240 ), on: true } );
				}

				// Rain
				var rain = new PIXI.Graphics();
				app.stage.addChild( rain );
				var DROPS = 280;
				var drops = [];
				for ( var d = 0; d < DROPS; d++ ) {
					drops.push( {
						x: rand( -w, w ), y: rand( -h, h ),
						len: rand( 10, 22 ), speed: rand( 7, 13 ),
						alpha: rand( 0.25, 0.8 ),
					} );
				}
				var splashes = []; // { x, y, life }

				// Spinner
				var spinner = new PIXI.Graphics();
				spinner.rect( -30, -6, 60, 12 ).fill( 0x1a1a2e );
				spinner.rect( -14, -12, 28, 6 ).fill( 0x1a1a2e );
				spinner.rect( -26, -2, 6, 4 ).fill( 0xff9640 );
				spinner.rect( 20, -2, 6, 4 ).fill( 0xff9640 );
				spinner.circle( 0, 0, 3 ).fill( 0x64d8ff );
				spinner.alpha = 0;
				spinner.y = h * 0.28; spinner.x = -80;
				app.stage.addChild( spinner );

				return {
					bg: bg, sky: sky, drawSky: drawSky,
					lightning: lightning, lightT: rand( 60 * 8, 60 * 30 ),
					cityFar: cityFar, cityMid: cityMid, cityNear: cityNear, drawCity: drawCity,
					signs: signs, rain: rain, drops: drops, splashes: splashes,
					spinner: spinner, spinnerT: rand( 60 * 12, 60 * 35 ),
				};
			},
			onResize: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;
				paintVGradient( state.bg, w, h, 0x1a0420, 0x000000, 12 );
				state.drawSky();
				state.drawCity();
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;

				// Lightning
				state.lightT -= env.dt;
				if ( state.lightT <= 0 && state.lightning.alpha < 0.02 ) {
					state.lightT = rand( 60 * 15, 60 * 60 );
					state.lightning.clear().rect( 0, 0, w, h * 0.7 ).fill( { color: 0xe6cfff, alpha: 1 } );
					state.lightning.alpha = 1;
				}
				if ( state.lightning.alpha > 0 ) state.lightning.alpha = Math.max( 0, state.lightning.alpha - 0.09 * env.dt );

				// Signs flicker
				for ( var i = 0; i < state.signs.length; i++ ) {
					var s = state.signs[ i ];
					s.flickerCD -= env.dt;
					if ( s.flickerCD <= 0 ) {
						s.on = Math.random() < 0.85;
						var a = s.on ? rand( 0.8, 1 ) : rand( 0.1, 0.4 );
						s.crisp.alpha = a; s.glow.alpha = a * 0.85;
						s.flickerCD = rand( 4, 140 );
					}
				}

				// Rain
				state.rain.clear();
				var ground = h * 0.94;
				for ( var d = 0; d < state.drops.length; d++ ) {
					var dr = state.drops[ d ];
					dr.x += dr.speed * 0.4 * env.dt;
					dr.y += dr.speed * env.dt;
					if ( dr.y > ground ) {
						state.splashes.push( { x: dr.x, y: ground, life: 1 } );
						dr.y = rand( -h * 0.5, 0 );
						dr.x = rand( -w * 0.2, w );
					}
					if ( dr.x > w + 20 ) dr.x -= w + 40;
					state.rain.moveTo( dr.x, dr.y )
						.lineTo( dr.x - dr.len * 0.35, dr.y - dr.len )
						.stroke( { color: 0xb4c8ff, alpha: dr.alpha, width: 1 } );
				}
				// Splashes
				for ( var s2 = state.splashes.length - 1; s2 >= 0; s2-- ) {
					var sp = state.splashes[ s2 ];
					state.rain.circle( sp.x, sp.y, ( 1 - sp.life ) * 4 )
						.stroke( { color: 0xa8c8ff, alpha: sp.life * 0.6, width: 0.8 } );
					sp.life -= 0.08 * env.dt;
					if ( sp.life <= 0 ) state.splashes.splice( s2, 1 );
				}

				// Spinner
				state.spinnerT -= env.dt;
				if ( state.spinnerT <= 0 && state.spinner.alpha === 0 ) {
					state.spinner.alpha = 1;
					state.spinner.x = -80;
					state.spinner.y = rand( h * 0.18, h * 0.34 );
				}
				if ( state.spinner.alpha > 0 ) {
					state.spinner.x += 3.6 * env.dt;
					if ( state.spinner.x > w + 120 ) {
						state.spinner.alpha = 0;
						state.spinnerT = rand( 60 * 12, 60 * 35 );
					}
				}
			},
		} );
	}

	// ================================================================ //
	// 4. THE GRID — Tron
	// ================================================================ //
	// Isometric neon grid with stronger horizon glow, visible cycle
	// silhouettes, gradient trails, and grid-intersection pulses when
	// cycles pass nearby.

	function sceneTronGrid() {
		return makeScene( {
			id: 'tron-grid',
			label: 'The Grid',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, app.renderer.width, app.renderer.height, 0x001626, 0x000000, 14 );

				var horizon = new PIXI.Graphics();
				app.stage.addChild( horizon );

				var grid = new PIXI.Graphics();
				app.stage.addChild( grid );

				var trails = new PIXI.Graphics();
				app.stage.addChild( trails );

				var bloom = makeBloomLayer( PIXI, 9 );
				app.stage.addChild( bloom );
				var bloomLayer = new PIXI.Graphics();
				bloom.addChild( bloomLayer );

				function drawHorizon() {
					var w = app.renderer.width, h = app.renderer.height;
					horizon.clear();
					var hy = h * 0.52;
					// bright centre bar
					horizon.rect( 0, hy - 1, w, 2 ).fill( 0xff7a1a );
					// soft glow above and below
					for ( var i = 0; i < 20; i++ ) {
						var t = i / 20;
						horizon.rect( 0, hy - i, w, 1 )
							.fill( { color: lerpColor( 0xff6d1f, 0x000000, t ), alpha: ( 1 - t ) * 0.55 } );
						horizon.rect( 0, hy + i, w, 1 )
							.fill( { color: lerpColor( 0xff6d1f, 0x000000, t ), alpha: ( 1 - t ) * 0.3 } );
					}
				}

				function drawGrid() {
					var w = app.renderer.width, h = app.renderer.height;
					grid.clear();
					var hy = h * 0.52;
					var rows = 16;
					for ( var r = 0; r < rows; r++ ) {
						var t = r / ( rows - 1 );
						var y = hy + Math.pow( t, 1.8 ) * ( h - hy );
						grid.moveTo( 0, y ).lineTo( w, y )
							.stroke( { color: 0x00aaff, alpha: 0.25 + t * 0.55, width: 1 } );
					}
					var vp = { x: w / 2, y: hy };
					for ( var c = -12; c <= 12; c++ ) {
						var x0 = w / 2 + c * ( w / 26 );
						grid.moveTo( x0, h ).lineTo( vp.x + c * 5, vp.y )
							.stroke( { color: 0x00aaff, alpha: 0.28, width: 1 } );
					}
				}
				drawHorizon();
				drawGrid();

				function makeCycle( color ) {
					return {
						gx: irand( 2, 18 ), gy: irand( 2, 14 ),
						dir: irand( 0, 4 ), color: color,
						trail: [], stepT: 0,
					};
				}
				var cycles = [ makeCycle( 0x00eaff ), makeCycle( 0xff6d1f ), makeCycle( 0xbaff3d ) ];

				// Pulses
				var pulses = []; // { x, y, life, color }

				return {
					bg: bg, horizon: horizon, grid: grid, trails: trails,
					bloom: bloom, bloomLayer: bloomLayer,
					cycles: cycles, makeCycle: makeCycle, pulses: pulses,
					drawHorizon: drawHorizon, drawGrid: drawGrid,
				};
			},
			onResize: function ( state, env ) {
				paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x001626, 0x000000, 14 );
				state.drawHorizon();
				state.drawGrid();
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;
				var hy = h * 0.52;
				var dirs = [ [ 1, 0 ], [ 0, 1 ], [ -1, 0 ], [ 0, -1 ] ];

				for ( var i = 0; i < state.cycles.length; i++ ) {
					var cy = state.cycles[ i ];
					cy.stepT += env.dt;
					if ( cy.stepT >= 8 ) {
						cy.stepT = 0;
						var d = dirs[ cy.dir ];
						cy.gx += d[ 0 ]; cy.gy += d[ 1 ];
						if ( Math.random() < 0.2 ) cy.dir = ( cy.dir + ( Math.random() < 0.5 ? 1 : 3 ) ) % 4;
						var sx = w / 2 + ( cy.gx - 10 ) * ( w / 26 );
						var sy = hy + Math.pow( cy.gy / 16, 1.8 ) * ( h - hy );
						cy.trail.push( { x: sx, y: sy, life: 1 } );
						if ( cy.trail.length > 90 ) cy.trail.shift();
						state.pulses.push( { x: sx, y: sy, life: 1, color: cy.color } );
						if ( cy.gx < -3 || cy.gx > 23 || cy.gy < -1 || cy.gy > 17 ) {
							Object.assign( cy, state.makeCycle( cy.color ) );
						}
					}
				}

				state.trails.clear();
				state.bloomLayer.clear();

				for ( var c = 0; c < state.cycles.length; c++ ) {
					var cyc = state.cycles[ c ];
					for ( var t = cyc.trail.length - 1; t >= 1; t-- ) {
						var a = cyc.trail[ t - 1 ], b = cyc.trail[ t ];
						state.trails.moveTo( a.x, a.y ).lineTo( b.x, b.y )
							.stroke( { color: cyc.color, alpha: b.life * 0.95, width: 2 } );
						state.bloomLayer.moveTo( a.x, a.y ).lineTo( b.x, b.y )
							.stroke( { color: cyc.color, alpha: b.life * 0.7, width: 4 } );
						b.life = Math.max( 0, b.life - 0.009 * env.dt );
					}
					if ( cyc.trail.length ) {
						var head = cyc.trail[ cyc.trail.length - 1 ];
						// Cycle silhouette
						state.trails.rect( head.x - 5, head.y - 2.5, 10, 5 ).fill( 0xffffff );
						state.bloomLayer.circle( head.x, head.y, 8 ).fill( { color: cyc.color, alpha: 0.7 } );
						state.bloomLayer.circle( head.x, head.y, 14 ).fill( { color: cyc.color, alpha: 0.35 } );
					}
				}

				// Pulses (intersection flashes)
				for ( var p = state.pulses.length - 1; p >= 0; p-- ) {
					var pu = state.pulses[ p ];
					state.bloomLayer.circle( pu.x, pu.y, ( 1 - pu.life ) * 20 )
						.stroke( { color: pu.color, alpha: pu.life, width: 1.4 } );
					pu.life -= 0.05 * env.dt;
					if ( pu.life <= 0 ) state.pulses.splice( p, 1 );
				}
			},
		} );
	}

	// ================================================================ //
	// 5. COUCH GAG — The Simpsons
	// ================================================================ //
	// Springfield-blue sky with sun + clouds. When the gag fires, a
	// full living room fades in: yellow floor, purple wall, TV, lamp,
	// and the iconic couch. Holds for a beat, then fades out.

	function sceneCouchGag() {
		return makeScene( {
			id: 'couch-gag',
			label: 'Couch Gag',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, app.renderer.width, app.renderer.height, 0x7ab9f0, 0xdaefff, 12 );

				// Sun
				var sun = new PIXI.Graphics();
				sun.circle( 0, 0, 28 ).fill( { color: 0xfff2a6, alpha: 0.85 } );
				sun.circle( 0, 0, 22 ).fill( 0xffde3a );
				sun.x = app.renderer.width - 80;
				sun.y = 80;
				app.stage.addChild( sun );

				// Clouds
				function makeCloud() {
					var g = new PIXI.Graphics();
					var parts = [
						[ 0, 0, 40 ], [ 34, -8, 32 ], [ 66, -2, 36 ],
						[ 96, -10, 28 ], [ 22, 8, 30 ], [ 56, 10, 32 ], [ 86, 6, 26 ],
					];
					parts.forEach( function ( p ) { g.circle( p[ 0 ], p[ 1 ], p[ 2 ] ).fill( 0xffffff ); } );
					g.alpha = 0.96;
					return g;
				}

				var clouds = [];
				for ( var i = 0; i < 9; i++ ) {
					var c = makeCloud();
					c.scale.set( rand( 0.4, 1.1 ) );
					c.x = rand( 0, app.renderer.width );
					c.y = rand( 30, app.renderer.height * 0.55 );
					app.stage.addChild( c );
					clouds.push( { node: c, speed: rand( 0.1, 0.35 ) / ( c.scale.x + 0.2 ) } );
				}

				// Birds (flying M shapes)
				var birds = [];
				for ( var b = 0; b < 3; b++ ) {
					var bg2 = new PIXI.Graphics();
					bg2.moveTo( -4, 0 ).lineTo( 0, -2 ).lineTo( 4, 0 ).lineTo( 8, -2 ).lineTo( 12, 0 )
						.stroke( { color: 0x000000, width: 1.2 } );
					bg2.x = rand( -40, app.renderer.width );
					bg2.y = rand( 40, app.renderer.height * 0.35 );
					app.stage.addChild( bg2 );
					birds.push( { node: bg2, speed: rand( 0.3, 0.7 ), phase: Math.random() * tau } );
				}

				// Living room (container, hidden until gag)
				var room = new PIXI.Container();
				room.alpha = 0;
				app.stage.addChild( room );

				// Purple wall
				var wall = new PIXI.Graphics();
				wall.rect( 0, 0, 360, 150 ).fill( 0x7c62a4 );
				room.addChild( wall );
				// Yellow floor
				var floor = new PIXI.Graphics();
				floor.rect( 0, 150, 360, 80 ).fill( 0xe7c148 );
				room.addChild( floor );
				// Window (above couch)
				var windowFrame = new PIXI.Graphics();
				windowFrame.rect( 20, 20, 70, 50 ).fill( 0x9ec3ff );
				windowFrame.rect( 54, 20, 2, 50 ).fill( 0x7c62a4 );
				windowFrame.rect( 20, 43, 70, 2 ).fill( 0x7c62a4 );
				room.addChild( windowFrame );
				// TV on stand (left)
				var tv = new PIXI.Graphics();
				tv.rect( -30, 70, 50, 40 ).fill( 0x2e2215 );
				tv.rect( -24, 76, 38, 28 ).fill( 0xc8d8d8 );
				tv.rect( -18, 110, 26, 4 ).fill( 0x1a1208 );
				room.addChild( tv );
				// Lamp (right)
				var lamp = new PIXI.Graphics();
				lamp.moveTo( 250, 110 ).lineTo( 260, 80 ).lineTo( 290, 80 ).lineTo( 300, 110 ).lineTo( 250, 110 )
					.fill( 0xf0a030 );
				lamp.rect( 273, 110, 4, 30 ).fill( 0x4a2c10 );
				lamp.rect( 258, 140, 34, 4 ).fill( 0x4a2c10 );
				room.addChild( lamp );
				// Couch
				var couch = new PIXI.Graphics();
				couch.roundRect( 90, 90, 160, 54, 8 ).fill( 0xc36a1e );
				couch.roundRect( 98, 78, 42, 24, 5 ).fill( 0xe2894a );
				couch.roundRect( 146, 78, 42, 24, 5 ).fill( 0xe2894a );
				couch.roundRect( 194, 78, 42, 24, 5 ).fill( 0xe2894a );
				couch.roundRect( 82, 90, 14, 54, 5 ).fill( 0x8a4812 );
				couch.roundRect( 244, 90, 14, 54, 5 ).fill( 0x8a4812 );
				couch.rect( 96, 144, 6, 8 ).fill( 0x3d1e08 );
				couch.rect( 238, 144, 6, 8 ).fill( 0x3d1e08 );
				room.addChild( couch );
				room.pivot.set( 180, 115 );

				return {
					bg: bg, sun: sun, clouds: clouds, birds: birds,
					room: room, roomT: rand( 60 * 15, 60 * 40 ), phase: 'idle', hold: 0,
				};
			},
			onResize: function ( state, env ) {
				paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x7ab9f0, 0xdaefff, 12 );
				state.sun.x = env.app.renderer.width - 80;
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;

				for ( var i = 0; i < state.clouds.length; i++ ) {
					var c = state.clouds[ i ];
					c.node.x += c.speed * env.dt;
					if ( c.node.x > w + 140 ) c.node.x = -140;
				}
				for ( var b = 0; b < state.birds.length; b++ ) {
					var br = state.birds[ b ];
					br.phase += 0.05 * env.dt;
					br.node.x += br.speed * env.dt;
					br.node.y += Math.sin( br.phase ) * 0.2;
					if ( br.node.x > w + 40 ) { br.node.x = -40; br.node.y = rand( 40, h * 0.35 ); }
				}

				// Room gag
				state.roomT -= env.dt;
				if ( state.phase === 'idle' && state.roomT <= 0 ) {
					state.phase = 'drop';
					state.room.x = rand( w * 0.3, w * 0.7 );
					state.room.y = -200;
					state.room.scale.set( rand( 0.8, 1.1 ) );
					state.room.alpha = 0;
				}
				if ( state.phase === 'drop' ) {
					state.room.alpha = Math.min( 1, state.room.alpha + 0.06 * env.dt );
					state.room.y += ( h * 0.55 - state.room.y ) * 0.1 * env.dt;
					if ( Math.abs( state.room.y - h * 0.55 ) < 3 ) { state.phase = 'hold'; state.hold = 180; }
				} else if ( state.phase === 'hold' ) {
					state.hold -= env.dt;
					if ( state.hold <= 0 ) state.phase = 'out';
				} else if ( state.phase === 'out' ) {
					state.room.alpha -= 0.03 * env.dt;
					if ( state.room.alpha <= 0 ) { state.phase = 'idle'; state.roomT = rand( 60 * 35, 60 * 90 ); }
				}
			},
		} );
	}

	// ================================================================ //
	// 6. RAINBOW ROAD — Mario Kart
	// ================================================================ //
	// Neon-striped road in exaggerated perspective, guardrails with
	// neon glow, twinkling stars above, a distant planet, shooting
	// stars, and a rotating item-box drifting past.

	function sceneRainbowRoad() {
		var ROAD_COLORS = [ 0xff2d5a, 0xff993d, 0xffe84a, 0x31d16a, 0x3dc3ff, 0x8a5bff, 0xff2d5a ];

		return makeScene( {
			id: 'rainbow-road',
			label: 'Rainbow Road',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, app.renderer.width, app.renderer.height, 0x0b0024, 0x000000, 12 );

				// Distant planet
				var planet = new PIXI.Graphics();
				planet.circle( 0, 0, 34 ).fill( 0xe9a83e );
				planet.ellipse( 0, 0, 50, 10 ).stroke( { color: 0xf6dca0, width: 2, alpha: 0.8 } );
				planet.x = app.renderer.width * 0.78;
				planet.y = app.renderer.height * 0.25;
				planet.alpha = 0.9;
				app.stage.addChild( planet );

				// Stars
				var stars = new PIXI.Graphics();
				app.stage.addChild( stars );
				var starData = [];
				for ( var i = 0; i < 180; i++ ) {
					starData.push( {
						x: rand( 0, app.renderer.width ),
						y: rand( 0, app.renderer.height * 0.48 ),
						r: rand( 0.5, 1.8 ), tw: Math.random() * tau,
					} );
				}

				// Shooting stars
				var shooters = [];

				// Road
				var road = new PIXI.Graphics();
				app.stage.addChild( road );

				var rails = new PIXI.Graphics();
				app.stage.addChild( rails );

				// Bloom for rails + item
				var bloom = makeBloomLayer( PIXI, 8 );
				app.stage.addChild( bloom );
				var bloomRails = new PIXI.Graphics();
				bloom.addChild( bloomRails );

				// Item box
				var item = new PIXI.Container();
				var iBody = new PIXI.Graphics();
				iBody.roundRect( -20, -20, 40, 40, 8 ).fill( 0xff9e1a );
				iBody.roundRect( -18, -18, 36, 36, 6 ).fill( 0xffcc4a );
				var q = new PIXI.Text( {
					text: '?',
					style: { fontFamily: 'Impact, sans-serif', fontSize: 32, fill: 0xffffff,
						stroke: { color: 0x5b3300, width: 3 } },
				} );
				q.anchor.set( 0.5 );
				item.addChild( iBody );
				item.addChild( q );
				item.alpha = 0;
				app.stage.addChild( item );

				return {
					bg: bg, planet: planet, stars: stars, starData: starData,
					shooters: shooters, road: road, rails: rails,
					bloomRails: bloomRails, item: item,
					itemT: rand( 60 * 15, 60 * 50 ), itemPhase: 'idle',
					shootT: rand( 60 * 5, 60 * 20 ),
					offset: 0,
				};
			},
			onResize: function ( state, env ) {
				paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x0b0024, 0x000000, 12 );
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;

				// Stars twinkle
				state.stars.clear();
				for ( var i = 0; i < state.starData.length; i++ ) {
					var st = state.starData[ i ];
					st.tw += 0.04 * env.dt;
					var a = 0.45 + 0.45 * Math.sin( st.tw );
					state.stars.circle( st.x, st.y, st.r ).fill( { color: 0xffffff, alpha: a } );
				}

				// Shooting stars
				state.shootT -= env.dt;
				if ( state.shootT <= 0 ) {
					state.shootT = rand( 60 * 4, 60 * 18 );
					state.shooters.push( {
						x: rand( 0, w * 0.5 ), y: rand( 0, h * 0.35 ),
						vx: rand( 4, 8 ), vy: rand( 2, 5 ), life: 1,
					} );
				}
				for ( var s2 = state.shooters.length - 1; s2 >= 0; s2-- ) {
					var sh = state.shooters[ s2 ];
					sh.x += sh.vx * env.dt; sh.y += sh.vy * env.dt;
					state.stars.moveTo( sh.x, sh.y )
						.lineTo( sh.x - sh.vx * 6, sh.y - sh.vy * 6 )
						.stroke( { color: 0xffffff, alpha: sh.life * 0.8, width: 1 } );
					sh.life -= 0.02 * env.dt;
					if ( sh.life <= 0 || sh.x > w + 40 ) state.shooters.splice( s2, 1 );
				}

				// Road: perspective stripes scrolling.
				state.offset += 0.055 * env.dt;
				state.road.clear();
				state.rails.clear();
				state.bloomRails.clear();

				var horizon = h * 0.48;
				var vpX = w / 2;
				var STRIPES = 60;
				for ( var sn = 0; sn < STRIPES; sn++ ) {
					var tNorm = ( sn / STRIPES + state.offset ) % 1;
					var y  = horizon + Math.pow( tNorm, 1.8 ) * ( h - horizon );
					var y2 = horizon + Math.pow( tNorm + 1 / STRIPES, 1.8 ) * ( h - horizon );
					var widthTop = ( y - horizon ) * 0.85;
					var widthBot = ( y2 - horizon ) * 0.85;
					var color = ROAD_COLORS[ sn % ROAD_COLORS.length ];
					state.road.poly( [
						vpX - widthTop, y,  vpX + widthTop, y,
						vpX + widthBot, y2, vpX - widthBot, y2,
					] ).fill( { color: color, alpha: 0.92 } );
				}
				// Centre line glow
				state.road.rect( vpX - 2.5, horizon, 5, h - horizon )
					.fill( { color: 0xffffff, alpha: 0.45 } );

				// Guardrails
				var pts = 30;
				for ( var g = 0; g < pts; g++ ) {
					var tt = ( g / pts ) + ( state.offset % ( 1 / pts ) ) * pts;
					var yy = horizon + Math.pow( tt, 1.8 ) * ( h - horizon );
					var wt = ( yy - horizon ) * 0.85;
					// Left rail
					state.rails.circle( vpX - wt - 2, yy, 1.2 + tt * 2 )
						.fill( { color: 0x64d8ff, alpha: 0.9 } );
					state.bloomRails.circle( vpX - wt - 2, yy, 3 + tt * 3 )
						.fill( { color: 0x64d8ff, alpha: 0.55 } );
					// Right rail
					state.rails.circle( vpX + wt + 2, yy, 1.2 + tt * 2 )
						.fill( { color: 0xff4aa0, alpha: 0.9 } );
					state.bloomRails.circle( vpX + wt + 2, yy, 3 + tt * 3 )
						.fill( { color: 0xff4aa0, alpha: 0.55 } );
				}

				// Item box
				state.itemT -= env.dt;
				if ( state.itemPhase === 'idle' && state.itemT <= 0 ) {
					state.itemPhase = 'fly';
					state.item.alpha = 1;
					state.item.x = -50;
					state.item.y = rand( h * 0.2, h * 0.42 );
					state.item.rotation = 0;
					state.item.scale.set( rand( 0.8, 1.15 ) );
				}
				if ( state.itemPhase === 'fly' ) {
					state.item.x += 2.4 * env.dt;
					state.item.rotation += 0.04 * env.dt;
					if ( state.item.x > w + 50 ) {
						state.itemPhase = 'idle';
						state.item.alpha = 0;
						state.itemT = rand( 60 * 20, 60 * 60 );
					}
				}
			},
		} );
	}

	// ================================================================ //
	// 7. SOOT SPRITES — Studio Ghibli
	// ================================================================ //
	// Soft pastel sky with fluffy sprites of varied size. Candy drops
	// occasionally fall and the nearest sprites huddle toward them.

	function sceneSootSprites() {
		return makeScene( {
			id: 'soot-sprites',
			label: 'Soot Sprites',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, app.renderer.width, app.renderer.height, 0xffd7ea, 0xcce7ff, 20 );

				var spriteLayer = new PIXI.Container();
				app.stage.addChild( spriteLayer );

				function makeSoot( scaleHint ) {
					var c = new PIXI.Container();
					var base = new PIXI.Graphics();
					base.circle( 0, 0, 18 ).fill( 0x161616 );
					for ( var k = 0; k < 18; k++ ) {
						var a = ( k / 18 ) * tau + rand( -0.1, 0.1 );
						var rr = 18 + rand( 2, 8 );
						base.circle( Math.cos( a ) * rr, Math.sin( a ) * rr, rand( 2, 5 ) ).fill( 0x161616 );
					}
					// subtle shadow below
					var shadow = new PIXI.Graphics();
					shadow.ellipse( 0, 22, 18, 4 ).fill( { color: 0x000000, alpha: 0.15 } );
					c.addChild( shadow );
					c.addChild( base );
					var leye = new PIXI.Graphics(); leye.circle( -5, -2, 2.4 ).fill( 0xffffff );
					var reye = new PIXI.Graphics(); reye.circle(  5, -2, 2.4 ).fill( 0xffffff );
					leye.visible = reye.visible = false;
					c.addChild( leye ); c.addChild( reye );
					c.scale.set( scaleHint );
					return { node: c, leye: leye, reye: reye };
				}

				var sprites = [];
				for ( var i = 0; i < 26; i++ ) {
					var s = makeSoot( rand( 0.5, 1.35 ) );
					s.node.x = rand( 0, app.renderer.width );
					s.node.y = rand( 0, app.renderer.height );
					spriteLayer.addChild( s.node );
					sprites.push( Object.assign( s, {
						baseY: s.node.y, phase: Math.random() * tau,
						amp: rand( 8, 35 ), vx: rand( -0.3, 0.3 ),
						blinkCD: rand( 60 * 3, 60 * 14 ), blinkT: 0,
						attractTo: null,
					} ) );
				}

				// Candy (star shapes) that drop occasionally.
				var candies = [];
				function makeCandy( x, y ) {
					var g = new PIXI.Graphics();
					var r1 = 6, r2 = 2.5;
					var pts = [];
					for ( var i = 0; i < 10; i++ ) {
						var a = ( i / 10 ) * tau - Math.PI / 2;
						var r = i % 2 === 0 ? r1 : r2;
						pts.push( Math.cos( a ) * r, Math.sin( a ) * r );
					}
					g.poly( pts ).fill( choose( [ 0xffe04a, 0xff8cc6, 0x8ae0ff, 0x9fff9a ] ) );
					g.x = x; g.y = y;
					app.stage.addChild( g );
					return { node: g, vy: 0.3, spin: rand( -0.02, 0.02 ), life: 1 };
				}

				return { bg: bg, sprites: sprites, spriteLayer: spriteLayer,
					candies: candies, makeCandy: makeCandy,
					candyT: rand( 60 * 15, 60 * 40 ),
				};
			},
			onResize: function ( state, env ) {
				paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0xffd7ea, 0xcce7ff, 20 );
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;

				// Candy spawn/fall
				state.candyT -= env.dt;
				if ( state.candyT <= 0 ) {
					state.candyT = rand( 60 * 25, 60 * 60 );
					state.candies.push( state.makeCandy( rand( 60, w - 60 ), -10 ) );
				}
				for ( var cI = state.candies.length - 1; cI >= 0; cI-- ) {
					var cc = state.candies[ cI ];
					cc.node.y += cc.vy * env.dt;
					cc.node.rotation += cc.spin * env.dt;
					if ( cc.node.y > h * 0.75 ) {
						cc.life -= 0.005 * env.dt;
						if ( cc.life <= 0 ) { cc.node.destroy(); state.candies.splice( cI, 1 ); continue; }
					}
					cc.node.alpha = cc.life;
				}

				// Find closest candy for each sprite
				for ( var i = 0; i < state.sprites.length; i++ ) {
					var s = state.sprites[ i ];
					s.attractTo = null;
					var closest = Infinity;
					for ( var cI2 = 0; cI2 < state.candies.length; cI2++ ) {
						var ca = state.candies[ cI2 ];
						var dx = ca.node.x - s.node.x, dy = ca.node.y - s.node.y;
						var d2 = dx * dx + dy * dy;
						if ( d2 < 24000 && d2 < closest ) { closest = d2; s.attractTo = ca; }
					}

					s.phase += 0.02 * env.dt;
					if ( s.attractTo ) {
						var dx2 = s.attractTo.node.x - s.node.x;
						var dy2 = s.attractTo.node.y - s.node.y;
						s.node.x += dx2 * 0.015 * env.dt;
						s.node.y += dy2 * 0.015 * env.dt;
					} else {
						s.node.y = s.baseY + Math.sin( s.phase ) * s.amp;
						s.node.x += s.vx * env.dt;
						if ( s.node.x < -40 ) s.node.x = w + 40;
						if ( s.node.x > w + 40 ) s.node.x = -40;
					}

					s.blinkCD -= env.dt;
					if ( s.blinkCD <= 0 && s.blinkT === 0 ) {
						s.blinkT = 14;
						s.leye.visible = s.reye.visible = true;
					}
					if ( s.blinkT > 0 ) {
						s.blinkT -= env.dt;
						if ( s.blinkT <= 0 ) {
							s.leye.visible = s.reye.visible = false;
							s.blinkCD = rand( 60 * 4, 60 * 16 );
						}
					}
				}
			},
		} );
	}

	// ================================================================ //
	// 8. THE UPSIDE DOWN — Stranger Things
	// ================================================================ //
	// Red-violet murk with creeping tendrils from the edges, spiraling
	// spores, CRT scanlines, a glitch-chromatic title-card every few
	// minutes, and a crackling red lightning flash overhead.

	function sceneUpsideDown() {
		var CHAPTERS = [ 'CHAPTER ONE', 'CHAPTER TWO', 'CHAPTER SIX', 'VECNA', 'HAWKINS', 'THE MIND FLAYER' ];

		return makeScene( {
			id: 'upside-down',
			label: 'The Upside Down',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;
				var w = app.renderer.width, h = app.renderer.height;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				function drawBg() {
					bg.clear();
					var w = app.renderer.width, h = app.renderer.height;
					for ( var i = 0; i < 22; i++ ) {
						var t = i / 21;
						var c = lerpColor( 0x4a0a20, 0x050007, Math.abs( t - 0.35 ) * 1.4 );
						bg.rect( 0, ( i * h ) / 22, w, h / 22 + 1 ).fill( c );
					}
				}
				drawBg();

				// Crackling red veil at top
				var veil = new PIXI.Graphics();
				app.stage.addChild( veil );

				// Creeping tendrils
				var tendrils = new PIXI.Graphics();
				app.stage.addChild( tendrils );

				// Spores (Graphics-drawn for performance)
				var sporeLayer = new PIXI.Graphics();
				app.stage.addChild( sporeLayer );

				var SPORE_N = 130;
				var spores = [];
				for ( var i = 0; i < SPORE_N; i++ ) {
					spores.push( {
						x: rand( 0, w ), y: rand( 0, h ),
						r: rand( 1.2, 3.2 ),
						vy: -rand( 0.1, 0.6 ), phase: Math.random() * tau,
						spin: rand( 0.01, 0.05 ),
					} );
				}

				// Scanlines
				var scan = new PIXI.Graphics();
				scan.alpha = 0.08;
				app.stage.addChild( scan );
				function drawScan() {
					scan.clear();
					var w = app.renderer.width, h = app.renderer.height;
					for ( var y = 0; y < h; y += 3 ) scan.rect( 0, y, w, 1 ).fill( 0x000000 );
				}
				drawScan();

				// Title card — 3 channels for chromatic glitch
				var card = new PIXI.Container();
				var tR = new PIXI.Text( {
					text: choose( CHAPTERS ),
					style: { fontFamily: 'Georgia,serif', fontSize: 44, fill: 0xff2420, letterSpacing: 3, fontStyle: 'italic' },
				} );
				var tG = new PIXI.Text( { text: tR.text, style: Object.assign( {}, tR.style, { fill: 0x00ffaa } ) } );
				var tB = new PIXI.Text( { text: tR.text, style: Object.assign( {}, tR.style, { fill: 0x64e0ff } ) } );
				tR.anchor.set( 0.5 ); tG.anchor.set( 0.5 ); tB.anchor.set( 0.5 );
				card.addChild( tB ); card.addChild( tG ); card.addChild( tR );
				card.alpha = 0;
				card.x = w / 2; card.y = h * 0.45;
				app.stage.addChild( card );

				return {
					bg: bg, drawBg: drawBg, veil: veil, tendrils: tendrils,
					sporeLayer: sporeLayer, spores: spores,
					scan: scan, drawScan: drawScan, card: card, tR: tR, tG: tG, tB: tB,
					cardT: rand( 60 * 30, 60 * 75 ), phase: 'idle', hold: 0,
					lightT: rand( 60 * 10, 60 * 25 ), lightLife: 0,
				};
			},
			onResize: function ( state, env ) {
				state.drawBg();
				state.drawScan();
				state.card.x = env.app.renderer.width / 2;
				state.card.y = env.app.renderer.height * 0.45;
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;
				var time = env.app.ticker.lastTime;

				// Spore drift (spiraling)
				state.sporeLayer.clear();
				for ( var s = 0; s < state.spores.length; s++ ) {
					var sp = state.spores[ s ];
					sp.phase += sp.spin * env.dt;
					sp.y += sp.vy * env.dt;
					var px = sp.x + Math.sin( sp.phase * 2 ) * 8;
					if ( sp.y < -10 ) { sp.y = h + 10; sp.x = rand( 0, w ); }
					state.sporeLayer.circle( px, sp.y, sp.r ).fill( { color: 0xffccdd, alpha: 0.85 } );
					state.sporeLayer.circle( px, sp.y, sp.r * 2.4 ).fill( { color: 0xffccdd, alpha: 0.1 } );
				}

				// Tendrils: slow-moving curves at edges
				state.tendrils.clear();
				function drawTendril( x0, y0, x1, y1, cpx, cpy, alpha ) {
					state.tendrils.moveTo( x0, y0 )
						.quadraticCurveTo( cpx, cpy, x1, y1 )
						.stroke( { color: 0x3a0614, width: 1, alpha: alpha } );
				}
				var wob = Math.sin( time * 0.0008 ) * 8;
				drawTendril( 0, 20,              40, 80 + wob,              20 + wob, 40,           0.6 );
				drawTendril( w, 40,              w - 60, 100 - wob,         w - 40, 70 + wob,        0.6 );
				drawTendril( 0, h - 40,          80, h - 100 + wob,         40, h - 70 + wob,        0.5 );
				drawTendril( w, h - 50,          w - 80, h - 80 - wob,      w - 40, h - 70 - wob,    0.55 );
				drawTendril( w / 2, 0,           w / 2 + wob, 60 + wob,     w / 2 + 40, 30,          0.4 );

				// Red crackling lightning veil
				state.lightT -= env.dt;
				if ( state.lightT <= 0 && state.lightLife <= 0 ) {
					state.lightT = rand( 60 * 8, 60 * 25 );
					state.lightLife = 1;
				}
				state.veil.clear();
				if ( state.lightLife > 0 ) {
					state.lightLife -= 0.05 * env.dt;
					// Jagged path
					var steps = 12;
					var startX = rand( 0, w );
					var y = 0, x = startX;
					for ( var i2 = 0; i2 < steps; i2++ ) {
						var nx = x + rand( -30, 30 );
						var ny = y + ( h * 0.35 ) / steps;
						state.veil.moveTo( x, y ).lineTo( nx, ny )
							.stroke( { color: 0xff3322, alpha: state.lightLife * 0.95, width: 1.2 } );
						state.veil.moveTo( x, y ).lineTo( nx, ny )
							.stroke( { color: 0xff8855, alpha: state.lightLife * 0.5, width: 3 } );
						x = nx; y = ny;
					}
				}

				// Title card
				state.cardT -= env.dt;
				if ( state.phase === 'idle' && state.cardT <= 0 ) {
					state.phase = 'in';
					var ch = choose( CHAPTERS );
					state.tR.text = ch; state.tG.text = ch; state.tB.text = ch;
				}
				if ( state.phase === 'in' ) {
					state.card.alpha = Math.min( 1, state.card.alpha + 0.04 * env.dt );
					// glitch offsets
					var off = Math.random() < 0.1 ? rand( -6, 6 ) : 0;
					state.tR.x = -off * 1.2; state.tG.x = 0; state.tB.x = off * 1.2;
					state.card.x = env.app.renderer.width / 2 + rand( -2, 2 );
					if ( state.card.alpha >= 1 ) { state.phase = 'hold'; state.hold = 80; }
				} else if ( state.phase === 'hold' ) {
					state.hold -= env.dt;
					state.card.x = env.app.renderer.width / 2 + ( Math.random() < 0.05 ? rand( -8, 8 ) : 0 );
					state.tR.x = Math.random() < 0.1 ? rand( -3, 3 ) : 0;
					state.tB.x = -state.tR.x;
					if ( state.hold <= 0 ) state.phase = 'out';
				} else if ( state.phase === 'out' ) {
					state.card.alpha -= 0.03 * env.dt;
					if ( state.card.alpha <= 0 ) { state.phase = 'idle'; state.cardT = rand( 60 * 45, 60 * 110 ); }
				}
			},
		} );
	}

	// ================================================================ //
	// 9. REFINERY — Severance
	// ================================================================ //
	// Pale pool of drifting numerals. Clusters form specific shapes
	// (ring, double-spiral, scatter) and occasionally briefly highlight
	// red as "scary." MDR selector drifts across.

	function sceneRefinery() {
		var DIGITS = '0123456789'.split( '' );

		return makeScene( {
			id: 'refinery',
			label: 'Refinery',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;
				var w = app.renderer.width, h = app.renderer.height;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, w, h, 0xe6f0ea, 0xb8cec3, 12 );

				// Faint grid
				var grid = new PIXI.Graphics();
				grid.alpha = 0.12;
				app.stage.addChild( grid );
				function drawGrid() {
					grid.clear();
					var w = app.renderer.width, h = app.renderer.height;
					for ( var x = 0; x < w; x += 24 ) grid.moveTo( x, 0 ).lineTo( x, h ).stroke( { color: 0x0d2d4e, width: 0.5 } );
					for ( var y = 0; y < h; y += 24 ) grid.moveTo( 0, y ).lineTo( w, y ).stroke( { color: 0x0d2d4e, width: 0.5 } );
				}
				drawGrid();

				var numberLayer = new PIXI.Container();
				app.stage.addChild( numberLayer );

				var style = new PIXI.TextStyle( {
					fontFamily: 'ui-monospace, "Courier New", monospace',
					fontSize: 18, fill: 0x0d2d4e,
				} );
				var styleAlt = new PIXI.TextStyle( {
					fontFamily: 'ui-monospace, "Courier New", monospace',
					fontSize: 12, fill: 0x0d2d4e,
				} );
				var styleScary = new PIXI.TextStyle( {
					fontFamily: 'ui-monospace, "Courier New", monospace',
					fontSize: 22, fill: 0xb22430, fontWeight: 'bold',
				} );

				var particles = [];
				for ( var i = 0; i < 260; i++ ) {
					var big = Math.random() < 0.3;
					var t = new PIXI.Text( {
						text: choose( DIGITS ),
						style: big ? style : styleAlt,
					} );
					t.anchor.set( 0.5 );
					t.x = rand( 0, w ); t.y = rand( 0, h );
					t.alpha = rand( 0.35, 0.9 );
					numberLayer.addChild( t );
					particles.push( {
						node: t, vx: rand( -0.3, 0.3 ), vy: rand( -0.3, 0.3 ),
						homeX: t.x, homeY: t.y, scary: 0,
						bigStyle: big ? style : styleAlt, scaryStyle: styleScary,
					} );
				}

				// MDR selector box
				var selector = new PIXI.Graphics();
				selector.rect( 0, 0, 120, 80 ).stroke( { color: 0x0d2d4e, width: 1.5, alpha: 0.8 } );
				selector.rect( 0, 0, 120, 80 ).fill( { color: 0x0d2d4e, alpha: 0.05 } );
				selector.pivot.set( 60, 40 );
				selector.x = w / 2; selector.y = h / 2;
				app.stage.addChild( selector );

				// Lumon mark
				var mark = new PIXI.Graphics();
				mark.circle( 0, 0, 22 ).stroke( { color: 0x0d2d4e, width: 2 } );
				mark.circle( 0, 0, 14 ).stroke( { color: 0x0d2d4e, width: 1.5 } );
				mark.moveTo( -22, 0 ).lineTo( 22, 0 ).stroke( { color: 0x0d2d4e, width: 1 } );
				mark.moveTo( 0, -22 ).lineTo( 0, 22 ).stroke( { color: 0x0d2d4e, width: 1 } );
				var markText = new PIXI.Text( {
					text: 'LUMON',
					style: { fontFamily: 'Georgia, serif', fontSize: 11, fill: 0x0d2d4e, letterSpacing: 2 },
				} );
				markText.anchor.set( 0.5, 0 );
				markText.y = 28;
				mark.addChild( markText );
				mark.alpha = 0.45;
				app.stage.addChild( mark );

				return {
					bg: bg, grid: grid, drawGrid: drawGrid, numberLayer: numberLayer,
					particles: particles, selector: selector, mark: mark,
					clusterT: 60 * 6, phase: 'idle', clusterShape: null, clusterCenter: null,
					selTargetX: w / 2, selTargetY: h / 2, selT: 0,
				};
			},
			onResize: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;
				paintVGradient( state.bg, w, h, 0xe6f0ea, 0xb8cec3, 12 );
				state.drawGrid();
				state.mark.x = w - 60; state.mark.y = h - 60;
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;
				var t = env.app.ticker.lastTime;
				state.mark.x = w - 60; state.mark.y = h - 60;

				// Selector box drifts
				state.selT -= env.dt;
				if ( state.selT <= 0 ) {
					state.selT = 60 * rand( 3, 8 );
					state.selTargetX = rand( w * 0.15, w * 0.85 );
					state.selTargetY = rand( h * 0.15, h * 0.85 );
				}
				state.selector.x += ( state.selTargetX - state.selector.x ) * 0.015 * env.dt;
				state.selector.y += ( state.selTargetY - state.selector.y ) * 0.015 * env.dt;

				// Cluster cycle
				state.clusterT -= env.dt;
				if ( state.clusterT <= 0 ) {
					if ( state.phase === 'idle' ) {
						state.phase = 'gather';
						state.clusterCenter = { x: rand( w * 0.25, w * 0.75 ), y: rand( h * 0.25, h * 0.75 ) };
						state.clusterShape = choose( [ 'ring', 'spiral', 'crescent' ] );
						state.clusterT = 60 * 5;
					} else if ( state.phase === 'gather' ) {
						state.phase = 'scary';
						state.clusterT = 60 * 2;
					} else if ( state.phase === 'scary' ) {
						state.phase = 'idle';
						state.clusterCenter = null;
						state.clusterT = 60 * rand( 10, 22 );
					}
				}

				var scary = state.phase === 'scary';

				for ( var i = 0; i < state.particles.length; i++ ) {
					var p = state.particles[ i ];
					var tx, ty;
					if ( state.clusterCenter ) {
						var idx = i / state.particles.length;
						if ( state.clusterShape === 'ring' ) {
							var ang = idx * tau * 3 + t * 0.0005;
							var r = 90 + Math.sin( ang * 2 ) * 15;
							tx = state.clusterCenter.x + Math.cos( ang ) * r;
							ty = state.clusterCenter.y + Math.sin( ang ) * r;
						} else if ( state.clusterShape === 'spiral' ) {
							var ang2 = idx * tau * 6;
							var r2 = 20 + idx * 80;
							tx = state.clusterCenter.x + Math.cos( ang2 ) * r2;
							ty = state.clusterCenter.y + Math.sin( ang2 ) * r2;
						} else { // crescent
							var ang3 = idx * Math.PI + t * 0.0004;
							var r3 = 100 + Math.sin( ang3 * 3 ) * 20;
							tx = state.clusterCenter.x + Math.cos( ang3 - Math.PI / 4 ) * r3;
							ty = state.clusterCenter.y + Math.sin( ang3 - Math.PI / 4 ) * r3 * 0.6;
						}
					} else {
						tx = p.homeX + Math.sin( t * 0.0004 + i * 0.25 ) * 50;
						ty = p.homeY + Math.cos( t * 0.00035 + i * 0.25 ) * 50;
					}
					p.node.x += ( tx - p.node.x ) * 0.022 * env.dt;
					p.node.y += ( ty - p.node.y ) * 0.022 * env.dt;
					if ( Math.random() < 0.004 ) p.node.text = choose( DIGITS );

					if ( scary && p.scary < 1 ) p.scary = Math.min( 1, p.scary + 0.04 * env.dt );
					else if ( ! scary && p.scary > 0 ) p.scary = Math.max( 0, p.scary - 0.02 * env.dt );
					p.node.style = p.scary > 0.5 ? p.scaryStyle : p.bigStyle;
				}

				state.mark.alpha = 0.35 + 0.12 * Math.sin( t * 0.0018 );
			},
		} );
	}

	// ================================================================ //
	// 10. SHIMMER — Arcane
	// ================================================================ //
	// Magenta→gold gradient with Zaun silhouette at the bottom,
	// rising bioluminescent particles with trails, hex-grid flashes,
	// gold glints, and a pulsing chem-tank glow at the floor.

	function sceneShimmer() {
		return makeScene( {
			id: 'shimmer',
			label: 'Shimmer',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;
				var w = app.renderer.width, h = app.renderer.height;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				function drawBg() {
					bg.clear();
					var w = app.renderer.width, h = app.renderer.height;
					var steps = 26;
					for ( var i = 0; i < steps; i++ ) {
						var t = i / ( steps - 1 ), c;
						if ( t < 0.3 )      c = lerpColor( 0xc29033, 0x8a2c5b, t / 0.3 );
						else                c = lerpColor( 0x8a2c5b, 0x16051a, ( t - 0.3 ) / 0.7 );
						bg.rect( 0, ( i * h ) / steps, w, h / steps + 1 ).fill( c );
					}
				}
				drawBg();

				// Zaun silhouette (with window lights)
				var zaun = new PIXI.Graphics();
				app.stage.addChild( zaun );
				var zaunWindows = [];
				function drawZaun() {
					zaun.clear();
					zaunWindows = [];
					var w = app.renderer.width, h = app.renderer.height;
					var base = h * 0.82, x = 0;
					while ( x < w ) {
						var bw = rand( 30, 90 );
						var bh = rand( 40, 140 );
						zaun.rect( x, base - bh, bw, h ).fill( { color: 0x0a0210, alpha: 0.97 } );
						// windows
						for ( var wy = base - bh + 8; wy < h - 8; wy += 16 ) {
							for ( var wx = x + 4; wx < x + bw - 5; wx += 10 ) {
								if ( Math.random() < 0.32 ) {
									zaunWindows.push( { x: wx, y: wy, alpha: rand( 0.4, 0.9 ), tw: Math.random() * tau } );
								}
							}
						}
						x += bw + rand( 1, 3 );
					}
					// pipes
					for ( var p = 0; p < 8; p++ ) {
						var px = rand( 40, w - 60 );
						zaun.rect( px, base - 4, 4, h ).fill( { color: 0x190214, alpha: 0.95 } );
					}
				}
				drawZaun();

				// Piltover silhouette (top)
				var pilt = new PIXI.Graphics();
				app.stage.addChild( pilt );
				function drawPilt() {
					pilt.clear();
					var w = app.renderer.width, h = app.renderer.height;
					var top = h * 0.04;
					pilt.poly( [
						0, top,
						40, top - 6,
						80, top + 4,
						130, top - 12,
						180, top + 2,
						240, top - 8,
						300, top + 4,
						360, top - 10,
						420, top + 2,
						480, top - 4,
						540, top,
						w, top - 4,
						w, 0, 0, 0,
					] ).fill( { color: 0x1c1228, alpha: 0.5 } );
				}
				drawPilt();

				var windowLights = new PIXI.Graphics();
				app.stage.addChild( windowLights );

				// Chem-tank glow (bottom)
				var tank = new PIXI.Graphics();
				app.stage.addChild( tank );

				// Hex-grid flash
				var hex = new PIXI.Graphics();
				hex.alpha = 0;
				app.stage.addChild( hex );

				// Particles (rising) + bloom
				var bloom = makeBloomLayer( PIXI, 6 );
				app.stage.addChild( bloom );
				var bloomParticles = new PIXI.Graphics();
				bloom.addChild( bloomParticles );

				var particles = new PIXI.Graphics();
				app.stage.addChild( particles );

				var pts = [];
				for ( var i = 0; i < 170; i++ ) {
					pts.push( {
						x: rand( 0, w ), y: rand( 0, h ),
						prevX: 0, prevY: 0,
						r: rand( 0.8, 2.8 ), vy: -rand( 0.3, 1 ),
						phase: Math.random() * tau, amp: rand( 5, 18 ),
					} );
				}

				// Gold glints
				var glintLayer = new PIXI.Graphics();
				app.stage.addChild( glintLayer );

				return {
					bg: bg, drawBg: drawBg, zaun: zaun, drawZaun: drawZaun, zaunWindows: zaunWindows,
					pilt: pilt, drawPilt: drawPilt, windowLights: windowLights, tank: tank,
					hex: hex, hexAlpha: 0, hexOrigin: { x: w / 2, y: h * 0.88 },
					particles: particles, bloomParticles: bloomParticles, pts: pts,
					glintLayer: glintLayer, hexT: rand( 60 * 12, 60 * 35 ),
				};
			},
			onResize: function ( state, env ) {
				state.drawBg(); state.drawZaun(); state.drawPilt();
				state.hexOrigin = { x: env.app.renderer.width / 2, y: env.app.renderer.height * 0.88 };
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;
				var t = env.app.ticker.lastTime;

				// Window lights flicker
				state.windowLights.clear();
				for ( var i = 0; i < state.zaunWindows.length; i++ ) {
					var wi = state.zaunWindows[ i ];
					wi.tw += 0.02 * env.dt;
					var a = wi.alpha * ( 0.7 + 0.3 * Math.sin( wi.tw ) );
					state.windowLights.rect( wi.x, wi.y, 2, 3 ).fill( { color: 0xff8c5a, alpha: a } );
				}

				// Chem-tank pulse
				state.tank.clear();
				var tankPulse = 0.55 + 0.35 * Math.sin( t * 0.002 );
				for ( var r = 8; r >= 1; r-- ) {
					state.tank.circle( w / 2, h + 10, r * 20 )
						.fill( { color: lerpColor( 0xff4ab8, 0x16051a, r / 8 ), alpha: tankPulse * 0.1 } );
				}

				// Particles
				state.particles.clear();
				state.bloomParticles.clear();
				for ( var j = 0; j < state.pts.length; j++ ) {
					var p = state.pts[ j ];
					p.prevX = p.x + Math.sin( p.phase ) * p.amp;
					p.prevY = p.y;
					p.phase += 0.04 * env.dt;
					p.y += p.vy * env.dt;
					if ( p.y < -10 ) { p.y = h + 20; p.x = rand( 0, w ); }
					var px = p.x + Math.sin( p.phase ) * p.amp;
					var prog = 1 - ( p.y / h );
					var color = lerpColor( 0xff4ab8, 0xffe08a, clamp( prog - 0.4, 0, 1 ) * 1.4 );
					state.particles.moveTo( p.prevX, p.prevY ).lineTo( px, p.y )
						.stroke( { color: color, alpha: 0.35 + prog * 0.4, width: p.r * 0.6 } );
					state.particles.circle( px, p.y, p.r ).fill( { color: color, alpha: 0.5 + prog * 0.4 } );
					state.bloomParticles.circle( px, p.y, p.r * 3 ).fill( { color: color, alpha: 0.12 + prog * 0.18 } );
				}

				// Gold glints
				state.glintLayer.clear();
				var G = 22;
				for ( var g = 0; g < G; g++ ) {
					var gx = ( g / G ) * w + Math.sin( t * 0.0005 + g ) * 16;
					var gy = h * 0.09 + Math.sin( t * 0.0012 + g * 1.3 ) * 6;
					var ga = 0.3 + 0.35 * Math.sin( t * 0.003 + g );
					state.glintLayer.circle( gx, gy, 1.4 ).fill( { color: 0xffe08a, alpha: ga } );
					if ( ga > 0.55 ) {
						// crosshair spark
						state.glintLayer.moveTo( gx - 4, gy ).lineTo( gx + 4, gy )
							.stroke( { color: 0xffe08a, alpha: ga * 0.8, width: 0.6 } );
						state.glintLayer.moveTo( gx, gy - 4 ).lineTo( gx, gy + 4 )
							.stroke( { color: 0xffe08a, alpha: ga * 0.8, width: 0.6 } );
					}
				}

				// Hex flash radiating from origin
				state.hexT -= env.dt;
				if ( state.hexT <= 0 ) {
					state.hexT = rand( 60 * 10, 60 * 30 );
					state.hexAlpha = 1;
					state.hexOrigin = { x: rand( w * 0.2, w * 0.8 ), y: h * 0.88 };
				}
				if ( state.hexAlpha > 0 ) {
					state.hexAlpha = Math.max( 0, state.hexAlpha - 0.015 * env.dt );
					state.hex.clear();
					var HEX_R = 30, HEX_H = HEX_R * Math.sqrt( 3 );
					for ( var y = 0; y < h + HEX_H; y += HEX_H * 0.5 ) {
						for ( var x = 0; x < w + HEX_R * 2; x += HEX_R * 1.5 ) {
							var ox = ( Math.round( y / ( HEX_H * 0.5 ) ) % 2 ) * HEX_R * 0.75;
							var cx = x + ox, cy = y;
							var dist = Math.hypot( cx - state.hexOrigin.x, cy - state.hexOrigin.y );
							var wave = Math.max( 0, 1 - Math.abs( dist - ( 1 - state.hexAlpha ) * 400 ) / 80 );
							state.hex.poly( [
								cx - HEX_R, cy,
								cx - HEX_R * 0.5, cy - HEX_H * 0.5,
								cx + HEX_R * 0.5, cy - HEX_H * 0.5,
								cx + HEX_R, cy,
								cx + HEX_R * 0.5, cy + HEX_H * 0.5,
								cx - HEX_R * 0.5, cy + HEX_H * 0.5,
							] ).stroke( { color: 0xff7ad0, alpha: state.hexAlpha * 0.35 + wave * 0.6, width: 1 } );
						}
					}
				}
			},
		} );
	}

	// ================================================================ //
	// Registration
	// ================================================================ //

	var SCENE_FACTORIES = [
		sceneCodeRain, sceneHyperspace, sceneNeonRain, sceneTronGrid,
		sceneCouchGag, sceneRainbowRoad, sceneSootSprites, sceneUpsideDown,
		sceneRefinery, sceneShimmer,
	];

	var registered = false;
	function registerAll() {
		if ( registered ) return;
		if ( ! window.wp || ! window.wp.desktop || typeof window.wp.desktop.registerWallpaper !== 'function' ) return;
		registered = true;
		for ( var i = 0; i < SCENE_FACTORIES.length; i++ ) {
			try { window.wp.desktop.registerWallpaper( SCENE_FACTORIES[ i ]() ); }
			catch ( e ) { if ( window.console ) window.console.warn( 'B-Roll: scene registration failed', e ); }
		}
	}

	function boot() {
		if ( ! window.wp || ! window.wp.hooks ) return;
		window.wp.hooks.addAction( 'wp-desktop.init', 'b-roll/register', registerAll );
		if ( window.wp.desktop && typeof window.wp.desktop.whenReady === 'function' ) {
			window.wp.desktop.whenReady( registerAll );
		}
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
} )();
