/**
 * ODD scene: Circuit Garden.
 *
 * Regenerated backdrop tuned with a quiet lower-left board area,
 * slow trace pulses, right-side blossom breaths, and sparse fireflies.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers || {};
	var scriptUrl = document.currentScript && document.currentScript.src;
	var TAU = h.tau || Math.PI * 2;

	function rand( min, max ) {
		return h.rand ? h.rand( min, max ) : min + Math.random() * ( max - min );
	}

	function choose( list ) {
		return h.choose ? h.choose( list ) : list[ ( Math.random() * list.length ) | 0 ];
	}

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'circuit-garden' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function seasonPalette( season ) {
		switch ( season ) {
			case 'spring': return { firefly: 0xb5ffdf, blossom: 0xff9dd2, trace: 0x7effc8, bus: 0xffc060 };
			case 'summer': return { firefly: 0xfff2a0, blossom: 0xff7f6b, trace: 0xffcb5b, bus: 0xffd070 };
			case 'autumn': return { firefly: 0xffc27a, blossom: 0xff8a3a, trace: 0xff7aa2, bus: 0xffa84d };
			case 'winter': return { firefly: 0xcfe8ff, blossom: 0xbde3ff, trace: 0x9bd7ff, bus: 0xd9f2ff };
			case 'halloween': return { firefly: 0xff9a3b, blossom: 0xb074ff, trace: 0x4ce0a5, bus: 0xff8a3b };
			case 'newYear': return { firefly: 0xffd79a, blossom: 0xffa9d0, trace: 0xffe88a, bus: 0xffd79a };
			default: return { firefly: 0xc8ffd0, blossom: 0xff9fd0, trace: 0x9affc5, bus: 0xffc060 };
		}
	}

	function countFor( env, normal, low ) {
		return env.perfTier === 'low' ? low : normal;
	}

	function makeFireflies( w, hh, count ) {
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			var rightGlow = Math.random() > 0.28;
			arr.push( {
				x: rightGlow ? rand( w * 0.43, w * 0.97 ) : rand( w * 0.16, w * 0.75 ),
				y: rightGlow ? rand( hh * 0.08, hh * 0.82 ) : rand( hh * 0.08, hh * 0.44 ),
				r: rand( 0.8, 2.2 ),
				phase: Math.random() * TAU,
				speed: rand( 0.003, 0.012 ),
				alpha: rand( 0.14, 0.46 ),
				color: choose( [ 0xffd968, 0xaaff75, 0x6fffee, 0xa48cff ] ),
			} );
		}
		return arr;
	}

	function makeBusPulses( w, hh, count ) {
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			arr.push( {
				t: Math.random(),
				speed: rand( 0.0009, 0.0022 ),
				r: rand( 1.4, 2.8 ),
				offset: rand( -7, 7 ),
				phase: Math.random() * TAU,
			} );
		}
		return arr;
	}

	function makeBlossoms( w, hh, count ) {
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			arr.push( {
				x: rand( w * 0.55, w * 0.96 ),
				y: rand( hh * 0.16, hh * 0.72 ),
				r: rand( 4, 11 ),
				phase: Math.random() * TAU,
				speed: rand( 0.003, 0.008 ),
				petals: 5 + ( Math.random() * 3 ) | 0,
				color: choose( [ 0xff8fe7, 0x9d7cff, 0xffb65f, 0x80fff1 ] ),
			} );
		}
		return arr;
	}

	function pointOnBus( w, hh, t, offset ) {
		var x0 = w * 0.12;
		var y0 = hh * 0.46;
		var x1 = w * 0.97;
		var y1 = hh * 0.63;
		return {
			x: x0 + ( x1 - x0 ) * t,
			y: y0 + ( y1 - y0 ) * t + Math.sin( t * Math.PI ) * hh * 0.06 + offset,
		};
	}

	window.__odd.scenes[ 'circuit-garden' ] = {
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

			var bus = new PIXI.Graphics();
			bus.blendMode = 'add';
			app.stage.addChild( bus );
			var blossoms = new PIXI.Graphics();
			blossoms.blendMode = 'add';
			app.stage.addChild( blossoms );
			var sparks = new PIXI.Graphics();
			sparks.blendMode = 'add';
			app.stage.addChild( sparks );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop,
				fitBackdrop: fitBackdrop,
				busG: bus,
				blossomG: blossoms,
				sparkG: sparks,
				fireflies: makeFireflies( w, hh, countFor( env, 72, 36 ) ),
				busPulses: makeBusPulses( w, hh, countFor( env, 9, 4 ) ),
				blossoms: makeBlossoms( w, hh, countFor( env, 13, 6 ) ),
				palette: seasonPalette( env.season ),
				time: 0,
				breath: 0,
				glanceX: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.fireflies = makeFireflies( w, hh, countFor( env, 72, 36 ) );
			state.busPulses = makeBusPulses( w, hh, countFor( env, 9, 4 ) );
			state.blossoms = makeBlossoms( w, hh, countFor( env, 13, 6 ) );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.breath *= 0.94;
			state.glanceX *= 0.9;
			state.palette = seasonPalette( env.season );
			var pal = state.palette;
			var mid = ( env.audio && env.audio.enabled ) ? env.audio.mid : 0;
			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			var bus = state.busG;
			bus.clear();
			for ( var rail = 0; rail < 4; rail++ ) {
				var prev = pointOnBus( w, hh, 0, rail * 4 - 8 );
				for ( var step = 1; step <= 22; step++ ) {
					var t = step / 22;
					var p = pointOnBus( w, hh, t, rail * 4 - 8 );
					bus.moveTo( prev.x + px * 2, prev.y + py )
						.lineTo( p.x + px * 2, p.y + py )
						.stroke( { color: pal.bus, width: 0.9, alpha: 0.06, cap: 'round' } );
					prev = p;
				}
			}
			for ( var i = 0; i < state.busPulses.length; i++ ) {
				var bp = state.busPulses[ i ];
				if ( ! env.reducedMotion ) bp.t = ( bp.t + bp.speed * dt * ( 1 + mid * 0.7 ) ) % 1;
				var pp = pointOnBus( w, hh, bp.t, bp.offset );
				var pulse = 0.55 + Math.sin( state.time * 0.015 + bp.phase ) * 0.25 + state.breath * 0.3;
				bus.circle( pp.x + px * 2, pp.y + py, bp.r * 3.2 )
					.fill( { color: pal.bus, alpha: 0.08 * pulse } );
				bus.circle( pp.x + px * 2, pp.y + py, bp.r )
					.fill( { color: pal.bus, alpha: 0.55 * pulse } );
			}

			var bg = state.blossomG;
			bg.clear();
			for ( var b = 0; b < state.blossoms.length; b++ ) {
				var bl = state.blossoms[ b ];
				if ( ! env.reducedMotion ) bl.phase += bl.speed * dt;
				var open = 0.82 + Math.sin( bl.phase ) * 0.18 + state.breath * 0.2;
				var cx = bl.x + px * 7 + state.glanceX * 7;
				var cy = bl.y + py * 4;
				bg.circle( cx, cy, bl.r * 0.38 ).fill( { color: 0xffffff, alpha: 0.26 } );
				for ( var ptl = 0; ptl < bl.petals; ptl++ ) {
					var ang = ptl / bl.petals * TAU + bl.phase * 0.12;
					bg.ellipse( cx + Math.cos( ang ) * bl.r * open, cy + Math.sin( ang ) * bl.r * open, bl.r * 0.48, bl.r * 0.28 )
						.fill( { color: bl.color || pal.blossom, alpha: 0.25 } );
				}
			}

			var sg = state.sparkG;
			sg.clear();
			for ( var s = 0; s < state.fireflies.length; s++ ) {
				var f = state.fireflies[ s ];
				if ( ! env.reducedMotion ) f.phase += f.speed * dt * ( 1 + mid * 0.8 );
				var x = f.x + Math.sin( f.phase ) * 9 + px * 4 + state.glanceX * 5;
				var y = f.y + Math.cos( f.phase * 0.8 ) * 7 + py * 3;
				var twinkle = 0.52 + Math.sin( f.phase * 1.8 ) * 0.36;
				sg.circle( x, y, f.r * 2.6 )
					.fill( { color: f.color, alpha: f.alpha * 0.18 * ( 1 + high * 0.25 ) } );
				sg.circle( x, y, f.r )
					.fill( { color: f.color, alpha: f.alpha * twinkle * ( 1 + high * 0.25 ) } );
			}
		},

		onRipple: function ( opts, state ) {
			state.breath = Math.min( 1, state.breath + ( ( opts && opts.intensity ) || 0.45 ) );
		},

		onGlance: function ( opts, state, env ) {
			if ( ! opts || opts.nod ) return;
			var w = env.app.renderer.width;
			state.glanceX = Math.max( -1, Math.min( 1, ( ( opts.x || w / 2 ) / w - 0.5 ) * 2 ) );
		},

		onGlitch: function ( opts, state ) {
			state.breath = 1;
		},

		onAudio: function ( state, env ) {
			if ( env.audio && env.audio.enabled && env.audio.high > 0.62 ) {
				state.breath = Math.min( 1, state.breath + 0.06 );
			}
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.fireflies = [];
			state.busPulses = [];
			state.blossoms = [];
		},
	};
} )();
