/**
 * B-Roll scene: Hyperspace (Star Wars) — v0.5
 * ---------------------------------------------------------------
 * Painted backdrop (assets/wallpapers/hyperspace.jpg — deep
 * starfield with tinted nebula) loaded as a Sprite. On top: an
 * additional twinkling point-star layer for live motion, a mid
 * band of thin radial streaks, and a near band of bright streaks
 * with bright lead dots. Streak speed accelerates cubically as
 * stars approach the screen edge so the motion reads as
 * "accelerating into warp," not a constant pan.
 *
 * A central iris holds a pulsing blue core plus eight lens-flare
 * spokes (H/V + diagonals) that breathe with the core. A warp-
 * flash event every ~18–35 seconds blasts the screen white and
 * is followed by cyan + magenta chromatic ghosts that decay at
 * different rates so the flash reads as anamorphic, not flat.
 * A subtle radial vignette finishes the frame.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	var STREAK_NUM = 360;
	var TWINKLE_NUM = 160;

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/hyperspace.jpg' + qs;
	}

	window.__bRoll.scenes[ 'hyperspace' ] = {
		setup: async function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			// Painted starfield + nebula backdrop (replaces v0.4 bg + glow).
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

			var twinkle  = new PIXI.Graphics(); app.stage.addChild( twinkle );
			var linesFar = new PIXI.Graphics(); app.stage.addChild( linesFar );
			var linesNear= new PIXI.Graphics(); app.stage.addChild( linesNear );

			var bloom = h.makeBloomLayer( PIXI, 10 );
			app.stage.addChild( bloom );
			var bloomGlow = new PIXI.Graphics(); bloom.addChild( bloomGlow );
			var flare     = new PIXI.Graphics(); bloom.addChild( flare );

			// Foreground cut-out layer (v0.7) — ships drift in front of streaks.
			var fg = new PIXI.Container();
			app.stage.addChild( fg );

			// Chromatic ghosts sit below the main flash so the R/G/B split shows
			// as colored halos around the white blast as it decays.
			var flashCyan    = new PIXI.Graphics(); flashCyan.alpha = 0;    app.stage.addChild( flashCyan );
			var flashMagenta = new PIXI.Graphics(); flashMagenta.alpha = 0; app.stage.addChild( flashMagenta );
			var flash        = new PIXI.Graphics(); flash.alpha = 0;        app.stage.addChild( flash );

			var vignette = new PIXI.Graphics(); app.stage.addChild( vignette );

			function drawVignette() {
				var w = app.renderer.width, hh = app.renderer.height;
				vignette.clear();
				var cx = w / 2, cy = hh / 2;
				var maxR = Math.sqrt( cx * cx + cy * cy );
				var rings = 18;
				for ( var i = 0; i < rings; i++ ) {
					var t = i / ( rings - 1 );
					var r = maxR * ( 0.55 + t * 0.50 );
					var a = Math.pow( t, 2.6 ) * 0.9;
					vignette.circle( cx, cy, r ).stroke( {
						width: maxR * 0.08 / rings,
						color: 0x000000,
						alpha: a,
					} );
				}
			}

			function spawnStreak( s, seeded ) {
				s.angle = Math.random() * h.tau;
				s.depth = h.rand( 0.3, 1 );
				s.speed = h.rand( 0.4, 2.0 ) * s.depth;
				s.tint  = h.lerpColor( 0x88ccff, 0xffffff, Math.random() );
				s.r = seeded
					? h.rand( 10, Math.min( app.renderer.width, app.renderer.height ) * 0.6 )
					: h.rand( 4, 14 );
			}

			function spawnTwinkle( t ) {
				t.x = Math.random();  // normalized 0..1, multiplied at draw time
				t.y = Math.random();
				t.base = h.rand( 0.25, 0.9 );
				t.freq = h.rand( 0.008, 0.04 );
				t.phase = h.rand( 0, h.tau );
				t.size = Math.random() < 0.15 ? 1.4 : 0.7;
				t.tint = Math.random() < 0.2 ? 0xffe8c0 : 0xffffff;
			}

			var streaks = [];
			for ( var i = 0; i < STREAK_NUM; i++ ) {
				var s = {}; spawnStreak( s, true ); streaks.push( s );
			}
			var twinkles = [];
			for ( var j = 0; j < TWINKLE_NUM; j++ ) {
				var t = {}; spawnTwinkle( t ); twinkles.push( t );
			}

			drawVignette();

			var drifters = await h.mountCutouts( app, PIXI, 'hyperspace', fg );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				drawVignette: drawVignette,
				twinkle: twinkle, linesFar: linesFar, linesNear: linesNear,
				bloomGlow: bloomGlow, flare: flare,
				flash: flash, flashCyan: flashCyan, flashMagenta: flashMagenta,
				vignette: vignette,
				streaks: streaks, twinkles: twinkles,
				spawnStreak: spawnStreak,
				tFlash: 60 * h.rand( 8, 18 ),
				time: 0,
				fg: fg, drifters: drifters,
				eggDestroyerHide: 0,
			};
		},

		onResize: function ( state ) {
			state.fitBackdrop();
			state.drawVignette();
		},

		onEgg: function ( name, state, env ) {
			if ( name === 'festival' ) {
				h.showEggDrifter( state.drifters, 'stardestroyer.png', { resetT: true } );
				state.eggDestroyerHide = setTimeout( function () {
					h.hideEggDrifter( state.drifters, 'stardestroyer.png' );
				}, 12000 );
			} else if ( name === 'reveal' ) {
				// Force a warp flash + jolt all streaks.
				state.tFlash = 0;
				for ( var i = 0; i < state.streaks.length; i++ ) {
					state.streaks[ i ].r += h.rand( 100, 300 );
				}
			} else if ( name === 'peek' ) {
				// Quick big star destroyer flyby.
				h.showEggDrifter( state.drifters, 'stardestroyer.png', { scaleMul: 1.4, resetT: true } );
				setTimeout( function () { h.hideEggDrifter( state.drifters, 'stardestroyer.png' ); }, 6000 );
			}
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var cx = w / 2, cy = hh / 2;
			var maxR = Math.sqrt( cx * cx + cy * cy );
			state.time += dt;
			h.tickDrifters( state.drifters, env );

			// --- Twinkle (deep background) --------------------------- //
			state.twinkle.clear();
			for ( var ti = 0; ti < state.twinkles.length; ti++ ) {
				var tw = state.twinkles[ ti ];
				var a = tw.base + 0.35 * Math.sin( state.time * tw.freq + tw.phase );
				if ( a < 0.05 ) continue;
				state.twinkle.circle( tw.x * w, tw.y * hh, tw.size ).fill( { color: tw.tint, alpha: a } );
			}

			// --- Core iris + lens-flare spokes ----------------------- //
			state.bloomGlow.clear();
			state.flare.clear();
			var pulse = 0.55 + 0.3 * Math.sin( state.time * 0.09 );
			state.bloomGlow.circle( cx, cy, maxR * 0.12 ).fill( { color: 0x4a82ff, alpha: pulse } );
			state.bloomGlow.circle( cx, cy, maxR * 0.20 ).fill( { color: 0x183c7a, alpha: pulse * 0.55 } );
			state.bloomGlow.circle( cx, cy, maxR * 0.05 ).fill( { color: 0xe8f2ff, alpha: Math.min( 1, pulse + 0.3 ) } );
			// Eight spokes: horizontal, vertical, and four diagonals. Length
			// breathes with the core pulse.
			var spokeLen = maxR * ( 0.42 + pulse * 0.18 );
			var spokeA = 0.55 * pulse;
			for ( var sp = 0; sp < 8; sp++ ) {
				var ang = ( sp / 8 ) * h.tau;
				var ex = cx + Math.cos( ang ) * spokeLen, ey = cy + Math.sin( ang ) * spokeLen;
				var w0 = sp % 2 === 0 ? 4 : 2.2;
				state.flare.moveTo( cx, cy ).lineTo( ex, ey ).stroke( {
					color: 0xb4d0ff, alpha: spokeA, width: w0,
				} );
			}

			// --- Streaks --------------------------------------------- //
			state.linesFar.clear();
			state.linesNear.clear();
			for ( var i = 0; i < state.streaks.length; i++ ) {
				var s = state.streaks[ i ];
				var prevR = s.r;
				// Cubic acceleration: speed grows with normalized distance.
				var prog = s.r / maxR;
				var accel = 0.3 + s.speed * 3.2 + prog * prog * 9.0;
				s.r += accel * dt;
				if ( s.r > maxR + 20 ) { state.spawnStreak( s, false ); continue; }
				var cos = Math.cos( s.angle ), sin = Math.sin( s.angle );
				var x0 = cx + cos * prevR, y0 = cy + sin * prevR;
				var x1 = cx + cos * s.r, y1 = cy + sin * s.r;
				var alpha = h.clamp( ( prog - 0.04 ) * 1.5, 0, 1 );
				// Width eases cubically so streaks really pop near the edge.
				var widthMul = 0.35 + prog * prog * 1.85;
				var width = ( 0.45 + s.depth * 1.8 ) * widthMul;
				var layer = s.depth > 0.65 ? state.linesNear : state.linesFar;
				layer.moveTo( x0, y0 ).lineTo( x1, y1 ).stroke( {
					color: s.tint, alpha: alpha, width: width,
				} );
				if ( s.depth > 0.65 && prog > 0.28 ) {
					state.linesNear.circle( x1, y1, width * 0.95 ).fill( {
						color: 0xffffff, alpha: alpha,
					} );
				}
			}

			// --- Warp flash + chromatic ghosts ----------------------- //
			state.tFlash -= dt;
			if ( state.tFlash <= 0 && state.flash.alpha < 0.03 ) {
				state.tFlash = 60 * h.rand( 18, 35 );
				// Main white blast.
				state.flash.clear().rect( 0, 0, w, hh ).fill( 0xdbe8ff );
				state.flash.alpha = 1;
				// Chromatic ghosts offset left/right to simulate an anamorphic
				// RGB split. They decay slower than the main flash.
				state.flashCyan.clear().rect( -4, 0, w + 4, hh ).fill( { color: 0x4affee, alpha: 0.85 } );
				state.flashCyan.alpha = 0.85;
				state.flashMagenta.clear().rect( 4, 0, w + 4, hh ).fill( { color: 0xff4ac8, alpha: 0.85 } );
				state.flashMagenta.alpha = 0.85;
				// Jolt all streaks forward so the flash reads as an acceleration
				// pulse, not a passive bloom.
				for ( var kk = 0; kk < state.streaks.length; kk++ ) {
					state.streaks[ kk ].r += h.rand( 60, 220 );
				}
			}
			if ( state.flash.alpha > 0 ) {
				state.flash.alpha = Math.max( 0, state.flash.alpha - 0.055 * dt );
			}
			if ( state.flashCyan.alpha > 0 ) {
				state.flashCyan.alpha = Math.max( 0, state.flashCyan.alpha - 0.035 * dt );
			}
			if ( state.flashMagenta.alpha > 0 ) {
				state.flashMagenta.alpha = Math.max( 0, state.flashMagenta.alpha - 0.03 * dt );
			}
		},
	};
} )();
