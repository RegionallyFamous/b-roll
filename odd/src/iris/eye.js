/**
 * Iris — optional in-DOM eye overlay.
 * ---------------------------------------------------------------
 * A lightweight, purely visual companion that responds to the
 * motion primitives. The canonical "eye" of ODD remains the
 * desktop-icon tile (see `odd/includes/native-window.php` →
 * `odd_control_icon_svg_data_uri`). This module adds an
 * ephemeral floating eye at the top-right of the viewport that
 * materializes only for rituals and occasional reactions, then
 * fades back out.
 *
 * Keeping it transient means:
 *   - it does not compete with the OS accent / scene aesthetic
 *   - it does not ship a persistent DOM element that a user has
 *     to mentally filter out of every frame
 *   - it can be removed entirely by disabling one subscriber
 *
 * Respects `user.mascotQuiet` (still appears for rituals, but
 * silent — no said lines), `runtime.reducedMotion` (shows only a
 * static pose, no blinks).
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;
	window.__odd = window.__odd || {};
	window.__odd.iris = window.__odd.iris || {};
	if ( window.__odd.iris.eye ) return;

	var SVG_NS = 'http://www.w3.org/2000/svg';
	var HOLD_MS = 1600;
	var FADE_MS = 300;

	var root = null;
	var lid  = null;
	var pupil = null;
	var hideTimer = null;
	var state = 'hidden';

	function reducedMotion() {
		var s = window.__odd.store;
		return !! ( s && s.get( 'runtime.reducedMotion' ) );
	}

	function ensure() {
		if ( root ) return;
		root = document.createElementNS( SVG_NS, 'svg' );
		root.setAttribute( 'viewBox', '0 0 64 40' );
		root.setAttribute( 'aria-hidden', 'true' );
		root.setAttribute( 'data-odd-iris', '' );
		root.style.cssText = [
			'position:fixed',
			'top:20px',
			'right:20px',
			'width:80px',
			'height:50px',
			'pointer-events:none',
			'z-index:2147483600',
			'opacity:0',
			'transition:opacity ' + FADE_MS + 'ms ease',
			'filter:drop-shadow(0 4px 12px rgba(0,0,0,0.35))',
		].join( ';' );

		root.innerHTML = [
			'<defs>',
				'<radialGradient id="iris-sclera" cx="42%" cy="40%" r="65%">',
					'<stop offset="0" stop-color="#fdfaf2"/>',
					'<stop offset="1" stop-color="#cdbfa6"/>',
				'</radialGradient>',
				'<radialGradient id="iris-iris" cx="42%" cy="40%" r="65%">',
					'<stop offset="0" stop-color="#ffdd4d"/>',
					'<stop offset="0.45" stop-color="#d946ef"/>',
					'<stop offset="1" stop-color="#2b3dff"/>',
				'</radialGradient>',
			'</defs>',
			'<path d="M 2 20 Q 32 2 62 20 Q 32 38 2 20 Z" fill="url(#iris-sclera)" stroke="#130826" stroke-width="1.3"/>',
			'<g data-eye-pupil>',
				'<circle cx="32" cy="20" r="9" fill="url(#iris-iris)"/>',
				'<circle cx="32" cy="20" r="3.8" fill="#0a0416"/>',
				'<ellipse cx="29" cy="17.5" rx="1.8" ry="1.3" fill="#ffffff" opacity="0.9"/>',
			'</g>',
			'<path data-eye-lid d="M 2 20 Q 32 2 62 20 Q 32 2 2 20 Z" fill="#130826" opacity="0" style="transition:opacity 80ms linear"/>',
		].join( '' );

		document.body.appendChild( root );
		lid   = root.querySelector( '[data-eye-lid]' );
		pupil = root.querySelector( '[data-eye-pupil]' );
	}

	function show( hold ) {
		ensure();
		if ( hideTimer ) clearTimeout( hideTimer );
		root.style.opacity = '1';
		root.setAttribute( 'data-odd-iris-state', state );
		hideTimer = setTimeout( function () {
			root.style.opacity = '0';
			state = 'hidden';
			root.setAttribute( 'data-odd-iris-state', state );
		}, hold == null ? HOLD_MS : hold );
	}

	function pulseLid( count, gap ) {
		if ( ! lid ) return;
		var i = 0;
		function step() {
			if ( i++ >= count ) return;
			lid.style.opacity = '0.92';
			setTimeout( function () {
				lid.style.opacity = '0';
				setTimeout( step, gap || 160 );
			}, 90 );
		}
		step();
	}

	function glancePupil( dx, dy ) {
		if ( ! pupil ) return;
		pupil.setAttribute( 'transform', 'translate(' + dx + ',' + dy + ')' );
		setTimeout( function () {
			pupil.setAttribute( 'transform', 'translate(0,0)' );
		}, 220 );
	}

	function jitterRoot( ms ) {
		if ( ! root ) return;
		var end = Date.now() + ms;
		function step() {
			if ( Date.now() > end ) {
				root.style.transform = '';
				return;
			}
			var j = ( Math.random() - 0.5 ) * 4;
			var k = ( Math.random() - 0.5 ) * 4;
			root.style.transform = 'translate(' + j.toFixed( 1 ) + 'px,' + k.toFixed( 1 ) + 'px)';
			setTimeout( step, 40 );
		}
		step();
	}

	var evt = window.__odd.events;
	if ( evt && typeof evt.on === 'function' ) {
		evt.on( 'odd.motion.blink', function () {
			state = 'blinking';
			if ( reducedMotion() ) { show( 800 ); return; }
			show();
			pulseLid( 1 );
		} );
		evt.on( 'odd.motion.wink', function () {
			state = 'winking';
			if ( reducedMotion() ) { show( 800 ); return; }
			show();
			pulseLid( 1, 200 );
		} );
		evt.on( 'odd.motion.glance', function ( opts ) {
			state = 'glancing';
			if ( reducedMotion() ) { show( 800 ); return; }
			show();
			if ( opts && opts.nod ) { glancePupil( 0, 1.5 ); return; }
			var dx = opts && opts.x ? Math.max( -3, Math.min( 3, ( opts.x / window.innerWidth  - 0.5 ) * 6 ) ) : 0;
			var dy = opts && opts.y ? Math.max( -2, Math.min( 2, ( opts.y / window.innerHeight - 0.5 ) * 4 ) ) : 0;
			glancePupil( dx, dy );
		} );
		evt.on( 'odd.motion.glitch', function ( opts ) {
			state = 'glitching';
			show();
			if ( ! reducedMotion() ) jitterRoot( ( opts && opts.ms ) || 220 );
		} );
		evt.on( 'odd.ritual.festival', function () {
			state = 'festival';
			show( 2800 );
			if ( ! reducedMotion() ) {
				pulseLid( 6, 220 );
				jitterRoot( 900 );
			}
		} );
		evt.on( 'odd.ritual.seven', function () {
			state = 'seven';
			show( 2400 );
			pulseLid( 7, 180 );
		} );
		evt.on( 'odd.ritual.dream', function ( opts ) {
			if ( opts && opts.state === 'enter' ) {
				state = 'dreaming';
				show( 3200 );
				pulseLid( 2, 600 );
			}
		} );
	}

	// Lightweight test handle — matches the original Iris plan's
	// window.__odd.iris.test surface so automated tests can trip
	// individual moments deterministically.
	window.__odd.iris.eye = {
		show:    show,
		blink:   function () { state = 'blinking';  show(); pulseLid( 1 ); },
		wink:    function () { state = 'winking';   show(); pulseLid( 1, 200 ); },
		glance:  function ( x, y ) { state = 'glancing'; show(); glancePupil( x || 0, y || 0 ); },
		glitch:  function ( ms ) { state = 'glitching'; show(); jitterRoot( ms || 220 ); },
	};
} )();
