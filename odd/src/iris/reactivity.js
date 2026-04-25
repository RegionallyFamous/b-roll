/**
 * Iris — environmental reactivity.
 * ---------------------------------------------------------------
 * Subscribes to the WP Desktop Mode hooks listed in the plan,
 * re-emits them as dot-namespaced `odd.*` events on the ODD bus
 * (so third-party extensions don't have to know the `wp-desktop.*`
 * convention), and triggers the matching motion primitive on the
 * active scene.
 *
 * Every reaction is throttled and every reaction respects
 * `user.mascotQuiet` for the spoken half while still letting the
 * silent half (the motion primitive) play. The reactivity layer
 * never draws anything itself — it just glues the shell to the
 * Iris voice and the motion registry.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;
	window.__odd = window.__odd || {};
	window.__odd.iris = window.__odd.iris || {};
	if ( window.__odd.iris.__reactivityInstalled ) return;
	window.__odd.iris.__reactivityInstalled = true;

	function on( name, cb ) {
		var hooks = window.wp && window.wp.hooks;
		if ( ! hooks || typeof hooks.addAction !== 'function' ) return;
		try { hooks.addAction( name, 'odd/iris-reactivity', cb ); } catch ( e ) { /* bad name */ }
	}
	function emit( name, payload ) {
		var evt = window.__odd.events;
		if ( evt && typeof evt.emit === 'function' ) evt.emit( name, payload );
	}
	function motion( slug, opts ) {
		var m = window.__odd.iris && window.__odd.iris.motion;
		if ( m && typeof m[ slug ] === 'function' ) m[ slug ]( opts || {} );
	}
	function say( bucket ) {
		var iris = window.__odd.iris;
		if ( iris && typeof iris.say === 'function' ) iris.say( bucket );
	}

	function centerOf( bounds ) {
		if ( ! bounds || typeof bounds !== 'object' ) return null;
		var x = ( bounds.x != null ? bounds.x : bounds.left   || 0 ) + ( bounds.width  || 0 ) / 2;
		var y = ( bounds.y != null ? bounds.y : bounds.top    || 0 ) + ( bounds.height || 0 ) / 2;
		return { x: x, y: y };
	}
	function throttle( ms ) {
		var last = 0;
		return function ( fn ) {
			var now = Date.now();
			if ( now - last < ms ) return;
			last = now;
			fn();
		};
	}

	var throttleShellErr   = throttle( 30000 );
	var throttleWelcomeBck = throttle( 10 * 60 * 1000 );

	on( 'wp-desktop.window.opened', function ( payload ) {
		emit( 'odd.window-opened', payload || {} );
		var c = centerOf( payload && payload.bounds );
		motion( 'ripple', c ? { x: c.x, y: c.y, intensity: 1.0 } : { x: 0.5, y: 0.5, intensity: 1.0, normalized: true } );
	} );
	on( 'wp-desktop.window.closed', function ( payload ) {
		emit( 'odd.window-closed', payload || {} );
		var c = centerOf( payload && payload.bounds );
		motion( 'ripple', c ? { x: c.x, y: c.y, intensity: 0.6 } : { x: 0.5, y: 0.5, intensity: 0.6, normalized: true } );
	} );
	on( 'wp-desktop.window.focused', function ( payload ) {
		emit( 'odd.window-focused', payload || {} );
		var c = centerOf( payload && payload.bounds );
		if ( c ) motion( 'glance', { x: c.x, y: c.y } );
	} );
	on( 'wp-desktop.shell.error', function ( payload ) {
		emit( 'odd.shell-error', payload || {} );
		motion( 'glitch', { ms: 220 } );
		throttleShellErr( function () { say( 'shellError' ); } );
	} );
	on( 'wp-desktop.iframe.error', function ( payload ) {
		emit( 'odd.iframe-error', payload || {} );
		motion( 'glitch', { ms: 220 } );
		throttleShellErr( function () { say( 'shellError' ); } );
	} );
	on( 'wp-desktop.dock.item-appended', function ( payload ) {
		var c = centerOf( payload && payload.bounds );
		motion( 'ripple', c ? { x: c.x, y: c.y, intensity: 0.3 } : { x: 0.85, y: 0.95, intensity: 0.3, normalized: true } );
	} );
	on( 'wp-desktop.command.after-run', function () {
		motion( 'glance', { nod: true } );
	} );
	on( 'wp-desktop.shell.visibility', function ( payload ) {
		var state = payload && payload.state;
		emit( 'odd.visibility-changed', { state: state } );
		if ( state === 'visible' ) {
			throttleWelcomeBck( function () { say( 'welcomeBack' ); } );
		}
	} );

	// Scene-change + icon-set change are emitted by ODD itself.
	// Hook them here so Iris can react to her own changes.
	var events = window.__odd.events;
	if ( events && typeof events.on === 'function' ) {
		events.on( 'odd.scene-changed', function ( p ) {
			if ( p && p.to ) say( 'sceneOpen.' + p.to );
		} );
		events.on( 'odd.icon-set-changed', function () {
			say( 'iconChange' );
		} );
	}
} )();
