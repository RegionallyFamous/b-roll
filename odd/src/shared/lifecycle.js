/**
 * ODD lifecycle (window.__odd.lifecycle)
 * ---------------------------------------------------------------
 * Explicit boot phases. Subsystems declare which phase they belong
 * to and await it via `whenPhase(name)`, instead of racing on DOM
 * ready or wp.desktop.ready and hoping everyone else showed up.
 *
 * Phases (strictly ordered):
 *   boot              shared modules loaded, store hydrated
 *   configured        localized config applied (rarely distinct
 *                     from boot today but reserved for future
 *                     async config sources)
 *   registries-ready  all registries populated
 *   mounted           first wallpaper frame painted
 *   ready             every enqueued subsystem reported in
 *   teardown          page unload — subscribers should release
 *                     timers, listeners, and Pixi containers
 *
 * `advance(next)` is monotonic: you can only move forward. The
 * one exception is `teardown`, which is reachable from anywhere
 * and terminal. Events are emitted on the shared bus as odd/<phase>.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;
	window.__odd = window.__odd || {};
	if ( window.__odd.lifecycle ) return;

	var PHASES = [ 'boot', 'configured', 'registries-ready', 'mounted', 'ready', 'teardown' ];
	var current = 'boot';
	var waiters = [];

	function orderOf( name ) {
		for ( var i = 0; i < PHASES.length; i++ ) if ( PHASES[ i ] === name ) return i;
		return -1;
	}

	function phase() { return current; }

	function advance( next ) {
		if ( typeof next !== 'string' ) return false;
		if ( next === current ) return false;
		var cO = orderOf( current );
		var nO = orderOf( next );
		if ( nO < 0 ) return false;
		if ( next !== 'teardown' && nO <= cO ) return false;

		var from = current;
		current = next;

		if ( window.__odd.store ) {
			window.__odd.store.set( { runtime: { phase: next } }, { source: 'lifecycle' } );
		}

		if ( window.__odd.events ) {
			window.__odd.events.emit( 'odd.' + next, { from: from, to: next } );
		}

		// Resolve every waiter whose requested phase has now been
		// reached. Snapshot the list so a waiter that registers a new
		// one from its resolve callback doesn't confuse the loop.
		var stillWaiting = [];
		var snap = waiters;
		waiters = stillWaiting;
		for ( var i = 0; i < snap.length; i++ ) {
			var w = snap[ i ];
			var wO = orderOf( w.phase );
			if ( wO >= 0 && wO <= nO ) {
				try { w.resolve( next ); } catch ( e ) {}
			} else {
				stillWaiting.push( w );
			}
		}
		return true;
	}

	function whenPhase( name ) {
		var nO = orderOf( name );
		var cO = orderOf( current );
		if ( nO < 0 ) {
			return typeof Promise === 'function'
				? Promise.reject( new Error( 'ODD lifecycle: unknown phase ' + name ) )
				: null;
		}
		if ( current !== 'teardown' && cO >= nO ) {
			return typeof Promise === 'function' ? Promise.resolve( current ) : null;
		}
		if ( typeof Promise !== 'function' ) return null;
		return new Promise( function ( resolve ) {
			waiters.push( { phase: name, resolve: resolve } );
		} );
	}

	// Wire the teardown phase to page unload so scenes + timers get a
	// last chance to clean up. `pagehide` fires for bfcache transitions
	// too; `beforeunload` doesn't.
	try {
		window.addEventListener( 'pagehide', function () { advance( 'teardown' ); }, { once: true } );
	} catch ( e ) {}

	window.__odd.lifecycle = {
		PHASES:    PHASES.slice(),
		phase:     phase,
		advance:   advance,
		whenPhase: whenPhase,
	};
} )();
