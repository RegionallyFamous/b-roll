/**
 * ODD scene: Origami — v0.2.0
 * ---------------------------------------------------------------
 * Painted backdrop (wallpaper.webp — soft cream
 * washi paper with faint origami crease shadows in the corners).
 * On top:
 *
 *   1. A flock of ~7 procedurally-drawn paper cranes that drift
 *      across the canvas in slow sinusoidal arcs. Each crane is a
 *      cluster of 4 polygon "facets" (body + two wings + tail)
 *      drawn in pale paper tones with a soft drop-shadow polygon
 *      offset below. Wings flap via a slow per-crane sin so the
 *      flock breathes.
 *
 *   2. A handful of "drifting fold" motes — tiny rotating
 *      diamond/triangle paper fragments that float on imagined air
 *      currents. Adds depth without competing with the cranes.
 *
 *   3. A barely-there pollen layer (additive cream dots) that
 *      catches the diagonal light from the painted backdrop.
 *
 * Audio reactive: bass slows wing flap (counterintuitive, but
 * makes a heavy bass feel calming); highs add a brief pollen burst.
 *
 * Reduced motion: cranes hold mid-flight pose; pollen frozen.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;
	var scriptUrl = document.currentScript && document.currentScript.src;

	var CRANE_COUNT  = 7;
	var FOLD_COUNT   = 9;
	var POLLEN_COUNT = 80;

	// Paper palette: lighter "face" + darker "shadow" pairs so each
	// facet has a folded-paper feel without an explicit gradient.
	var CRANE_PAIRS = [
		{ face: 0xffffff, shadow: 0xe8d6b8 },
		{ face: 0xfff1d6, shadow: 0xd9b888 },
		{ face: 0xfde0c4, shadow: 0xc99a6c },
		{ face: 0xf6efe2, shadow: 0xc9b694 },
		{ face: 0xfbe3da, shadow: 0xd6a890 },
	];

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'origami' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function makeCrane( w, hh ) {
		var pair = CRANE_PAIRS[ ( Math.random() * CRANE_PAIRS.length ) | 0 ];
		return {
			x:  h.rand( -0.2, 1.2 ) * w,
			y:  h.rand( 0.15, 0.85 ) * hh,
			vx: h.rand( 0.45, 0.95 ) * ( Math.random() < 0.5 ? -1 : 1 ),
			vy: 0,
			amp: h.rand( 14, 28 ),
			freq: h.rand( 0.0009, 0.0018 ),
			phase: Math.random() * Math.PI * 2,
			scale: h.rand( 0.55, 1.05 ),
			flap: Math.random() * Math.PI * 2,
			flapSpeed: h.rand( 0.045, 0.085 ),
			face: pair.face,
			shadow: pair.shadow,
		};
	}

	function makeFold( w, hh ) {
		return {
			x:  Math.random() * w,
			y:  Math.random() * hh,
			vx: h.rand( -0.4, 0.4 ),
			vy: h.rand( -0.18, 0.18 ),
			rot:  Math.random() * Math.PI * 2,
			rotV: h.rand( -0.012, 0.012 ),
			size: h.rand( 6, 16 ),
			tone: 0xe6cfa6,
			alpha: h.rand( 0.18, 0.42 ),
			shape: Math.random() < 0.5 ? 'tri' : 'dia',
		};
	}

	function makePollen( w, hh ) {
		var arr = [];
		for ( var i = 0; i < POLLEN_COUNT; i++ ) {
			arr.push( {
				x: Math.random() * w,
				y: Math.random() * hh,
				r: 0.6 + Math.random() * 1.4,
				phase: Math.random() * Math.PI * 2,
				speed: h.rand( 0.008, 0.022 ),
				baseAlpha: h.rand( 0.10, 0.35 ),
			} );
		}
		return arr;
	}

	// Draw a single crane at (cx, cy) with rotation (rad), scale s.
	// The "facets" are the body, wings (animated by flap), and tail.
	function drawCrane( g, c, cx, cy, s, flapY ) {
		// Drop shadow: same silhouette, offset down-right, semi-translucent.
		var sx = cx + 4 * s, sy = cy + 6 * s;
		var shadow = c.shadow;

		// Body (left-pointing diamond).
		var bx = [ -22 * s, 6 * s,  16 * s, 6 * s ];
		var by = [   0    , -6 * s, 0    ,  6 * s ];

		// Wing — upper triangle, hinged at body top. Flap by rotating
		// the wing tip's Y coord.
		var wTipY  = -22 * s + flapY;
		var wing = [
			-6 * s, -4 * s,
			 8 * s, -4 * s,
			-2 * s,  wTipY,
		];

		// Tail / head: small upturned triangle on the right.
		var head = [
			16 * s, 0,
			28 * s, -2 * s,
			16 * s, -8 * s,
		];

		function poly( gg, pts, color, alpha, ox, oy ) {
			gg.poly( pts.map( function ( v, i ) { return ( i % 2 === 0 ) ? v + ox : v + oy; } ) )
				.fill( { color: color, alpha: alpha } );
		}

		// Shadow first.
		poly( g, [
			bx[ 0 ], by[ 0 ], bx[ 1 ], by[ 1 ], bx[ 2 ], by[ 2 ], bx[ 3 ], by[ 3 ],
		], shadow, 0.18, sx, sy );

		// Wing under-shadow.
		poly( g, wing, shadow, 0.32, cx, cy );
		// Body face.
		poly( g, [
			bx[ 0 ], by[ 0 ], bx[ 1 ], by[ 1 ], bx[ 2 ], by[ 2 ], bx[ 3 ], by[ 3 ],
		], c.face, 0.95, cx, cy );
		// Wing top facet (lighter).
		poly( g, wing, c.face, 0.92, cx, cy );
		// Tail / head.
		poly( g, head, c.face, 0.92, cx, cy );
		// Crease line down the body for paper feel.
		g.moveTo( cx - 22 * s, cy ).lineTo( cx + 16 * s, cy )
			.stroke( { color: c.shadow, width: 0.8 * s, alpha: 0.5 } );
	}

	window.__odd.scenes[ 'origami' ] = {
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

			var pollenG  = new PIXI.Graphics(); pollenG.blendMode = 'add'; app.stage.addChild( pollenG );
			var foldG    = new PIXI.Graphics(); app.stage.addChild( foldG );
			var craneG   = new PIXI.Graphics(); app.stage.addChild( craneG );

			var w = app.renderer.width, hh = app.renderer.height;
			var cranes = []; for ( var i = 0; i < CRANE_COUNT; i++ ) cranes.push( makeCrane( w, hh ) );
			var folds  = []; for ( var j = 0; j < FOLD_COUNT;  j++ ) folds.push( makeFold( w, hh ) );
			var pollen = makePollen( w, hh );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				pollenG: pollenG, foldG: foldG, craneG: craneG,
				cranes: cranes, folds: folds, pollen: pollen,
				time: 0, burst: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.cranes = []; for ( var i = 0; i < CRANE_COUNT; i++ ) state.cranes.push( makeCrane( w, hh ) );
			state.folds  = []; for ( var j = 0; j < FOLD_COUNT;  j++ ) state.folds.push( makeFold( w, hh ) );
			state.pollen = makePollen( w, hh );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt;

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			// Bass DECREASES flap rate — counterintuitive but reads as
			// the scene "settling" under heavy notes.
			var flapMul = Math.max( 0.4, 1 - bass * 0.6 );

			// Pollen.
			var pg = state.pollenG;
			pg.clear();
			pg.alpha = 0.6 + state.burst * 0.7;
			for ( var i = 0; i < state.pollen.length; i++ ) {
				var p = state.pollen[ i ];
				if ( ! env.reducedMotion ) {
					p.phase += p.speed * dt;
					p.x += Math.cos( p.phase ) * 0.18 * dt;
					p.y += ( Math.sin( p.phase * 0.7 ) * 0.08 - 0.06 ) * dt;
					if ( p.y < -4 ) { p.y = hh + 4; p.x = Math.random() * w; }
					if ( p.x < -4 ) p.x = w + 4;
					else if ( p.x > w + 4 ) p.x = -4;
				}
				var twinkle = 0.7 + Math.sin( p.phase ) * 0.3;
				pg.circle( p.x, p.y, p.r ).fill( { color: 0xfff1cf, alpha: p.baseAlpha * twinkle } );
			}
			state.burst = Math.max( 0, state.burst - dt * 0.03 );

			// Folds.
			var fg = state.foldG;
			fg.clear();
			for ( var j = 0; j < state.folds.length; j++ ) {
				var f = state.folds[ j ];
				if ( ! env.reducedMotion ) {
					f.x += f.vx * dt;
					f.y += f.vy * dt;
					f.rot += f.rotV * dt;
					if ( f.x < -30 ) f.x = w + 30;
					else if ( f.x > w + 30 ) f.x = -30;
					if ( f.y < -30 ) f.y = hh + 30;
					else if ( f.y > hh + 30 ) f.y = -30;
				}
				// Two-tone diamond/triangle painted via two facets so
				// each fold looks creased.
				var s = f.size;
				var cx = f.x, cy = f.y, r = f.rot;
				var cos = Math.cos( r ), sin = Math.sin( r );
				function rot( x, y ) { return [ cx + x * cos - y * sin, cy + x * sin + y * cos ]; }
				var pts;
				if ( f.shape === 'tri' ) {
					var a = rot( 0, -s ), b = rot( s, s ), c = rot( -s, s );
					pts = [ a[ 0 ], a[ 1 ], b[ 0 ], b[ 1 ], c[ 0 ], c[ 1 ] ];
					fg.poly( pts ).fill( { color: 0xfff1d6, alpha: f.alpha } );
					// Crease — half-tone overlay.
					fg.poly( [ a[ 0 ], a[ 1 ], c[ 0 ], c[ 1 ], cx, cy ] )
						.fill( { color: f.tone, alpha: f.alpha * 0.6 } );
				} else {
					var t1 = rot( 0, -s ), t2 = rot( s, 0 ), t3 = rot( 0, s ), t4 = rot( -s, 0 );
					pts = [ t1[ 0 ], t1[ 1 ], t2[ 0 ], t2[ 1 ], t3[ 0 ], t3[ 1 ], t4[ 0 ], t4[ 1 ] ];
					fg.poly( pts ).fill( { color: 0xfff1d6, alpha: f.alpha } );
					fg.poly( [ t1[ 0 ], t1[ 1 ], t2[ 0 ], t2[ 1 ], t3[ 0 ], t3[ 1 ] ] )
						.fill( { color: f.tone, alpha: f.alpha * 0.6 } );
				}
			}

			// Cranes.
			var cg = state.craneG;
			cg.clear();
			for ( var k = 0; k < state.cranes.length; k++ ) {
				var cr = state.cranes[ k ];
				if ( ! env.reducedMotion ) {
					cr.x += cr.vx * dt;
					cr.flap += cr.flapSpeed * dt * flapMul;
					if ( cr.x < -120 ) { cr.x = w + 120; cr.vx = -Math.abs( cr.vx ); }
					else if ( cr.x > w + 120 ) { cr.x = -120; cr.vx = Math.abs( cr.vx ); }
				}
				var by = Math.sin( cr.phase + state.time * cr.freq ) * cr.amp;
				var flapY = ( -10 + Math.sin( cr.flap ) * 14 ) * cr.scale;
				drawCrane( cg, { face: cr.face, shadow: cr.shadow }, cr.x, cr.y + by, cr.scale, flapY );
			}

		},

		onAudio: function ( state, env ) {
			if ( env.audio.high > 0.55 && state.burst < 0.5 ) {
				state.burst = 1;
			}
		},

		onRipple: function ( opts, state ) {
			state.burst = Math.min( 1, state.burst + ( ( opts && opts.intensity ) || 0.6 ) );
		},

		onGlitch: function ( opts, state ) {
			state.burst = 1;
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function () { /* nothing to free outside the stage */ },
	};
} )();
