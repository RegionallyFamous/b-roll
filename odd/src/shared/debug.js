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
		apps:       function () { return { installed: [], pinned: [], windows: [] }; },
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
			apps:             r.readApps ? r.readApps() : [],
		};
	}

	/**
	 * Apps inspector. Returns what's installed, what the user has
	 * pinned, and which app windows the host currently knows about.
	 * When used from the console this is the one-stop debug call
	 * for every apps-related question.
	 */
	function apps() {
		var installed = ( store.get( 'registries.apps' ) ) || [];
		var userSlice = store.get( 'user.apps' ) || {};
		var openWindowIds = [];
		try {
			var shell = window.wp && window.wp.desktop;
			if ( shell && typeof shell.getWindows === 'function' ) {
				var all = shell.getWindows() || [];
				for ( var i = 0; i < all.length; i++ ) {
					if ( all[ i ] && typeof all[ i ].id === 'string' && all[ i ].id.indexOf( 'odd-app-' ) === 0 ) {
						openWindowIds.push( all[ i ].id );
					}
				}
			}
		} catch ( e ) {}
		return {
			installed: installed,
			pinned:    Array.isArray( userSlice.pinned )    ? userSlice.pinned.slice()    : [],
			enabled:   Array.isArray( userSlice.installed ) ? userSlice.installed.slice() : [],
			windows:   openWindowIds,
			feature:   !! ( window.odd && window.odd.appsEnabled ),
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
		apps:       apps,
	};

	try { window.console.info( '[ODD] Debug mode active. Inspect via window.__odd.debug.' ); } catch ( e ) {}
} )();
