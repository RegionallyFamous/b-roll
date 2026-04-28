/**
 * ODD scene: Beach Umbrellas — v1.2.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (assets/wallpapers/beach-umbrellas.webp),
 * a high-aerial beach. Motion:
 *
 *   1. A wave foam band at the top edge advances/retreats.
 *   2. A sand-sparkle layer that flickers in the afternoon sun.
 *   3. Gull shadows arcing across the sand every few seconds.
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
				timer: 90 + Math.random() * 90,
				life: 0,
			};
			s.ball = { x: -80, y: 0, rot: 0 };
			app.stage.addChild( s.layer );
		}
		if ( s.life <= 0 ) {
			s.timer -= dt / 60;
			if ( s.timer > 0 ) { s.layer.clear(); return; }
			s.life = 1;
			s.timer = 90 + Math.random() * 90;
			s.ball.x = -80;
			            s.ball.y = app.renderer.height * ( 0.78 + Math.random() * 0.08 );
			            s.ball.rot = 0;
		}
		s.life = Math.max( 0, s.life - dt * 0.0015 );

		            s.ball.x += dt * 3.2;
		            s.ball.y -= dt * 0.6;
		            s.ball.rot += dt * 0.12;
		            var r = 22;
		            s.layer.clear();
		            var cx = s.ball.x, cy = s.ball.y;
		            s.layer.circle( cx, cy, r )
		                .fill( { color: 0xffffff, alpha: s.life * 0.95 } );
		            for ( var k = 0; k < 6; k++ ) {
		                var a0 = s.ball.rot + k * Math.PI / 3;
		                s.layer.moveTo( cx, cy )
		                    .lineTo( cx + Math.cos( a0 ) * r, cy + Math.sin( a0 ) * r )
		                    .lineTo( cx + Math.cos( a0 + Math.PI / 6 ) * r, cy + Math.sin( a0 + Math.PI / 6 ) * r )
		                    .fill( { color: ( k % 2 === 0 ? 0xff4d6d : 0xffca3a ), alpha: s.life * 0.85 } );
		            }
		            s.layer.ellipse( cx, cy + r + 4, r * 0.9, 5 )
		                .fill( { color: 0x000000, alpha: s.life * 0.3 } );
		            if ( s.ball.x > app.renderer.width * 0.55 ) s.life = 0;
	}

	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	var SPARKLE_COUNT = 140;
	var GULL_COUNT = 3;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'beach-umbrellas' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/beach-umbrellas.webp' + qs;
	}

	function makeSparkles( w, hh ) {
		var out = [];
		for ( var i = 0; i < SPARKLE_COUNT; i++ ) {
			out.push( {
				x: h.rand( 0, w ),
				y: h.rand( hh * 0.25, hh ),
				r: h.rand( 0.5, 1.4 ),
				phase: Math.random() * h.tau,
				speed: h.rand( 0.03, 0.09 ),
			} );
		}
		return out;
	}

	function makeGulls( w, hh ) {
		var out = [];
		for ( var i = 0; i < GULL_COUNT; i++ ) {
			out.push( {
				t: -h.rand( 0, 1 ),
				y: hh * ( 0.32 + i * 0.18 ),
				speed: h.rand( 0.004, 0.008 ),
				dir: Math.random() < 0.5 ? 1 : -1,
				size: h.rand( 6, 11 ),
				next: h.rand( 6, 22 ),
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'beach-umbrellas' ] = {
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

			var foam = new PIXI.Graphics();
			foam.blendMode = 'add';
			app.stage.addChild( foam );

			var sparkle = new PIXI.Graphics();
			sparkle.blendMode = 'add';
			app.stage.addChild( sparkle );

			var gulls = new PIXI.Graphics();
			app.stage.addChild( gulls );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				foamG: foam, sparkleG: sparkle, gullG: gulls,
				sparkles: makeSparkles( w, hh ),
				gulls: makeGulls( w, hh ),
				time: 0, pulse: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.sparkles = makeSparkles( w, hh );
			state.gulls = makeGulls( w, hh );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.pulse *= 0.92;

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;
			var px = env.parallax ? env.parallax.x : 0;

			var fg = state.foamG;
			fg.clear();
			var foamBand = hh * 0.18;
			var waveAdvance = 0.5 + Math.sin( state.time * 0.012 ) * 0.5;
			var foamTop = foamBand - waveAdvance * 22 - state.pulse * 6 - bass * 8;
			var segments = 32;
			for ( var i = 0; i < segments; i++ ) {
				var t = i / segments;
				var x1 = t * w;
				var y1 = foamTop + Math.sin( state.time * 0.03 + i * 0.6 ) * 3;
				var y2 = foamBand + Math.sin( state.time * 0.02 + i * 0.8 + 1 ) * 2;
				fg.moveTo( x1, y2 )
					.lineTo( x1 + w / segments, y1 )
					.stroke( { color: 0xffffff, width: 3, alpha: 0.45 } );
			}
			fg.rect( 0, 0, w, foamTop ).fill( { color: 0x5ab4d2, alpha: 0.08 } );

			var sg = state.sparkleG;
			sg.clear();
			for ( var k = 0; k < state.sparkles.length; k++ ) {
				var p = state.sparkles[ k ];
				if ( ! env.reducedMotion ) p.phase += p.speed * dt;
				var a = Math.pow( Math.abs( Math.sin( p.phase ) ), 6 ) * 0.7 * ( 0.7 + high * 0.5 );
				sg.circle( p.x + px * 4, p.y, p.r )
					.fill( { color: 0xfff6d8, alpha: a } );
			}

			var gg = state.gullG;
			gg.clear();
			for ( var m = 0; m < state.gulls.length; m++ ) {
				var G = state.gulls[ m ];
				if ( ! env.reducedMotion ) {
					if ( G.t < 0 ) {
						G.next -= dt / 60;
						if ( G.next <= 0 ) { G.t = 0; G.next = h.rand( 10, 28 ); }
					} else {
						G.t += G.speed * dt;
						if ( G.t >= 1 ) { G.t = -1; G.dir = Math.random() < 0.5 ? 1 : -1; }
					}
				}
				if ( G.t >= 0 ) {
					var tt = G.t;
					var gx = G.dir > 0 ? w * ( -0.1 + 1.2 * tt ) : w * ( 1.1 - 1.2 * tt );
					var gy = G.y + Math.sin( tt * Math.PI ) * -20;
					var flap = Math.sin( state.time * 0.3 + m ) * 2;
					var sx = gx + 6;
					var sy = gy + 18;
					gg.moveTo( sx - G.size, sy + flap )
						.quadraticCurveTo( sx - G.size * 0.3, sy - 1, sx, sy )
						.quadraticCurveTo( sx + G.size * 0.3, sy - 1, sx + G.size, sy + flap )
						.stroke( { color: 0x3a2a1e, width: 2, alpha: 0.45 } );
				}
			}
		
			signatureTick( state, env );
		},

		onRipple: function ( opts, state ) {
			state.pulse = Math.min( 1, state.pulse + ( ( opts && opts.intensity ) || 0.6 ) );
		},

		onAudio: function ( state, env ) {
			if ( env.audio.bass > 0.5 ) state.pulse = Math.min( 1, state.pulse + 0.14 );
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.sparkles = [];
			state.gulls = [];
		},
	};
} )();
