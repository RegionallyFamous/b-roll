/**
 * B-Roll scene: Neon Rain (Blade Runner 2049)
 * ---------------------------------------------------------------
 * Three-layer parallax city silhouette with warm window lights,
 * flickering neon signs (crisp + bloom passes), diagonal rain with
 * splashes at ground level, rare lightning flash, occasional
 * spinner-car silhouette gliding across the top.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	var SIGN_TEXTS = [ 'ATARI', 'TYRELL', 'WALLACE', 'シティ', 'NEXUS', '強化', '2049', 'JOI' ];
	var SIGN_COLORS = [ 0xff4aa0, 0xff6a3d, 0x64d8ff, 0xfff14d, 0xd65bff ];

	function drawCityLayer( g, w, hh, base, minH, maxH, color, windowOpacity, windowColor ) {
		g.clear();
		var x = 0;
		while ( x < w + 20 ) {
			var bw = h.rand( 28, 120 );
			var bh = h.rand( minH, maxH );
			g.rect( x, base - bh, bw, hh ).fill( color );
			for ( var wy = base - bh + 8; wy < hh - 4; wy += 10 ) {
				for ( var wx = x + 3; wx < x + bw - 5; wx += 7 ) {
					if ( Math.random() < windowOpacity ) {
						g.rect( wx, wy, 2.5, 3 ).fill( { color: windowColor, alpha: h.rand( 0.45, 0.95 ) } );
					}
				}
			}
			x += bw + h.rand( 1, 5 );
		}
	}

	window.__bRoll.scenes[ 'neon-rain' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;
			var w = app.renderer.width, hh = app.renderer.height;

			var bg = new PIXI.Graphics();
			app.stage.addChild( bg );
			h.paintVGradient( bg, w, hh, 0x1a0420, 0x000000, 12 );

			var lightning = new PIXI.Graphics();
			lightning.alpha = 0;
			app.stage.addChild( lightning );

			var cityFar  = new PIXI.Graphics();
			var cityMid  = new PIXI.Graphics();
			var cityNear = new PIXI.Graphics();
			app.stage.addChild( cityFar );
			app.stage.addChild( cityMid );
			app.stage.addChild( cityNear );
			function drawCity() {
				drawCityLayer( cityFar,  app.renderer.width, hh, hh * 0.68, 30, 120, 0x0c0812, 0.10, 0xff8866 );
				drawCityLayer( cityMid,  app.renderer.width, hh, hh * 0.78, 60, 200, 0x050308, 0.18, 0xffcc66 );
				drawCityLayer( cityNear, app.renderer.width, hh, hh * 0.92, 40, 160, 0x020104, 0.24, 0xffe08a );
			}
			drawCity();

			var bloom = h.makeBloomLayer( PIXI, 10 );
			app.stage.addChild( bloom );
			var bloomSigns = new PIXI.Container();
			bloom.addChild( bloomSigns );

			var signLayer = new PIXI.Container();
			app.stage.addChild( signLayer );

			var signs = [];
			for ( var i = 0; i < 6; i++ ) {
				var color = h.choose( SIGN_COLORS );
				var crisp = new PIXI.Text( {
					text: h.choose( SIGN_TEXTS ),
					style: {
						fontFamily: 'Impact, "Helvetica Neue", sans-serif',
						fontSize: h.irand( 22, 48 ),
						fill: color, letterSpacing: 2,
					},
				} );
				crisp.x = h.rand( 20, app.renderer.width - 180 );
				crisp.y = h.rand( 20, app.renderer.height * 0.5 );
				signLayer.addChild( crisp );
				var glowSign = new PIXI.Text( {
					text: crisp.text,
					style: { fontFamily: crisp.style.fontFamily, fontSize: crisp.style.fontSize, fill: color, letterSpacing: 2 },
				} );
				glowSign.x = crisp.x; glowSign.y = crisp.y;
				bloomSigns.addChild( glowSign );
				signs.push( { crisp: crisp, glow: glowSign, flickerCD: h.rand( 60, 240 ), on: true } );
			}

			var rain = new PIXI.Graphics();
			app.stage.addChild( rain );
			var DROPS = 280;
			var drops = [];
			for ( var d = 0; d < DROPS; d++ ) {
				drops.push( {
					x: h.rand( -w, w ), y: h.rand( -hh, hh ),
					len: h.rand( 10, 22 ), speed: h.rand( 7, 13 ),
					alpha: h.rand( 0.25, 0.8 ),
				} );
			}
			var splashes = [];

			var spinner = new PIXI.Graphics();
			spinner.rect( -30, -6, 60, 12 ).fill( 0x1a1a2e );
			spinner.rect( -14, -12, 28, 6 ).fill( 0x1a1a2e );
			spinner.rect( -26, -2, 6, 4 ).fill( 0xff9640 );
			spinner.rect( 20, -2, 6, 4 ).fill( 0xff9640 );
			spinner.circle( 0, 0, 3 ).fill( 0x64d8ff );
			spinner.alpha = 0;
			spinner.y = hh * 0.28; spinner.x = -80;
			app.stage.addChild( spinner );

			return {
				bg: bg, lightning: lightning, lightT: h.rand( 60 * 8, 60 * 30 ),
				cityFar: cityFar, cityMid: cityMid, cityNear: cityNear, drawCity: drawCity,
				signs: signs, rain: rain, drops: drops, splashes: splashes,
				spinner: spinner, spinnerT: h.rand( 60 * 12, 60 * 35 ),
			};
		},
		onResize: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			h.paintVGradient( state.bg, w, hh, 0x1a0420, 0x000000, 12 );
			state.drawCity();
		},
		tick: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;

			state.lightT -= env.dt;
			if ( state.lightT <= 0 && state.lightning.alpha < 0.02 ) {
				state.lightT = h.rand( 60 * 15, 60 * 60 );
				state.lightning.clear().rect( 0, 0, w, hh * 0.7 ).fill( { color: 0xe6cfff, alpha: 1 } );
				state.lightning.alpha = 1;
			}
			if ( state.lightning.alpha > 0 ) state.lightning.alpha = Math.max( 0, state.lightning.alpha - 0.09 * env.dt );

			for ( var i = 0; i < state.signs.length; i++ ) {
				var s = state.signs[ i ];
				s.flickerCD -= env.dt;
				if ( s.flickerCD <= 0 ) {
					s.on = Math.random() < 0.85;
					var a = s.on ? h.rand( 0.8, 1 ) : h.rand( 0.1, 0.4 );
					s.crisp.alpha = a; s.glow.alpha = a * 0.85;
					s.flickerCD = h.rand( 4, 140 );
				}
			}

			state.rain.clear();
			var ground = hh * 0.94;
			for ( var d = 0; d < state.drops.length; d++ ) {
				var dr = state.drops[ d ];
				dr.x += dr.speed * 0.4 * env.dt;
				dr.y += dr.speed * env.dt;
				if ( dr.y > ground ) {
					state.splashes.push( { x: dr.x, y: ground, life: 1 } );
					dr.y = h.rand( -hh * 0.5, 0 );
					dr.x = h.rand( -w * 0.2, w );
				}
				if ( dr.x > w + 20 ) dr.x -= w + 40;
				state.rain.moveTo( dr.x, dr.y )
					.lineTo( dr.x - dr.len * 0.35, dr.y - dr.len )
					.stroke( { color: 0xb4c8ff, alpha: dr.alpha, width: 1 } );
			}
			for ( var s2 = state.splashes.length - 1; s2 >= 0; s2-- ) {
				var sp = state.splashes[ s2 ];
				state.rain.circle( sp.x, sp.y, ( 1 - sp.life ) * 4 )
					.stroke( { color: 0xa8c8ff, alpha: sp.life * 0.6, width: 0.8 } );
				sp.life -= 0.08 * env.dt;
				if ( sp.life <= 0 ) state.splashes.splice( s2, 1 );
			}

			state.spinnerT -= env.dt;
			if ( state.spinnerT <= 0 && state.spinner.alpha === 0 ) {
				state.spinner.alpha = 1;
				state.spinner.x = -80;
				state.spinner.y = h.rand( hh * 0.18, hh * 0.34 );
			}
			if ( state.spinner.alpha > 0 ) {
				state.spinner.x += 3.6 * env.dt;
				if ( state.spinner.x > w + 120 ) {
					state.spinner.alpha = 0;
					state.spinnerT = h.rand( 60 * 12, 60 * 35 );
				}
			}
		},
	};
} )();
