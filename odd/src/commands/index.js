/**
 * ODD — slash-command integration for WP Desktop Mode's palette
 * ---------------------------------------------------------------
 * Registers four slash commands on the ⌘K palette:
 *
 *   /odd [scene]        swap to a scene (autocomplete from the
 *                       registered catalog; no-arg = random).
 *   /odd-icons [set]    swap to an icon set (autocomplete; 'none'
 *                       is valid and reverts to WP defaults).
 *   /shuffle            pick a random non-current scene.
 *   /odd-panel          open the ODD Control Panel native window.
 *
 * All four route through window.__odd.api so they share the live
 * swap + REST persistence path with the widgets and the panel.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	function ready( cb ) {
		if ( window.wp && window.wp.desktop && typeof window.wp.desktop.ready === 'function' ) {
			window.wp.desktop.ready( cb );
		} else if ( document.readyState === 'loading' ) {
			document.addEventListener( 'DOMContentLoaded', cb, { once: true } );
		} else {
			cb();
		}
	}

	function api() { return window.__odd && window.__odd.api; }
	function norm( s ) { return String( s || '' ).trim().toLowerCase(); }

	// Wrap a command run handler so a throw in one command doesn't poison
	// the rest of the palette. Reported as `odd.error` on the bus with the
	// command slug in the `source` so the debug inspector can show which
	// command misbehaved.
	function safeRun( fn, source ) {
		return function ( args, ctx ) {
			try {
				return fn( args, ctx );
			} catch ( err ) {
				if ( window.__odd && window.__odd.events ) {
					try {
						window.__odd.events.emit( 'odd.error', {
							source:   source,
							err:      err,
							severity: 'error',
							message:  err && err.message,
							stack:    err && err.stack,
						} );
					} catch ( e ) {}
				}
				if ( window.console ) { try { window.console.error( '[ODD ' + source + ']', err ); } catch ( e ) {} }
				return 'ODD hit a snag running that command. Reload and try again.';
			}
		};
	}
	function safeSuggest( fn, source ) {
		return function ( args ) {
			try { return fn( args ); } catch ( err ) {
				if ( window.__odd && window.__odd.events ) {
					try {
						window.__odd.events.emit( 'odd.error', {
							source:   source,
							err:      err,
							severity: 'warning',
							message:  err && err.message,
							stack:    err && err.stack,
						} );
					} catch ( e ) {}
				}
				return [];
			}
		};
	}

	// Fuzzy-ish substring match on slug + label. Low ceremony; the palette
	// already narrows by the /slug prefix, so this only filters the args.
	function matches( needle, candidates ) {
		var n = norm( needle );
		if ( ! n ) return candidates.slice();
		return candidates.filter( function ( c ) {
			return norm( c.value ).indexOf( n ) >= 0 || norm( c.label ).indexOf( n ) >= 0;
		} );
	}

	function sceneSuggestions( args ) {
		if ( ! api() ) return [];
		return matches( args, api().scenes().map( function ( s ) {
			return {
				value:       s.slug,
				label:       s.label || s.slug,
				description: s.franchise || '',
				icon:        'dashicons-art',
			};
		} ) );
	}

	function iconSetSuggestions( args ) {
		var list = [];
		if ( api() ) {
			list = api().iconSets().map( function ( s ) {
				return {
					value:       s.slug,
					label:       s.label || s.slug,
					description: s.franchise || '',
					icon:        'dashicons-grid-view',
				};
			} );
		}
		list.unshift( {
			value:       'none',
			label:       'Default',
			description: 'WP Desktop Mode stock icons',
			icon:        'dashicons-no-alt',
		} );
		return matches( args, list );
	}

	function run_odd( args ) {
		var a = api();
		if ( ! a ) return 'ODD is not ready yet.';
		var slug = norm( args );
		if ( ! slug ) {
			var ok = a.shuffle();
			return ok
				? 'Shuffled to a random scene.'
				: 'No scenes registered yet.';
		}
		var scene = a.sceneBySlug( slug );
		if ( ! scene ) return 'Unknown scene "' + slug + '". Try /odd with Tab for a list.';
		if ( slug === a.currentScene() ) return scene.label + ' is already playing.';
		a.setScene( slug );
		return 'Now playing: ' + ( scene.label || slug ) + '.';
	}

	function run_oddIcons( args ) {
		var a = api();
		if ( ! a ) return 'ODD is not ready yet.';
		var slug = norm( args );
		if ( ! slug ) return 'Usage: /odd-icons [set]. Tab to see available sets.';
		var set = slug === 'none' ? { label: 'Default' } : a.iconSetBySlug( slug );
		if ( ! set ) return 'Unknown icon set "' + slug + '". Try /odd-icons with Tab for a list.';
		var cur = a.currentIconSet() || 'none';
		if ( slug === cur ) return ( set.label || slug ) + ' is already active.';
		a.setIconSet( slug );
		return 'Applying ' + ( set.label || slug ) + '… reloading.';
	}

	function run_shuffle() {
		var a = api();
		if ( ! a ) return 'ODD is not ready yet.';
		var ok = a.shuffle();
		if ( ! ok ) return 'No scenes registered yet.';
		var s = a.sceneBySlug( a.currentScene() );
		return 'Shuffled to ' + ( ( s && s.label ) ? s.label : 'a random scene' ) + '.';
	}

	function run_panel( args, ctx ) {
		var a = api();
		if ( a && a.openPanel() ) {
			if ( ctx && ctx.close ) ctx.close();
			return;
		}
		return 'ODD Control Panel is unavailable — WP Desktop Mode may not be ready yet.';
	}

	ready( function () {
		if ( ! window.wp || ! window.wp.desktop || typeof window.wp.desktop.registerCommand !== 'function' ) return;

		window.wp.desktop.registerCommand( {
			slug:        'odd',
			label:       'ODD: pick a scene',
			description: 'Swap the live PixiJS wallpaper scene.',
			hint:        '[scene] · blank = random',
			icon:        'dashicons-art',
			owner:       'odd-commands',
			suggest:     safeSuggest( sceneSuggestions, 'command.odd.suggest' ),
			run:         safeRun( run_odd, 'command.odd' ),
		} );

		window.wp.desktop.registerCommand( {
			slug:        'odd-icons',
			label:       'ODD: pick an icon set',
			description: 'Swap the dock + desktop shortcut icon set (soft reload).',
			hint:        '[set] · "none" to reset',
			icon:        'dashicons-grid-view',
			owner:       'odd-commands',
			suggest:     safeSuggest( iconSetSuggestions, 'command.odd-icons.suggest' ),
			run:         safeRun( run_oddIcons, 'command.odd-icons' ),
		} );

		window.wp.desktop.registerCommand( {
			slug:        'shuffle',
			label:       'ODD: shuffle scene',
			description: 'Jump to a random scene right now.',
			icon:        'dashicons-controls-forward',
			owner:       'odd-commands',
			run:         safeRun( run_shuffle, 'command.shuffle' ),
		} );

		window.wp.desktop.registerCommand( {
			slug:        'odd-panel',
			label:       'ODD: open Control Panel',
			description: 'Open (or focus) the ODD Control Panel window.',
			icon:        'dashicons-admin-generic',
			owner:       'odd-commands',
			run:         safeRun( run_panel, 'command.odd-panel' ),
		} );
	} );
} )();
