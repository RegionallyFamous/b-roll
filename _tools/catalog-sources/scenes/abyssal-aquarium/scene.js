/**
 * ODD scene: Abyssal Aquarium - v1.1.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (wallpaper.webp)
 * with layered Pixi motion that sells the aquarium glass:
 *
 *   1. Three depth bands of jellyfish silhouettes (back / mid / front),
 *      each with a breathing bell pulse and gentle vertical drift.
 *      Parallax tilts them against each other on cursor movement.
 *
 *   2. Rising bubbles in three depth tiers, smaller/faster up close.
 *
 *   3. Two soft caustic light shafts raking down from above.
 *
 *   4. Dust motes drifting in the near field.
 *
 * Audio: bass brightens bioluminescence and speeds jellyfish bells.
 * Reduced motion: everything freezes with the current pose rendered once.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;
	var scriptUrl = document.currentScript && document.currentScript.src;

	var JELLY_COUNTS = [ 4, 4, 2 ];       // back, mid, front
	var JELLY_SCALES = [ 0.55, 0.9, 1.35 ];
	var JELLY_ALPHAS = [ 0.14, 0.26, 0.4 ];
	var BUBBLE_COUNTS = [ 28, 22, 12 ];
	var DUST_COUNT = 64;
	var SHAFT_COUNT = 2;

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'abyssal-aquarium' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function makeJellies( w, hh, perfLow ) {
		var layers = [];
		for ( var band = 0; band < 3; band++ ) {
			var items = [];
			var count = perfLow ? Math.max( 1, Math.floor( JELLY_COUNTS[ band ] * 0.55 ) ) : JELLY_COUNTS[ band ];
			for ( var i = 0; i < count; i++ ) {
				var x = h.rand( w * 0.18, w * 0.94 );
				var y = h.rand( hh * 0.16, hh * 0.74 );
				if ( x < w * 0.38 && y > hh * 0.5 ) x += w * 0.28;
				items.push( {
					x: x,
					y: y,
					// Bell radius shrinks with depth.
					r: h.rand( 22, 42 ) * JELLY_SCALES[ band ],
					phase: Math.random() * h.tau,
					pulseSpeed: h.rand( 0.014, 0.026 ),
					drift: h.rand( -0.08, 0.08 ),
					hue: [ 0x74e8ff, 0xa0ffe0, 0xc8b0ff ][ ( Math.random() * 3 ) | 0 ],
				} );
			}
			layers.push( items );
		}
		return layers;
	}

	function makeBubbles( w, hh, perfLow ) {
		var layers = [];
		for ( var band = 0; band < 3; band++ ) {
			var items = [];
			var count = perfLow ? Math.max( 4, Math.floor( BUBBLE_COUNTS[ band ] * 0.55 ) ) : BUBBLE_COUNTS[ band ];
			for ( var i = 0; i < count; i++ ) {
				var x = h.rand( 0, w );
				var y = h.rand( 0, hh );
				items.push( {
					x: x,
					y: y,
					r: h.rand( 0.8, 2.4 ) + band * 0.9,
					speed: h.rand( 0.25, 0.55 ) + band * 0.3,
					sway: h.rand( 0.3, 0.9 ),
					phase: Math.random() * h.tau,
					alpha: ( x < w * 0.34 && y > hh * 0.52 ) ? 0.08 : 0.16 + band * 0.1,
				} );
			}
			layers.push( items );
		}
		return layers;
	}

	function makeDust( w, hh, perfLow ) {
		var arr = [];
		var count = perfLow ? Math.floor( DUST_COUNT * 0.5 ) : DUST_COUNT;
		for ( var i = 0; i < count; i++ ) {
			var x = h.rand( 0, w );
			var y = h.rand( 0, hh );
			arr.push( {
				x: x,
				y: y,
				r: h.rand( 0.4, 1.4 ),
				phase: Math.random() * h.tau,
				speed: h.rand( 0.003, 0.009 ),
				alpha: ( x < w * 0.34 && y > hh * 0.5 ) ? h.rand( 0.03, 0.08 ) : h.rand( 0.06, 0.2 ),
			} );
		}
		return arr;
	}

	function makeShafts( w ) {
		var arr = [];
		for ( var i = 0; i < SHAFT_COUNT; i++ ) {
			arr.push( {
				x: w * ( 0.28 + i * 0.38 ),
				width: w * ( 0.1 + Math.random() * 0.05 ),
				tilt: h.rand( -0.08, 0.08 ),
				phase: Math.random() * h.tau,
				speed: h.rand( 0.0012, 0.0022 ),
			} );
		}
		return arr;
	}

	function drawJelly( g, x, y, r, alpha, tint ) {
		// Translucent bell: three stacked filled half-ellipses for
		// volume, plus a short tentacle fringe.
		for ( var k = 0; k < 3; k++ ) {
			var kr = r * ( 1 - k * 0.18 );
			g.ellipse( x, y - k * r * 0.08, kr, kr * 0.7 )
				.fill( { color: tint, alpha: alpha * ( 0.35 + k * 0.18 ) } );
		}
		// Tentacles.
		for ( var t = -2; t <= 2; t++ ) {
			var tx = x + t * r * 0.28;
			g.moveTo( tx, y + r * 0.2 )
				.lineTo( tx + t * 2, y + r * 1.1 )
				.stroke( { color: tint, width: 1, alpha: alpha * 0.45, cap: 'round' } );
		}
	}

	window.__odd.scenes[ 'abyssal-aquarium' ] = {
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

			var shafts = new PIXI.Graphics();
			shafts.blendMode = 'add';
			shafts.alpha = 0.32;
			app.stage.addChild( shafts );

			var jelliesBack  = new PIXI.Graphics();
			jelliesBack.blendMode = 'add';
			app.stage.addChild( jelliesBack );

			var bubblesBack  = new PIXI.Graphics();
			bubblesBack.blendMode = 'add';
			app.stage.addChild( bubblesBack );

			var jelliesMid   = new PIXI.Graphics();
			jelliesMid.blendMode = 'add';
			app.stage.addChild( jelliesMid );

			var bubblesMid   = new PIXI.Graphics();
			bubblesMid.blendMode = 'add';
			app.stage.addChild( bubblesMid );

			var jelliesFront = new PIXI.Graphics();
			jelliesFront.blendMode = 'add';
			app.stage.addChild( jelliesFront );

			var bubblesFront = new PIXI.Graphics();
			bubblesFront.blendMode = 'add';
			app.stage.addChild( bubblesFront );

			var dust = new PIXI.Graphics();
			dust.blendMode = 'add';
			app.stage.addChild( dust );

			var vignette = new PIXI.Graphics();
			app.stage.addChild( vignette );

			var w = app.renderer.width, hh = app.renderer.height;
			var perfLow = env.perfTier === 'low';

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				shafts: shafts, dust: dust, vignette: vignette,
				jellyLayers: [ jelliesBack, jelliesMid, jelliesFront ],
				bubbleLayers: [ bubblesBack, bubblesMid, bubblesFront ],
				jellies: makeJellies( w, hh, perfLow ),
				bubbles: makeBubbles( w, hh, perfLow ),
				dustList: makeDust( w, hh, perfLow ),
				shaftList: makeShafts( w ),
				time: 0,
				pulse: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var perfLow = env.perfTier === 'low';
			state.jellies = makeJellies( w, hh, perfLow );
			state.bubbles = makeBubbles( w, hh, perfLow );
			state.dustList = makeDust( w, hh, perfLow );
			state.shaftList = makeShafts( w );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.pulse *= 0.92;

			var perfLow = env.perfTier === 'low';
			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;
			var glow = 1 + bass * 0.6 + state.pulse * 0.8;

			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			for ( var band = 0; band < 3; band++ ) {
				var g = state.jellyLayers[ band ];
				g.clear();
				var parallaxX = px * ( 6 + band * 10 );
				var parallaxY = py * ( 3 + band * 5 );
				var items = state.jellies[ band ];
				for ( var i = 0; i < items.length; i++ ) {
					var j = items[ i ];
					if ( ! env.reducedMotion ) j.phase += j.pulseSpeed * dt * ( 1 + bass * 0.6 );
					var bell = 1 + Math.sin( j.phase ) * 0.18;
					var yDrift = Math.sin( j.phase * 0.5 ) * 6 * ( 1 + band * 0.2 );
					var x = j.x + parallaxX;
					var y = j.y + parallaxY + yDrift;
					var alpha = JELLY_ALPHAS[ band ] * glow;
					drawJelly( g, x, y, j.r * bell, alpha, j.hue );
				}
			}

			for ( var b = 0; b < 3; b++ ) {
				var bg = state.bubbleLayers[ b ];
				bg.clear();
				var bparX = px * ( 4 + b * 8 );
				var bparY = py * ( 2 + b * 4 );
				var bubs = state.bubbles[ b ];
				for ( var k = 0; k < bubs.length; k++ ) {
					var bu = bubs[ k ];
					if ( ! env.reducedMotion ) {
						bu.y -= bu.speed * dt;
						bu.phase += 0.03 * dt;
						if ( bu.y < -10 ) {
							bu.y = hh + 10;
							bu.x = h.rand( 0, w );
						}
					}
					var sway = Math.sin( bu.phase ) * bu.sway * 8;
					bg.circle( bu.x + sway + bparX, bu.y + bparY, bu.r )
						.fill( { color: 0xcdf6ff, alpha: bu.alpha * ( 0.85 + high * 0.3 ) } );
				}
			}

			if ( ! perfLow ) {
				var sg = state.shafts;
				sg.clear();
				for ( var sI = 0; sI < state.shaftList.length; sI++ ) {
					var sh = state.shaftList[ sI ];
					var breath = 0.5 + Math.sin( state.time * sh.speed + sh.phase ) * 0.5;
					var steps = 14;
					for ( var stp = 0; stp < steps; stp++ ) {
						var t = stp / ( steps - 1 );
						var xOff = sh.tilt * hh * t;
						var xc = sh.x + xOff + px * 10;
						var wSeg = sh.width * ( 0.7 + t * 0.6 );
						var a = ( 1 - t ) * 0.08 * ( 0.6 + breath * 0.8 ) * glow;
						sg.rect( xc - wSeg * 0.5, hh * t, wSeg, hh / steps + 1 )
							.fill( { color: 0xbfe8ff, alpha: a } );
					}
				}
			}

			var dg = state.dust;
			dg.clear();
			for ( var d = 0; d < state.dustList.length; d++ ) {
				var p = state.dustList[ d ];
				if ( ! env.reducedMotion ) p.phase += p.speed * dt;
				var dx = Math.sin( p.phase * 0.9 ) * 5 + px * 14;
				var dy = Math.cos( p.phase ) * 4 + py * 8;
				dg.circle( p.x + dx, p.y + dy, p.r )
					.fill( { color: 0xe0f4ff, alpha: p.alpha * ( 0.7 + high * 0.3 ) } );
			}

			var vg = state.vignette;
			vg.clear();
			vg.rect( 0, 0, w, hh ).fill( { color: 0x001218, alpha: 0.04 } );

		},

		onRipple: function ( opts, state ) {
			state.pulse = Math.min( 1, state.pulse + ( ( opts && opts.intensity ) || 0.6 ) );
		},

		onAudio: function ( state, env ) {
			if ( env.audio.bass > 0.6 ) {
				state.pulse = Math.min( 1, state.pulse + 0.15 );
			}
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.jellies = [];
			state.bubbles = [];
			state.dustList = [];
			state.shaftList = [];
		},
	};
} )();
