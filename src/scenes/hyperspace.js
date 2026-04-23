/**
 * B-Roll scene: Hyperspace (Star Wars)
 * ---------------------------------------------------------------
 * 3D-parallax starfield stretched into radial lines from centre.
 * Near stars are wider and brighter with lead dots; far stars are
 * thin. A pulsing blue warp-glow sits at centre. Cinematic warp
 * flash every 20–40 seconds.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	window.__bRoll.scenes[ 'hyperspace' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			var bg = new PIXI.Graphics();
			app.stage.addChild( bg );
			var glow = new PIXI.Graphics();
			app.stage.addChild( glow );
			var linesFar = new PIXI.Graphics();
			var linesNear = new PIXI.Graphics();
			app.stage.addChild( linesFar );
			app.stage.addChild( linesNear );

			var bloom = h.makeBloomLayer( PIXI, 8 );
			var bloomGlow = new PIXI.Graphics();
			bloom.addChild( bloomGlow );
			app.stage.addChild( bloom );

			var flash = new PIXI.Graphics();
			flash.alpha = 0;
			app.stage.addChild( flash );

			function drawBg() {
				var w = app.renderer.width, hh = app.renderer.height;
				h.paintVGradient( bg, w, hh, 0x000010, 0x000000, 8 );
				var cx = w / 2, cy = hh / 2;
				var R = Math.min( w, hh ) * 0.35;
				glow.clear();
				for ( var i = 14; i >= 0; i-- ) {
					var t = i / 14;
					glow.circle( cx, cy, R * ( i + 1 ) / 14 )
						.fill( { color: h.lerpColor( 0x000000, 0x183c7a, 1 - t ), alpha: 0.08 * ( 1 - t ) + 0.01 } );
				}
			}
			drawBg();

			var NUM = 340;
			var stars = [];
			function spawn( s ) {
				s.angle = Math.random() * h.tau;
				s.r = h.rand( 6, 40 );
				s.depth = h.rand( 0.3, 1 );
				s.speed = h.rand( 0.35, 1.8 ) * s.depth;
				s.tint = h.lerpColor( 0x88ccff, 0xffffff, Math.random() );
			}
			for ( var i = 0; i < NUM; i++ ) {
				var s = {};
				spawn( s );
				s.r = h.rand( 10, Math.min( app.renderer.width, app.renderer.height ) * 0.6 );
				stars.push( s );
			}

			return { bg: bg, glow: glow, drawBg: drawBg, linesFar: linesFar, linesNear: linesNear,
				bloomGlow: bloomGlow, flash: flash, stars: stars, spawn: spawn,
				tFlash: 60 * h.rand( 18, 30 ) };
		},
		onResize: function ( state ) { state.drawBg(); },
		tick: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var cx = w / 2, cy = hh / 2;
			var maxR = Math.sqrt( cx * cx + cy * cy );

			state.bloomGlow.clear();
			var pulse = 0.55 + 0.25 * Math.sin( env.app.ticker.lastTime * 0.002 );
			state.bloomGlow.circle( cx, cy, maxR * 0.11 ).fill( { color: 0x4a82ff, alpha: pulse } );
			state.bloomGlow.circle( cx, cy, maxR * 0.18 ).fill( { color: 0x183c7a, alpha: pulse * 0.55 } );

			state.linesFar.clear();
			state.linesNear.clear();

			for ( var i = 0; i < state.stars.length; i++ ) {
				var s = state.stars[ i ];
				var prevR = s.r;
				s.r += ( 0.5 + s.speed * 6 ) * env.dt;
				if ( s.r > maxR ) { state.spawn( s ); continue; }
				var cos = Math.cos( s.angle ), sin = Math.sin( s.angle );
				var x0 = cx + cos * prevR, y0 = cy + sin * prevR;
				var x1 = cx + cos * s.r, y1 = cy + sin * s.r;
				var prog = s.r / maxR;
				var alpha = h.clamp( ( prog - 0.05 ) * 1.3, 0, 1 );
				var width = 0.5 + s.depth * 2.0 * prog;
				var layer = s.depth > 0.65 ? state.linesNear : state.linesFar;
				layer.moveTo( x0, y0 ).lineTo( x1, y1 )
					.stroke( { color: s.tint, alpha: alpha, width: width } );
				if ( s.depth > 0.65 && prog > 0.3 ) {
					state.linesNear.circle( x1, y1, width * 0.9 ).fill( { color: 0xffffff, alpha: alpha } );
				}
			}

			state.tFlash -= env.dt;
			if ( state.tFlash <= 0 && state.flash.alpha < 0.02 ) {
				state.tFlash = 60 * h.rand( 18, 35 );
				state.flash.clear().rect( 0, 0, w, hh ).fill( 0xdbe8ff );
				state.flash.alpha = 1;
				for ( var k = 0; k < state.stars.length; k++ ) state.stars[ k ].r += h.rand( 40, 180 );
			}
			if ( state.flash.alpha > 0 ) state.flash.alpha = Math.max( 0, state.flash.alpha - 0.05 * env.dt );
		},
	};
} )();
