/**
 * ODD easter eggs — v0.7
 * ---------------------------------------------------------------
 * Global keyboard + pointer listener that fires scene-specific
 * reveals. Loaded once (lazily) from src/index.js on first mount.
 *
 * Triggers (all gated on a mounted ODD wallpaper being active):
 *
 *   festival — Konami code (↑↑↓↓←→←→ba). 10-second
 *              "everything at once" moment. Dispatched on the
 *              currently-active scene.
 *
 *   reveal   — Typing a scene-specific keyword (e.g. "koi"
 *              while flux is active). Each scene slug maps to
 *              one or more keywords; see SCENE_KEYWORDS below.
 *
 *   peek     — Triple-click within a hidden 60×60 hotspot at the
 *              bottom-left corner of the wallpaper container.
 *
 * Dispatch is fire-and-forget: scenes that don't define onEgg
 * silently no-op, and handler exceptions are swallowed so a
 * bad egg never takes down the wallpaper.
 *
 * Reduced motion: triggers still fire. Scene onEgg handlers
 * are expected to gate heavier effects on ctx.prefersReducedMotion.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	if ( window.__odd.eggs && window.__odd.eggs._installed ) return;

	var alphaBuf = '';
	var dirBuf = [];
	var MAX_ALPHA = 32;
	var MAX_DIR = 14;

	// Konami: ↑ ↑ ↓ ↓ ← → ← → B A
	var KONAMI = [
		'arrowup', 'arrowup', 'arrowdown', 'arrowdown',
		'arrowleft', 'arrowright', 'arrowleft', 'arrowright',
		'b', 'a',
	];

	var SCENE_KEYWORDS = {
		'flux':    [ 'flow', 'ink', 'koi' ],
		'aurora':  [ 'borealis', 'arctic', 'polar' ],
		'origami': [ 'crane', 'fold', 'paper' ],
	};

	var state = {
		activeSlug: null,
		scenes: window.__odd.scenes || {},
		sceneStates: {},
		env: null,
		host: null,
		cooldown: 0,
	};

	function dispatch( name ) {
		if ( ! state.activeSlug ) return;
		if ( Date.now() < state.cooldown ) return;
		var scene = ( window.__odd.scenes || {} )[ state.activeSlug ];
		var ss    = state.sceneStates[ state.activeSlug ];
		if ( ! scene || typeof scene.onEgg !== 'function' || ! ss ) return;
		state.cooldown = Date.now() + 400; // soft debounce
		try {
			scene.onEgg( name, ss, state.env );
		} catch ( e ) {
			if ( window.console ) window.console.warn( 'ODD: egg handler threw', name, e );
		}
	}

	function isTypingField( el ) {
		if ( ! el ) return false;
		var tag = el.tagName;
		if ( tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ) return true;
		if ( el.isContentEditable ) return true;
		return false;
	}

	function onKeyDown( e ) {
		if ( ! state.activeSlug ) return;
		if ( isTypingField( e.target ) ) return;
		if ( e.ctrlKey || e.metaKey || e.altKey ) return;

		var k = e.key || '';
		var low = k.toLowerCase();

		// Alphanumeric buffer → scene keyword check.
		if ( k.length === 1 && /[a-z0-9]/i.test( k ) ) {
			alphaBuf = ( alphaBuf + low ).slice( -MAX_ALPHA );
			var words = SCENE_KEYWORDS[ state.activeSlug ] || [];
			for ( var i = 0; i < words.length; i++ ) {
				var w = words[ i ];
				if ( alphaBuf.slice( -w.length ) === w ) {
					alphaBuf = '';
					dispatch( 'reveal' );
					return;
				}
			}
		}

		// Directional / AB buffer → Konami check.
		if ( /^arrow/.test( low ) || low === 'a' || low === 'b' ) {
			dirBuf.push( low );
			if ( dirBuf.length > MAX_DIR ) dirBuf.shift();
			if ( dirBuf.length >= KONAMI.length ) {
				var ok = true;
				var offset = dirBuf.length - KONAMI.length;
				for ( var j = 0; j < KONAMI.length; j++ ) {
					if ( dirBuf[ offset + j ] !== KONAMI[ j ] ) { ok = false; break; }
				}
				if ( ok ) {
					dirBuf = [];
					dispatch( 'festival' );
				}
			}
		}
	}

	var clickTimes = [];
	function onPointerDown( e ) {
		if ( ! state.activeSlug || ! state.host ) return;
		var host = state.host;
		if ( ! host.getBoundingClientRect ) return;
		var rect = host.getBoundingClientRect();
		var x = e.clientX - rect.left;
		var y = e.clientY - rect.top;
		// Hotspot: bottom-left 60×60.
		var HOT = 60;
		if ( x < 0 || x > HOT ) return;
		if ( y < rect.height - HOT || y > rect.height ) return;

		var now = Date.now();
		clickTimes.push( now );
		clickTimes = clickTimes.filter( function ( t ) { return now - t < 700; } );
		if ( clickTimes.length >= 3 ) {
			clickTimes = [];
			dispatch( 'peek' );
		}
	}

	window.addEventListener( 'keydown', onKeyDown, true );
	window.addEventListener( 'pointerdown', onPointerDown, true );

	window.__odd.eggs = {
		_installed: true,
		setActive: function ( slug, sceneState, env, host ) {
			state.activeSlug = slug;
			state.sceneStates[ slug ] = sceneState;
			state.env = env;
			state.host = host;
			alphaBuf = '';
			dirBuf = [];
			clickTimes = [];
		},
		trigger: dispatch,
		_state: state,
		KONAMI: KONAMI.slice(),
		KEYWORDS: SCENE_KEYWORDS,
	};
} )();
