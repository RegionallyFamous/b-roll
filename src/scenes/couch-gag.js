/**
 * B-Roll scene: Couch Gag (The Simpsons) — v0.4
 * ---------------------------------------------------------------
 * Springfield-blue sky with a pulsing sun + lens-flare ghost spots
 * along the sun→screen-center axis. Three depth tiers of flapping
 * birds (far/mid/near) with animated wing V-angles plus idle
 * up-and-down bob. Clouds now subtly squash and stretch as they
 * drift — scaleX wobbles ±4% at a per-cloud frequency so they
 * breathe instead of sliding rigidly.
 *
 * A wind-swayed grass strip runs across the bottom, each blade
 * with its own sway phase and wind coupling, and occasional wind
 * gusts send a set of faint white streaks flying across the
 * middle of the sky.
 *
 * Couch gag timeline keeps the drop-in tableau but now the room
 * overshoots and bounces on landing, and during the "hold" phase
 * the whole room bobs subtly on a ~3s cycle so it never feels
 * static.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	function drawBird( g, wingT, size ) {
		g.clear();
		var wy = -2 - 1.6 * Math.sin( wingT );
		g.moveTo( -4 * size, 0 )
			.lineTo( 0, wy * size )
			.lineTo( 4 * size, 0 )
			.lineTo( 8 * size, wy * size )
			.lineTo( 12 * size, 0 )
			.stroke( { color: 0x000000, width: 0.9 * size } );
	}

	function drawGrass( g, blades, time ) {
		g.clear();
		for ( var i = 0; i < blades.length; i++ ) {
			var b = blades[ i ];
			var sway = Math.sin( time * b.freq + b.phase ) * b.amp;
			g.moveTo( b.x, b.rootY )
				.bezierCurveTo(
					b.x + sway * 0.4, b.rootY - b.h * 0.5,
					b.x + sway * 0.7, b.rootY - b.h * 0.75,
					b.x + sway, b.rootY - b.h,
				)
				.stroke( { color: b.color, width: b.w } );
		}
	}

	window.__bRoll.scenes[ 'couch-gag' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			var bg = new PIXI.Graphics(); app.stage.addChild( bg );
			h.paintVGradient( bg, app.renderer.width, app.renderer.height, 0x7ab9f0, 0xdaefff, 14 );

			var sunCorona = new PIXI.Graphics(); app.stage.addChild( sunCorona );
			var sun       = new PIXI.Graphics(); app.stage.addChild( sun );
			var flare     = new PIXI.Graphics(); app.stage.addChild( flare );

			function drawSun() {
				sun.clear();
				sun.circle( 0, 0, 28 ).fill( { color: 0xfff2a6, alpha: 0.85 } );
				sun.circle( 0, 0, 22 ).fill( 0xffde3a );
			}
			drawSun();
			sun.x = app.renderer.width - 80;
			sun.y = 80;
			sunCorona.x = sun.x; sunCorona.y = sun.y;

			// Clouds.
			function makeCloud() {
				var g = new PIXI.Graphics();
				var parts = [
					[ 0, 0, 40 ], [ 34, -8, 32 ], [ 66, -2, 36 ],
					[ 96, -10, 28 ], [ 22, 8, 30 ], [ 56, 10, 32 ], [ 86, 6, 26 ],
				];
				parts.forEach( function ( p ) { g.circle( p[ 0 ], p[ 1 ], p[ 2 ] ).fill( 0xffffff ); } );
				g.alpha = 0.96;
				return g;
			}
			var clouds = [];
			for ( var i = 0; i < 9; i++ ) {
				var c = makeCloud();
				var sc = h.rand( 0.4, 1.1 );
				c.scale.set( sc );
				c.x = h.rand( 0, app.renderer.width );
				c.y = h.rand( 30, app.renderer.height * 0.55 );
				app.stage.addChild( c );
				clouds.push( {
					node: c,
					speed: h.rand( 0.1, 0.35 ) / ( sc + 0.2 ),
					baseSx: sc, baseSy: sc,
					breatheFreq: h.rand( 0.01, 0.03 ),
					breathePhase: h.rand( 0, h.tau ),
				} );
			}

			// Birds across 3 depths.
			var birdLayers = [
				{ scale: 0.6, count: 5, speed: 0.25, yMin: 0.10, yMax: 0.30, flapFreq: 0.22 },
				{ scale: 1.0, count: 3, speed: 0.45, yMin: 0.18, yMax: 0.38, flapFreq: 0.18 },
				{ scale: 1.5, count: 2, speed: 0.70, yMin: 0.22, yMax: 0.42, flapFreq: 0.14 },
			];
			var birds = [];
			birdLayers.forEach( function ( L ) {
				for ( var b = 0; b < L.count; b++ ) {
					var node = new PIXI.Graphics();
					node.x = h.rand( -40, app.renderer.width );
					node.y = h.rand( app.renderer.height * L.yMin, app.renderer.height * L.yMax );
					app.stage.addChild( node );
					birds.push( {
						node: node,
						speed: L.speed,
						scale: L.scale,
						flapFreq: L.flapFreq,
						flapPhase: h.rand( 0, h.tau ),
						bobPhase: h.rand( 0, h.tau ),
					} );
				}
			} );

			// Wind gust streaks.
			var windStreaks = [];
			var windCD = h.rand( 60 * 4, 60 * 12 );

			// Grass strip (near bottom).
			var grassLayer = new PIXI.Graphics(); app.stage.addChild( grassLayer );
			var blades = [];
			function rebuildGrass() {
				var w = app.renderer.width, hh = app.renderer.height;
				blades = [];
				for ( var bx = -10; bx < w + 10; bx += 6 ) {
					blades.push( {
						x: bx + h.rand( -1.5, 1.5 ),
						rootY: hh - 2,
						h: h.rand( 10, 22 ),
						w: h.rand( 0.7, 1.4 ),
						color: h.choose( [ 0x3a9e3a, 0x44b842, 0x2f8a35, 0x4ac84e ] ),
						freq: h.rand( 0.04, 0.12 ),
						phase: h.rand( 0, h.tau ),
						amp: h.rand( 0.8, 2.4 ),
					} );
				}
			}
			rebuildGrass();

			// Couch room (unchanged structure, drops in periodically).
			var room = new PIXI.Container();
			room.alpha = 0;
			app.stage.addChild( room );

			var wall = new PIXI.Graphics();
			wall.rect( 0, 0, 360, 150 ).fill( 0x7c62a4 );
			room.addChild( wall );
			var floor = new PIXI.Graphics();
			floor.rect( 0, 150, 360, 80 ).fill( 0xe7c148 );
			room.addChild( floor );
			var windowFrame = new PIXI.Graphics();
			windowFrame.rect( 20, 20, 70, 50 ).fill( 0x9ec3ff );
			windowFrame.rect( 54, 20, 2, 50 ).fill( 0x7c62a4 );
			windowFrame.rect( 20, 43, 70, 2 ).fill( 0x7c62a4 );
			room.addChild( windowFrame );
			var tv = new PIXI.Graphics();
			tv.rect( -30, 70, 50, 40 ).fill( 0x2e2215 );
			tv.rect( -24, 76, 38, 28 ).fill( 0xc8d8d8 );
			tv.rect( -18, 110, 26, 4 ).fill( 0x1a1208 );
			room.addChild( tv );
			var lamp = new PIXI.Graphics();
			lamp.moveTo( 250, 110 ).lineTo( 260, 80 ).lineTo( 290, 80 ).lineTo( 300, 110 ).lineTo( 250, 110 )
				.fill( 0xf0a030 );
			lamp.rect( 273, 110, 4, 30 ).fill( 0x4a2c10 );
			lamp.rect( 258, 140, 34, 4 ).fill( 0x4a2c10 );
			room.addChild( lamp );
			var couch = new PIXI.Graphics();
			couch.roundRect( 90, 90, 160, 54, 8 ).fill( 0xc36a1e );
			couch.roundRect( 98, 78, 42, 24, 5 ).fill( 0xe2894a );
			couch.roundRect( 146, 78, 42, 24, 5 ).fill( 0xe2894a );
			couch.roundRect( 194, 78, 42, 24, 5 ).fill( 0xe2894a );
			couch.roundRect( 82, 90, 14, 54, 5 ).fill( 0x8a4812 );
			couch.roundRect( 244, 90, 14, 54, 5 ).fill( 0x8a4812 );
			couch.rect( 96, 144, 6, 8 ).fill( 0x3d1e08 );
			couch.rect( 238, 144, 6, 8 ).fill( 0x3d1e08 );
			room.addChild( couch );
			room.pivot.set( 180, 115 );

			return {
				bg: bg, sun: sun, sunCorona: sunCorona, flare: flare,
				clouds: clouds, birds: birds,
				grassLayer: grassLayer, blades: blades, rebuildGrass: rebuildGrass,
				windStreaks: windStreaks, windCD: windCD,
				room: room, roomT: h.rand( 60 * 15, 60 * 40 ),
				phase: 'idle',
				hold: 0, landVY: 0,
				time: 0,
			};
		},

		onResize: function ( state, env ) {
			h.paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x7ab9f0, 0xdaefff, 14 );
			state.sun.x = env.app.renderer.width - 80;
			state.sunCorona.x = state.sun.x; state.sunCorona.y = state.sun.y;
			state.rebuildGrass();
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.time += dt;

			// --- Sun corona pulse + lens flare ghosts ---------------- //
			var pulse = 0.8 + 0.2 * Math.sin( state.time * 0.04 );
			state.sunCorona.clear();
			state.sunCorona.circle( 0, 0, 40 * pulse ).fill( { color: 0xfff2a6, alpha: 0.28 } );
			state.sunCorona.circle( 0, 0, 60 * pulse ).fill( { color: 0xffde3a, alpha: 0.12 } );
			state.sunCorona.circle( 0, 0, 90 * pulse ).fill( { color: 0xffde3a, alpha: 0.05 } );

			state.flare.clear();
			var cx = w / 2, cy = hh / 2;
			var dx = cx - state.sun.x, dy = cy - state.sun.y;
			var ghosts = [
				{ t: 0.30, r: 14, color: 0xffb868, alpha: 0.35 },
				{ t: 0.60, r: 8,  color: 0x8abff0, alpha: 0.25 },
				{ t: 0.95, r: 22, color: 0xffde3a, alpha: 0.18 },
				{ t: 1.25, r: 10, color: 0xff6a88, alpha: 0.22 },
			];
			for ( var gi = 0; gi < ghosts.length; gi++ ) {
				var gg = ghosts[ gi ];
				var gx = state.sun.x + dx * gg.t;
				var gy = state.sun.y + dy * gg.t;
				state.flare.circle( gx, gy, gg.r ).fill( { color: gg.color, alpha: gg.alpha } );
			}

			// --- Clouds (drift + squash/stretch) --------------------- //
			for ( var ci = 0; ci < state.clouds.length; ci++ ) {
				var cc = state.clouds[ ci ];
				cc.node.x += cc.speed * dt;
				if ( cc.node.x > w + 140 ) cc.node.x = -140;
				var s = 1 + 0.04 * Math.sin( state.time * cc.breatheFreq + cc.breathePhase );
				cc.node.scale.x = cc.baseSx * s;
				cc.node.scale.y = cc.baseSy * ( 2 - s ); // conserves mass a bit
			}

			// --- Birds (flap + bob + wrap) --------------------------- //
			for ( var bi = 0; bi < state.birds.length; bi++ ) {
				var br = state.birds[ bi ];
				br.flapPhase += br.flapFreq * dt;
				br.bobPhase  += 0.03 * dt;
				br.node.x += br.speed * dt;
				br.node.y += Math.sin( br.bobPhase ) * 0.12;
				if ( br.node.x > w + 40 ) {
					br.node.x = -40;
					br.node.y = h.rand( hh * 0.1, hh * 0.42 );
				}
				drawBird( br.node, br.flapPhase, br.scale );
			}

			// --- Wind gust streaks ----------------------------------- //
			state.windCD -= dt;
			if ( state.windCD <= 0 ) {
				state.windCD = h.rand( 60 * 4, 60 * 12 );
				var yCenter = h.rand( hh * 0.15, hh * 0.55 );
				var lineCount = h.irand( 3, 6 );
				for ( var wi = 0; wi < lineCount; wi++ ) {
					state.windStreaks.push( {
						x: -40,
						y: yCenter + ( wi - lineCount / 2 ) * 6,
						speed: h.rand( 8, 16 ),
						len: h.rand( 20, 60 ),
						life: 1,
					} );
				}
			}
			// Draw wind streaks directly onto the grass layer's Graphics (reuse).
			for ( var si = state.windStreaks.length - 1; si >= 0; si-- ) {
				var ws = state.windStreaks[ si ];
				ws.x += ws.speed * dt;
				ws.life -= 0.012 * dt;
				if ( ws.x > w + ws.len || ws.life <= 0 ) state.windStreaks.splice( si, 1 );
			}

			// --- Grass + wind streaks draw -------------------------- //
			drawGrass( state.grassLayer, state.blades, state.time );
			for ( var sj = 0; sj < state.windStreaks.length; sj++ ) {
				var wsj = state.windStreaks[ sj ];
				state.grassLayer.moveTo( wsj.x, wsj.y ).lineTo( wsj.x - wsj.len, wsj.y - 1 )
					.stroke( { color: 0xffffff, alpha: wsj.life * 0.55, width: 0.8 } );
			}

			// --- Couch drop + hold + bounce ------------------------- //
			state.roomT -= dt;
			if ( state.phase === 'idle' && state.roomT <= 0 ) {
				state.phase = 'drop';
				state.room.x = h.rand( w * 0.3, w * 0.7 );
				state.room.y = -200;
				state.room.scale.set( h.rand( 0.8, 1.1 ) );
				state.room.alpha = 0;
				state.landVY = 12;
			}
			if ( state.phase === 'drop' ) {
				state.room.alpha = Math.min( 1, state.room.alpha + 0.06 * dt );
				state.room.y += state.landVY * dt;
				state.landVY += 0.55 * dt;
				if ( state.room.y >= hh * 0.55 ) {
					state.room.y = hh * 0.55;
					state.phase = 'bounce';
					state.landVY = -state.landVY * 0.45;
				}
			} else if ( state.phase === 'bounce' ) {
				state.room.y += state.landVY * dt;
				state.landVY += 0.55 * dt;
				if ( state.room.y >= hh * 0.55 && state.landVY > 0 ) {
					state.room.y = hh * 0.55;
					if ( Math.abs( state.landVY ) < 2 ) {
						state.phase = 'hold'; state.hold = 600;
					} else {
						state.landVY = -state.landVY * 0.4;
					}
				}
			} else if ( state.phase === 'hold' ) {
				state.hold -= dt;
				// Gentle sit-bounce: room bobs on a ~8s cycle during hold.
				state.room.y = hh * 0.55 + Math.sin( state.time * 0.012 ) * 2.4
					+ Math.sin( state.time * 0.028 ) * 0.6;
				if ( state.hold <= 0 ) state.phase = 'out';
			} else if ( state.phase === 'out' ) {
				state.room.alpha -= 0.03 * dt;
				if ( state.room.alpha <= 0 ) {
					state.phase = 'idle';
					state.roomT = h.rand( 60 * 35, 60 * 90 );
				}
			}
		},
	};
} )();
