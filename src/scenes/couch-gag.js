/**
 * B-Roll scene: Couch Gag (The Simpsons) — v0.5
 * ---------------------------------------------------------------
 * Painted backdrop (assets/wallpapers/couch-gag.jpg — Springfield-
 * blue sky with a warm yellow sun, distant rolling hills, and a
 * lush wildflower meadow) loaded as a Sprite. On top: three depth
 * tiers of flapping birds (far/mid/near) with animated wing
 * V-angles plus idle up-and-down bob, drifting clouds that subtly
 * squash and stretch as they go (scaleX wobbles ±4% at a per-cloud
 * frequency), occasional wind gusts that send faint white streaks
 * flying across the middle of the sky, soft lens-flare ghosts
 * tracking the painted sun → screen-center axis, and the couch
 * gag tableau that drops in, bounces, holds (gentle bob), and
 * fades out on a long cadence.
 *
 * The v0.4 sky gradient, Pixi sun + corona, and procedural grass
 * blades are now baked into the painting.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/couch-gag.jpg' + qs;
	}

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

	window.__bRoll.scenes[ 'couch-gag' ] = {
		setup: async function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			// Painted sky / sun / hills / meadow backdrop.
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

			// Lens-flare ghosts tracking the painted sun → screen-center axis.
			var flare = new PIXI.Graphics(); app.stage.addChild( flare );

			// Clouds.
			function makeCloud() {
				var g = new PIXI.Graphics();
				var parts = [
					[ 0, 0, 40 ], [ 34, -8, 32 ], [ 66, -2, 36 ],
					[ 96, -10, 28 ], [ 22, 8, 30 ], [ 56, 10, 32 ], [ 86, 6, 26 ],
				];
				parts.forEach( function ( p ) { g.circle( p[ 0 ], p[ 1 ], p[ 2 ] ).fill( 0xffffff ); } );
				g.alpha = 0.85;
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

			// Wind streaks (their own layer; v0.4 piggybacked on the grass).
			var windLayer = new PIXI.Graphics(); app.stage.addChild( windLayer );
			var windStreaks = [];
			var windCD = h.rand( 60 * 4, 60 * 12 );

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
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				flare: flare,
				clouds: clouds, birds: birds,
				windLayer: windLayer, windStreaks: windStreaks, windCD: windCD,
				room: room, roomT: h.rand( 60 * 15, 60 * 40 ),
				phase: 'idle',
				hold: 0, landVY: 0,
				time: 0,
			};
		},

		onResize: function ( state ) {
			state.fitBackdrop();
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.time += dt;

			// --- Lens-flare ghosts (origin = painted sun, upper center) //
			state.flare.clear();
			var sunX = w * 0.5, sunY = hh * 0.18;
			var cx = w / 2, cy = hh / 2;
			var dx = cx - sunX, dy = cy - sunY;
			var pulse = 0.85 + 0.15 * Math.sin( state.time * 0.04 );
			var ghosts = [
				{ t: 0.30, r: 14, color: 0xffb868, alpha: 0.30 },
				{ t: 0.60, r: 8,  color: 0x8abff0, alpha: 0.22 },
				{ t: 0.95, r: 22, color: 0xffde3a, alpha: 0.16 },
				{ t: 1.25, r: 10, color: 0xff6a88, alpha: 0.20 },
			];
			for ( var gi = 0; gi < ghosts.length; gi++ ) {
				var gg = ghosts[ gi ];
				var gx = sunX + dx * gg.t;
				var gy = sunY + dy * gg.t;
				state.flare.circle( gx, gy, gg.r * pulse ).fill( { color: gg.color, alpha: gg.alpha } );
			}

			// --- Clouds (drift + squash/stretch) --------------------- //
			for ( var ci = 0; ci < state.clouds.length; ci++ ) {
				var cc = state.clouds[ ci ];
				cc.node.x += cc.speed * dt;
				if ( cc.node.x > w + 140 ) cc.node.x = -140;
				var s = 1 + 0.04 * Math.sin( state.time * cc.breatheFreq + cc.breathePhase );
				cc.node.scale.x = cc.baseSx * s;
				cc.node.scale.y = cc.baseSy * ( 2 - s );
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
			state.windLayer.clear();
			for ( var si = state.windStreaks.length - 1; si >= 0; si-- ) {
				var ws = state.windStreaks[ si ];
				ws.x += ws.speed * dt;
				ws.life -= 0.012 * dt;
				if ( ws.x > w + ws.len || ws.life <= 0 ) {
					state.windStreaks.splice( si, 1 );
					continue;
				}
				state.windLayer.moveTo( ws.x, ws.y ).lineTo( ws.x - ws.len, ws.y - 1 )
					.stroke( { color: 0xffffff, alpha: ws.life * 0.55, width: 0.8 } );
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
