/**
 * B-Roll scene: Shimmer (Arcane) — v0.5
 * ---------------------------------------------------------------
 * Painted backdrop (assets/wallpapers/shimmer.webp — magenta-and-
 * violet cavern walls, distant Piltover-like skyline silhouette,
 * golden chemical haze rising from the bottom) loaded as a
 * Sprite. On top: a dedicated bubble layer spawns gold→pink
 * spheres at the floor that rise and pop, giving the scene a
 * literal "chemicals boiling" read.
 *
 * Magenta hex-grid pulses radiate outward every ~6–18s, the wave
 * ring thick with a clear leading edge. A slow color-shift wave
 * sweeps down the frame, tinting the painting cyan/pink as it
 * passes. Rare purple lightning flashes across the upper sky
 * with a veil flash. Rising particles with bloom trails and
 * upper-frame glints round it out.
 *
 * The v0.4 magenta-to-gold gradient, Piltover silhouette, Zaun
 * silhouette + window flicker are now baked into the painting.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/shimmer.webp' + qs;
	}

	window.__bRoll.scenes[ 'shimmer' ] = {
		setup: async function ( env ) {
			var PIXI = env.PIXI, app = env.app;
			var w = app.renderer.width, hh = app.renderer.height;

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

			// Color-shift wave overlay (tints a horizontal band).
			var colorWave = new PIXI.Graphics();
			app.stage.addChild( colorWave );

			// Distant lightning over the painted Piltover skyline.
			var lightning = new PIXI.Graphics();
			app.stage.addChild( lightning );

			var tank = new PIXI.Graphics();
			app.stage.addChild( tank );

			// Rising chemical bubbles from the floor.
			var bubbleLayer = new PIXI.Graphics();
			app.stage.addChild( bubbleLayer );
			var bubbles = [];

			var hex = new PIXI.Graphics();
			hex.alpha = 0;
			app.stage.addChild( hex );

			var bloom = h.makeBloomLayer( PIXI, 6 );
			app.stage.addChild( bloom );
			var bloomParticles = new PIXI.Graphics();
			bloom.addChild( bloomParticles );

			var particles = new PIXI.Graphics();
			app.stage.addChild( particles );

			var pts = [];
			for ( var i = 0; i < 170; i++ ) {
				pts.push( {
					x: h.rand( 0, w ), y: h.rand( 0, hh ),
					prevX: 0, prevY: 0,
					r: h.rand( 0.8, 2.8 ), vy: -h.rand( 0.3, 1 ),
					phase: Math.random() * h.tau, amp: h.rand( 5, 18 ),
				} );
			}

			var glintLayer = new PIXI.Graphics();
			app.stage.addChild( glintLayer );

			var fg = new PIXI.Container();
			app.stage.addChild( fg );
			var drifters = await h.mountCutouts( app, PIXI, 'shimmer', fg );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				colorWave: colorWave, waveY: -999, waveT: h.rand( 60 * 8, 60 * 22 ),
				waveTint: 0xff4ab8,
				lightning: lightning, lightningLife: 0, lightningT: h.rand( 60 * 20, 60 * 55 ),
				lightningFlash: 0, lightningPath: null,
				tank: tank,
				bubbleLayer: bubbleLayer, bubbles: bubbles,
				bubbleSpawnCD: 0,
				hex: hex, hexAlpha: 0, hexOrigin: { x: w / 2, y: hh * 0.88 },
				particles: particles, bloomParticles: bloomParticles, pts: pts,
				glintLayer: glintLayer, hexT: h.rand( 60 * 6, 60 * 18 ),
				fg: fg, drifters: drifters,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			state.hexOrigin = { x: env.app.renderer.width / 2, y: env.app.renderer.height * 0.88 };
		},

		onEgg: function ( name, state, env ) {
			if ( name === 'festival' ) {
				// Konami → big hex pulse + lightning + flood of bubbles.
				state.hexAlpha = 1;
				state.hexOrigin = { x: env.app.renderer.width / 2, y: env.app.renderer.height * 0.6 };
				state.lightningLife = 1;
				state.lightningFlash = 1;
				for ( var i = 0; i < 30; i++ ) {
					state.bubbles.push( {
						x: h.rand( 0, env.app.renderer.width ), y: env.app.renderer.height + h.rand( 0, 80 ),
						vy: -h.rand( 0.5, 1.5 ), r: h.rand( 1.2, 4 ),
						phase: Math.random() * h.tau, wobble: h.rand( 0.5, 1.8 ),
						life: 1, color: h.lerpColor( 0xff4ab8, 0xffe08a, Math.random() ),
					} );
				}
			} else if ( name === 'reveal' ) {
				// Type 'jinx' → monkey-bomb appears + lightning.
				h.showEggDrifter( state.drifters, 'monkey-bomb.webp', { resetT: true, scaleMul: 1.2 } );
				state.lightningLife = 1; state.lightningFlash = 1;
				setTimeout( function () { h.hideEggDrifter( state.drifters, 'monkey-bomb.webp' ); }, 5000 );
			} else if ( name === 'peek' ) {
				// Triple-click → focused hex pulse near the click region.
				state.hexAlpha = 1;
				state.hexOrigin = { x: 80, y: env.app.renderer.height - 80 };
			}
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var t = env.app.ticker.lastTime;
			h.tickDrifters( state.drifters, env );

			// --- Chem-tank pulse (base glow) ------------------- //
			state.tank.clear();
			var tankPulse = 0.55 + 0.35 * Math.sin( t * 0.002 );
			for ( var r = 8; r >= 1; r-- ) {
				state.tank.circle( w / 2, hh + 10, r * 20 )
					.fill( { color: h.lerpColor( 0xff4ab8, 0x16051a, r / 8 ), alpha: tankPulse * 0.1 } );
			}

			// --- Rising chemical bubbles ----------------------- //
			state.bubbleSpawnCD -= dt;
			if ( state.bubbleSpawnCD <= 0 ) {
				state.bubbleSpawnCD = h.rand( 2, 8 );
				var bx = h.rand( w * 0.1, w * 0.9 );
				state.bubbles.push( {
					x: bx, y: hh + 4,
					vy: -h.rand( 0.25, 0.7 ),
					r: h.rand( 1.2, 4 ),
					phase: Math.random() * h.tau,
					wobble: h.rand( 0.5, 1.8 ),
					life: 1,
					color: h.lerpColor( 0xff4ab8, 0xffe08a, Math.random() ),
				} );
			}
			state.bubbleLayer.clear();
			for ( var bi = state.bubbles.length - 1; bi >= 0; bi-- ) {
				var b = state.bubbles[ bi ];
				b.phase += 0.05 * dt;
				b.y += b.vy * dt;
				var bbx = b.x + Math.sin( b.phase ) * b.wobble;
				var riseFrac = 1 - ( b.y - hh * 0.6 ) / ( hh * 0.4 );
				riseFrac = h.clamp( riseFrac, 0, 1 );
				if ( b.y < hh * 0.58 ) {
					b.life -= 0.02 * dt;
					if ( b.life <= 0 ) { state.bubbles.splice( bi, 1 ); continue; }
				}
				state.bubbleLayer.circle( bbx, b.y, b.r )
					.fill( { color: b.color, alpha: b.life * ( 0.35 + riseFrac * 0.25 ) } );
				state.bubbleLayer.circle( bbx, b.y, b.r * 2.2 )
					.fill( { color: b.color, alpha: b.life * 0.12 } );
				state.bubbleLayer.circle( bbx - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.3 )
					.fill( { color: 0xffe08a, alpha: b.life * 0.45 } );
			}

			// --- Rising particles + bloom trails --------------- //
			state.particles.clear();
			state.bloomParticles.clear();
			for ( var j = 0; j < state.pts.length; j++ ) {
				var p = state.pts[ j ];
				p.prevX = p.x + Math.sin( p.phase ) * p.amp;
				p.prevY = p.y;
				p.phase += 0.04 * dt;
				p.y += p.vy * dt;
				if ( p.y < -10 ) { p.y = hh + 20; p.x = h.rand( 0, w ); }
				var px = p.x + Math.sin( p.phase ) * p.amp;
				var prog = 1 - ( p.y / hh );
				var color = h.lerpColor( 0xff4ab8, 0xffe08a, h.clamp( prog - 0.4, 0, 1 ) * 1.4 );
				state.particles.moveTo( p.prevX, p.prevY ).lineTo( px, p.y )
					.stroke( { color: color, alpha: 0.35 + prog * 0.4, width: p.r * 0.6 } );
				state.particles.circle( px, p.y, p.r ).fill( { color: color, alpha: 0.5 + prog * 0.4 } );
				state.bloomParticles.circle( px, p.y, p.r * 3 ).fill( { color: color, alpha: 0.12 + prog * 0.18 } );
			}

			// --- Upper-frame glints ---------------------------- //
			state.glintLayer.clear();
			var G = 22;
			for ( var g = 0; g < G; g++ ) {
				var gx = ( g / G ) * w + Math.sin( t * 0.0005 + g ) * 16;
				var gy = hh * 0.09 + Math.sin( t * 0.0012 + g * 1.3 ) * 6;
				var ga = 0.3 + 0.35 * Math.sin( t * 0.003 + g );
				state.glintLayer.circle( gx, gy, 1.4 ).fill( { color: 0xffe08a, alpha: ga } );
				if ( ga > 0.55 ) {
					state.glintLayer.moveTo( gx - 4, gy ).lineTo( gx + 4, gy )
						.stroke( { color: 0xffe08a, alpha: ga * 0.8, width: 0.6 } );
					state.glintLayer.moveTo( gx, gy - 4 ).lineTo( gx, gy + 4 )
						.stroke( { color: 0xffe08a, alpha: ga * 0.8, width: 0.6 } );
				}
			}

			// --- Color-shift wave ------------------------------ //
			state.waveT -= dt;
			if ( state.waveT <= 0 && state.waveY < -50 ) {
				state.waveT = h.rand( 60 * 12, 60 * 28 );
				state.waveY = -40;
				state.waveTint = h.choose( [ 0xff4ab8, 0x64e0ff, 0xffa040, 0xb080ff ] );
			}
			state.colorWave.clear();
			if ( state.waveY > -50 ) {
				state.waveY += 0.9 * dt;
				if ( state.waveY > hh + 40 ) {
					state.waveY = -999;
				} else {
					// Wide gradient band (3 rects of varying alpha).
					state.colorWave.rect( 0, state.waveY - 30, w, 20 )
						.fill( { color: state.waveTint, alpha: 0.04 } );
					state.colorWave.rect( 0, state.waveY - 10, w, 20 )
						.fill( { color: state.waveTint, alpha: 0.11 } );
					state.colorWave.rect( 0, state.waveY + 10, w, 30 )
						.fill( { color: state.waveTint, alpha: 0.05 } );
				}
			}

			// --- Distant lightning ------------------------------ //
			state.lightningT -= dt;
			state.lightning.clear();
			if ( state.lightningT <= 0 && state.lightningLife <= 0 ) {
				state.lightningT = h.rand( 60 * 20, 60 * 55 );
				state.lightningLife = 1;
				state.lightningFlash = 1;
				// Pre-generate a bolt path.
				var steps = 10;
				var startX = h.rand( w * 0.1, w * 0.9 );
				var path = [ startX, 0 ];
				var x2 = startX, y2 = 0;
				for ( var li = 0; li < steps; li++ ) {
					x2 += h.rand( -20, 20 );
					y2 += ( hh * 0.18 ) / steps;
					path.push( x2, y2 );
				}
				state.lightningPath = path;
			}
			if ( state.lightningFlash > 0 ) {
				state.lightningFlash -= 0.06 * dt;
				state.lightning.rect( 0, 0, w, hh * 0.35 )
					.fill( { color: 0xb080ff, alpha: state.lightningFlash * 0.18 } );
			}
			if ( state.lightningLife > 0 && state.lightningPath ) {
				state.lightningLife -= 0.04 * dt;
				var P = state.lightningPath;
				for ( var lp = 0; lp < P.length - 2; lp += 2 ) {
					state.lightning.moveTo( P[ lp ], P[ lp + 1 ] ).lineTo( P[ lp + 2 ], P[ lp + 3 ] )
						.stroke( { color: 0xd8b8ff, alpha: state.lightningLife * 0.95, width: 1.1 } );
					state.lightning.moveTo( P[ lp ], P[ lp + 1 ] ).lineTo( P[ lp + 2 ], P[ lp + 3 ] )
						.stroke( { color: 0xb080ff, alpha: state.lightningLife * 0.45, width: 3 } );
				}
			}

			// --- Hex-grid magenta pulse ------------------------- //
			state.hexT -= dt;
			if ( state.hexT <= 0 ) {
				state.hexT = h.rand( 60 * 6, 60 * 18 );
				state.hexAlpha = 1;
				state.hexOrigin = { x: h.rand( w * 0.2, w * 0.8 ), y: hh * 0.88 };
			}
			if ( state.hexAlpha > 0 ) {
				state.hexAlpha = Math.max( 0, state.hexAlpha - 0.015 * dt );
				state.hex.clear();
				var HEX_R = 30, HEX_H = HEX_R * Math.sqrt( 3 );
				var waveRadius = ( 1 - state.hexAlpha ) * 450;
				for ( var y = 0; y < hh + HEX_H; y += HEX_H * 0.5 ) {
					for ( var x = 0; x < w + HEX_R * 2; x += HEX_R * 1.5 ) {
						var ox = ( Math.round( y / ( HEX_H * 0.5 ) ) % 2 ) * HEX_R * 0.75;
						var cx = x + ox, cy = y;
						var dist = Math.hypot( cx - state.hexOrigin.x, cy - state.hexOrigin.y );
						var wave = Math.max( 0, 1 - Math.abs( dist - waveRadius ) / 60 );
						var edge = Math.max( 0, 1 - Math.abs( dist - waveRadius ) / 20 );
						state.hex.poly( [
							cx - HEX_R, cy,
							cx - HEX_R * 0.5, cy - HEX_H * 0.5,
							cx + HEX_R * 0.5, cy - HEX_H * 0.5,
							cx + HEX_R, cy,
							cx + HEX_R * 0.5, cy + HEX_H * 0.5,
							cx - HEX_R * 0.5, cy + HEX_H * 0.5,
						] ).stroke( { color: 0xff7ad0, alpha: state.hexAlpha * 0.3 + wave * 0.55 + edge * 0.3, width: 1 } );
					}
				}
			}
		},
	};
} )();
