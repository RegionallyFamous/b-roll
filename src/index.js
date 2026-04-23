/**
 * B-Roll for WP Desktop Mode — v0.3 registrar
 * ---------------------------------------------------------------
 * Thin entrypoint that only registers metadata and lazy-loads
 * each scene's implementation the moment a user picks it.
 *
 * Architecture:
 *   - This file defines every scene's preview swatch + label,
 *     installs shared helpers on window.__bRoll, and wires a
 *     shared mount runner.
 *   - Each scene's Pixi logic lives in src/scenes/<slug>.js and
 *     is declared as a module via wp.desktop.registerModule().
 *   - Each wallpaper declares needs: ['pixijs', 'b-roll-<slug>'],
 *     so the shell only fetches a scene's 200–400 lines of Pixi
 *     code when that scene is actually selected.
 *   - Registering N wallpapers now costs metadata only — you can
 *     ship hundreds without bloating the picker or the bundle.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	// ================================================================ //
	// Shared helpers on window.__bRoll — scene files use them.
	// ================================================================ //

	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};

	var rand   = function ( a, b ) { return a + Math.random() * ( b - a ); };
	var irand  = function ( a, b ) { return ( a + Math.random() * ( b - a ) ) | 0; };
	var choose = function ( arr ) { return arr[ ( Math.random() * arr.length ) | 0 ]; };
	var clamp  = function ( v, a, b ) { return v < a ? a : v > b ? b : v; };
	var tau    = Math.PI * 2;

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
			g.rect( 0, ( i * h ) / steps, w, h / steps + 1 ).fill( lerpColor( c0, c1, t ) );
		}
	}

	function makeBloomLayer( PIXI, strength ) {
		var c = new PIXI.Container();
		c.blendMode = 'add';
		c.filters = [ new PIXI.BlurFilter( { strength: strength || 8, quality: 2 } ) ];
		return c;
	}

	window.__bRoll.helpers = {
		rand: rand, irand: irand, choose: choose, clamp: clamp, tau: tau,
		lerpColor: lerpColor, paintVGradient: paintVGradient, makeBloomLayer: makeBloomLayer,
	};

	// ================================================================ //
	// Preview swatches — hand-crafted SVG composites with gradients,
	// Gaussian-blur glow halos, and layered atmospheric perspective.
	// Wrapped in url(...) + a fallback color so they're valid CSS
	// `background` values consumable by <wpd-swatch>.
	// ================================================================ //

	function preview( svg, fallback ) {
		return "url(\"data:image/svg+xml;charset=utf-8," + encodeURIComponent( svg ) +
			"\") center/cover no-repeat, " + ( fallback || '#111' );
	}

	var PREVIEWS = {};

	// --- Code Rain ------------------------------------------------- //
	// v0.4: 3-depth parallax (far/mid/near columns), a MATRIX phrase
	// cascade in progress across 6 adjacent columns, CRT vignette, and
	// scanlines. Captures the new scene's money shot as a single frame.
	PREVIEWS[ 'code-rain' ] = preview( [
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='xMidYMid slice'>",
			"<defs>",
				"<radialGradient id='crBg' cx='.5' cy='.5' r='.9'>",
					"<stop offset='0' stop-color='#021b0f'/>",
					"<stop offset='.6' stop-color='#00080a' stop-opacity='1'/>",
					"<stop offset='1' stop-color='#000'/>",
				"</radialGradient>",
				"<radialGradient id='crVg' cx='.5' cy='.5' r='.75'>",
					"<stop offset='.45' stop-opacity='0'/>",
					"<stop offset='1' stop-opacity='.92'/>",
				"</radialGradient>",
				"<filter id='crG' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='1.8'/></filter>",
				"<pattern id='crSc' width='2' height='2' patternUnits='userSpaceOnUse'><rect width='2' height='1' fill='#000'/></pattern>",
			"</defs>",
			"<rect width='160' height='100' fill='url(#crBg)'/>",
			// Far bucket: tiny, dim, sparse.
			"<g font-family='ui-monospace,monospace' font-size='5' text-anchor='middle' opacity='.55'>",
				"<text x='6' y='20' fill='#004018'>ア</text><text x='6' y='27' fill='#006b2b'>ﾈ</text><text x='6' y='34' fill='#009038'>W</text>",
				"<text x='18' y='8' fill='#004018'>7</text><text x='18' y='15' fill='#006b2b'>ﾀ</text><text x='18' y='22' fill='#00a441'>0</text>",
				"<text x='40' y='4' fill='#004018'>ヒ</text><text x='40' y='11' fill='#006b2b'>ﾔ</text>",
				"<text x='128' y='12' fill='#004018'>ﾙ</text><text x='128' y='19' fill='#006b2b'>W</text>",
				"<text x='148' y='4' fill='#004018'>ヨ</text><text x='148' y='11' fill='#006b2b'>ﾁ</text><text x='148' y='18' fill='#00a441'>3</text>",
				"<text x='154' y='62' fill='#004018'>ﾑ</text><text x='154' y='69' fill='#006b2b'>ﾈ</text>",
			"</g>",
			// Mid bucket: standard columns scattered.
			"<g font-family='ui-monospace,monospace' font-size='8' text-anchor='middle'>",
				"<text x='12' y='52' fill='#003818' opacity='.55'>ア</text>",
				"<text x='12' y='62' fill='#006b2b' opacity='.8'>ﾈ</text>",
				"<text x='12' y='72' fill='#00a441'>ミ</text>",
				"<text x='12' y='82' fill='#00ff66' opacity='.55' filter='url(#crG)'>W</text>",
				"<text x='12' y='82' fill='#eaffdc'>W</text>",
				"<text x='28' y='70' fill='#003818' opacity='.55'>ﾀ</text>",
				"<text x='28' y='80' fill='#006b2b' opacity='.8'>ﾊ</text>",
				"<text x='28' y='90' fill='#00a441'>ﾐ</text>",
				"<text x='140' y='40' fill='#003818' opacity='.55'>ヌ</text>",
				"<text x='140' y='50' fill='#006b2b' opacity='.8'>W</text>",
				"<text x='140' y='60' fill='#00a441'>0</text>",
				"<text x='140' y='70' fill='#00ff66' opacity='.55' filter='url(#crG)'>ﾑ</text>",
				"<text x='140' y='70' fill='#eaffdc'>ﾑ</text>",
			"</g>",
			// Near bucket: phrase cascade "MATRIX" across 6 adjacent columns,
			// bright white heads with green bloom and random trail above.
			"<g font-family='ui-monospace,monospace' font-size='11' text-anchor='middle'>",
				// col M @ x=52
				"<text x='52' y='14' fill='#003818' opacity='.45'>ﾅ</text>",
				"<text x='52' y='28' fill='#006b2b' opacity='.7'>0</text>",
				"<text x='52' y='42' fill='#00a441' opacity='.9'>ﾁ</text>",
				"<text x='52' y='56' fill='#00ff66' opacity='.5' filter='url(#crG)'>M</text>",
				"<text x='52' y='56' fill='#fff'>M</text>",
				// col A @ x=66
				"<text x='66' y='10' fill='#003818' opacity='.45'>ﾓ</text>",
				"<text x='66' y='24' fill='#006b2b' opacity='.7'>ヨ</text>",
				"<text x='66' y='38' fill='#00a441' opacity='.9'>4</text>",
				"<text x='66' y='52' fill='#00ff66' opacity='.5' filter='url(#crG)'>A</text>",
				"<text x='66' y='52' fill='#fff'>A</text>",
				// col T @ x=80
				"<text x='80' y='18' fill='#003818' opacity='.45'>ﾊ</text>",
				"<text x='80' y='32' fill='#006b2b' opacity='.7'>W</text>",
				"<text x='80' y='46' fill='#00a441' opacity='.9'>ﾐ</text>",
				"<text x='80' y='60' fill='#00ff66' opacity='.5' filter='url(#crG)'>T</text>",
				"<text x='80' y='60' fill='#fff'>T</text>",
				// col R @ x=94
				"<text x='94' y='12' fill='#003818' opacity='.45'>1</text>",
				"<text x='94' y='26' fill='#006b2b' opacity='.7'>ネ</text>",
				"<text x='94' y='40' fill='#00a441' opacity='.9'>ﾀ</text>",
				"<text x='94' y='54' fill='#00ff66' opacity='.5' filter='url(#crG)'>R</text>",
				"<text x='94' y='54' fill='#fff'>R</text>",
				// col I @ x=108
				"<text x='108' y='16' fill='#003818' opacity='.45'>ﾖ</text>",
				"<text x='108' y='30' fill='#006b2b' opacity='.7'>3</text>",
				"<text x='108' y='44' fill='#00a441' opacity='.9'>W</text>",
				"<text x='108' y='58' fill='#00ff66' opacity='.5' filter='url(#crG)'>I</text>",
				"<text x='108' y='58' fill='#fff'>I</text>",
				// col X @ x=122
				"<text x='122' y='10' fill='#003818' opacity='.45'>ﾑ</text>",
				"<text x='122' y='24' fill='#006b2b' opacity='.7'>ﾁ</text>",
				"<text x='122' y='38' fill='#00a441' opacity='.9'>0</text>",
				"<text x='122' y='52' fill='#00ff66' opacity='.5' filter='url(#crG)'>X</text>",
				"<text x='122' y='52' fill='#fff'>X</text>",
			"</g>",
			"<rect width='160' height='100' fill='url(#crSc)' opacity='.28'/>",
			"<rect width='160' height='100' fill='url(#crVg)'/>",
		"</svg>",
	].join( '' ), '#000' );

	// --- Hyperspace ----------------------------------------------- //
	// v0.4: lens-flare iris with 8 cross-pattern spokes, cubic
	// acceleration streaks (wider near the edge), deep background
	// twinkle stars, chromatic warp-flash ghosts at the frame edges.
	PREVIEWS[ 'hyperspace' ] = preview( [
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='xMidYMid slice'>",
			"<defs>",
				"<radialGradient id='hyGlow' cx='.5' cy='.5' r='.58'>",
					"<stop offset='0' stop-color='#4a82ff' stop-opacity='1'/>",
					"<stop offset='.35' stop-color='#183c7a' stop-opacity='.9'/>",
					"<stop offset='1' stop-color='#000010' stop-opacity='1'/>",
				"</radialGradient>",
				"<radialGradient id='hyVg' cx='.5' cy='.5' r='.72'>",
					"<stop offset='.55' stop-opacity='0'/>",
					"<stop offset='1' stop-opacity='.88'/>",
				"</radialGradient>",
				"<filter id='hyB' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='2.6'/></filter>",
				"<filter id='hyBb' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='1.2'/></filter>",
			"</defs>",
			"<rect width='160' height='100' fill='#000010'/>",
			"<rect width='160' height='100' fill='url(#hyGlow)' opacity='.7'/>",
			// Deep background twinkle stars.
			"<g fill='#ffffff'>",
				"<circle cx='14' cy='8' r='.6' opacity='.85'/><circle cx='40' cy='6' r='.5' opacity='.6'/>",
				"<circle cx='60' cy='12' r='.4' opacity='.5'/><circle cx='98' cy='5' r='.7' opacity='.95'/>",
				"<circle cx='122' cy='10' r='.4' opacity='.55'/><circle cx='148' cy='14' r='.5' opacity='.7'/>",
				"<circle cx='8' cy='32' r='.4' opacity='.5'/><circle cx='28' cy='44' r='.5' opacity='.7'/>",
				"<circle cx='132' cy='36' r='.4' opacity='.5'/><circle cx='152' cy='48' r='.5' opacity='.65'/>",
				"<circle cx='10' cy='70' r='.5' opacity='.6'/><circle cx='22' cy='90' r='.4' opacity='.45'/>",
				"<circle cx='44' cy='94' r='.5' opacity='.7'/><circle cx='96' cy='92' r='.4' opacity='.5'/>",
				"<circle cx='126' cy='78' r='.4' opacity='.5'/><circle cx='150' cy='86' r='.6' opacity='.8'/>",
			"</g>",
			// Mid streaks.
			"<g stroke='#b4d0ff' stroke-linecap='round' fill='none' opacity='.55'>",
				"<line x1='80' y1='50' x2='30' y2='16' stroke-width='.5'/>",
				"<line x1='80' y1='50' x2='48' y2='22' stroke-width='.5'/>",
				"<line x1='80' y1='50' x2='120' y2='20' stroke-width='.5'/>",
				"<line x1='80' y1='50' x2='134' y2='30' stroke-width='.5'/>",
				"<line x1='80' y1='50' x2='50' y2='78' stroke-width='.5'/>",
				"<line x1='80' y1='50' x2='108' y2='82' stroke-width='.5'/>",
				"<line x1='80' y1='50' x2='26' y2='60' stroke-width='.4'/>",
				"<line x1='80' y1='50' x2='70' y2='18' stroke-width='.4'/>",
			"</g>",
			// Near streaks with lead dots (wider because they ease up near edges).
			"<g stroke='#ffffff' stroke-linecap='round' fill='none'>",
				"<line x1='80' y1='50' x2='6' y2='8'   stroke-width='1.4'/>",
				"<line x1='80' y1='50' x2='20' y2='26' stroke-width='1.1'/>",
				"<line x1='80' y1='50' x2='152' y2='12' stroke-width='1.5'/>",
				"<line x1='80' y1='50' x2='140' y2='32' stroke-width='1.1'/>",
				"<line x1='80' y1='50' x2='156' y2='66' stroke-width='1.3'/>",
				"<line x1='80' y1='50' x2='130' y2='88' stroke-width='1.4'/>",
				"<line x1='80' y1='50' x2='80' y2='94'  stroke-width='1.4'/>",
				"<line x1='80' y1='50' x2='34' y2='86' stroke-width='1.3'/>",
				"<line x1='80' y1='50' x2='4' y2='74'  stroke-width='1.2'/>",
				"<line x1='80' y1='50' x2='12' y2='40' stroke-width='1.0'/>",
			"</g>",
			"<g fill='#ffffff'>",
				"<circle cx='6' cy='8' r='1.1'/><circle cx='152' cy='12' r='1.2'/><circle cx='156' cy='66' r='1.1'/>",
				"<circle cx='130' cy='88' r='1.2'/><circle cx='80' cy='94' r='1.1'/><circle cx='34' cy='86' r='1.1'/>",
				"<circle cx='4' cy='74' r='1'/>",
			"</g>",
			// Lens-flare spokes around the iris.
			"<g stroke='#b4d0ff' stroke-linecap='round' opacity='.45' filter='url(#hyBb)'>",
				"<line x1='80' y1='50' x2='56' y2='50' stroke-width='2.4'/>",
				"<line x1='80' y1='50' x2='104' y2='50' stroke-width='2.4'/>",
				"<line x1='80' y1='50' x2='80' y2='30' stroke-width='2.4'/>",
				"<line x1='80' y1='50' x2='80' y2='70' stroke-width='2.4'/>",
				"<line x1='80' y1='50' x2='63' y2='36' stroke-width='1.4'/>",
				"<line x1='80' y1='50' x2='97' y2='64' stroke-width='1.4'/>",
				"<line x1='80' y1='50' x2='97' y2='36' stroke-width='1.4'/>",
				"<line x1='80' y1='50' x2='63' y2='64' stroke-width='1.4'/>",
			"</g>",
			// Core iris.
			"<circle cx='80' cy='50' r='10' fill='#4a82ff' filter='url(#hyB)' opacity='.9'/>",
			"<circle cx='80' cy='50' r='4.5' fill='#dbeaff'/>",
			"<circle cx='80' cy='50' r='2' fill='#ffffff'/>",
			// Subtle chromatic ghost hint at the edges (post-warp afterglow).
			"<rect x='-2' y='0' width='6' height='100' fill='#4affee' opacity='.22'/>",
			"<rect x='156' y='0' width='6' height='100' fill='#ff4ac8' opacity='.22'/>",
			// Vignette.
			"<rect width='160' height='100' fill='url(#hyVg)'/>",
		"</svg>",
	].join( '' ), '#000010' );

	// --- Neon Rain ------------------------------------------------- //
	// v0.4: wet-ground reflection band with ripple shimmer, fog haze
	// between the 3 city layers, flickering windows at varied
	// intensities, distant lightning silhouette on the horizon, neon
	// signs with bloom, diagonal rain + ground-impact splashes.
	PREVIEWS[ 'neon-rain' ] = preview( [
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='xMidYMid slice'>",
			"<defs>",
				"<linearGradient id='nrSky' x1='0' y1='0' x2='0' y2='1'>",
					"<stop offset='0' stop-color='#2e0a28'/>",
					"<stop offset='.55' stop-color='#0d0412'/>",
					"<stop offset='.88' stop-color='#050210'/>",
					"<stop offset='1' stop-color='#000'/>",
				"</linearGradient>",
				"<linearGradient id='nrRefl' x1='0' y1='0' x2='0' y2='1'>",
					"<stop offset='0' stop-color='#2a1840' stop-opacity='.85'/>",
					"<stop offset='1' stop-color='#000' stop-opacity='1'/>",
				"</linearGradient>",
				"<filter id='nrNeon' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='2.4'/></filter>",
				"<filter id='nrSoft' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='.6'/></filter>",
			"</defs>",
			"<rect width='160' height='100' fill='url(#nrSky)'/>",
			// Distant lightning glow on the horizon.
			"<rect x='40' y='40' width='60' height='14' fill='#d8baff' opacity='.12' filter='url(#nrNeon)'/>",
			// Moon.
			"<circle cx='124' cy='20' r='10' fill='#f0c6ff' opacity='.22' filter='url(#nrNeon)'/>",
			"<circle cx='124' cy='20' r='5' fill='#efe5ff' opacity='.95'/>",
			// Far city.
			"<g fill='#1a0f22'>",
				"<rect x='0' y='56' width='20' height='30'/><rect x='18' y='48' width='16' height='38'/>",
				"<rect x='32' y='58' width='12' height='28'/><rect x='42' y='44' width='18' height='42'/>",
				"<rect x='58' y='54' width='14' height='32'/><rect x='70' y='50' width='18' height='36'/>",
				"<rect x='86' y='60' width='10' height='26'/><rect x='94' y='46' width='16' height='40'/>",
				"<rect x='108' y='58' width='12' height='28'/><rect x='118' y='42' width='20' height='44'/>",
				"<rect x='136' y='54' width='14' height='32'/><rect x='148' y='48' width='12' height='38'/>",
			"</g>",
			// Fog haze between far and mid.
			"<rect x='0' y='50' width='160' height='18' fill='#3a1440' opacity='.26'/>",
			// Mid city.
			"<g fill='#050308'>",
				"<rect x='4' y='64' width='24' height='22'/><rect x='28' y='58' width='18' height='28'/>",
				"<rect x='44' y='62' width='14' height='24'/><rect x='56' y='52' width='22' height='34'/>",
				"<rect x='76' y='60' width='16' height='26'/><rect x='90' y='56' width='20' height='30'/>",
				"<rect x='108' y='64' width='12' height='22'/><rect x='118' y='54' width='18' height='32'/>",
				"<rect x='134' y='62' width='14' height='24'/><rect x='146' y='58' width='14' height='28'/>",
			"</g>",
			// Fog haze between mid and near.
			"<rect x='0' y='62' width='160' height='14' fill='#1a0420' opacity='.28'/>",
			// Windows (amber glow).
			"<g fill='#ffc873'>",
				"<rect x='10' y='68' width='1.4' height='1.8' opacity='.9'/><rect x='20' y='72' width='1.4' height='1.8' opacity='.55'/>",
				"<rect x='32' y='60' width='1.4' height='1.8' opacity='.85'/><rect x='47' y='66' width='1.4' height='1.8' opacity='.75'/>",
				"<rect x='62' y='56' width='1.4' height='1.8' opacity='.9'/><rect x='68' y='70' width='1.4' height='1.8' opacity='.65'/>",
				"<rect x='82' y='66' width='1.4' height='1.8' opacity='.8'/><rect x='96' y='60' width='1.4' height='1.8' opacity='.9'/>",
				"<rect x='100' y='68' width='1.4' height='1.8' opacity='.55'/><rect x='122' y='58' width='1.4' height='1.8' opacity='.85'/>",
				"<rect x='128' y='68' width='1.4' height='1.8' opacity='.3'/><rect x='140' y='68' width='1.4' height='1.8' opacity='.7'/>",
				"<rect x='150' y='62' width='1.4' height='1.8' opacity='.85'/>",
			"</g>",
			// Neon signs.
			"<g font-family='Impact,sans-serif' font-weight='bold'>",
				"<text x='44' y='26' font-size='14' fill='#ff4aa0' opacity='.4' filter='url(#nrNeon)'>TYRELL</text>",
				"<text x='44' y='26' font-size='14' fill='#ff4aa0'>TYRELL</text>",
				"<text x='102' y='46' font-size='8' fill='#64d8ff' opacity='.4' filter='url(#nrNeon)'>NEXUS</text>",
				"<text x='102' y='46' font-size='8' fill='#64d8ff'>NEXUS</text>",
				"<text x='8' y='40' font-size='7' fill='#fff14d' opacity='.85'>2049</text>",
			"</g>",
			// Rain.
			"<g stroke='#b4c8ff' stroke-width='.55' opacity='.7' filter='url(#nrSoft)'>",
				"<line x1='14' y1='2' x2='9' y2='14'/><line x1='30' y1='6' x2='25' y2='18'/>",
				"<line x1='50' y1='0' x2='45' y2='12'/><line x1='72' y1='8' x2='67' y2='20'/>",
				"<line x1='92' y1='4' x2='87' y2='16'/><line x1='112' y1='10' x2='107' y2='22'/>",
				"<line x1='134' y1='2' x2='129' y2='14'/><line x1='150' y1='8' x2='145' y2='20'/>",
				"<line x1='20' y1='34' x2='15' y2='46'/><line x1='80' y1='38' x2='75' y2='50'/>",
				"<line x1='140' y1='36' x2='135' y2='48'/>",
				"<line x1='36' y1='60' x2='31' y2='72'/><line x1='108' y1='60' x2='103' y2='72'/>",
			"</g>",
			// Wet-ground reflection band (flipped skyline, ripple-tinted).
			"<g transform='translate(0,176) scale(1,-0.55)' opacity='.6'>",
				"<g fill='#2a1840'>",
					"<rect x='4' y='64' width='24' height='22'/><rect x='28' y='58' width='18' height='28'/>",
					"<rect x='44' y='62' width='14' height='24'/><rect x='56' y='52' width='22' height='34'/>",
					"<rect x='76' y='60' width='16' height='26'/><rect x='90' y='56' width='20' height='30'/>",
					"<rect x='108' y='64' width='12' height='22'/><rect x='118' y='54' width='18' height='32'/>",
					"<rect x='134' y='62' width='14' height='24'/><rect x='146' y='58' width='14' height='28'/>",
				"</g>",
			"</g>",
			// Ripple shimmer bands across reflection.
			"<g fill='#64a0ff'>",
				"<rect x='0' y='90' width='160' height='.6' opacity='.25'/>",
				"<rect x='0' y='93' width='160' height='.6' opacity='.2'/>",
				"<rect x='0' y='96' width='160' height='.6' opacity='.15'/>",
				"<rect x='0' y='98' width='160' height='.6' opacity='.1'/>",
			"</g>",
			// Water-surface line.
			"<rect x='0' y='88.4' width='160' height='.6' fill='#8a64b0' opacity='.5'/>",
			// Splash circles (ground impacts).
			"<g stroke='#a8c8ff' fill='none' stroke-width='.35'>",
				"<circle cx='28' cy='90' r='1.6' opacity='.55'/>",
				"<circle cx='76' cy='92' r='2.0' opacity='.4'/>",
				"<circle cx='126' cy='91' r='1.4' opacity='.55'/>",
				"<circle cx='52' cy='93' r='.9' opacity='.7'/>",
				"<circle cx='100' cy='90' r='1.1' opacity='.65'/>",
			"</g>",
		"</svg>",
	].join( '' ), '#0d0412' );

	// --- The Grid (Tron) ------------------------------------------ //
	// v0.4: scrolling perspective grid with brighter near rows and
	// intersection dots, a horizon-glow reflection band below the
	// vanishing line, two cycles mid-circuit with long fade-trails,
	// and a data packet traveling along one of the trails.
	PREVIEWS[ 'tron-grid' ] = preview( [
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='xMidYMid slice'>",
			"<defs>",
				"<linearGradient id='tgSky' x1='0' y1='0' x2='0' y2='1'>",
					"<stop offset='0' stop-color='#001830'/><stop offset='.5' stop-color='#000814'/><stop offset='1' stop-color='#000'/>",
				"</linearGradient>",
				"<filter id='tgGl' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='2.6'/></filter>",
				"<linearGradient id='tgRefl' x1='0' y1='0' x2='0' y2='1'>",
					"<stop offset='0' stop-color='#ff7a1a' stop-opacity='.55'/>",
					"<stop offset='1' stop-color='#000' stop-opacity='0'/>",
				"</linearGradient>",
			"</defs>",
			"<rect width='160' height='100' fill='url(#tgSky)'/>",
			// Horizon halo (bloom) + bright horizon line.
			"<rect x='0' y='45' width='160' height='9' fill='#ff7a1a' opacity='.7' filter='url(#tgGl)'/>",
			"<rect x='0' y='51' width='160' height='2' fill='#ff9f4a'/>",
			// Horizon reflection glow (glossy floor).
			"<rect x='0' y='53' width='160' height='18' fill='url(#tgRefl)'/>",
			// Perspective grid — rows with increasing brightness/width.
			"<g stroke='#00c0ff' fill='none'>",
				"<line x1='0' y1='57' x2='160' y2='57' stroke-width='.3' opacity='.32'/>",
				"<line x1='0' y1='62' x2='160' y2='62' stroke-width='.4' opacity='.5'/>",
				"<line x1='0' y1='68' x2='160' y2='68' stroke-width='.6' opacity='.65'/>",
				"<line x1='0' y1='76' x2='160' y2='76' stroke-width='.8' opacity='.8'/>",
				"<line x1='0' y1='86' x2='160' y2='86' stroke-width='1.1' opacity='.95'/>",
				"<line x1='0' y1='96' x2='160' y2='96' stroke-width='1.4' opacity='1'/>",
			"</g>",
			// Near rows get a bloom pass for the neon-ing.
			"<g stroke='#40d8ff' fill='none' opacity='.55' filter='url(#tgGl)'>",
				"<line x1='0' y1='86' x2='160' y2='86' stroke-width='1.6'/>",
				"<line x1='0' y1='96' x2='160' y2='96' stroke-width='2'/>",
			"</g>",
			// Vertical convergence lines.
			"<g stroke='#00c0ff' fill='none' opacity='.35'>",
				"<line x1='80' y1='53' x2='-40' y2='100' stroke-width='.5'/>",
				"<line x1='80' y1='53' x2='10' y2='100' stroke-width='.5'/>",
				"<line x1='80' y1='53' x2='45' y2='100' stroke-width='.5'/>",
				"<line x1='80' y1='53' x2='80' y2='100' stroke-width='.5'/>",
				"<line x1='80' y1='53' x2='115' y2='100' stroke-width='.5'/>",
				"<line x1='80' y1='53' x2='150' y2='100' stroke-width='.5'/>",
				"<line x1='80' y1='53' x2='200' y2='100' stroke-width='.5'/>",
			"</g>",
			// Intersection dots on the two near rows.
			"<g fill='#9ef2ff'>",
				"<circle cx='18' cy='86' r='.9'/><circle cx='42' cy='86' r='1'/><circle cx='64' cy='86' r='1.1'/>",
				"<circle cx='80' cy='86' r='1.1'/><circle cx='96' cy='86' r='1.1'/><circle cx='118' cy='86' r='1'/><circle cx='142' cy='86' r='.9'/>",
				"<circle cx='8' cy='96' r='1.2'/><circle cx='36' cy='96' r='1.3'/><circle cx='62' cy='96' r='1.4'/>",
				"<circle cx='80' cy='96' r='1.4'/><circle cx='98' cy='96' r='1.4'/><circle cx='124' cy='96' r='1.3'/><circle cx='152' cy='96' r='1.2'/>",
			"</g>",
			// Cyan cycle trail — comes from upper-left, turns down.
			"<path d='M 18 66 L 18 80 L 42 80 L 42 90' stroke='#00eaff' stroke-width='3' fill='none' filter='url(#tgGl)' opacity='.7'/>",
			"<path d='M 18 66 L 18 80 L 42 80 L 42 90' stroke='#00eaff' stroke-width='1.5' fill='none'/>",
			"<rect x='38' y='87' width='8' height='4' fill='#fff'/>",
			"<circle cx='42' cy='90' r='5' fill='#00eaff' opacity='.55' filter='url(#tgGl)'/>",
			// Data packet traveling along cyan trail.
			"<circle cx='30' cy='80' r='3.8' fill='#00eaff' opacity='.6' filter='url(#tgGl)'/>",
			"<circle cx='30' cy='80' r='1.6' fill='#ffffff'/>",
			// Orange cycle trail — runs right, turns up.
			"<path d='M 142 70 L 110 70 L 110 84' stroke='#ff6d1f' stroke-width='3' fill='none' filter='url(#tgGl)' opacity='.65'/>",
			"<path d='M 142 70 L 110 70 L 110 84' stroke='#ff6d1f' stroke-width='1.4' fill='none'/>",
			"<rect x='106' y='82' width='8' height='4' fill='#fff'/>",
			"<circle cx='110' cy='84' r='5' fill='#ff6d1f' opacity='.55' filter='url(#tgGl)'/>",
		"</svg>",
	].join( '' ), '#000814' );

	// --- Couch Gag (Simpsons) ------------------------------------- //
	// v0.4: pulsing sun corona + lens-flare ghost spots, 3 depths of
	// flapping birds, drifting clouds, wind-swayed grass strip at
	// the bottom, a wind-gust streak mid-sky, and the couch landed
	// in its bouncy hold pose.
	PREVIEWS[ 'couch-gag' ] = preview( [
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='xMidYMid slice'>",
			"<defs>",
				"<linearGradient id='cgSky' x1='0' y1='0' x2='0' y2='1'>",
					"<stop offset='0' stop-color='#7ab9f0'/><stop offset='1' stop-color='#daefff'/>",
				"</linearGradient>",
				"<radialGradient id='cgSun' cx='.5' cy='.5' r='.55'>",
					"<stop offset='0' stop-color='#fffad2'/><stop offset='.45' stop-color='#ffde3a'/><stop offset='1' stop-color='#ffde3a' stop-opacity='0'/>",
				"</radialGradient>",
				"<filter id='cgSh' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='1.2'/></filter>",
				"<filter id='cgSoft' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='2.6'/></filter>",
			"</defs>",
			"<rect width='160' height='100' fill='url(#cgSky)'/>",
			// Sun with pulsing corona.
			"<circle cx='130' cy='22' r='34' fill='#ffde3a' opacity='.16' filter='url(#cgSoft)'/>",
			"<circle cx='130' cy='22' r='24' fill='url(#cgSun)'/>",
			// Lens-flare ghost spots along the sun→screen-center axis.
			"<circle cx='115' cy='34' r='3.8' fill='#ffb868' opacity='.45'/>",
			"<circle cx='100' cy='46' r='2.4' fill='#8abff0' opacity='.35'/>",
			"<circle cx='80' cy='60' r='5' fill='#ffde3a' opacity='.22'/>",
			"<circle cx='60' cy='74' r='3' fill='#ff6a88' opacity='.28'/>",
			// Wind-gust streaks mid-sky.
			"<g stroke='#ffffff' stroke-width='.55' opacity='.6'>",
				"<line x1='28' y1='36' x2='58' y2='35'/>",
				"<line x1='20' y1='42' x2='50' y2='41'/>",
				"<line x1='34' y1='30' x2='62' y2='29'/>",
			"</g>",
			// Drifting clouds (with subtle shadow bases).
			"<g>",
				"<ellipse cx='30' cy='25' rx='22' ry='7' fill='#dde9f5' opacity='.5' filter='url(#cgSh)'/>",
				"<g fill='#fff'>",
					"<circle cx='20' cy='20' r='8'/><circle cx='30' cy='16' r='9'/><circle cx='40' cy='22' r='8'/>",
					"<circle cx='26' cy='26' r='7'/><circle cx='36' cy='27' r='7'/>",
				"</g>",
				"<ellipse cx='85' cy='18' rx='18' ry='5' fill='#dde9f5' opacity='.4' filter='url(#cgSh)'/>",
				"<g fill='#fff'>",
					"<circle cx='78' cy='14' r='7'/><circle cx='88' cy='12' r='8'/><circle cx='96' cy='16' r='7'/>",
				"</g>",
			"</g>",
			// Multi-depth birds.
			"<g stroke='#000' fill='none'>",
				// far (tiny)
				"<path stroke-width='.5' d='M 52 10 q 1.5 -1.3 3 0 q 1.5 -1.3 3 0'/>",
				"<path stroke-width='.5' d='M 108 8 q 1.5 -1.3 3 0 q 1.5 -1.3 3 0'/>",
				// mid
				"<path stroke-width='.75' d='M 70 28 q 2 -1.8 4 0 q 2 -1.8 4 0'/>",
				"<path stroke-width='.75' d='M 100 32 q 2 -1.8 4 0 q 2 -1.8 4 0'/>",
				// near
				"<path stroke-width='1.0' d='M 42 48 q 2.6 -2.4 5 0 q 2.6 -2.4 5 0'/>",
			"</g>",
			// Wind-swayed grass strip.
			"<g stroke-linecap='round'>",
				"<path d='M 2 98 q .5 -6 1.5 -12' stroke='#3a9e3a' stroke-width='1.1' fill='none'/>",
				"<path d='M 8 98 q -.6 -7 -1.2 -14' stroke='#44b842' stroke-width='1.1' fill='none'/>",
				"<path d='M 14 98 q .8 -8 1.7 -15' stroke='#2f8a35' stroke-width='1' fill='none'/>",
				"<path d='M 22 98 q -.7 -7 -1.5 -14' stroke='#4ac84e' stroke-width='1.1' fill='none'/>",
				"<path d='M 30 98 q .5 -6 1.2 -12' stroke='#3a9e3a' stroke-width='1' fill='none'/>",
				"<path d='M 38 98 q -.5 -6 -1 -12' stroke='#44b842' stroke-width='.9' fill='none'/>",
				"<path d='M 46 98 q .8 -8 1.6 -15' stroke='#2f8a35' stroke-width='1.1' fill='none'/>",
				"<path d='M 132 98 q .4 -5 .9 -10' stroke='#3a9e3a' stroke-width='.9' fill='none'/>",
				"<path d='M 138 98 q -.6 -6 -1.2 -12' stroke='#44b842' stroke-width='1' fill='none'/>",
				"<path d='M 144 98 q .7 -7 1.3 -13' stroke='#4ac84e' stroke-width='1.1' fill='none'/>",
				"<path d='M 152 98 q -.5 -5 -1 -10' stroke='#2f8a35' stroke-width='.9' fill='none'/>",
			"</g>",
			// Couch shadow.
			"<ellipse cx='80' cy='86' rx='40' ry='3' fill='#000' opacity='.2' filter='url(#cgSh)'/>",
			// Couch (landed and bouncing in place).
			"<g>",
				"<rect x='48' y='66' width='64' height='18' rx='3' fill='#c36a1e'/>",
				"<rect x='52' y='60' width='16' height='10' rx='2' fill='#e89254'/>",
				"<rect x='72' y='60' width='16' height='10' rx='2' fill='#e89254'/>",
				"<rect x='92' y='60' width='16' height='10' rx='2' fill='#e89254'/>",
				"<rect x='44' y='64' width='7' height='22' rx='2' fill='#8a4812'/>",
				"<rect x='110' y='64' width='7' height='22' rx='2' fill='#8a4812'/>",
				"<rect x='50' y='84' width='4' height='6' fill='#3d1e08'/>",
				"<rect x='108' y='84' width='4' height='6' fill='#3d1e08'/>",
				"<rect x='48' y='67' width='64' height='1.5' fill='#e89254' opacity='.5'/>",
			"</g>",
		"</svg>",
	].join( '' ), '#7ab9f0' );

	// --- Rainbow Road (Mario Kart) -------------------------------- //
	// --- Rainbow Road --------------------------------------------- //
	// v0.4: tinted starfield (white + amber + cyan + pink), Saturn
	// planet with surface bands + ring shadow, scrolling chevron
	// lane markings, 2 abstract kart silhouettes mid-race, a speed-
	// line burst radiating from the vanishing point, neon guardrails.
	PREVIEWS[ 'rainbow-road' ] = preview( [
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='xMidYMid slice'>",
			"<defs>",
				"<linearGradient id='sp2' x1='0' y1='0' x2='0' y2='1'>",
					"<stop offset='0' stop-color='#15023a'/><stop offset='.5' stop-color='#0a001e'/><stop offset='1' stop-color='#000'/>",
				"</linearGradient>",
				"<radialGradient id='planet' cx='.35' cy='.4' r='.65'>",
					"<stop offset='0' stop-color='#f6c766'/><stop offset='.5' stop-color='#c28a3a'/><stop offset='1' stop-color='#5a3a14'/>",
				"</radialGradient>",
				"<filter id='rl' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='1.6'/></filter>",
			"</defs>",
			"<rect width='160' height='100' fill='url(#sp2)'/>",
			// Saturn: body + surface bands + ring + ring shadow.
			"<g transform='translate(124 28) rotate(-8)'>",
				"<circle r='12' fill='url(#planet)'/>",
				"<ellipse cy='-5' rx='10' ry='.8' fill='#ba6a28' opacity='.7'/>",
				"<ellipse cy='-1' rx='11.5' ry='.9' fill='#c97830' opacity='.7'/>",
				"<ellipse cy='4'  rx='11' ry='.8' fill='#ba6a28' opacity='.7'/>",
				"<ellipse cy='8'  rx='8' ry='.6' fill='#c97830' opacity='.7'/>",
				"<ellipse cy='0' rx='16' ry='1' fill='#7a4a1e' opacity='.6'/>",
				"<ellipse rx='18' ry='3' fill='none' stroke='#f6dca0' stroke-width='.8' opacity='.9'/>",
				"<ellipse rx='15' ry='2.3' fill='none' stroke='#eccb88' stroke-width='.4' opacity='.55'/>",
			"</g>",
			// Tinted starfield.
			"<g>",
				"<circle cx='8' cy='8' r='.7' fill='#fff'/>",
				"<circle cx='20' cy='12' r='.4' fill='#ffe8a8'/>",
				"<circle cx='34' cy='6' r='.9' fill='#fff'/>",
				"<circle cx='50' cy='14' r='.5' fill='#a8d8ff'/>",
				"<circle cx='66' cy='10' r='.6' fill='#fff'/>",
				"<circle cx='78' cy='6' r='.7' fill='#ffb0d8'/>",
				"<circle cx='92' cy='16' r='.5' fill='#fff'/>",
				"<circle cx='102' cy='10' r='.4' fill='#a8d8ff'/>",
				"<circle cx='146' cy='8' r='.8' fill='#fff'/>",
				"<circle cx='156' cy='18' r='.5' fill='#ffe8a8'/>",
				"<circle cx='10' cy='26' r='.4' fill='#fff'/>",
				"<circle cx='44' cy='30' r='.5' fill='#ffb0d8'/>",
				"<circle cx='22' cy='40' r='.4' fill='#fff'/>",
				"<circle cx='150' cy='42' r='.6' fill='#a8d8ff'/>",
			"</g>",
			// Shooting star.
			"<g opacity='.8'>",
				"<line x1='30' y1='20' x2='50' y2='26' stroke='#fff' stroke-width='.8' stroke-linecap='round'/>",
				"<circle cx='52' cy='27' r='1' fill='#fff'/>",
			"</g>",
			// Speed-line burst from vanishing point (80, 50).
			"<g stroke='#fff' stroke-width='.6' stroke-linecap='round' opacity='.7'>",
				"<line x1='74' y1='44' x2='66' y2='36'/>",
				"<line x1='86' y1='44' x2='94' y2='36'/>",
				"<line x1='88' y1='50' x2='100' y2='50'/>",
				"<line x1='72' y1='50' x2='60' y2='50'/>",
				"<line x1='78' y1='44' x2='76' y2='32'/>",
				"<line x1='82' y1='44' x2='84' y2='32'/>",
			"</g>",
			// Road perspective stripes.
			"<g>",
				"<polygon points='76,50 84,50 110,100 50,100' fill='#ff2d5a'/>",
				"<polygon points='74,52 86,52 115,100 45,100' fill='#ff993d' opacity='.95'/>",
				"<polygon points='72,54 88,54 120,100 40,100' fill='#ffe84a' opacity='.85'/>",
				"<polygon points='70,56 90,56 125,100 35,100' fill='#31d16a' opacity='.75'/>",
				"<polygon points='68,58 92,58 130,100 30,100' fill='#3dc3ff' opacity='.6'/>",
				"<polygon points='66,60 94,60 140,100 20,100' fill='#8a5bff' opacity='.4'/>",
			"</g>",
			// Guardrails with glow.
			"<g>",
				"<polygon points='76,50 75,50 40,100 42,100' fill='#64d8ff' opacity='.55' filter='url(#rl)'/>",
				"<polygon points='76,50 75,50 42,100 44,100' fill='#b0f0ff'/>",
				"<polygon points='84,50 85,50 120,100 118,100' fill='#ff4aa0' opacity='.55' filter='url(#rl)'/>",
				"<polygon points='84,50 85,50 118,100 116,100' fill='#ffb0d8'/>",
			"</g>",
			// Centre line.
			"<line x1='80' y1='52' x2='80' y2='100' stroke='#fff' stroke-width='1.2' opacity='.6'/>",
			// Chevron lane markings scrolling toward viewer.
			"<g fill='none' stroke='#fff' stroke-linecap='round'>",
				"<polyline points='78,56 82,58 78,60' stroke-width='.6' opacity='.55'/>",
				"<polyline points='76,68 84,72 76,76' stroke-width='1.2' opacity='.75'/>",
				"<polyline points='73,84 87,90 73,96' stroke-width='2' opacity='.9'/>",
			"</g>",
			// Kart silhouettes (far + near).
			"<g>",
				// Far kart near horizon, cyan.
				"<ellipse cx='78' cy='62' rx='3.5' ry='1.4' fill='#3dc3ff'/>",
				"<circle cx='76' cy='63.2' r='.9' fill='#1a1020'/>",
				"<circle cx='80' cy='63.2' r='.9' fill='#1a1020'/>",
				// Near kart, red, lower-right.
				"<ellipse cx='96' cy='86' rx='9' ry='3.6' fill='#ff5a3d'/>",
				"<ellipse cx='96' cy='84' rx='5' ry='2' fill='#fff' opacity='.6'/>",
				"<circle cx='91' cy='88.5' r='2.4' fill='#1a1020'/>",
				"<circle cx='101' cy='88.5' r='2.4' fill='#1a1020'/>",
				"<ellipse cx='96' cy='90' rx='10' ry='2.6' fill='#ff5a3d' opacity='.35' filter='url(#rl)'/>",
			"</g>",
			// Spinning ? item box drifting across upper road.
			"<g transform='translate(116,40) rotate(18)'>",
				"<rect x='-9' y='-9' width='18' height='18' rx='3' fill='#ff9e1a' filter='url(#rl)' opacity='.6'/>",
				"<rect x='-8' y='-8' width='16' height='16' rx='2.5' fill='#ff9e1a'/>",
				"<rect x='-6.5' y='-6.5' width='13' height='13' rx='2' fill='#ffcc4a'/>",
				"<text y='4' font-size='11' font-family='Impact,sans-serif' font-weight='bold' fill='#fff' text-anchor='middle' stroke='#5b3300' stroke-width='.5'>?</text>",
			"</g>",
		"</svg>",
	].join( '' ), '#0a001e' );

	// --- Soot Sprites (Ghibli) ------------------------------------ //
	PREVIEWS[ 'soot-sprites' ] = preview( [
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='xMidYMid slice'>",
			"<defs>",
				"<linearGradient id='pg2' x1='0' y1='0' x2='0' y2='1'>",
					"<stop offset='0' stop-color='#ffd7ea'/><stop offset='1' stop-color='#cce7ff'/>",
				"</linearGradient>",
				"<filter id='so' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='1.5'/></filter>",
			"</defs>",
			"<rect width='160' height='100' fill='url(#pg2)'/>",
			// soft petals drifting
			"<g fill='#ffbfd4' opacity='.7'>",
				"<circle cx='14' cy='18' r='1.5'/><circle cx='54' cy='10' r='1'/>",
				"<circle cx='100' cy='16' r='1.2'/><circle cx='134' cy='8' r='1'/>",
				"<circle cx='20' cy='36' r='1'/><circle cx='148' cy='30' r='1.2'/>",
			"</g>",
			// shadows
			"<g fill='#000' opacity='.12' filter='url(#so)'>",
				"<ellipse cx='38' cy='78' rx='14' ry='3'/>",
				"<ellipse cx='78' cy='56' rx='10' ry='2.5'/>",
				"<ellipse cx='98' cy='82' rx='12' ry='3'/>",
				"<ellipse cx='128' cy='64' rx='8' ry='2'/>",
			"</g>",
			// sprites
			"<g fill='#161616'>",
				// big left
				"<circle cx='38' cy='62' r='14'/>",
				"<circle cx='28' cy='54' r='4'/><circle cx='48' cy='54' r='4'/>",
				"<circle cx='52' cy='64' r='4'/><circle cx='24' cy='66' r='4'/>",
				"<circle cx='42' cy='74' r='4'/><circle cx='32' cy='50' r='3'/>",
				"<circle cx='46' cy='50' r='3'/><circle cx='54' cy='72' r='3'/>",
				// small mid-top
				"<circle cx='78' cy='42' r='8'/>",
				"<circle cx='72' cy='38' r='2.5'/><circle cx='84' cy='38' r='2.5'/>",
				"<circle cx='86' cy='46' r='2.5'/><circle cx='72' cy='46' r='2.5'/>",
				// mid-bottom
				"<circle cx='98' cy='70' r='11'/>",
				"<circle cx='90' cy='62' r='3'/><circle cx='108' cy='62' r='3'/>",
				"<circle cx='110' cy='74' r='3'/><circle cx='88' cy='74' r='3'/>",
				"<circle cx='100' cy='82' r='3'/>",
				// small right
				"<circle cx='128' cy='52' r='8'/>",
				"<circle cx='120' cy='48' r='2.5'/><circle cx='136' cy='50' r='2.5'/>",
				"<circle cx='134' cy='58' r='2.5'/>",
			"</g>",
			// big sprite eyes
			"<g fill='#fff'>",
				"<circle cx='33' cy='60' r='2'/><circle cx='43' cy='60' r='2'/>",
				"<circle cx='33' cy='60' r='.8' fill='#161616'/><circle cx='43' cy='60' r='.8' fill='#161616'/>",
			"</g>",
			// candy falling
			"<g transform='translate(66,20) rotate(15)'>",
				"<polygon fill='#ffe04a' points='0,-5 1.5,-1.5 5,-1.5 2,1 3.5,5 0,2.5 -3.5,5 -2,1 -5,-1.5 -1.5,-1.5'/>",
			"</g>",
		"</svg>",
	].join( '' ), '#e0deed' );

	// --- The Upside Down (Stranger Things) ------------------------ //
	PREVIEWS[ 'upside-down' ] = preview( [
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='xMidYMid slice'>",
			"<defs>",
				"<radialGradient id='ud2' cx='.5' cy='.5' r='.72'>",
					"<stop offset='0' stop-color='#6e0820'/><stop offset='.5' stop-color='#280410'/><stop offset='1' stop-color='#000'/>",
				"</radialGradient>",
				"<filter id='ug' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='2'/></filter>",
				"<filter id='usm' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='.6'/></filter>",
			"</defs>",
			"<rect width='160' height='100' fill='url(#ud2)'/>",
			// lightning at top
			"<g stroke='#ff5533' opacity='.85'>",
				"<path d='M 70 0 L 66 10 L 72 12 L 62 24' stroke-width='.9' fill='none'/>",
				"<path d='M 70 0 L 66 10 L 72 12 L 62 24' stroke-width='2' stroke='#ff8855' opacity='.4' fill='none' filter='url(#ug)'/>",
				"<path d='M 110 0 L 114 12 L 108 14 L 118 26' stroke-width='.7' fill='none'/>",
			"</g>",
			// tendrils from edges
			"<g stroke='#4a0820' fill='none' filter='url(#usm)'>",
				"<path d='M 0 16 Q 20 28 28 46 Q 36 64 52 74' stroke-width='1.2' opacity='.8'/>",
				"<path d='M 0 16 Q 20 28 28 46 Q 36 64 52 74' stroke-width='2.6' opacity='.4'/>",
				"<path d='M 160 86 Q 140 76 132 58 Q 124 40 108 26' stroke-width='1.2' opacity='.8'/>",
				"<path d='M 0 88 Q 14 76 40 82' stroke-width='1' opacity='.6'/>",
				"<path d='M 160 14 Q 146 6 130 16' stroke-width='1' opacity='.6'/>",
			"</g>",
			// glowing spores
			"<g>",
				"<circle cx='22' cy='22' r='2.5' fill='#ffccdd' opacity='.2' filter='url(#ug)'/><circle cx='22' cy='22' r='1.2' fill='#ffccdd'/>",
				"<circle cx='58' cy='38' r='3' fill='#ffccdd' opacity='.15' filter='url(#ug)'/><circle cx='58' cy='38' r='1.4' fill='#ffccdd'/>",
				"<circle cx='92' cy='26' r='2' fill='#ffccdd' opacity='.18' filter='url(#ug)'/><circle cx='92' cy='26' r='1' fill='#ffccdd'/>",
				"<circle cx='124' cy='68' r='3' fill='#ffccdd' opacity='.15' filter='url(#ug)'/><circle cx='124' cy='68' r='1.4' fill='#ffccdd'/>",
				"<circle cx='36' cy='74' r='2' fill='#ffccdd' opacity='.18' filter='url(#ug)'/><circle cx='36' cy='74' r='1' fill='#ffccdd'/>",
				"<circle cx='144' cy='42' r='2.5' fill='#ffccdd' opacity='.2' filter='url(#ug)'/><circle cx='144' cy='42' r='1.2' fill='#ffccdd'/>",
				"<circle cx='72' cy='88' r='1.6' fill='#ffccdd' opacity='.9'/>",
				"<circle cx='104' cy='86' r='1' fill='#ffccdd' opacity='.85'/>",
			"</g>",
			// glitch title
			"<g font-family='Georgia,serif' font-size='14' font-weight='bold' font-style='italic' letter-spacing='3'>",
				"<text x='80' y='58' fill='#64e0ff' opacity='.55' text-anchor='middle' transform='translate(-2 0)'>CHAPTER</text>",
				"<text x='80' y='58' fill='#00ffaa' opacity='.45' text-anchor='middle'>CHAPTER</text>",
				"<text x='80' y='58' fill='#ff2420' text-anchor='middle' transform='translate(2 0)'>CHAPTER</text>",
			"</g>",
		"</svg>",
	].join( '' ), '#1a0410' );

	// --- Refinery (Severance) ------------------------------------- //
	PREVIEWS[ 'refinery' ] = preview( [
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='xMidYMid slice'>",
			"<defs>",
				"<linearGradient id='lg2' x1='0' y1='0' x2='0' y2='1'>",
					"<stop offset='0' stop-color='#e6f0ea'/><stop offset='1' stop-color='#b8cec3'/>",
				"</linearGradient>",
				"<pattern id='grd' width='12' height='12' patternUnits='userSpaceOnUse'>",
					"<rect width='12' height='12' fill='none'/>",
					"<line x1='0' y1='0' x2='12' y2='0' stroke='#0d2d4e' stroke-width='.3' opacity='.2'/>",
					"<line x1='0' y1='0' x2='0' y2='12' stroke='#0d2d4e' stroke-width='.3' opacity='.2'/>",
				"</pattern>",
			"</defs>",
			"<rect width='160' height='100' fill='url(#lg2)'/>",
			"<rect width='160' height='100' fill='url(#grd)'/>",
			// numerals cluster (ring shape)
			"<g font-family='ui-monospace,monospace' fill='#0d2d4e' text-anchor='middle'>",
				"<text x='34' y='38' font-size='11' font-weight='bold' fill='#b22430'>7</text>",
				"<text x='46' y='32' font-size='14' font-weight='bold' fill='#b22430'>1</text>",
				"<text x='58' y='34' font-size='10' font-weight='bold' fill='#b22430'>9</text>",
				"<text x='30' y='52' font-size='12' font-weight='bold' fill='#b22430'>4</text>",
				"<text x='64' y='50' font-size='10' font-weight='bold' fill='#b22430'>2</text>",
				"<text x='34' y='68' font-size='13' font-weight='bold' fill='#b22430'>0</text>",
				"<text x='48' y='72' font-size='10' font-weight='bold' fill='#b22430'>5</text>",
				"<text x='60' y='66' font-size='11' font-weight='bold' fill='#b22430'>8</text>",
				// scattered outside
				"<text x='88' y='20' font-size='9' opacity='.7'>3</text>",
				"<text x='104' y='28' font-size='7' opacity='.55'>6</text>",
				"<text x='118' y='18' font-size='8' opacity='.6'>1</text>",
				"<text x='94' y='48' font-size='10' opacity='.7'>9</text>",
				"<text x='110' y='58' font-size='8' opacity='.55'>2</text>",
				"<text x='124' y='46' font-size='9' opacity='.65'>7</text>",
				"<text x='138' y='40' font-size='8' opacity='.55'>0</text>",
				"<text x='98' y='74' font-size='11' opacity='.75'>4</text>",
				"<text x='118' y='80' font-size='9' opacity='.6'>8</text>",
				"<text x='132' y='72' font-size='8' opacity='.55'>5</text>",
				"<text x='84' y='88' font-size='9' opacity='.6'>0</text>",
				"<text x='14' y='26' font-size='7' opacity='.5'>6</text>",
				"<text x='14' y='80' font-size='7' opacity='.5'>3</text>",
			"</g>",
			// MDR selector box
			"<rect x='20' y='24' width='54' height='56' rx='2' fill='#0d2d4e' opacity='.05' stroke='#0d2d4e' stroke-width='.8' opacity='.7'/>",
			// Lumon mark
			"<g transform='translate(140,82)' stroke='#0d2d4e' fill='none' opacity='.8'>",
				"<circle cx='0' cy='0' r='7' stroke-width='.8'/>",
				"<circle cx='0' cy='0' r='4' stroke-width='.6'/>",
				"<line x1='-7' y1='0' x2='7' y2='0' stroke-width='.4'/>",
				"<line x1='0' y1='-7' x2='0' y2='7' stroke-width='.4'/>",
			"</g>",
		"</svg>",
	].join( '' ), '#d4ded9' );

	// --- Shimmer (Arcane) ----------------------------------------- //
	PREVIEWS[ 'shimmer' ] = preview( [
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' preserveAspectRatio='xMidYMid slice'>",
			"<defs>",
				"<linearGradient id='sh2' x1='0' y1='0' x2='0' y2='1'>",
					"<stop offset='0' stop-color='#c29033'/><stop offset='.33' stop-color='#8a2c5b'/><stop offset='1' stop-color='#16051a'/>",
				"</linearGradient>",
				"<radialGradient id='tank' cx='.5' cy='1' r='.7'>",
					"<stop offset='0' stop-color='#ff4ab8' stop-opacity='.85'/><stop offset='1' stop-color='#ff4ab8' stop-opacity='0'/>",
				"</radialGradient>",
				"<filter id='pg3' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='2'/></filter>",
			"</defs>",
			"<rect width='160' height='100' fill='url(#sh2)'/>",
			// chem-tank glow at bottom
			"<rect width='160' height='100' fill='url(#tank)' opacity='.75'/>",
			// piltover silhouette top
			"<g fill='#3a2a4a' opacity='.55'>",
				"<polygon points='0,0 0,6 24,4 38,10 58,6 74,12 92,4 112,10 134,6 152,10 160,4 160,0'/>",
			"</g>",
			"<g fill='#ffe08a' opacity='.85'>",
				"<circle cx='38' cy='8' r='1'/><circle cx='74' cy='10' r='.8'/>",
				"<circle cx='112' cy='8' r='.9'/><circle cx='152' cy='8' r='.8'/>",
			"</g>",
			// hex grid
			"<g stroke='#ff7ad0' fill='none' stroke-width='.5' opacity='.55'>",
				"<polygon points='34,48 40,44 46,48 46,54 40,58 34,54'/>",
				"<polygon points='46,54 52,50 58,54 58,60 52,64 46,60'/>",
				"<polygon points='58,48 64,44 70,48 70,54 64,58 58,54'/>",
				"<polygon points='70,54 76,50 82,54 82,60 76,64 70,60'/>",
				"<polygon points='82,48 88,44 94,48 94,54 88,58 82,54'/>",
				"<polygon points='94,54 100,50 106,54 106,60 100,64 94,60'/>",
			"</g>",
			// zaun silhouette
			"<g fill='#0a0210'>",
				"<rect x='0' y='74' width='14' height='26'/><rect x='12' y='68' width='14' height='32'/>",
				"<rect x='24' y='78' width='10' height='22'/><rect x='32' y='72' width='16' height='28'/>",
				"<rect x='46' y='80' width='8' height='20'/><rect x='52' y='70' width='14' height='30'/>",
				"<rect x='64' y='76' width='12' height='24'/><rect x='74' y='66' width='16' height='34'/>",
				"<rect x='88' y='76' width='10' height='24'/><rect x='96' y='70' width='14' height='30'/>",
				"<rect x='108' y='78' width='10' height='22'/><rect x='116' y='68' width='16' height='32'/>",
				"<rect x='130' y='74' width='12' height='26'/><rect x='140' y='70' width='12' height='30'/>",
				"<rect x='150' y='76' width='10' height='24'/>",
			"</g>",
			// windows
			"<g fill='#ff8c5a'>",
				"<rect x='4' y='78' width='1.5' height='2'/><rect x='18' y='74' width='1.5' height='2'/>",
				"<rect x='40' y='78' width='1.5' height='2'/><rect x='58' y='76' width='1.5' height='2'/>",
				"<rect x='80' y='74' width='1.5' height='2'/><rect x='102' y='76' width='1.5' height='2'/>",
				"<rect x='122' y='74' width='1.5' height='2'/><rect x='144' y='76' width='1.5' height='2'/>",
			"</g>",
			// rising particles with glow
			"<g>",
				"<circle cx='16' cy='56' r='3' fill='#ff4ab8' opacity='.4' filter='url(#pg3)'/>",
				"<circle cx='16' cy='56' r='1.4' fill='#ff7cc8'/>",
				"<circle cx='44' cy='32' r='3' fill='#ff4ab8' opacity='.35' filter='url(#pg3)'/>",
				"<circle cx='44' cy='32' r='1.2' fill='#ffa4d4'/>",
				"<circle cx='64' cy='22' r='3' fill='#ffe08a' opacity='.3' filter='url(#pg3)'/>",
				"<circle cx='64' cy='22' r='1.6' fill='#ffd47a'/>",
				"<circle cx='88' cy='34' r='3' fill='#ff4ab8' opacity='.35' filter='url(#pg3)'/>",
				"<circle cx='88' cy='34' r='1.4' fill='#ff8ad0'/>",
				"<circle cx='106' cy='22' r='3' fill='#ffe08a' opacity='.3' filter='url(#pg3)'/>",
				"<circle cx='106' cy='22' r='1.6' fill='#ffd47a'/>",
				"<circle cx='134' cy='40' r='3' fill='#ff4ab8' opacity='.35' filter='url(#pg3)'/>",
				"<circle cx='134' cy='40' r='1.2' fill='#ff7cc8'/>",
			"</g>",
		"</svg>",
	].join( '' ), '#22071a' );

	// ================================================================ //
	// Scene manifest — order controls picker ordering.
	// ================================================================ //

	var SCENES = [
		{ id: 'code-rain',     label: 'Code Rain' },
		{ id: 'hyperspace',    label: 'Hyperspace' },
		{ id: 'neon-rain',     label: 'Neon Rain' },
		{ id: 'tron-grid',     label: 'The Grid' },
		{ id: 'couch-gag',     label: 'Couch Gag' },
		{ id: 'rainbow-road',  label: 'Rainbow Road' },
		{ id: 'soot-sprites',  label: 'Soot Sprites' },
		{ id: 'upside-down',   label: 'The Upside Down' },
		{ id: 'refinery',      label: 'Refinery' },
		{ id: 'shimmer',       label: 'Shimmer' },
	];

	// ================================================================ //
	// Shared mount runner — each scene's setup/tick/cleanup plugs in.
	// ================================================================ //

	function makeMount( sceneId ) {
		return async function ( container, ctx ) {
			var impl = window.__bRoll.scenes[ sceneId ];
			if ( ! impl || typeof impl.setup !== 'function' ) {
				if ( window.console ) window.console.error( 'B-Roll: scene impl missing: ' + sceneId );
				return function () {};
			}

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

			var env = { app: app, PIXI: PIXI, ctx: ctx, helpers: window.__bRoll.helpers };
			var state = await impl.setup( env );

			function step( ticker ) {
				env.dt = Math.min( 2.5, ticker.deltaTime );
				if ( impl.tick ) impl.tick( state, env );
			}
			function onResize() {
				if ( impl.onResize ) impl.onResize( state, env );
			}
			app.renderer.on( 'resize', onResize );

			if ( ctx.prefersReducedMotion ) {
				env.dt = 0;
				if ( impl.tick ) impl.tick( state, env );
				app.ticker.stop();
			} else {
				app.ticker.add( step );
			}

			var visHook = 'b-roll/' + sceneId + '/visibility';
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
				if ( impl.cleanup ) impl.cleanup( state, env );
				app.destroy( true, { children: true, texture: true } );
			};
		};
	}

	// ================================================================ //
	// Registration
	// ================================================================ //

	var registered = false;
	function registerAll() {
		if ( registered ) return;
		if ( ! window.wp || ! window.wp.desktop ) return;
		if ( typeof window.wp.desktop.registerWallpaper !== 'function' ) return;
		if ( typeof window.wp.desktop.registerModule !== 'function' ) return;
		registered = true;

		var pluginUrl = ( window.bRoll && window.bRoll.pluginUrl ) || '';

		for ( var i = 0; i < SCENES.length; i++ ) {
			var s = SCENES[ i ];
			var moduleId = 'b-roll/' + s.id;

			// Register the scene's Pixi code as a lazy-loadable module.
			( function ( slug, modId ) {
				window.wp.desktop.registerModule( {
					id: modId,
					url: pluginUrl + '/src/scenes/' + slug + '.js',
					isReady: function () {
						return !! ( window.__bRoll.scenes && window.__bRoll.scenes[ slug ] );
					},
				} );
			} )( s.id, moduleId );

			// Register the wallpaper with needs: the scene module will load
			// the moment a user picks this wallpaper.
			try {
				window.wp.desktop.registerWallpaper( {
					id: 'b-roll/' + s.id,
					label: s.label,
					type: 'canvas',
					preview: PREVIEWS[ s.id ] || '#111',
					needs: [ 'pixijs', moduleId ],
					mount: makeMount( s.id ),
				} );
			} catch ( e ) {
				if ( window.console ) window.console.warn( 'B-Roll: failed to register ' + s.id, e );
			}
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
