/**
 * ODD scene: Abyssal Aquarium.
 *
 * GPT Image 2 backdrop with subtle deep-sea motion: drifting bubbles,
 * bioluminescent specks, and slow glass caustics.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;
	var scriptUrl = document.currentScript && document.currentScript.src;

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'abyssal-aquarium' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function makeBubbles( w, hh ) {
		var out = [];
		for ( var i = 0; i < 90; i++ ) {
			out.push( {
				x: h.rand( w * 0.08, w * 0.88 ),
				y: h.rand( hh * 0.12, hh * 0.95 ),
				r: h.rand( 0.7, 3.4 ),
				speed: h.rand( 0.08, 0.32 ),
				phase: Math.random() * Math.PI * 2,
				alpha: h.rand( 0.08, 0.28 ),
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'abyssal-aquarium' ] = {
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
			app.stage.addChild( caustics );
			var bubbles = new PIXI.Graphics();
			bubbles.blendMode = 'add';
			app.stage.addChild( bubbles );
			return {
				backdrop: backdrop,
				fitBackdrop: fitBackdrop,
				caustics: caustics,
				bubbles: bubbles,
				bubbleList: makeBubbles( app.renderer.width, app.renderer.height ),
				time: 0,
				ripple: 0,
				glitch: 0,
			};
		},
		onResize: function ( state, env ) {
			state.fitBackdrop();
			state.bubbleList = makeBubbles( env.app.renderer.width, env.app.renderer.height );
		},
		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt;
			state.ripple *= 0.94;
			state.glitch *= 0.88;
			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;

			var cg = state.caustics;
			cg.clear();
			for ( var i = 0; i < 7; i++ ) {
				var y = hh * ( 0.18 + i * 0.085 ) + Math.sin( state.time * 0.01 + i ) * 8;
				var a = 0.025 + bass * 0.03 + state.ripple * 0.04;
				cg.moveTo( w * 0.02, y )
					.bezierCurveTo( w * 0.25, y - 28, w * 0.58, y + 28, w * 0.98, y - 8 )
					.stroke( { color: 0x76f7ff, width: 1.1 + state.ripple, alpha: a, cap: 'round' } );
			}

			var bg = state.bubbles;
			bg.clear();
			for ( var b = 0; b < state.bubbleList.length; b++ ) {
				var p = state.bubbleList[ b ];
				if ( ! env.reducedMotion ) {
					p.y -= p.speed * dt;
					p.phase += 0.012 * dt;
				}
				if ( p.y < -10 ) p.y = hh + h.rand( 4, 40 );
				var x = p.x + Math.sin( p.phase ) * 9;
				bg.circle( x, p.y, p.r ).stroke( { color: 0xb8fff8, width: 0.8, alpha: p.alpha + state.ripple * 0.12 } );
			}

		},
		onRipple: function ( opts, state ) {
			state.ripple = Math.min( 1, state.ripple + ( ( opts && opts.intensity ) || 0.5 ) );
		},
		onGlitch: function ( opts, state ) {
			state.glitch = 1;
			state.ripple = Math.min( 1, state.ripple + 0.45 );
		},
		onAudio: function ( state, env ) {
			if ( env.audio.high > 0.6 ) state.ripple = Math.min( 1, state.ripple + 0.08 );
		},
		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},
		cleanup: function ( state ) {
			state.bubbleList = [];
		},
	};
} )();
/**
 * ODD scene: Abyssal Aquarium � v1.1.0
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

	var JELLY_COUNTS = [ 6, 5, 4 ];       // back, mid, front
	var JELLY_SCALES = [ 0.55, 0.9, 1.35 ];
	var JELLY_ALPHAS = [ 0.18, 0.36, 0.58 ];
	var BUBBLE_COUNTS = [ 40, 30, 18 ];
	var DUST_COUNT = 90;
	var SHAFT_COUNT = 2;

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'abyssal-aquarium' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function makeJellies( w, hh ) {
		var layers = [];
		for ( var band = 0; band < 3; band++ ) {
			var items = [];
			for ( var i = 0; i < JELLY_COUNTS[ band ]; i++ ) {
				items.push( {
					x: h.rand( w * 0.08, w * 0.92 ),
					y: h.rand( hh * 0.18, hh * 0.78 ),
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

	function makeBubbles( w, hh ) {
		var layers = [];
		for ( var band = 0; band < 3; band++ ) {
			var items = [];
			for ( var i = 0; i < BUBBLE_COUNTS[ band ]; i++ ) {
				items.push( {
					x: h.rand( 0, w ),
					y: h.rand( 0, hh ),
					r: h.rand( 0.8, 2.4 ) + band * 0.9,
					speed: h.rand( 0.25, 0.55 ) + band * 0.3,
					sway: h.rand( 0.3, 0.9 ),
					phase: Math.random() * h.tau,
					alpha: 0.22 + band * 0.14,
				} );
			}
			layers.push( items );
		}
		return layers;
	}

	function makeDust( w, hh ) {
		var arr = [];
		for ( var i = 0; i < DUST_COUNT; i++ ) {
			arr.push( {
				x: h.rand( 0, w ),
				y: h.rand( 0, hh ),
				r: h.rand( 0.4, 1.4 ),
				phase: Math.random() * h.tau,
				speed: h.rand( 0.003, 0.009 ),
				alpha: h.rand( 0.08, 0.28 ),
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
		// Translucent bell � three stacked filled half-ellipses for
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

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				shafts: shafts, dust: dust, vignette: vignette,
				jellyLayers: [ jelliesBack, jelliesMid, jelliesFront ],
				bubbleLayers: [ bubblesBack, bubblesMid, bubblesFront ],
				jellies: makeJellies( w, hh ),
				bubbles: makeBubbles( w, hh ),
				dustList: makeDust( w, hh ),
				shaftList: makeShafts( w ),
				time: 0,
				pulse: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.jellies = makeJellies( w, hh );
			state.bubbles = makeBubbles( w, hh );
			state.dustList = makeDust( w, hh );
			state.shaftList = makeShafts( w );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt;
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
