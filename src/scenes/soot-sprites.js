/**
 * B-Roll scene: Soot Sprites (Studio Ghibli)
 * ---------------------------------------------------------------
 * Pastel sky with fluffy soot-sprite blobs of varied size. Candy
 * star-shapes occasionally fall; the nearest sprites sense them
 * and drift toward them to huddle.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	window.__bRoll.scenes[ 'soot-sprites' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			var bg = new PIXI.Graphics();
			app.stage.addChild( bg );
			h.paintVGradient( bg, app.renderer.width, app.renderer.height, 0xffd7ea, 0xcce7ff, 20 );

			var spriteLayer = new PIXI.Container();
			app.stage.addChild( spriteLayer );

			function makeSoot( scaleHint ) {
				var c = new PIXI.Container();
				var base = new PIXI.Graphics();
				base.circle( 0, 0, 18 ).fill( 0x161616 );
				for ( var k = 0; k < 18; k++ ) {
					var a = ( k / 18 ) * h.tau + h.rand( -0.1, 0.1 );
					var rr = 18 + h.rand( 2, 8 );
					base.circle( Math.cos( a ) * rr, Math.sin( a ) * rr, h.rand( 2, 5 ) ).fill( 0x161616 );
				}
				var shadow = new PIXI.Graphics();
				shadow.ellipse( 0, 22, 18, 4 ).fill( { color: 0x000000, alpha: 0.15 } );
				c.addChild( shadow );
				c.addChild( base );
				var leye = new PIXI.Graphics(); leye.circle( -5, -2, 2.4 ).fill( 0xffffff );
				var reye = new PIXI.Graphics(); reye.circle(  5, -2, 2.4 ).fill( 0xffffff );
				leye.visible = reye.visible = false;
				c.addChild( leye ); c.addChild( reye );
				c.scale.set( scaleHint );
				return { node: c, leye: leye, reye: reye };
			}

			var sprites = [];
			for ( var i = 0; i < 26; i++ ) {
				var s = makeSoot( h.rand( 0.5, 1.35 ) );
				s.node.x = h.rand( 0, app.renderer.width );
				s.node.y = h.rand( 0, app.renderer.height );
				spriteLayer.addChild( s.node );
				sprites.push( Object.assign( s, {
					baseY: s.node.y, phase: Math.random() * h.tau,
					amp: h.rand( 8, 35 ), vx: h.rand( -0.3, 0.3 ),
					blinkCD: h.rand( 60 * 3, 60 * 14 ), blinkT: 0,
					attractTo: null,
				} ) );
			}

			var candies = [];
			function makeCandy( x, y ) {
				var g = new PIXI.Graphics();
				var r1 = 6, r2 = 2.5;
				var pts = [];
				for ( var i = 0; i < 10; i++ ) {
					var a = ( i / 10 ) * h.tau - Math.PI / 2;
					var r = i % 2 === 0 ? r1 : r2;
					pts.push( Math.cos( a ) * r, Math.sin( a ) * r );
				}
				g.poly( pts ).fill( h.choose( [ 0xffe04a, 0xff8cc6, 0x8ae0ff, 0x9fff9a ] ) );
				g.x = x; g.y = y;
				app.stage.addChild( g );
				return { node: g, vy: 0.3, spin: h.rand( -0.02, 0.02 ), life: 1 };
			}

			return { bg: bg, sprites: sprites, candies: candies, makeCandy: makeCandy,
				candyT: h.rand( 60 * 15, 60 * 40 ) };
		},
		onResize: function ( state, env ) {
			h.paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0xffd7ea, 0xcce7ff, 20 );
		},
		tick: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;

			state.candyT -= env.dt;
			if ( state.candyT <= 0 ) {
				state.candyT = h.rand( 60 * 25, 60 * 60 );
				state.candies.push( state.makeCandy( h.rand( 60, w - 60 ), -10 ) );
			}
			for ( var cI = state.candies.length - 1; cI >= 0; cI-- ) {
				var cc = state.candies[ cI ];
				cc.node.y += cc.vy * env.dt;
				cc.node.rotation += cc.spin * env.dt;
				if ( cc.node.y > hh * 0.75 ) {
					cc.life -= 0.005 * env.dt;
					if ( cc.life <= 0 ) { cc.node.destroy(); state.candies.splice( cI, 1 ); continue; }
				}
				cc.node.alpha = cc.life;
			}

			for ( var i = 0; i < state.sprites.length; i++ ) {
				var s = state.sprites[ i ];
				s.attractTo = null;
				var closest = Infinity;
				for ( var cI2 = 0; cI2 < state.candies.length; cI2++ ) {
					var ca = state.candies[ cI2 ];
					var dx = ca.node.x - s.node.x, dy = ca.node.y - s.node.y;
					var d2 = dx * dx + dy * dy;
					if ( d2 < 24000 && d2 < closest ) { closest = d2; s.attractTo = ca; }
				}

				s.phase += 0.02 * env.dt;
				if ( s.attractTo ) {
					var dx2 = s.attractTo.node.x - s.node.x;
					var dy2 = s.attractTo.node.y - s.node.y;
					s.node.x += dx2 * 0.015 * env.dt;
					s.node.y += dy2 * 0.015 * env.dt;
				} else {
					s.node.y = s.baseY + Math.sin( s.phase ) * s.amp;
					s.node.x += s.vx * env.dt;
					if ( s.node.x < -40 ) s.node.x = w + 40;
					if ( s.node.x > w + 40 ) s.node.x = -40;
				}

				s.blinkCD -= env.dt;
				if ( s.blinkCD <= 0 && s.blinkT === 0 ) {
					s.blinkT = 14;
					s.leye.visible = s.reye.visible = true;
				}
				if ( s.blinkT > 0 ) {
					s.blinkT -= env.dt;
					if ( s.blinkT <= 0 ) {
						s.leye.visible = s.reye.visible = false;
						s.blinkCD = h.rand( 60 * 4, 60 * 16 );
					}
				}
			}
		},
	};
} )();
