/**
 * B-Roll scene: Couch Gag (The Simpsons)
 * ---------------------------------------------------------------
 * Springfield-blue sky with sun + clouds + flying birds. When the
 * gag fires, a full living-room tableau drops in from above:
 * purple wall, yellow floor, TV on stand, lamp, window, couch.
 * Holds, then fades out.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	window.__bRoll.scenes[ 'couch-gag' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			var bg = new PIXI.Graphics();
			app.stage.addChild( bg );
			h.paintVGradient( bg, app.renderer.width, app.renderer.height, 0x7ab9f0, 0xdaefff, 12 );

			var sun = new PIXI.Graphics();
			sun.circle( 0, 0, 28 ).fill( { color: 0xfff2a6, alpha: 0.85 } );
			sun.circle( 0, 0, 22 ).fill( 0xffde3a );
			sun.x = app.renderer.width - 80;
			sun.y = 80;
			app.stage.addChild( sun );

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
				c.scale.set( h.rand( 0.4, 1.1 ) );
				c.x = h.rand( 0, app.renderer.width );
				c.y = h.rand( 30, app.renderer.height * 0.55 );
				app.stage.addChild( c );
				clouds.push( { node: c, speed: h.rand( 0.1, 0.35 ) / ( c.scale.x + 0.2 ) } );
			}

			var birds = [];
			for ( var b = 0; b < 3; b++ ) {
				var bg2 = new PIXI.Graphics();
				bg2.moveTo( -4, 0 ).lineTo( 0, -2 ).lineTo( 4, 0 ).lineTo( 8, -2 ).lineTo( 12, 0 )
					.stroke( { color: 0x000000, width: 1.2 } );
				bg2.x = h.rand( -40, app.renderer.width );
				bg2.y = h.rand( 40, app.renderer.height * 0.35 );
				app.stage.addChild( bg2 );
				birds.push( { node: bg2, speed: h.rand( 0.3, 0.7 ), phase: Math.random() * h.tau } );
			}

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

			return { bg: bg, sun: sun, clouds: clouds, birds: birds,
				room: room, roomT: h.rand( 60 * 15, 60 * 40 ), phase: 'idle', hold: 0 };
		},
		onResize: function ( state, env ) {
			h.paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x7ab9f0, 0xdaefff, 12 );
			state.sun.x = env.app.renderer.width - 80;
		},
		tick: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;

			for ( var i = 0; i < state.clouds.length; i++ ) {
				var c = state.clouds[ i ];
				c.node.x += c.speed * env.dt;
				if ( c.node.x > w + 140 ) c.node.x = -140;
			}
			for ( var b = 0; b < state.birds.length; b++ ) {
				var br = state.birds[ b ];
				br.phase += 0.05 * env.dt;
				br.node.x += br.speed * env.dt;
				br.node.y += Math.sin( br.phase ) * 0.2;
				if ( br.node.x > w + 40 ) { br.node.x = -40; br.node.y = h.rand( 40, hh * 0.35 ); }
			}

			state.roomT -= env.dt;
			if ( state.phase === 'idle' && state.roomT <= 0 ) {
				state.phase = 'drop';
				state.room.x = h.rand( w * 0.3, w * 0.7 );
				state.room.y = -200;
				state.room.scale.set( h.rand( 0.8, 1.1 ) );
				state.room.alpha = 0;
			}
			if ( state.phase === 'drop' ) {
				state.room.alpha = Math.min( 1, state.room.alpha + 0.06 * env.dt );
				state.room.y += ( hh * 0.55 - state.room.y ) * 0.1 * env.dt;
				if ( Math.abs( state.room.y - hh * 0.55 ) < 3 ) { state.phase = 'hold'; state.hold = 180; }
			} else if ( state.phase === 'hold' ) {
				state.hold -= env.dt;
				if ( state.hold <= 0 ) state.phase = 'out';
			} else if ( state.phase === 'out' ) {
				state.room.alpha -= 0.03 * env.dt;
				if ( state.room.alpha <= 0 ) { state.phase = 'idle'; state.roomT = h.rand( 60 * 35, 60 * 90 ); }
			}
		},
	};
} )();
