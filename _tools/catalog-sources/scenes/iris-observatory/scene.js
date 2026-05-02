/**
 * ODD scene: Iris Observatory — v0.15.1
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (wallpaper.webp)
 * with restrained Pixi motion:
 *
 *   1. Slow atmospheric dust, biased around the telescope/window light.
 *   2. Soft aurora ribbons outside the circular glass.
 *   3. Occasional iris-glass glints and a faint breathing vignette.
 *
 * The still image carries the scene. Animation stays subtle and
 * opt-in: reduced motion renders a quiet settled frame; Iris motion
 * primitives can ripple, glance, and glitch the overlay without
 * disturbing the painting.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;
	var scriptUrl = document.currentScript && document.currentScript.src;

	var DUST_COUNT = 130;
	var RIBBON_COUNT = 3;

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'iris-observatory' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function makeDust( w, hh ) {
		var arr = [];
		for ( var i = 0; i < DUST_COUNT; i++ ) {
			arr.push( {
				x: h.rand( w * 0.08, w * 0.92 ),
				y: h.rand( hh * 0.08, hh * 0.82 ),
				r: h.rand( 0.45, 1.8 ),
				phase: Math.random() * Math.PI * 2,
				speed: h.rand( 0.003, 0.011 ),
				alpha: h.rand( 0.08, 0.32 ),
			} );
		}
		return arr;
	}

	function makeRibbons( w, hh ) {
		var colors = [ 0x74fff0, 0xbc7cff, 0x78a7ff ];
		var arr = [];
		for ( var i = 0; i < RIBBON_COUNT; i++ ) {
			arr.push( {
				y: hh * ( 0.15 + i * 0.08 ),
				amp: h.rand( 12, 30 ),
				speed: h.rand( 0.002, 0.005 ),
				phase: Math.random() * Math.PI * 2,
				color: colors[ i % colors.length ],
				alpha: 0.08 + i * 0.025,
				width: 1.6 + i * 0.7,
				x0: w * 0.43,
				x1: w * 0.82,
			} );
		}
		return arr;
	}

	window.__odd.scenes[ 'iris-observatory' ] = {
		setup: async function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			var tex = await PIXI.Assets.load( backdropUrl() );
			var backdrop = new PIXI.Sprite( tex );
			app.stage.addChild( backdrop );
			function fitBackdrop() {
				var s = Math.max(
					app.renderer.width  / tex.width,
					app.renderer.height / tex.height
				);
				backdrop.scale.set( s );
				backdrop.x = ( app.renderer.width  - tex.width  * s ) / 2;
				backdrop.y = ( app.renderer.height - tex.height * s ) / 2;
			}
			fitBackdrop();

			var ribbons = new PIXI.Graphics();
			ribbons.blendMode = 'add';
			app.stage.addChild( ribbons );

			var dust = new PIXI.Graphics();
			dust.blendMode = 'add';
			app.stage.addChild( dust );

			var glints = new PIXI.Graphics();
			glints.blendMode = 'add';
			app.stage.addChild( glints );

			var vignette = new PIXI.Graphics();
			app.stage.addChild( vignette );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop,
				fitBackdrop: fitBackdrop,
				ribbons: ribbons,
				ribbonList: makeRibbons( w, hh ),
				dust: dust,
				dustList: makeDust( w, hh ),
				glints: glints,
				vignette: vignette,
				time: 0,
				ripple: 0,
				glitch: 0,
				glanceX: 0,
				glanceY: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.dustList = makeDust( w, hh );
			state.ribbonList = makeRibbons( w, hh );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt;
			state.ripple *= 0.94;
			state.glitch *= 0.88;
			state.glanceX *= 0.9;
			state.glanceY *= 0.9;

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;
			var shimmer = 1 + bass * 0.4 + state.ripple * 0.55;

			var rg = state.ribbons;
			rg.clear();
			for ( var r = 0; r < state.ribbonList.length; r++ ) {
				var rib = state.ribbonList[ r ];
				var steps = 18;
				var prevX = rib.x0, prevY = rib.y;
				for ( var i = 1; i <= steps; i++ ) {
					var t = i / steps;
					var x = rib.x0 + ( rib.x1 - rib.x0 ) * t;
					var y = rib.y
						+ Math.sin( state.time * rib.speed + rib.phase + t * 5.5 ) * rib.amp
						+ state.glanceY * 10;
					rg.moveTo( prevX, prevY ).lineTo( x, y )
						.stroke( {
							color: rib.color,
							width: rib.width + state.ripple * 1.4,
							alpha: rib.alpha * shimmer,
							cap: 'round',
						} );
					prevX = x; prevY = y;
				}
			}

			var dg = state.dust;
			dg.clear();
			for ( var d = 0; d < state.dustList.length; d++ ) {
				var p = state.dustList[ d ];
				if ( ! env.reducedMotion ) p.phase += p.speed * dt;
				var driftX = Math.sin( p.phase * 0.7 ) * 7 + state.glanceX * 7;
				var driftY = Math.cos( p.phase ) * 5 + state.ripple * 4;
				var pulse = 0.72 + Math.sin( p.phase * 1.3 ) * 0.28;
				dg.circle( p.x + driftX, p.y + driftY, p.r )
					.fill( { color: 0xf8e7b8, alpha: p.alpha * pulse * ( 1 + high * 0.35 ) } );
			}

			var gg = state.glints;
			gg.clear();
			var glintAlpha = 0.12 + Math.sin( state.time * 0.012 ) * 0.045 + state.ripple * 0.1;
			var cx = w * ( 0.615 + state.glanceX * 0.012 );
			var cy = hh * ( 0.29 + state.glanceY * 0.012 );
			gg.moveTo( cx - 42, cy ).lineTo( cx + 42, cy )
				.stroke( { color: 0xffffff, width: 1.2, alpha: glintAlpha, cap: 'round' } );
			gg.moveTo( cx, cy - 28 ).lineTo( cx, cy + 28 )
				.stroke( { color: 0xffffff, width: 0.8, alpha: glintAlpha * 0.65, cap: 'round' } );

			var vg = state.vignette;
			vg.clear();
			vg.rect( 0, 0, w, hh ).fill( {
				color: state.glitch > 0.01 ? 0x190a28 : 0x000000,
				alpha: 0.04 + Math.sin( state.time * 0.006 ) * 0.012 + state.glitch * 0.04,
			} );

		},

		onRipple: function ( opts, state ) {
			state.ripple = Math.min( 1, state.ripple + ( ( opts && opts.intensity ) || 0.5 ) );
		},

		onGlance: function ( opts, state, env ) {
			if ( ! opts || opts.nod ) return;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.glanceX = Math.max( -1, Math.min( 1, ( ( opts.x || w / 2 ) / w - 0.5 ) * 2 ) );
			state.glanceY = Math.max( -1, Math.min( 1, ( ( opts.y || hh / 2 ) / hh - 0.5 ) * 2 ) );
		},

		onGlitch: function ( opts, state ) {
			state.glitch = Math.min( 1, state.glitch + 0.8 );
			state.ripple = Math.min( 1, state.ripple + 0.4 );
		},

		onAudio: function ( state, env ) {
			if ( env.audio.high > 0.58 ) {
				state.ripple = Math.min( 1, state.ripple + 0.08 );
			}
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.dustList = [];
			state.ribbonList = [];
		},
	};
} )();
