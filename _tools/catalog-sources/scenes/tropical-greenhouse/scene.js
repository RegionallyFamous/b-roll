/**
 * ODD scene: Tropical Greenhouse — v1.2.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (assets/wallpapers/tropical-greenhouse.webp)
 * with late-morning palm-house motion:
 *
 *   1. Warm god-ray shafts rake diagonally across the room.
 *   2. Pollen / humidity dust motes drift in the beams.
 *   3. A tiny parrot silhouette flits across the upper-right every
 *      30-90 seconds along an arcing path.
 *
 * Reduced motion freezes everything.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	// Signature moment: perf- and reduced-motion-aware overlay that
	// lands in the negative-space slot the v2 wallpaper prompt reserves.
	function signatureTick( state, env ) {
		if ( env.perfTier === 'low' || env.reducedMotion ) return;
		var app = env.app, PIXI = env.PIXI, dt = env.dt || 1;
		var s = state.__sig;
		if ( ! s || ! s.layer || ! s.layer.parent ) {
			s = state.__sig = {
				layer: new PIXI.Graphics(),
				timer: 22 + Math.random() * 38,
				life: 0,
			};
			s.mist = { x: 0, drift: 0 };
			app.stage.addChild( s.layer );
		}
		if ( s.life <= 0 ) {
			s.timer -= dt / 60;
			if ( s.timer > 0 ) { s.layer.clear(); return; }
			s.life = 1;
			s.timer = 22 + Math.random() * 38;
			s.mist.x = -80;
			            s.mist.y = app.renderer.height * ( 0.45 + Math.random() * 0.08 );
			            s.mist.drift = 0;
		}
		s.life = Math.max( 0, s.life - dt * 0.001 );

		            s.mist.x += dt * 1.2;
		            s.mist.drift += dt * 0.04;
		            s.layer.clear();
		            for ( var mi = 0; mi < 5; mi++ ) {
		                var px = s.mist.x + mi * 52;
		                var py = s.mist.y + Math.sin( s.mist.drift + mi ) * 14;
		                s.layer.ellipse( px, py, 46 + mi * 4, 22 )
		                    .fill( { color: 0xeef9f0, alpha: s.life * ( 0.30 - mi * 0.04 ) } );
		            }
		            if ( s.mist.x > app.renderer.width + 160 ) s.life = 0;
	}

	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	var MOTE_COUNT = 110;
	var SHAFT_COUNT = 4;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'tropical-greenhouse' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/tropical-greenhouse.webp' + qs;
	}

	function makeMotes( w, hh ) {
		var out = [];
		for ( var i = 0; i < MOTE_COUNT; i++ ) {
			out.push( {
				x: h.rand( 0, w ), y: h.rand( 0, hh ),
				r: h.rand( 0.5, 1.8 ),
				phase: Math.random() * h.tau,
				speed: h.rand( 0.005, 0.014 ),
				alpha: h.rand( 0.1, 0.34 ),
			} );
		}
		return out;
	}

	function makeShafts( w ) {
		var out = [];
		for ( var i = 0; i < SHAFT_COUNT; i++ ) {
			out.push( {
				x: w * ( 0.1 + i * ( 0.85 / ( SHAFT_COUNT - 1 ) ) ),
				tilt: 0.35 + Math.random() * 0.12,
				width: w * ( 0.08 + Math.random() * 0.06 ),
				phase: Math.random() * h.tau,
				speed: h.rand( 0.0009, 0.002 ),
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'tropical-greenhouse' ] = {
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

			var shafts = new PIXI.Graphics();
			shafts.blendMode = 'add';
			shafts.alpha = 0.42;
			app.stage.addChild( shafts );

			var motes = new PIXI.Graphics();
			motes.blendMode = 'add';
			app.stage.addChild( motes );

			var parrot = new PIXI.Graphics();
			app.stage.addChild( parrot );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				shafts: shafts, motes: motes, parrot: parrot,
				moteList: makeMotes( w, hh ),
				shaftList: makeShafts( w ),
				time: 0, pulse: 0,
				parrotT: -1, parrotNext: 8,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.moteList = makeMotes( w, hh );
			state.shaftList = makeShafts( w );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.pulse *= 0.92;

			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;
			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			var sg = state.shafts;
			sg.clear();
			for ( var sI = 0; sI < state.shaftList.length; sI++ ) {
				var sh = state.shaftList[ sI ];
				var breath = 0.5 + Math.sin( state.time * sh.speed + sh.phase ) * 0.5;
				var steps = 16;
				for ( var stp = 0; stp < steps; stp++ ) {
					var t = stp / ( steps - 1 );
					var xc = sh.x + sh.tilt * hh * t + px * 6;
					var wSeg = sh.width * ( 0.75 + t * 0.55 );
					var a = ( 1 - t ) * 0.07 * ( 0.55 + breath * 0.9 ) * ( 1 + bass * 0.4 + state.pulse * 0.5 );
					sg.rect( xc - wSeg * 0.5, hh * t, wSeg, hh / steps + 1 )
						.fill( { color: 0xffe9b4, alpha: a } );
				}
			}

			var mg = state.motes;
			mg.clear();
			for ( var i = 0; i < state.moteList.length; i++ ) {
				var p = state.moteList[ i ];
				if ( ! env.reducedMotion ) {
					p.phase += p.speed * dt;
					p.y -= 0.12 * dt;
					if ( p.y < -8 ) { p.y = hh + 8; p.x = h.rand( 0, w ); }
				}
				var x = p.x + Math.sin( p.phase ) * 10 + px * 10;
				var y = p.y + Math.cos( p.phase * 0.8 ) * 5 + py * 6;
				mg.circle( x, y, p.r ).fill( { color: 0xfff1c6, alpha: p.alpha * ( 0.8 + high * 0.3 ) } );
			}

			var pg = state.parrot;
			pg.clear();
			if ( ! env.reducedMotion ) {
				if ( state.parrotT < 0 ) {
					state.parrotNext -= dt / 60;
					if ( state.parrotNext <= 0 ) {
						state.parrotT = 0;
						state.parrotNext = h.rand( 30, 90 );
					}
				} else {
					state.parrotT += dt / 180;
					if ( state.parrotT >= 1 ) state.parrotT = -1;
				}
			}
			if ( state.parrotT >= 0 ) {
				var pt = state.parrotT;
				var x1 = w * 1.05, x2 = w * 0.55;
				var y1 = hh * 0.16, y2 = hh * 0.42;
				var fx = x1 + ( x2 - x1 ) * pt;
				var fy = y1 + ( y2 - y1 ) * pt + Math.sin( pt * Math.PI ) * -40;
				var flap = Math.sin( state.time * 0.6 ) * 4;
				pg.moveTo( fx - 9, fy + flap )
					.lineTo( fx, fy - 2 )
					.lineTo( fx + 9, fy + flap )
					.lineTo( fx, fy + 4 )
					.fill( { color: 0xcf3f2a, alpha: 0.82 } );
				pg.circle( fx + 8, fy - 1, 2 ).fill( { color: 0x1a0d32, alpha: 0.8 } );
			}

		
			signatureTick( state, env );
		},

		onRipple: function ( opts, state ) {
			state.pulse = Math.min( 1, state.pulse + ( ( opts && opts.intensity ) || 0.5 ) );
		},

		onAudio: function ( state, env ) {
			if ( env.audio.bass > 0.55 ) state.pulse = Math.min( 1, state.pulse + 0.1 );
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.moteList = [];
			state.shaftList = [];
		},
	};
} )();
