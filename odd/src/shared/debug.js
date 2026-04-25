/**
 * ODD debug inspector (window.__odd.debug)
 * ---------------------------------------------------------------
 * Opt-in runtime inspector. Enabled only when `wpDesktopConfig.debug`
 * is true or the page URL carries `?odd-debug=1`. In production the
 * module installs a no-op stub so callers can always invoke it safely.
 *
 * Methods:
 *
 *   state()          — snapshot of the ODD store
 *   events(n = 100)  — last N events from the bus log
 *   registries()     — every registry after filters apply
 *   timings()        — optional per-subsystem timing marks (future)
 *   dump()           — everything above, suitable for pasting in bugs
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;
	window.__odd = window.__odd || {};
	if ( window.__odd.debug ) return;

	var NOOP = {
		enabled:    false,
		state:      function () {},
		events:     function () { return []; },
		registries: function () { return {}; },
		timings:    function () { return {}; },
		dump:       function () { return {}; },
	};

	var store     = window.__odd.store;
	var events    = window.__odd.events;
	var lifecycle = window.__odd.lifecycle;

	if ( ! store || ! events ) {
		window.__odd.debug = NOOP;
		return;
	}

	var enabled = !! store.get( 'runtime.debug' );
	if ( ! enabled ) {
		window.__odd.debug = NOOP;
		return;
	}

	function snapshot() {
		return store.getState();
	}

	function log( n ) {
		var full = events.log();
		if ( typeof n === 'number' && n > 0 ) return full.slice( -n );
		return full;
	}

	function registries() {
		var r = window.__odd.registries;
		if ( ! r ) return {};
		return {
			scenes:           r.readScenes(),
			iconSets:         r.readIconSets(),
			muses:            r.readMuses(),
			commands:         r.readCommands(),
			widgets:          r.readWidgets(),
			rituals:          r.readRituals(),
			motionPrimitives: r.readMotionPrimitives(),
		};
	}

	function timings() {
		return ( window.__odd && window.__odd._timings ) || {};
	}

	function dump() {
		return {
			at:         new Date().toISOString(),
			phase:      lifecycle ? lifecycle.phase() : 'unknown',
			state:      snapshot(),
			events:     log( 50 ),
			registries: registries(),
			timings:    timings(),
			version:    ( window.odd && window.odd.version ) || '',
		};
	}

	window.__odd.debug = {
		enabled:    true,
		state:      snapshot,
		events:     log,
		registries: registries,
		timings:    timings,
		dump:       dump,
	};

	try { window.console.info( '[ODD] Debug mode active. Inspect via window.__odd.debug.' ); } catch ( e ) {}
} )();
