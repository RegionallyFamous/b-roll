/**
 * ODD scene: Aurora — v0.2.0
 * ---------------------------------------------------------------
 * Painted backdrop (assets/wallpapers/aurora.webp — arctic plateau
 * under a teal/magenta aurora) loaded as a cover-fit Sprite. On top:
 *
 *   1. Twinkling stars — ~220 small additive dots scattered across
 *      the upper two-thirds, each with a slow per-star sin twinkle.
 *
 *   2. Three procedural aurora curtains drawn as soft vertical
 *      gradient ribbons that sway via stacked sin waves. They sit
 *      ABOVE the painted aurora so the scene reads "alive" — the
 *      painted aurora anchors the composition, the procedural one
 *      animates it.
 *
 *   3. Occasional shooting stars: rare ~12–25s cadence diagonal
 *      streaks across the upper sky with a fading wake.
 *
 * Audio reactive: bass intensifies the curtain alpha, mid notes
 * speed up the sway. Highs occasionally trigger a star burst.
 *
 * Reduced motion: stars freeze, curtains hold a single sway phase.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	var STAR_COUNT = 220;
	var CURTAIN_COUNT = 3;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'aurora' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/aurora.webp' + qs;
	}

	function makeStars( count, w, hh ) {
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			arr.push( {
				x: Math.random() * w,
				// Star field hugs the upper 70% so stars don't sit
				// awkwardly on the snow ridge.
				y: Math.random() * hh * 0.7,
				r: 0.5 + Math.random() * 1.6,
				phase: Math.random() * Math.PI * 2,
				speed: 0.012 + Math.random() * 0.02,
				baseAlpha: 0.4 + Math.random() * 0.6,
			} );
		}
		return arr;
	}

	function makeCurtains( count, w ) {
		var arr = [];
		// Tints sampled to harmonize with the painted aurora — teal
		// dominant, magenta accent, pale cyan fill.
		var TINTS = [ 0x66ffd0, 0xff7fd1, 0x9be8ff ];
		for ( var i = 0; i < count; i++ ) {
			arr.push( {
				cx: w * ( 0.18 + i * 0.32 ),       // base X
				width: w * ( 0.28 + Math.random() * 0.08 ),
				heightFrac: 0.42 + Math.random() * 0.14,
				topFrac: 0.05 + Math.random() * 0.05,
				phase: Math.random() * Math.PI * 2,
				freq: 0.0009 + Math.random() * 0.0006,
				tint: TINTS[ i % TINTS.length ],
			} );
		}
		return arr;
	}

	window.__odd.scenes[ 'aurora' ] = {
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

			// Curtains live below the star layer so stars twinkle
			// IN FRONT of the additional aurora — same depth order as
			// the painted scene.
			var curtainsG = new PIXI.Graphics();
			curtainsG.blendMode = 'add';
			curtainsG.alpha = 0.55;
			app.stage.addChild( curtainsG );

			var stars = new PIXI.Graphics();
			stars.blendMode = 'add';
			app.stage.addChild( stars );

			var streaks = new PIXI.Graphics();
			streaks.blendMode = 'add';
			app.stage.addChild( streaks );

			var w = app.renderer.width, hh = app.renderer.height;
			var starList     = makeStars( STAR_COUNT, w, hh );
			var curtainList  = makeCurtains( CURTAIN_COUNT, w );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				curtainsG: curtainsG, stars: stars, streaks: streaks,
				starList: starList, curtainList: curtainList,
				time: 0,
				streakTimer: h.rand( 6, 18 ),
				activeStreaks: [],
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.starList    = makeStars( STAR_COUNT, w, hh );
			state.curtainList = makeCurtains( CURTAIN_COUNT, w );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt;

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var mid  = ( env.audio && env.audio.enabled ) ? env.audio.mid  : 0;
			var swayBoost = 1 + mid * 1.4;
			var glowBoost = 1 + bass * 0.5;

			// Curtains: stack 7 vertical strips per curtain, each
			// offset along a sin wave. Cheap, reads as wispy ribbons.
			var cg = state.curtainsG;
			cg.clear();
			cg.alpha = 0.45 + bass * 0.35;
			for ( var c = 0; c < state.curtainList.length; c++ ) {
				var cu = state.curtainList[ c ];
				var top = hh * cu.topFrac;
				var bot = top + hh * cu.heightFrac;
				var stripW = cu.width / 7;
				for ( var s = 0; s < 7; s++ ) {
					var sx = cu.cx + ( s - 3 ) * stripW * 0.6;
					var sway = Math.sin( state.time * cu.freq * swayBoost + cu.phase + s * 0.6 ) * 26;
					var x = sx + sway;
					// Vertical gradient: bright at top → near-zero at
					// bottom. Painted as 8 rect bands per strip.
					for ( var k = 0; k < 8; k++ ) {
						var t = k / 7;
						var bandY = top + ( bot - top ) * t;
						var bandH = ( bot - top ) / 8 + 1;
						var a = ( 1 - t ) * 0.18 * glowBoost;
						cg.rect( x - stripW * 0.4, bandY, stripW * 0.9, bandH )
							.fill( { color: cu.tint, alpha: a } );
					}
				}
			}

			// Stars: redraw each frame so per-star twinkle is just a
			// sin on the alpha. 220 dots is fine.
			var st = state.stars;
			st.clear();
			for ( var i = 0; i < state.starList.length; i++ ) {
				var p = state.starList[ i ];
				if ( ! env.reducedMotion ) p.phase += p.speed * dt;
				var twinkle = 0.6 + Math.sin( p.phase ) * 0.4;
				st.circle( p.x, p.y, p.r ).fill( { color: 0xffffff, alpha: p.baseAlpha * twinkle } );
			}

			// Shooting stars: spawn rare diagonals.
			if ( ! env.reducedMotion ) {
				state.streakTimer -= dt / 60;
				if ( state.streakTimer <= 0 ) {
					state.activeStreaks.push( {
						x:  h.rand( w * 0.05, w * 0.95 ),
						y:  h.rand( 0, hh * 0.35 ),
						vx: h.rand( -16, -10 ),
						vy: h.rand( 4, 7 ),
						life: 0,
						maxLife: 70,
					} );
					state.streakTimer = h.rand( 12, 28 );
				}
			}

			var sg = state.streaks;
			sg.clear();
			for ( var n = state.activeStreaks.length - 1; n >= 0; n-- ) {
				var ss = state.activeStreaks[ n ];
				ss.life += dt;
				if ( ss.life > ss.maxLife ) { state.activeStreaks.splice( n, 1 ); continue; }
				var fade = 1 - ss.life / ss.maxLife;
				ss.x += ss.vx * dt;
				ss.y += ss.vy * dt;
				// Wake: line back along the velocity vector for ~80px,
				// thin highlight at the head.
				var hx = ss.x, hy = ss.y;
				var tx = hx - ss.vx * 8, ty = hy - ss.vy * 8;
				sg.moveTo( tx, ty ).lineTo( hx, hy )
					.stroke( { color: 0xeaffff, width: 1.2, alpha: 0.55 * fade, cap: 'round' } );
				sg.circle( hx, hy, 2.2 ).fill( { color: 0xffffff, alpha: 0.95 * fade } );
			}

		},

		onAudio: function ( state, env ) {
			if ( env.audio.high > 0.6 ) {
				// High pulse → flash a couple of stars to peak alpha.
				for ( var i = 0; i < 6; i++ ) {
					var s = state.starList[ ( Math.random() * state.starList.length ) | 0 ];
					s.baseAlpha = Math.min( 1, s.baseAlpha + 0.25 );
				}
			}
		},

		onRipple: function ( opts, state, env ) {
			// Force-spawn a shooting star biased toward the ripple x.
			if ( state.activeStreaks.length > 5 ) return;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var sx = w * 0.5;
			if ( opts && typeof opts.x === 'number' ) {
				sx = opts.normalized ? opts.x * w : opts.x;
			}
			state.activeStreaks.push( {
				x: sx + h.rand( -80, 80 ),
				y: h.rand( 0, hh * 0.35 ),
				vx: h.rand( -16, -10 ),
				vy: h.rand( 4, 7 ),
				life: 0,
				maxLife: 70,
			} );
		},

		onGlitch: function ( opts, state ) {
			state.time += 120;
			for ( var i = 0; i < 12; i++ ) {
				var s = state.starList[ ( Math.random() * state.starList.length ) | 0 ];
				s.baseAlpha = Math.min( 1, s.baseAlpha + 0.3 );
			}
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.activeStreaks = [];
		},
	};
} )();
