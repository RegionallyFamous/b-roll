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
	// Preview swatches — painterly raster thumbnails shipped under
	// assets/previews/<slug>.jpg. Each one was hand-generated as a
	// 1.6:1 painterly matte painting of its scene's mood (no franchise
	// IP), then resized + JPG-encoded (~640px wide, q75) so the entire
	// 10-image set adds ~650 KB to the plugin payload.
	//
	// They're returned as CSS `background` shorthand (url(...) +
	// fallback solid color), consumable directly by <wpd-swatch>.
	// The version query param ensures swatches refresh whenever the
	// plugin version bumps so users don't see stale art.
	// ================================================================ //

	var bRollCfg = window.bRoll || {};
	var PREVIEW_BASE = ( bRollCfg.pluginUrl || '' ) + '/assets/previews/';
	var PREVIEW_QS = bRollCfg.version ? '?v=' + encodeURIComponent( bRollCfg.version ) : '';

	function preview( slug, fallback ) {
		var url = PREVIEW_BASE + slug + '.jpg' + PREVIEW_QS;
		return "url(\"" + url + "\") center/cover no-repeat, " + ( fallback || '#111' );
	}

	var PREVIEWS = {
		'code-rain':    preview( 'code-rain',    '#021b0f' ),
		'hyperspace':   preview( 'hyperspace',   '#000010' ),
		'neon-rain':    preview( 'neon-rain',    '#0d0412' ),
		'tron-grid':    preview( 'tron-grid',    '#000814' ),
		'couch-gag':    preview( 'couch-gag',    '#7ab9f0' ),
		'rainbow-road': preview( 'rainbow-road', '#0a001e' ),
		'soot-sprites': preview( 'soot-sprites', '#e0deed' ),
		'upside-down':  preview( 'upside-down',  '#1a0410' ),
		'refinery':     preview( 'refinery',     '#d4ded9' ),
		'shimmer':      preview( 'shimmer',      '#22071a' ),
	};

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
