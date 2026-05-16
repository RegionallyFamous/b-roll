/**
 * ODD scene: Mercado.
 *
 * Sunlit market backdrop with light canopy ripples, right-stall
 * marigold drift, and slow warm sunbeams kept off the icon lane.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers || {};
	var scriptUrl = document.currentScript && document.currentScript.src;
	var TAU = h.tau || Math.PI * 2;
	var FLAG_COLORS = [ 0xff4fa8, 0x2fd1d8, 0xffb800, 0xff6a5c, 0x80d45b, 0x2a4fc2 ];

	function rand( min, max ) {
		return h.rand ? h.rand( min, max ) : min + Math.random() * ( max - min );
	}

	function choose( list ) {
		return h.choose ? h.choose( list ) : list[ ( Math.random() * list.length ) | 0 ];
	}

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'mercado' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function countFor( env, normal, low ) {
		return env.perfTier === 'low' ? low : normal;
	}

	function makePetals( w, hh, count ) {
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			var stallSide = Math.random() > 0.18;
			arr.push( {
				x: stallSide ? rand( w * 0.48, w * 0.96 ) : rand( w * 0.18, w * 0.72 ),
				y: stallSide ? rand( hh * 0.16, hh * 0.78 ) : rand( hh * 0.16, hh * 0.48 ),
				size: rand( 2.0, 4.3 ),
				vx: rand( -0.015, 0.06 ),
				vy: rand( 0.045, 0.13 ),
				phase: Math.random() * TAU,
				color: choose( [ 0xff8a2a, 0xffb400, 0xff6b1a, 0xffd257, 0xf6427d ] ),
				alpha: rand( 0.42, 0.78 ),
			} );
		}
		return arr;
	}

	function makeFlags( count ) {
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			arr.push( {
				color: FLAG_COLORS[ i % FLAG_COLORS.length ],
				phase: Math.random() * TAU,
				w: rand( 19, 28 ),
				h: rand( 16, 24 ),
			} );
		}
		return arr;
	}

	function makeBeams( w, hh, count ) {
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			arr.push( {
				x: rand( w * 0.05, w * 0.55 ),
				width: rand( w * 0.055, w * 0.12 ),
				phase: Math.random() * TAU,
				speed: rand( 0.0008, 0.0018 ),
			} );
		}
		return arr;
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
			app.stage.addChild( beams );
			var bunting = new PIXI.Graphics();
			app.stage.addChild( bunting );
			var petals = new PIXI.Graphics();
			petals.blendMode = 'add';
			app.stage.addChild( petals );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop,
				fitBackdrop: fitBackdrop,
				beamsG: beams,
				buntingG: bunting,
				petalsG: petals,
				beams: makeBeams( w, hh, countFor( env, 3, 1 ) ),
				flagsNear: makeFlags( 11 ),
				flagsFar: makeFlags( 9 ),
				petals: makePetals( w, hh, countFor( env, 64, 28 ) ),
				time: 0,
				pulse: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.beams = makeBeams( w, hh, countFor( env, 3, 1 ) );
			state.petals = makePetals( w, hh, countFor( env, 64, 28 ) );
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

			var bg = state.beamsG;
			bg.clear();
			for ( var bi = 0; bi < state.beams.length; bi++ ) {
				var beam = state.beams[ bi ];
				var breath = 0.52 + Math.sin( state.time * beam.speed + beam.phase ) * 0.48;
				for ( var st = 0; st < 12; st++ ) {
					var t = st / 11;
					var y = hh * ( 0.03 + t * 0.42 );
					var x = beam.x + hh * 0.32 * t + px * 3;
					var alpha = ( 1 - t ) * 0.045 * ( 0.5 + breath * 0.7 ) * ( 1 + bass * 0.25 );
					bg.rect( x - beam.width * 0.5, y, beam.width * ( 0.9 + t * 0.7 ), hh * 0.045 )
						.fill( { color: 0xffe0a0, alpha: alpha } );
				}
			}

			function drawFlags( flags, y0, y1, x0, x1, amp, alpha ) {
				var points = [];
				for ( var i = 0; i < flags.length; i++ ) {
					var t = i / Math.max( 1, flags.length - 1 );
					var x = x0 + ( x1 - x0 ) * t + px * 3;
					var y = y0 + ( y1 - y0 ) * t + Math.sin( t * Math.PI ) * 14
						+ Math.sin( state.time * 0.018 + flags[ i ].phase ) * amp + py * 2;
					points.push( { x: x, y: y } );
				}
				state.buntingG.moveTo( points[ 0 ].x, points[ 0 ].y );
				for ( var j = 1; j < points.length; j++ ) {
					state.buntingG.lineTo( points[ j ].x, points[ j ].y );
				}
				state.buntingG.stroke( { color: 0x5a3518, width: 1.2, alpha: alpha * 0.75 } );
				for ( var k = 0; k < flags.length; k++ ) {
					var f = flags[ k ];
					var pt = points[ k ];
					var twist = Math.sin( state.time * 0.025 + f.phase ) * 0.18;
					var fw = f.w * ( 0.92 + Math.cos( twist ) * 0.08 );
					state.buntingG.moveTo( pt.x - fw * 0.5, pt.y )
						.lineTo( pt.x + fw * 0.5, pt.y )
						.lineTo( pt.x + fw * 0.32, pt.y + f.h )
						.lineTo( pt.x, pt.y + f.h * 0.78 )
						.lineTo( pt.x - fw * 0.32, pt.y + f.h )
						.fill( { color: f.color, alpha: alpha } );
				}
			}

			state.buntingG.clear();
			drawFlags( state.flagsFar, hh * 0.29, hh * 0.13, w * 0.08, w * 0.58, 2.2 + state.pulse * 1.5, 0.55 );
			drawFlags( state.flagsNear, hh * 0.23, hh * 0.09, w * 0.36, w * 0.98, 3.2 + state.pulse * 2 + bass * 1.5, 0.82 );

			var pg = state.petalsG;
			pg.clear();
			for ( var pI = 0; pI < state.petals.length; pI++ ) {
				var p = state.petals[ pI ];
				if ( ! env.reducedMotion ) {
					p.x += p.vx * dt;
					p.y += p.vy * dt;
					p.phase += 0.012 * dt;
					if ( p.y > hh * 0.84 || p.x > w + 8 ) {
						p.x = rand( w * 0.48, w * 0.96 );
						p.y = rand( hh * 0.12, hh * 0.3 );
					}
				}
				var leftQuiet = p.x < w * 0.34 && p.y > hh * 0.26;
				var sway = Math.sin( p.phase ) * 3.5;
				var a = p.alpha * ( leftQuiet ? 0.16 : 1 ) * ( 0.88 + high * 0.12 );
				pg.ellipse( p.x + sway + px * 2, p.y + py * 2, p.size, p.size * 0.48 )
					.fill( { color: p.color, alpha: a } );
			}
		},

		onRipple: function ( opts, state ) {
			state.pulse = Math.min( 1, state.pulse + ( ( opts && opts.intensity ) || 0.55 ) );
		},

		onAudio: function ( state, env ) {
			if ( env.audio && env.audio.enabled && env.audio.bass > 0.58 ) {
				state.pulse = Math.min( 1, state.pulse + 0.1 );
			}
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.beams = [];
			state.flagsNear = [];
			state.flagsFar = [];
			state.petals = [];
		},
	};
} )();
