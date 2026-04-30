/**
 * Iris — motion primitives.
 * ---------------------------------------------------------------
 * Five named motions that scenes, rituals, and the reactivity layer
 * all share. Each primitive is registered in the `odd.motionPrimitives`
 * registry (Cut 1 extension point) and exposes a `run(opts)` method
 * that:
 *
 *   1. Emits an `odd.motion.<slug>` bus event so anyone (Iris eye,
 *      a third-party plugin, debug inspector) can react.
 *   2. Calls the matching optional hook on the active wallpaper
 *      scene (`onRipple`, `onGlitch`, `onGlance`, etc.) so the
 *      environment responds physically.
 *
 * `onBlink` / `onWink` are scene no-ops by contract — those two
 * primitives belong to the eye, not the world. Every primitive
 * respects `prefers-reduced-motion` via the runtime store slice.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;
	window.__odd = window.__odd || {};
	window.__odd.iris = window.__odd.iris || {};
	if ( window.__odd.iris.motion ) return;

	var PRIMITIVES = [
		{ slug: 'blink',   label: 'Blink',   duration: 120,   sceneHook: null },
		{ slug: 'wink',    label: 'Wink',    duration: 180,   sceneHook: null },
		{ slug: 'glance',  label: 'Glance',  duration: 200,   sceneHook: 'onGlance' },
		{ slug: 'glitch',  label: 'Glitch',  duration: 220,   sceneHook: 'onGlitch' },
		{ slug: 'ripple',  label: 'Ripple',  duration: 600,   sceneHook: 'onRipple' },
	];

	function activeScene() {
		var rt = window.__odd.runtime;
		return rt && rt.activeScene ? rt.activeScene : null;
	}

	function reducedMotion() {
		var store = window.__odd.store;
		return !! ( store && store.get( 'runtime.reducedMotion' ) );
	}

	function safe( fn, source ) {
		var safeCall = window.__odd.safeCall;
		if ( typeof safeCall === 'function' ) return safeCall( fn, source );
		try { return fn(); } catch ( e ) { /* swallow */ }
		return null;
	}

	function emit( name, payload ) {
		var evt = window.__odd.events;
		if ( evt && typeof evt.emit === 'function' ) evt.emit( name, payload );
	}

	function runPrimitive( spec, opts ) {
		opts = opts || {};
		emit( 'odd.motion.' + spec.slug, opts );

		if ( reducedMotion() && spec.slug !== 'glance' ) {
			// Reduce ripple/glitch/blink/wink to a single static
			// emission — no scene payload — so there's no motion
			// cost. Glance still fires so focus tracking stays
			// accurate for keyboard users.
			return;
		}

		if ( ! spec.sceneHook ) return;
		var active = activeScene();
		if ( ! active || ! active.scene ) return;
		var hook = active.scene[ spec.sceneHook ];
		if ( typeof hook !== 'function' ) return;
		safe( function () {
			hook.call( active.scene, opts, active.state, active.env );
		}, 'iris.motion.' + spec.slug );
	}

	var motion = {};
	PRIMITIVES.forEach( function ( spec ) {
		motion[ spec.slug ] = function ( opts ) { runPrimitive( spec, opts ); };
	} );
	motion.list = function () { return PRIMITIVES.slice(); };

	var hooks = window.wp && window.wp.hooks;
	if ( hooks && typeof hooks.addFilter === 'function' ) {
		hooks.addFilter( 'odd.motionPrimitives', 'odd.iris-motion', function ( list ) {
			var arr = Array.isArray( list ) ? list.slice() : [];
			PRIMITIVES.forEach( function ( spec ) {
				var exists = false;
				for ( var i = 0; i < arr.length; i++ ) {
					if ( arr[ i ] && arr[ i ].slug === spec.slug ) { exists = true; break; }
				}
				if ( ! exists ) {
					arr.push( {
						slug:     spec.slug,
						label:    spec.label,
						duration: spec.duration,
						run:      motion[ spec.slug ],
					} );
				}
			} );
			return arr;
		} );
	}

	window.__odd.iris.motion = motion;
} )();
