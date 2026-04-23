/**
 * B-Roll scene: The Upside Down (Stranger Things)
 * ---------------------------------------------------------------
 * Red-violet murk with bezier-curve tendrils creeping from edges,
 * spiraling spores, CRT scanlines, occasional crackling red
 * lightning strike, and a 3-channel chromatic glitch title card.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	var CHAPTERS = [ 'CHAPTER ONE', 'CHAPTER TWO', 'CHAPTER SIX', 'VECNA', 'HAWKINS', 'THE MIND FLAYER' ];

	window.__bRoll.scenes[ 'upside-down' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;
			var w = app.renderer.width, hh = app.renderer.height;

			var bg = new PIXI.Graphics();
			app.stage.addChild( bg );
			function drawBg() {
				bg.clear();
				var w = app.renderer.width, hh = app.renderer.height;
				for ( var i = 0; i < 22; i++ ) {
					var t = i / 21;
					var c = h.lerpColor( 0x4a0a20, 0x050007, Math.abs( t - 0.35 ) * 1.4 );
					bg.rect( 0, ( i * hh ) / 22, w, hh / 22 + 1 ).fill( c );
				}
			}
			drawBg();

			var veil = new PIXI.Graphics();
			app.stage.addChild( veil );

			var tendrils = new PIXI.Graphics();
			app.stage.addChild( tendrils );

			var sporeLayer = new PIXI.Graphics();
			app.stage.addChild( sporeLayer );

			var SPORE_N = 130;
			var spores = [];
			for ( var i = 0; i < SPORE_N; i++ ) {
				spores.push( {
					x: h.rand( 0, w ), y: h.rand( 0, hh ),
					r: h.rand( 1.2, 3.2 ),
					vy: -h.rand( 0.1, 0.6 ), phase: Math.random() * h.tau,
					spin: h.rand( 0.01, 0.05 ),
				} );
			}

			var scan = new PIXI.Graphics();
			scan.alpha = 0.08;
			app.stage.addChild( scan );
			function drawScan() {
				scan.clear();
				var w = app.renderer.width, hh = app.renderer.height;
				for ( var y = 0; y < hh; y += 3 ) scan.rect( 0, y, w, 1 ).fill( 0x000000 );
			}
			drawScan();

			var card = new PIXI.Container();
			var tR = new PIXI.Text( {
				text: h.choose( CHAPTERS ),
				style: { fontFamily: 'Georgia,serif', fontSize: 44, fill: 0xff2420, letterSpacing: 3, fontStyle: 'italic' },
			} );
			var tG = new PIXI.Text( { text: tR.text, style: Object.assign( {}, tR.style, { fill: 0x00ffaa } ) } );
			var tB = new PIXI.Text( { text: tR.text, style: Object.assign( {}, tR.style, { fill: 0x64e0ff } ) } );
			tR.anchor.set( 0.5 ); tG.anchor.set( 0.5 ); tB.anchor.set( 0.5 );
			card.addChild( tB ); card.addChild( tG ); card.addChild( tR );
			card.alpha = 0;
			card.x = w / 2; card.y = hh * 0.45;
			app.stage.addChild( card );

			return { bg: bg, drawBg: drawBg, veil: veil, tendrils: tendrils,
				sporeLayer: sporeLayer, spores: spores, scan: scan, drawScan: drawScan,
				card: card, tR: tR, tG: tG, tB: tB,
				cardT: h.rand( 60 * 30, 60 * 75 ), phase: 'idle', hold: 0,
				lightT: h.rand( 60 * 10, 60 * 25 ), lightLife: 0 };
		},
		onResize: function ( state, env ) {
			state.drawBg();
			state.drawScan();
			state.card.x = env.app.renderer.width / 2;
			state.card.y = env.app.renderer.height * 0.45;
		},
		tick: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var time = env.app.ticker.lastTime;

			state.sporeLayer.clear();
			for ( var s = 0; s < state.spores.length; s++ ) {
				var sp = state.spores[ s ];
				sp.phase += sp.spin * env.dt;
				sp.y += sp.vy * env.dt;
				var px = sp.x + Math.sin( sp.phase * 2 ) * 8;
				if ( sp.y < -10 ) { sp.y = hh + 10; sp.x = h.rand( 0, w ); }
				state.sporeLayer.circle( px, sp.y, sp.r ).fill( { color: 0xffccdd, alpha: 0.85 } );
				state.sporeLayer.circle( px, sp.y, sp.r * 2.4 ).fill( { color: 0xffccdd, alpha: 0.1 } );
			}

			state.tendrils.clear();
			function drawTendril( x0, y0, x1, y1, cpx, cpy, alpha ) {
				state.tendrils.moveTo( x0, y0 )
					.quadraticCurveTo( cpx, cpy, x1, y1 )
					.stroke( { color: 0x3a0614, width: 1, alpha: alpha } );
			}
			var wob = Math.sin( time * 0.0008 ) * 8;
			drawTendril( 0, 20,              40, 80 + wob,              20 + wob, 40,           0.6 );
			drawTendril( w, 40,              w - 60, 100 - wob,         w - 40, 70 + wob,        0.6 );
			drawTendril( 0, hh - 40,         80, hh - 100 + wob,        40, hh - 70 + wob,       0.5 );
			drawTendril( w, hh - 50,         w - 80, hh - 80 - wob,     w - 40, hh - 70 - wob,   0.55 );
			drawTendril( w / 2, 0,           w / 2 + wob, 60 + wob,     w / 2 + 40, 30,          0.4 );

			state.lightT -= env.dt;
			if ( state.lightT <= 0 && state.lightLife <= 0 ) {
				state.lightT = h.rand( 60 * 8, 60 * 25 );
				state.lightLife = 1;
			}
			state.veil.clear();
			if ( state.lightLife > 0 ) {
				state.lightLife -= 0.05 * env.dt;
				var steps = 12;
				var startX = h.rand( 0, w );
				var y = 0, x = startX;
				for ( var i2 = 0; i2 < steps; i2++ ) {
					var nx = x + h.rand( -30, 30 );
					var ny = y + ( hh * 0.35 ) / steps;
					state.veil.moveTo( x, y ).lineTo( nx, ny )
						.stroke( { color: 0xff3322, alpha: state.lightLife * 0.95, width: 1.2 } );
					state.veil.moveTo( x, y ).lineTo( nx, ny )
						.stroke( { color: 0xff8855, alpha: state.lightLife * 0.5, width: 3 } );
					x = nx; y = ny;
				}
			}

			state.cardT -= env.dt;
			if ( state.phase === 'idle' && state.cardT <= 0 ) {
				state.phase = 'in';
				var ch = h.choose( CHAPTERS );
				state.tR.text = ch; state.tG.text = ch; state.tB.text = ch;
			}
			if ( state.phase === 'in' ) {
				state.card.alpha = Math.min( 1, state.card.alpha + 0.04 * env.dt );
				var off = Math.random() < 0.1 ? h.rand( -6, 6 ) : 0;
				state.tR.x = -off * 1.2; state.tG.x = 0; state.tB.x = off * 1.2;
				state.card.x = env.app.renderer.width / 2 + h.rand( -2, 2 );
				if ( state.card.alpha >= 1 ) { state.phase = 'hold'; state.hold = 80; }
			} else if ( state.phase === 'hold' ) {
				state.hold -= env.dt;
				state.card.x = env.app.renderer.width / 2 + ( Math.random() < 0.05 ? h.rand( -8, 8 ) : 0 );
				state.tR.x = Math.random() < 0.1 ? h.rand( -3, 3 ) : 0;
				state.tB.x = -state.tR.x;
				if ( state.hold <= 0 ) state.phase = 'out';
			} else if ( state.phase === 'out' ) {
				state.card.alpha -= 0.03 * env.dt;
				if ( state.card.alpha <= 0 ) { state.phase = 'idle'; state.cardT = h.rand( 60 * 45, 60 * 110 ); }
			}
		},
	};
} )();
