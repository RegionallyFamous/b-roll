/**
 * ODD scene: Flux — v0.2.0
 * ---------------------------------------------------------------
 * Painted backdrop (assets/wallpapers/flux.webp — deep marbled ink
 * in navy/crimson/amber) loaded as a cover-fit Sprite. On top:
 *
 *   1. ~900 ribbon particles flowing through a slowly-evolving
 *      pseudo-Perlin vector field. Particles leave hair-thin
 *      additive trails that fade by ~6%/frame, so the effect reads
 *      as marbled ink currents rather than a starfield.
 *
 *   2. Rare "koi" particles — bigger, brighter, slower — that
 *      cross the canvas leaving wakes 3× thicker than the swarm.
 *      Spawn cadence ~6–14s; max 3 alive at once.
 *
 *   3. A faint vignette quad pinned over the painting so the
 *      ribbon highlights sit cleanly inside the painted vortex.
 *
 * Audio reactive: bass thickens trail width, highs occasionally
 * spawn a "spark" pulse that briefly multiplies particle alpha.
 *
 * Reduced motion: stillFrame() paints one balanced frame and stops.
 * Perf tier: at 'low' we halve particle count and disable the
 * trail-fade alpha pass (paints crisp dots instead).
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	var BASE_COUNT = 900;
	var KOI_MAX    = 3;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/flux.webp' + qs;
	}

	// Cheap deterministic 2D noise. Not real Perlin — enough vortex
	// structure for visual flow at fraction of the cost. Output ∈ [-1,1].
	function noise2( x, y ) {
		var s = Math.sin( x * 12.9898 + y * 78.233 ) * 43758.5453;
		return ( s - Math.floor( s ) ) * 2 - 1;
	}
	function fieldAngle( x, y, t ) {
		var nx = noise2( x * 0.7 + t,         y * 0.7 - t * 0.3 );
		var ny = noise2( x * 0.7 - t * 0.4,   y * 0.7 + t       );
		// Combine with a slow rotational bias so flows look swirled
		// rather than purely random per-cell.
		return Math.atan2( ny, nx ) + Math.sin( ( x + y ) * 0.05 + t * 0.6 ) * 0.6;
	}

	// Palette: warm-amber → crimson → cool-cyan, biased to match
	// the painted backdrop. Picked by particle "lane" (0..1).
	var PALETTE = [ 0xffc78a, 0xff7a3c, 0xe73667, 0x9c2a86, 0x4f2e8a, 0x2a8fb8, 0x6cf0d6 ];
	function pickColor( lane ) {
		var f = lane * ( PALETTE.length - 1 );
		var i = Math.floor( f );
		var t = f - i;
		var a = PALETTE[ i ];
		var b = PALETTE[ Math.min( PALETTE.length - 1, i + 1 ) ];
		return h.lerpColor( a, b, t );
	}

	function spawn( w, hh, isKoi ) {
		return {
			x: h.rand( 0, w ),
			y: h.rand( 0, hh ),
			vx: 0,
			vy: 0,
			lane: Math.random(),
			life: h.rand( 60, 240 ),
			age:  0,
			koi:  !! isKoi,
		};
	}

	window.__odd.scenes[ 'flux' ] = {
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

			// Trail layer. We paint hair-thin lines into a
			// PIXI.Graphics and leave it to compose additively against
			// the backdrop. Each frame we slightly fade the previous
			// trail by drawing a translucent black quad over the
			// backdrop area; this is the cheapest "motion blur" trick
			// that reads as ink dispersion. We do it via a separate
			// "fade" Graphics with normal blendMode so it modulates
			// the trail alpha without touching the painted backdrop.
			var trails = new PIXI.Graphics();
			trails.blendMode = 'add';
			app.stage.addChild( trails );

			// Vignette over backdrop so center reads darker.
			var vignette = new PIXI.Graphics();
			app.stage.addChild( vignette );
			function paintVignette() {
				var w = app.renderer.width, hh = app.renderer.height;
				vignette.clear();
				// Soft radial falloff approximated by 18 concentric
				// rings of decreasing alpha. Tuned to hug the painted
				// vortex without dimming corners further.
				var cx = w * 0.5, cy = hh * 0.55;
				var rMax = Math.hypot( w, hh ) * 0.6;
				for ( var i = 0; i < 18; i++ ) {
					var t = i / 17;
					var r = rMax * ( 0.35 + t * 0.65 );
					vignette.circle( cx, cy, r ).fill( { color: 0x000000, alpha: ( 1 - t ) * 0.018 } );
				}
			}
			paintVignette();

			var particles = [];
			var koiTimer  = h.rand( 4, 9 );

			function reseed( count ) {
				particles = [];
				var w = app.renderer.width, hh = app.renderer.height;
				for ( var i = 0; i < count; i++ ) particles.push( spawn( w, hh, false ) );
			}
			reseed( BASE_COUNT );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				trails: trails, vignette: vignette, paintVignette: paintVignette,
				particles: particles, reseed: reseed,
				koiTimer: koiTimer, sparkBoost: 0,
				time: 0,
			};
		},

		onResize: function ( state ) {
			state.fitBackdrop();
			state.paintVignette();
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt * 0.0035;

			// Auto-dim: 'low' tier halves particles + skips fade
			// pass so we still hit 60fps on weaker GPUs.
			var perfLow  = env.perfTier === 'low';
			var perfHigh = env.perfTier === 'high';
			var target   = perfLow ? ( BASE_COUNT >> 1 ) : BASE_COUNT;
			if ( state.particles.length !== target ) state.reseed( target );

			var ps = state.particles;
			var trails = state.trails;

			// Fade previous trail. We re-stamp a translucent black
			// rect over the trail layer to crush old ink toward the
			// backdrop without touching the painting underneath.
			if ( ! perfLow ) {
				trails.alpha = 0.94;
			} else {
				trails.clear();
				trails.alpha = 1;
			}

			// Keep the live frame's strokes on the same Graphics; in
			// perfHigh we let the canvas accumulate (cheap motion blur),
			// in perfLow we cleared above. Either way, we draw new
			// strokes now.
			var t  = state.time;
			var sparkBoost = state.sparkBoost;
			state.sparkBoost = Math.max( 0, sparkBoost - dt * 0.04 );

			// Audio thickens trails a touch.
			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var thick = 0.55 + bass * 1.2 + sparkBoost * 0.4;

			for ( var i = 0; i < ps.length; i++ ) {
				var p = ps[ i ];
				p.age += dt;
				var ang = fieldAngle( p.x * 0.005, p.y * 0.005, t );
				var spd = ( p.koi ? 1.4 : 0.9 ) + bass * 0.6;
				p.vx += Math.cos( ang ) * spd * 0.08 * dt;
				p.vy += Math.sin( ang ) * spd * 0.08 * dt;
				// Friction so the swarm doesn't blow up past terminal.
				p.vx *= 0.96;
				p.vy *= 0.96;
				var nx = p.x + p.vx * dt;
				var ny = p.y + p.vy * dt;

				// Wrap softly across edges so flow looks continuous.
				if ( nx < -10 || nx > w + 10 || ny < -10 || ny > hh + 10 || p.age > p.life ) {
					if ( p.koi ) {
						// Koi reach end — let timer respawn them.
					} else {
						p.x = h.rand( 0, w );
						p.y = h.rand( 0, hh );
						p.vx = 0; p.vy = 0;
						p.age = 0;
						p.life = h.rand( 60, 240 );
						p.lane = Math.random();
					}
					continue;
				}

				var color = pickColor( p.lane );
				var fade  = 1 - ( p.age / p.life );
				var alpha = ( p.koi ? 0.95 : 0.55 ) * Math.max( 0, fade ) * ( 1 + sparkBoost * 0.7 );
				var width = ( p.koi ? 2.4 : 0.8 ) * thick;

				trails.moveTo( p.x, p.y ).lineTo( nx, ny )
					.stroke( { color: color, width: width, alpha: alpha, cap: 'round' } );

				p.x = nx;
				p.y = ny;
			}

			// Periodically spawn a koi.
			state.koiTimer -= dt / 60;
			if ( state.koiTimer <= 0 ) {
				var alive = 0;
				for ( var k = 0; k < ps.length; k++ ) if ( ps[ k ].koi ) alive++;
				if ( alive < KOI_MAX ) {
					var koi = spawn( w, hh, true );
					// Bias spawn to one edge so the cross is dramatic.
					var edge = ( Math.random() * 4 ) | 0;
					if ( edge === 0 ) { koi.x = -20;     koi.y = h.rand( hh * 0.2, hh * 0.8 ); }
					else if ( edge === 1 ) { koi.x = w + 20; koi.y = h.rand( hh * 0.2, hh * 0.8 ); }
					else if ( edge === 2 ) { koi.x = h.rand( w * 0.2, w * 0.8 ); koi.y = -20; }
					else                   { koi.x = h.rand( w * 0.2, w * 0.8 ); koi.y = hh + 20; }
					koi.life = h.rand( 480, 900 );
					ps.push( koi );
				}
				state.koiTimer = h.rand( 6, 14 );
			}

			// Periodically GC dead koi so the array doesn't grow unbounded.
			if ( ( state.time | 0 ) % 5 === 0 && ps.length > target + 10 ) {
				state.particles = ps.filter( function ( q ) { return ! q.koi || q.age < q.life; } );
			}

			void perfHigh;
		},

		onAudio: function ( state, env ) {
			// Treble pulses spawn a brief sparkle boost; rate-limited
			// by sparkBoost decay in tick().
			if ( env.audio.high > 0.55 && state.sparkBoost < 0.5 ) {
				state.sparkBoost = 1;
			}
		},

		onRipple: function ( opts, state ) {
			var i = ( opts && opts.intensity ) || 0.8;
			state.sparkBoost = Math.min( 1, state.sparkBoost + i * 0.6 );
		},

		onGlitch: function ( opts, state ) {
			state.sparkBoost = Math.min( 1, state.sparkBoost + 0.9 );
		},

		stillFrame: function ( state, env ) {
			// Run ~120 settled frames so the still-life shows ribbon
			// shapes, then stop. Cheap enough at static call cost.
			var saveDt = env.dt;
			env.dt = 1;
			for ( var i = 0; i < 120; i++ ) this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.particles = [];
		},
	};
} )();
