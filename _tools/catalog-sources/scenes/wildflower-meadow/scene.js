/**
 * ODD scene: Wildflower Meadow — v1.2.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (assets/wallpapers/wildflower-meadow.webp).
 * Motion:
 *
 *   1. Butterflies on slow sine-arc paths across the mid-ground.
 *   2. Bees doing tight zigzag paths, faster than butterflies.
 *   3. Soft petal-specks drifting down on a breeze.
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
				timer: 40 + Math.random() * 50,
				life: 0,
			};
			s.bfly = { x: 0, y: 0, phase: 0, target: 0, resting: 0 };
			app.stage.addChild( s.layer );
		}
		if ( s.life <= 0 ) {
			s.timer -= dt / 60;
			if ( s.timer > 0 ) { s.layer.clear(); return; }
			s.life = 1;
			s.timer = 40 + Math.random() * 50;
			s.bfly.x = app.renderer.width * 0.92;
			            s.bfly.y = app.renderer.height * 0.18;
			            s.bfly.target = app.renderer.width * ( 0.58 + Math.random() * 0.14 );
			            s.bfly.resty  = app.renderer.height * ( 0.48 + Math.random() * 0.08 );
			            s.bfly.phase = 0;
			            s.bfly.resting = 0;
		}
		s.life = Math.max( 0, s.life - dt * 0.0008 );

		            s.bfly.phase += dt * 0.4;
		            var tx = s.bfly.target, ty = s.bfly.resty;
		            if ( s.bfly.resting < 2.4 ) {
		                s.bfly.x += ( tx - s.bfly.x ) * 0.02 * dt;
		                s.bfly.y += ( ty - s.bfly.y ) * 0.02 * dt;
		                if ( Math.abs( s.bfly.x - tx ) < 4 && Math.abs( s.bfly.y - ty ) < 4 ) {
		                    s.bfly.resting += dt / 60;
		                }
		            } else {
		                s.bfly.x += dt * 1.2;
		                s.bfly.y -= dt * 0.6;
		            }
		            var flap = Math.sin( s.bfly.phase ) * 0.6 + 0.4;
		            s.layer.clear();
		            s.layer
		                .ellipse( s.bfly.x - 8, s.bfly.y, 12 * flap, 16 )
		                .fill( { color: 0xff7ab0, alpha: s.life } )
		                .ellipse( s.bfly.x + 8, s.bfly.y, 12 * flap, 16 )
		                .fill( { color: 0xff7ab0, alpha: s.life } )
		                .rect( s.bfly.x - 1, s.bfly.y - 8, 2, 16 )
		                .fill( { color: 0x1a0a0a, alpha: s.life } );
		            if ( s.bfly.x > app.renderer.width + 40 ) s.life = 0;
	}

	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	var BUTTERFLY_COUNT = 6;
	var BEE_COUNT = 4;
	var PETAL_COUNT = 80;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'wildflower-meadow' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/wildflower-meadow.webp' + qs;
	}

	function makeButterflies( w, hh ) {
		var out = [];
		for ( var i = 0; i < BUTTERFLY_COUNT; i++ ) {
			out.push( {
				x: h.rand( 0, w ), y: h.rand( hh * 0.2, hh * 0.7 ),
				vx: h.rand( 0.25, 0.55 ) * ( Math.random() < 0.5 ? 1 : -1 ),
				phase: Math.random() * h.tau,
				amp: h.rand( 18, 42 ),
				flap: Math.random() * h.tau,
				size: h.rand( 5, 9 ),
				color: h.choose( [ 0xffd24a, 0xff76a2, 0x9d6bff, 0x63d7ff, 0xff8b4a ] ),
			} );
		}
		return out;
	}

	function makeBees( w, hh ) {
		var out = [];
		for ( var i = 0; i < BEE_COUNT; i++ ) {
			out.push( {
				x: h.rand( 0, w ), y: h.rand( hh * 0.4, hh * 0.85 ),
				vx: h.rand( 1.0, 1.8 ) * ( Math.random() < 0.5 ? 1 : -1 ),
				phase: Math.random() * h.tau,
			} );
		}
		return out;
	}

	function makePetals( w, hh ) {
		var out = [];
		for ( var i = 0; i < PETAL_COUNT; i++ ) {
			out.push( {
				x: h.rand( 0, w ), y: h.rand( -hh * 0.1, hh ),
				r: h.rand( 1.2, 2.6 ),
				vx: h.rand( 0.08, 0.22 ),
				vy: h.rand( 0.12, 0.3 ),
				phase: Math.random() * h.tau,
				color: h.choose( [ 0xffffff, 0xffd7d7, 0xfff4b0, 0xffc2e2 ] ),
				alpha: h.rand( 0.35, 0.75 ),
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'wildflower-meadow' ] = {
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

			var petalG = new PIXI.Graphics(); app.stage.addChild( petalG );
			var beeG = new PIXI.Graphics(); app.stage.addChild( beeG );
			var bfG = new PIXI.Graphics(); app.stage.addChild( bfG );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				petalG: petalG, beeG: beeG, bfG: bfG,
				butterflies: makeButterflies( w, hh ),
				bees: makeBees( w, hh ),
				petals: makePetals( w, hh ),
				time: 0, pulse: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.butterflies = makeButterflies( w, hh );
			state.bees = makeBees( w, hh );
			state.petals = makePetals( w, hh );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.pulse *= 0.92;

			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			var pg = state.petalG;
			pg.clear();
			for ( var i = 0; i < state.petals.length; i++ ) {
				var p = state.petals[ i ];
				if ( ! env.reducedMotion ) {
					p.x += p.vx * dt;
					p.y += p.vy * dt;
					p.phase += 0.04 * dt;
					if ( p.y > hh + 5 ) { p.y = -10; p.x = h.rand( 0, w ); }
					if ( p.x > w + 5 ) p.x = -5;
				}
				var sway = Math.sin( p.phase ) * 3;
				pg.circle( p.x + sway, p.y, p.r )
					.fill( { color: p.color, alpha: p.alpha } );
			}

			var bg = state.beeG;
			bg.clear();
			for ( var j = 0; j < state.bees.length; j++ ) {
				var b = state.bees[ j ];
				if ( ! env.reducedMotion ) {
					b.x += b.vx * dt;
					b.phase += 0.2 * dt;
					if ( b.vx > 0 && b.x > w + 20 ) { b.x = -20; b.y = h.rand( hh * 0.4, hh * 0.85 ); }
					if ( b.vx < 0 && b.x < -20 ) { b.x = w + 20; b.y = h.rand( hh * 0.4, hh * 0.85 ); }
				}
				var zig = Math.sin( b.phase ) * 6 + Math.sin( b.phase * 2.3 ) * 3;
				var bx = b.x, by = b.y + zig;
				bg.ellipse( bx, by, 2.6, 1.6 ).fill( { color: 0xf6c434, alpha: 0.9 } );
				bg.rect( bx - 1.2, by - 0.4, 0.8, 0.8 ).fill( { color: 0x1e1206, alpha: 0.9 } );
				bg.rect( bx + 0.4, by - 0.4, 0.8, 0.8 ).fill( { color: 0x1e1206, alpha: 0.9 } );
				bg.ellipse( bx, by - 1.4, 3, 1 ).fill( { color: 0xfffde0, alpha: 0.35 } );
			}

			var fg = state.bfG;
			fg.clear();
			for ( var k = 0; k < state.butterflies.length; k++ ) {
				var bf = state.butterflies[ k ];
				if ( ! env.reducedMotion ) {
					bf.x += bf.vx * dt;
					bf.phase += 0.04 * dt;
					bf.flap += 0.25 * dt * ( 1 + state.pulse * 0.8 );
					if ( bf.vx > 0 && bf.x > w + 30 ) { bf.x = -30; bf.y = h.rand( hh * 0.2, hh * 0.7 ); }
					if ( bf.vx < 0 && bf.x < -30 ) { bf.x = w + 30; bf.y = h.rand( hh * 0.2, hh * 0.7 ); }
				}
				var yy = bf.y + Math.sin( bf.phase ) * bf.amp + py * 4;
				var xx = bf.x + px * 6;
				var openness = Math.abs( Math.sin( bf.flap ) );
				var wingW = bf.size * ( 0.4 + openness );
				fg.ellipse( xx - bf.size * 0.6, yy, wingW, bf.size ).fill( { color: bf.color, alpha: 0.9 } );
				fg.ellipse( xx + bf.size * 0.6, yy, wingW, bf.size ).fill( { color: bf.color, alpha: 0.9 } );
				fg.rect( xx - 0.6, yy - bf.size * 0.5, 1.2, bf.size ).fill( { color: 0x1e0f18, alpha: 0.95 } );
			}

		
			signatureTick( state, env );
		},

		onRipple: function ( opts, state ) {
			state.pulse = Math.min( 1, state.pulse + ( ( opts && opts.intensity ) || 0.5 ) );
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.butterflies = [];
			state.bees = [];
			state.petals = [];
		},
	};
} )();
