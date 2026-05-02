/**
 * ODD scene: Mercado — v1.2.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (wallpaper.webp), a
 * bright market aisle with papel-picado bunting. Motion:
 *
 *   1. Two rows of colored bunting flags ripple on shared wind curves.
 *   2. Marigold petals drift down along the aisle.
 *   3. Diagonal sunbeam bands ease in / out.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;
	var scriptUrl = document.currentScript && document.currentScript.src;

	var PETAL_COUNT = 110;
	var FLAG_ROW_A = 16;
	var FLAG_ROW_B = 14;
	var SUNBEAMS = 4;
	var BUNTING_COLORS = [ 0xff4fa8, 0x2fd1d8, 0xffb800, 0xff6a5c, 0x6fd26c, 0x2a4fc2, 0xff6bcf ];

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'mercado' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function makePetals( w, hh ) {
		var out = [];
		for ( var i = 0; i < PETAL_COUNT; i++ ) {
			out.push( {
				x: h.rand( 0, w ),
				y: h.rand( -hh * 0.2, hh ),
				size: h.rand( 2.4, 4.6 ),
				vx: h.rand( 0.05, 0.2 ),
				vy: h.rand( 0.2, 0.5 ),
				phase: Math.random() * h.tau,
				color: h.choose( [ 0xff8a2a, 0xffb400, 0xff6b1a, 0xffd257 ] ),
				alpha: h.rand( 0.55, 0.9 ),
			} );
		}
		return out;
	}

	function buildBuntingRow( count ) {
		var out = [];
		for ( var i = 0; i < count; i++ ) {
			out.push( {
				color: BUNTING_COLORS[ i % BUNTING_COLORS.length ],
				phase: Math.random() * h.tau,
			} );
		}
		return out;
	}

	function makeSunbeams( w, hh ) {
		var out = [];
		for ( var i = 0; i < SUNBEAMS; i++ ) {
			out.push( {
				x: w * ( 0.1 + i * ( 0.85 / ( SUNBEAMS - 1 ) ) ),
				width: w * 0.09,
				phase: Math.random() * h.tau,
				speed: h.rand( 0.001, 0.002 ),
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'mercado' ] = {
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

			var beams = new PIXI.Graphics();
			beams.blendMode = 'add';
			beams.alpha = 0.4;
			app.stage.addChild( beams );

			var bunting = new PIXI.Graphics();
			app.stage.addChild( bunting );

			var petals = new PIXI.Graphics();
			app.stage.addChild( petals );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				beamG: beams, buntingG: bunting, petalG: petals,
				flagsA: buildBuntingRow( FLAG_ROW_A ),
				flagsB: buildBuntingRow( FLAG_ROW_B ),
				petals: makePetals( w, hh ),
				sunbeams: makeSunbeams( w, hh ),
				time: 0, pulse: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.petals = makePetals( w, hh );
			state.sunbeams = makeSunbeams( w, hh );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.pulse *= 0.92;

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			var bg = state.beamG;
			bg.clear();
			for ( var sI = 0; sI < state.sunbeams.length; sI++ ) {
				var sb = state.sunbeams[ sI ];
				var breath = 0.5 + Math.sin( state.time * sb.speed + sb.phase ) * 0.5;
				var steps = 14;
				for ( var stp = 0; stp < steps; stp++ ) {
					var t = stp / ( steps - 1 );
					var xc = sb.x + 0.28 * hh * t + px * 6;
					var wSeg = sb.width * ( 0.75 + t * 0.55 );
					var a = ( 1 - t ) * 0.06 * ( 0.55 + breath * 0.9 ) * ( 1 + bass * 0.4 );
					bg.rect( xc - wSeg * 0.5, hh * t, wSeg, hh / steps + 1 )
						.fill( { color: 0xffe3a0, alpha: a } );
				}
			}

			function drawBunting( rowArr, rowY, amp, wavePhase ) {
				var lenX = w * 0.92;
				var startX = w * 0.04;
				var count = rowArr.length;
				var step = lenX / ( count - 1 );
				var points = [];
				for ( var i = 0; i < count; i++ ) {
					var t = i / ( count - 1 );
					var sag = Math.sin( t * Math.PI ) * 20;
					var ripple = Math.sin( state.time * 0.04 + i * 0.6 + wavePhase ) * amp;
					var x = startX + step * i + px * 4;
					var y = rowY + sag + ripple + py * 2;
					points.push( { x: x, y: y } );
				}
				state.buntingG.moveTo( points[ 0 ].x, points[ 0 ].y );
				for ( var j = 1; j < points.length; j++ ) {
					state.buntingG.lineTo( points[ j ].x, points[ j ].y );
				}
				state.buntingG.stroke( { color: 0x4a2d12, width: 1.3, alpha: 0.8 } );
				for ( var k = 0; k < count; k++ ) {
					var pt = points[ k ];
					var flag = rowArr[ k ];
					var twist = Math.sin( state.time * 0.06 + flag.phase ) * 0.25;
					var fw = 16 + Math.cos( twist ) * 6;
					var fh = 20;
					state.buntingG.moveTo( pt.x - fw * 0.5, pt.y )
						.lineTo( pt.x + fw * 0.5, pt.y )
						.lineTo( pt.x, pt.y + fh )
						.fill( { color: flag.color, alpha: 0.92 } );
				}
			}

			state.buntingG.clear();
			drawBunting( state.flagsA, hh * 0.12, 4 + state.pulse * 3 + bass * 4, 0 );
			drawBunting( state.flagsB, hh * 0.22, 3 + state.pulse * 3 + bass * 3, 1.4 );

			var pg = state.petalG;
			pg.clear();
			for ( var i = 0; i < state.petals.length; i++ ) {
				var p = state.petals[ i ];
				if ( ! env.reducedMotion ) {
					p.x += p.vx * dt;
					p.y += p.vy * dt;
					p.phase += 0.05 * dt;
					if ( p.y > hh + 6 ) { p.y = -8; p.x = h.rand( 0, w ); }
					if ( p.x > w + 6 ) p.x = -6;
				}
				var sway = Math.sin( p.phase ) * 3;
				pg.rect( p.x + sway - p.size * 0.5, p.y - p.size * 0.3, p.size, p.size * 0.6 )
					.fill( { color: p.color, alpha: p.alpha * ( 0.85 + high * 0.2 ) } );
			}
		},

		onRipple: function ( opts, state ) {
			state.pulse = Math.min( 1, state.pulse + ( ( opts && opts.intensity ) || 0.6 ) );
		},

		onAudio: function ( state, env ) {
			if ( env.audio.bass > 0.55 ) state.pulse = Math.min( 1, state.pulse + 0.15 );
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.petals = [];
			state.sunbeams = [];
			state.flagsA = [];
			state.flagsB = [];
		},
	};
} )();
