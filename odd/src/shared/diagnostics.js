/**
 * ODD diagnostics (window.__odd.diagnostics)
 * ---------------------------------------------------------------
 * Local-only, zero-telemetry diagnostics bundle for bug reports.
 *
 * Everything this module collects stays on the user's machine. The
 * only side effect that leaves the browser is the user manually
 * copying the payload into a GitHub issue. There is no network
 * transport, no opt-in flag, no ping-back; if we ever add server-side
 * telemetry it MUST be a separate module so this one keeps its
 * "safe to run, always" contract.
 *
 * Exposes:
 *   window.__odd.diagnostics.collect()              → payload object
 *   window.__odd.diagnostics.collectMarkdown()      → markdown string
 *   window.__odd.diagnostics.copy()                 → Promise<boolean>
 *
 * Also installs a ring buffer that captures the last 100 entries from
 * console.error + console.warn + unhandled errors so the report has
 * something useful even when the panel wasn't open when things went
 * wrong. The buffer size is capped to keep `localStorage` clean.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	window.__odd = window.__odd || {};
	if ( window.__odd.diagnostics ) return;

	var MAX_ENTRIES = 100;
	var MAX_METRICS = 80;
	var buffer = [];
	var metrics = {
		timings: [],
		counters: {},
	};

	function now() {
		return new Date().toISOString();
	}

	function safeStringify( arg ) {
		if ( arg === undefined ) return 'undefined';
		if ( arg === null ) return 'null';
		if ( arg instanceof Error ) {
			return ( arg.name || 'Error' ) + ': ' + arg.message +
				( arg.stack ? '\n' + arg.stack : '' );
		}
		if ( typeof arg === 'string' ) return arg;
		try { return JSON.stringify( arg ); }
		catch ( _ ) { return String( arg ); }
	}

	function record( level, args ) {
		try {
			var line = Array.prototype.slice.call( args || [] ).map( safeStringify ).join( ' ' );
			buffer.push( { at: now(), level: level, message: line.slice( 0, 2000 ) } );
			while ( buffer.length > MAX_ENTRIES ) buffer.shift();
		} catch ( _ ) {}
	}

	function monotonicNow() {
		try {
			return ( window.performance && typeof window.performance.now === 'function' ) ? window.performance.now() : Date.now();
		} catch ( _ ) {
			return Date.now();
		}
	}

	function metricName( name ) {
		return String( name || '' ).replace( /[^a-zA-Z0-9_.:-]/g, '-' ).slice( 0, 96 );
	}

	function timing( name, ms, meta ) {
		name = metricName( name );
		if ( ! name ) return null;
		var row = {
			at:   now(),
			name: name,
			ms:   Math.max( 0, Math.round( Number( ms ) || 0 ) ),
		};
		if ( meta && typeof meta === 'object' ) {
			row.meta = {};
			Object.keys( meta ).slice( 0, 12 ).forEach( function ( key ) {
				var value = meta[ key ];
				if ( value === null || [ 'string', 'number', 'boolean' ].indexOf( typeof value ) !== -1 ) {
					row.meta[ key ] = value;
				}
			} );
		}
		metrics.timings.push( row );
		while ( metrics.timings.length > MAX_METRICS ) metrics.timings.shift();
		return row;
	}

	function count( name, by ) {
		name = metricName( name );
		if ( ! name ) return 0;
		by = Number( by );
		if ( ! by ) by = 1;
		metrics.counters[ name ] = ( metrics.counters[ name ] || 0 ) + by;
		return metrics.counters[ name ];
	}

	function time( name, meta ) {
		var start = monotonicNow();
		return function ( doneMeta ) {
			var merged = {};
			var key;
			if ( meta && typeof meta === 'object' ) {
				for ( key in meta ) {
					if ( Object.prototype.hasOwnProperty.call( meta, key ) ) merged[ key ] = meta[ key ];
				}
			}
			if ( doneMeta && typeof doneMeta === 'object' ) {
				for ( key in doneMeta ) {
					if ( Object.prototype.hasOwnProperty.call( doneMeta, key ) ) merged[ key ] = doneMeta[ key ];
				}
			}
			return timing( name, monotonicNow() - start, merged );
		};
	}

	function metricsSnapshot() {
		return {
			timings:  metrics.timings.slice(),
			counters: Object.assign( {}, metrics.counters ),
		};
	}

	var c = window.console;
	if ( c ) {
		var origError = c.error && c.error.bind( c );
		var origWarn  = c.warn  && c.warn.bind( c );
		if ( origError ) { c.error = function () { record( 'error', arguments ); return origError.apply( null, arguments ); }; }
		if ( origWarn )  { c.warn  = function () { record( 'warn',  arguments ); return origWarn.apply( null, arguments ); }; }
	}

	window.addEventListener( 'error', function ( e ) {
		record( 'error', [ e && ( e.message || 'Uncaught' ), e && e.filename, e && e.lineno ] );
	} );
	window.addEventListener( 'unhandledrejection', function ( e ) {
		record( 'error', [ 'UnhandledRejection:', e && ( e.reason && e.reason.message ) || e ] );
	} );

	// Also mirror whatever the event bus routed as `odd.error` so scene
	// boundary errors show up in the report even when they were only
	// logged through wrapMethod.
	try {
		if ( window.__odd.events && typeof window.__odd.events.on === 'function' ) {
			window.__odd.events.on( 'odd.error', function ( payload ) {
				record( 'error', [ 'odd.error', payload && payload.scope, payload && payload.error && payload.error.message ] );
			} );
		}
	} catch ( _ ) {}

	function environment() {
		var c = window.odd || {};
		return {
			oddVersion:   c.version || '',
			pluginUrl:    c.pluginUrl || '',
			restUrl:      c.restUrl ? '(present)' : '(missing)',
			apiVersion:   ( window.__odd && window.__odd.api && window.__odd.api.version ) || '',
			wpHooks:      !! ( window.wp && window.wp.hooks ),
			desktopMode:  !! ( window.wp && window.wp.desktop ),
			desktopLayout: ( window.wp && window.wp.desktop && window.wp.desktop.desktopLayout ) || '',
			desktopHookBridge: !! ( window.__odd && window.__odd.desktopHooks ),
			pixi:         !! window.PIXI,
			userAgent:    ( navigator && navigator.userAgent ) || '',
			viewport:     { w: window.innerWidth, h: window.innerHeight },
			devicePixelRatio: window.devicePixelRatio || 1,
			language:     ( navigator && navigator.language ) || '',
		};
	}

	function lifecyclePhase() {
		try {
			return ( window.__odd.lifecycle && window.__odd.lifecycle.phase && window.__odd.lifecycle.phase() ) || 'unknown';
		} catch ( _ ) { return 'unknown'; }
	}

	function registriesSnapshot() {
		try {
			var r = window.__odd.registries;
			if ( ! r ) return {};
			function countOrEmpty( list ) { return Array.isArray( list ) ? list.length : 0; }
			return {
				scenes:   countOrEmpty( r.readScenes && r.readScenes() ),
				iconSets: countOrEmpty( r.readIconSets && r.readIconSets() ),
				widgets:  countOrEmpty( r.readWidgets && r.readWidgets() ),
				commands: countOrEmpty( r.readCommands && r.readCommands() ),
				apps:     countOrEmpty( r.readApps && r.readApps() ),
			};
		} catch ( _ ) { return {}; }
	}

	function storeSnapshot() {
		try {
			if ( ! window.__odd.store ) return {};
			var snap = window.__odd.store.getState();
			if ( snap && snap.user ) {
				return { user: { wallpaper: snap.user.wallpaper, iconSet: snap.user.iconSet, cursorSet: snap.user.cursorSet } };
			}
			return {};
		} catch ( _ ) { return {}; }
	}

	function systemHealthSnapshot() {
		try {
			var c = window.odd || {};
			return c.systemHealth || {};
		} catch ( _ ) { return {}; }
	}

	function desktopSnapshot() {
		try {
			var api = window.__odd && window.__odd.api;
			return api && typeof api.diagnosticsSnapshot === 'function' ? api.diagnosticsSnapshot() : {};
		} catch ( _ ) { return {}; }
	}

	function collect() {
		return {
			collectedAt:   now(),
			phase:         lifecyclePhase(),
			environment:   environment(),
			registries:    registriesSnapshot(),
			state:         storeSnapshot(),
			systemHealth:  systemHealthSnapshot(),
			desktop:       desktopSnapshot(),
			metrics:       metricsSnapshot(),
			recentLog:     buffer.slice().reverse().slice( 0, 50 ),
		};
	}

	function collectMarkdown() {
		var p = collect();
		var env = p.environment;
		var lines = [
			'# ODD diagnostics',
			'',
			'_Collected at ' + p.collectedAt + '. No information has been sent anywhere — this was assembled locally and copied to your clipboard. Paste it into a GitHub issue as-is._',
			'',
			'## Environment',
			'- ODD version: `' + env.oddVersion + '`',
			'- API version: `' + env.apiVersion + '`',
			'- Lifecycle phase: `' + p.phase + '`',
			'- WP Desktop Mode present: ' + ( env.desktopMode ? 'yes' : 'no' ),
			'- Desktop layout: `' + env.desktopLayout + '`',
			'- Desktop hook bridge: ' + ( env.desktopHookBridge ? 'yes' : 'no' ),
			'- PIXI global present: ' + ( env.pixi ? 'yes' : 'no' ),
			'- REST URL localized: ' + env.restUrl,
			'- User agent: `' + env.userAgent + '`',
			'- Viewport: `' + env.viewport.w + '×' + env.viewport.h + '` @ `' + env.devicePixelRatio + 'x`',
			'- Language: `' + env.language + '`',
			'',
			'## Registries',
			'- scenes: `' + p.registries.scenes + '` / iconSets: `' + p.registries.iconSets + '` / widgets: `' + p.registries.widgets + '` / commands: `' + p.registries.commands + '` / apps: `' + p.registries.apps + '`',
			'',
			'## State',
			'- wallpaper: `' + ( p.state.user && p.state.user.wallpaper || '' ) + '`',
			'- iconSet: `' + ( p.state.user && p.state.user.iconSet || '' ) + '`',
			'',
			'## System Health',
			'- catalog source: `' + ( p.systemHealth.catalog && p.systemHealth.catalog.source || '' ) + '`',
			'- catalog bundles: `' + ( p.systemHealth.catalog && p.systemHealth.catalog.bundle_count || 0 ) + '`',
			'- catalog last error: `' + ( p.systemHealth.catalog && p.systemHealth.catalog.last_error_message || '' ) + '`',
			'- starter status: `' + ( p.systemHealth.starter && p.systemHealth.starter.status || '' ) + '`',
			'- installed apps: `' + ( p.systemHealth.apps && p.systemHealth.apps.installed || 0 ) + '`',
			'- installed scenes/icon sets/cursor sets/widgets: `' + [
				p.systemHealth.content && p.systemHealth.content.scenes || 0,
				p.systemHealth.content && p.systemHealth.content.iconSets || 0,
				p.systemHealth.content && p.systemHealth.content.cursorSets || 0,
				p.systemHealth.content && p.systemHealth.content.widgets || 0,
			].join( '/' ) + '`',
			'- active cursor set: `' + ( p.systemHealth.cursors && p.systemHealth.cursors.active || ( p.state.user && p.state.user.cursorSet ) || '' ) + '`',
			'- cursor stylesheet: `' + ( p.systemHealth.cursors && p.systemHealth.cursors.stylesheet ? '(present)' : '(missing)' ) + '`',
			'- Desktop Mode version: `' + ( p.systemHealth.desktopMode && p.systemHealth.desktopMode.version || '' ) + '`',
			'- Desktop Mode baseline met: `' + ( p.systemHealth.desktopMode && p.systemHealth.desktopMode.baseline ? 'yes' : 'no' ) + '`',
			'- Desktop Mode settings tabs/system tiles/palettes: `' + [
				p.desktop.settingsTabs && p.desktop.settingsTabs.length || 0,
				p.desktop.systemTiles && p.desktop.systemTiles.length || 0,
				p.desktop.palettes && p.desktop.palettes.length || 0,
			].join( '/' ) + '`',
			'',
			'## Local Metrics',
			'- timings captured: `' + ( p.metrics.timings && p.metrics.timings.length || 0 ) + '`',
			'- counters: `' + Object.keys( p.metrics.counters || {} ).map( function ( key ) { return key + '=' + p.metrics.counters[ key ]; } ).join( ', ' ) + '`',
			'',
			'## Recent log (' + p.recentLog.length + ' entries, newest first)',
			'```',
		];
		for ( var i = 0; i < p.recentLog.length; i++ ) {
			var e = p.recentLog[ i ];
			lines.push( '[' + e.at + '] [' + e.level + '] ' + e.message );
		}
		lines.push( '```' );
		return lines.join( '\n' );
	}

	function copy() {
		var md = collectMarkdown();
		if ( navigator && navigator.clipboard && navigator.clipboard.writeText ) {
			return navigator.clipboard.writeText( md ).then( function () { return true; }, function () { return fallbackCopy( md ); } );
		}
		return Promise.resolve( fallbackCopy( md ) );
	}

	function fallbackCopy( text ) {
		try {
			var ta = document.createElement( 'textarea' );
			ta.value = text;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild( ta );
			ta.select();
			var ok = document.execCommand && document.execCommand( 'copy' );
			document.body.removeChild( ta );
			return !! ok;
		} catch ( _ ) { return false; }
	}

	window.__odd.diagnostics = {
		collect:         collect,
		collectMarkdown: collectMarkdown,
		copy:            copy,
		count:           count,
		metrics:         metricsSnapshot,
		record:          record,
		recent:          function () { return buffer.slice(); },
		time:            time,
		timing:          timing,
	};
} )();
