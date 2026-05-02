/**
 * ODD scene: Tide Pool — v1.2.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (wallpaper.webp)
 * with noon rockpool motion:
 *
 *   1. Two caustic light nets at different scales drift over the sand.
 *   2. A shoal of tiny dart-fish follow curvy sine paths.
 *   3. A faint surface sparkle layer pulses with audio highs.
 *
 * Reduced motion freezes caustics and fish in place.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;
	var scriptUrl = document.currentScript && document.currentScript.src;

	var FISH_COUNT = 14;
	var SPARKLE_COUNT = 70;

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'tide-pool' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function makeFish( w, hh ) {
		var out = [];
		for ( var i = 0; i < FISH_COUNT; i++ ) {
			out.push( {
				x: h.rand( w * 0.08, w * 0.92 ),
				y: h.rand( hh * 0.18, hh * 0.88 ),
				len: h.rand( 5, 11 ),
				speed: h.rand( 0.9, 1.8 ) * ( Math.random() < 0.5 ? 1 : -1 ),
				phase: Math.random() * h.tau,
				sway: h.rand( 12, 28 ),
				alpha: h.rand( 0.22, 0.48 ),
				tint: h.choose( [ 0x20303a, 0x273640, 0x3a2a22 ] ),
			} );
		}
		return out;
	}

	function makeSparkles( w, hh ) {
		var out = [];
		for ( var i = 0; i < SPARKLE_COUNT; i++ ) {
			out.push( {
				x: h.rand( 0, w ),
				y: h.rand( 0, hh ),
				r: h.rand( 0.4, 1.4 ),
				phase: Math.random() * h.tau,
				speed: h.rand( 0.012, 0.03 ),
				alpha: h.rand( 0.15, 0.4 ),
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'tide-pool' ] = {
		setup: async function ( env ) {
			var PIXI = env.PIXI, app = env.app;
			var tex = await PIXI.Assets.load( backdropUrl() );
			var backdrop = new PIXI.Sprite( tex );
			app.stage.addChild( backdrop );
			function fitBackdrop() {
				var s = Math.max( app.renderer.width / tex.width, app.renderer.height / tex.height );
				backdrop.scale.set( s );
				backdrop.x = ( app.renderer.width - tex.width * s ) / 2;
				backdrop.y = ( app.renderer.height - tex.height * s ) / 2;
			}
			fitBackdrop();

			var caustics = new PIXI.Graphics();
			caustics.blendMode = 'add';
			caustics.alpha = 0.55;
			app.stage.addChild( caustics );

			var fish = new PIXI.Graphics();
			app.stage.addChild( fish );

			var sparkles = new PIXI.Graphics();
			sparkles.blendMode = 'add';
			app.stage.addChild( sparkles );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				caustics: caustics, fish: fish, sparkles: sparkles,
				fishList: makeFish( w, hh ),
				sparkleList: makeSparkles( w, hh ),
				time: 0, pulse: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.fishList = makeFish( w, hh );
			state.sparkleList = makeSparkles( w, hh );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.pulse *= 0.9;

			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			var cg = state.caustics;
			cg.clear();
			for ( var i = 0; i < 9; i++ ) {
				var t = state.time * 0.006;
				var y = hh * ( 0.22 + i * 0.09 ) + Math.sin( t + i * 0.7 ) * 10;
				cg.moveTo( -20, y )
					.bezierCurveTo( w * 0.3, y - 22 + Math.cos( t + i ) * 6, w * 0.62, y + 24, w + 20, y - 8 )
					.stroke( { color: 0xfff4c8, width: 1.2, alpha: 0.12 + state.pulse * 0.1, cap: 'round' } );
			}
			for ( var j = 0; j < 5; j++ ) {
				var t2 = state.time * 0.01 + j * 1.3;
				var y2 = hh * ( 0.18 + j * 0.16 ) + Math.cos( t2 ) * 14;
				cg.moveTo( -20, y2 )
					.bezierCurveTo( w * 0.35, y2 + 28, w * 0.68, y2 - 28, w + 20, y2 + 6 )
					.stroke( { color: 0xcdf3ff, width: 0.9, alpha: 0.08, cap: 'round' } );
			}

			var fg = state.fish;
			fg.clear();
			var fishes = state.fishList;
			for ( var k = 0; k < fishes.length; k++ ) {
				var f = fishes[ k ];
				if ( ! env.reducedMotion ) {
					f.x += f.speed * dt;
					f.phase += 0.03 * dt;
					if ( f.x < -40 ) f.x = w + 20;
					if ( f.x > w + 40 ) f.x = -20;
				}
				var fx = f.x + px * 6;
				var fy = f.y + Math.sin( f.phase ) * f.sway + py * 3;
				var dir = f.speed > 0 ? 1 : -1;
				fg.moveTo( fx - f.len * dir, fy )
					.quadraticCurveTo( fx, fy - 1.5, fx + f.len * dir, fy )
					.quadraticCurveTo( fx, fy + 1.5, fx - f.len * dir, fy )
					.fill( { color: f.tint, alpha: f.alpha } );
				fg.moveTo( fx - f.len * dir, fy )
					.lineTo( fx - ( f.len + 3 ) * dir, fy - 2 )
					.lineTo( fx - ( f.len + 3 ) * dir, fy + 2 )
					.fill( { color: f.tint, alpha: f.alpha * 0.85 } );
			}

			var sg = state.sparkles;
			sg.clear();
			for ( var s = 0; s < state.sparkleList.length; s++ ) {
				var p = state.sparkleList[ s ];
				if ( ! env.reducedMotion ) p.phase += p.speed * dt;
				var a = p.alpha * ( 0.4 + Math.abs( Math.sin( p.phase ) ) * 0.6 ) * ( 0.85 + high * 0.3 );
				sg.circle( p.x, p.y, p.r ).fill( { color: 0xffffff, alpha: a } );
			}

		},

		onRipple: function ( opts, state ) {
			state.pulse = Math.min( 1, state.pulse + ( ( opts && opts.intensity ) || 0.5 ) );
		},

		onAudio: function ( state, env ) {
			if ( env.audio.high > 0.5 ) state.pulse = Math.min( 1, state.pulse + 0.08 );
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.fishList = [];
			state.sparkleList = [];
		},
	};
} )();
