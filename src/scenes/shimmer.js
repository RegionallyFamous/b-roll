/**
 * B-Roll scene: Shimmer (Arcane)
 * ---------------------------------------------------------------
 * Magenta→gold gradient with Zaun silhouette at the bottom,
 * rising bioluminescent particles with trails, hex-grid flashes
 * that radiate from specific origin points, gold glints, pulsing
 * chem-tank glow at the floor.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	window.__bRoll.scenes[ 'shimmer' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;
			var w = app.renderer.width, hh = app.renderer.height;

			var bg = new PIXI.Graphics();
			app.stage.addChild( bg );
			function drawBg() {
				bg.clear();
				var w = app.renderer.width, hh = app.renderer.height;
				var steps = 26;
				for ( var i = 0; i < steps; i++ ) {
					var t = i / ( steps - 1 ), c;
					if ( t < 0.3 ) c = h.lerpColor( 0xc29033, 0x8a2c5b, t / 0.3 );
					else           c = h.lerpColor( 0x8a2c5b, 0x16051a, ( t - 0.3 ) / 0.7 );
					bg.rect( 0, ( i * hh ) / steps, w, hh / steps + 1 ).fill( c );
				}
			}
			drawBg();

			var zaun = new PIXI.Graphics();
			app.stage.addChild( zaun );
			var zaunWindows = [];
			function drawZaun() {
				zaun.clear();
				zaunWindows = [];
				var w = app.renderer.width, hh = app.renderer.height;
				var base = hh * 0.82, x = 0;
				while ( x < w ) {
					var bw = h.rand( 30, 90 );
					var bh = h.rand( 40, 140 );
					zaun.rect( x, base - bh, bw, hh ).fill( { color: 0x0a0210, alpha: 0.97 } );
					for ( var wy = base - bh + 8; wy < hh - 8; wy += 16 ) {
						for ( var wx = x + 4; wx < x + bw - 5; wx += 10 ) {
							if ( Math.random() < 0.32 ) {
								zaunWindows.push( { x: wx, y: wy, alpha: h.rand( 0.4, 0.9 ), tw: Math.random() * h.tau } );
							}
						}
					}
					x += bw + h.rand( 1, 3 );
				}
				for ( var p = 0; p < 8; p++ ) {
					var px = h.rand( 40, w - 60 );
					zaun.rect( px, base - 4, 4, hh ).fill( { color: 0x190214, alpha: 0.95 } );
				}
			}
			drawZaun();

			var pilt = new PIXI.Graphics();
			app.stage.addChild( pilt );
			function drawPilt() {
				pilt.clear();
				var w = app.renderer.width, hh = app.renderer.height;
				var top = hh * 0.04;
				pilt.poly( [
					0, top, 40, top - 6, 80, top + 4, 130, top - 12, 180, top + 2,
					240, top - 8, 300, top + 4, 360, top - 10, 420, top + 2,
					480, top - 4, 540, top, w, top - 4, w, 0, 0, 0,
				] ).fill( { color: 0x1c1228, alpha: 0.5 } );
			}
			drawPilt();

			var windowLights = new PIXI.Graphics();
			app.stage.addChild( windowLights );

			var tank = new PIXI.Graphics();
			app.stage.addChild( tank );

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

			return { bg: bg, drawBg: drawBg, zaun: zaun, drawZaun: drawZaun, zaunWindows: zaunWindows,
				pilt: pilt, drawPilt: drawPilt, windowLights: windowLights, tank: tank,
				hex: hex, hexAlpha: 0, hexOrigin: { x: w / 2, y: hh * 0.88 },
				particles: particles, bloomParticles: bloomParticles, pts: pts,
				glintLayer: glintLayer, hexT: h.rand( 60 * 12, 60 * 35 ) };
		},
		onResize: function ( state, env ) {
			state.drawBg(); state.drawZaun(); state.drawPilt();
			state.hexOrigin = { x: env.app.renderer.width / 2, y: env.app.renderer.height * 0.88 };
		},
		tick: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var t = env.app.ticker.lastTime;

			state.windowLights.clear();
			for ( var i = 0; i < state.zaunWindows.length; i++ ) {
				var wi = state.zaunWindows[ i ];
				wi.tw += 0.02 * env.dt;
				var a = wi.alpha * ( 0.7 + 0.3 * Math.sin( wi.tw ) );
				state.windowLights.rect( wi.x, wi.y, 2, 3 ).fill( { color: 0xff8c5a, alpha: a } );
			}

			state.tank.clear();
			var tankPulse = 0.55 + 0.35 * Math.sin( t * 0.002 );
			for ( var r = 8; r >= 1; r-- ) {
				state.tank.circle( w / 2, hh + 10, r * 20 )
					.fill( { color: h.lerpColor( 0xff4ab8, 0x16051a, r / 8 ), alpha: tankPulse * 0.1 } );
			}

			state.particles.clear();
			state.bloomParticles.clear();
			for ( var j = 0; j < state.pts.length; j++ ) {
				var p = state.pts[ j ];
				p.prevX = p.x + Math.sin( p.phase ) * p.amp;
				p.prevY = p.y;
				p.phase += 0.04 * env.dt;
				p.y += p.vy * env.dt;
				if ( p.y < -10 ) { p.y = hh + 20; p.x = h.rand( 0, w ); }
				var px = p.x + Math.sin( p.phase ) * p.amp;
				var prog = 1 - ( p.y / hh );
				var color = h.lerpColor( 0xff4ab8, 0xffe08a, h.clamp( prog - 0.4, 0, 1 ) * 1.4 );
				state.particles.moveTo( p.prevX, p.prevY ).lineTo( px, p.y )
					.stroke( { color: color, alpha: 0.35 + prog * 0.4, width: p.r * 0.6 } );
				state.particles.circle( px, p.y, p.r ).fill( { color: color, alpha: 0.5 + prog * 0.4 } );
				state.bloomParticles.circle( px, p.y, p.r * 3 ).fill( { color: color, alpha: 0.12 + prog * 0.18 } );
			}

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

			state.hexT -= env.dt;
			if ( state.hexT <= 0 ) {
				state.hexT = h.rand( 60 * 10, 60 * 30 );
				state.hexAlpha = 1;
				state.hexOrigin = { x: h.rand( w * 0.2, w * 0.8 ), y: hh * 0.88 };
			}
			if ( state.hexAlpha > 0 ) {
				state.hexAlpha = Math.max( 0, state.hexAlpha - 0.015 * env.dt );
				state.hex.clear();
				var HEX_R = 30, HEX_H = HEX_R * Math.sqrt( 3 );
				for ( var y = 0; y < hh + HEX_H; y += HEX_H * 0.5 ) {
					for ( var x = 0; x < w + HEX_R * 2; x += HEX_R * 1.5 ) {
						var ox = ( Math.round( y / ( HEX_H * 0.5 ) ) % 2 ) * HEX_R * 0.75;
						var cx = x + ox, cy = y;
						var dist = Math.hypot( cx - state.hexOrigin.x, cy - state.hexOrigin.y );
						var wave = Math.max( 0, 1 - Math.abs( dist - ( 1 - state.hexAlpha ) * 400 ) / 80 );
						state.hex.poly( [
							cx - HEX_R, cy,
							cx - HEX_R * 0.5, cy - HEX_H * 0.5,
							cx + HEX_R * 0.5, cy - HEX_H * 0.5,
							cx + HEX_R, cy,
							cx + HEX_R * 0.5, cy + HEX_H * 0.5,
							cx - HEX_R * 0.5, cy + HEX_H * 0.5,
						] ).stroke( { color: 0xff7ad0, alpha: state.hexAlpha * 0.35 + wave * 0.6, width: 1 } );
					}
				}
			}
		},
	};
} )();
