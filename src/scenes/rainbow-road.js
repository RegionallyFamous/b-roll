/**
 * B-Roll scene: Rainbow Road (Mario Kart)
 * ---------------------------------------------------------------
 * Scrolling rainbow-striped road in exaggerated perspective with
 * neon guardrails (crisp + bloom), twinkling stars, a distant
 * ringed planet, occasional shooting stars, and a rotating item
 * box drifting past.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	var ROAD_COLORS = [ 0xff2d5a, 0xff993d, 0xffe84a, 0x31d16a, 0x3dc3ff, 0x8a5bff, 0xff2d5a ];

	window.__bRoll.scenes[ 'rainbow-road' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			var bg = new PIXI.Graphics();
			app.stage.addChild( bg );
			h.paintVGradient( bg, app.renderer.width, app.renderer.height, 0x0b0024, 0x000000, 12 );

			var planet = new PIXI.Graphics();
			planet.circle( 0, 0, 34 ).fill( 0xe9a83e );
			planet.ellipse( 0, 0, 50, 10 ).stroke( { color: 0xf6dca0, width: 2, alpha: 0.8 } );
			planet.x = app.renderer.width * 0.78;
			planet.y = app.renderer.height * 0.25;
			planet.alpha = 0.9;
			app.stage.addChild( planet );

			var stars = new PIXI.Graphics();
			app.stage.addChild( stars );
			var starData = [];
			for ( var i = 0; i < 180; i++ ) {
				starData.push( {
					x: h.rand( 0, app.renderer.width ),
					y: h.rand( 0, app.renderer.height * 0.48 ),
					r: h.rand( 0.5, 1.8 ), tw: Math.random() * h.tau,
				} );
			}

			var shooters = [];

			var road = new PIXI.Graphics();
			app.stage.addChild( road );
			var rails = new PIXI.Graphics();
			app.stage.addChild( rails );

			var bloom = h.makeBloomLayer( PIXI, 8 );
			app.stage.addChild( bloom );
			var bloomRails = new PIXI.Graphics();
			bloom.addChild( bloomRails );

			var item = new PIXI.Container();
			var iBody = new PIXI.Graphics();
			iBody.roundRect( -20, -20, 40, 40, 8 ).fill( 0xff9e1a );
			iBody.roundRect( -18, -18, 36, 36, 6 ).fill( 0xffcc4a );
			var q = new PIXI.Text( {
				text: '?',
				style: { fontFamily: 'Impact, sans-serif', fontSize: 32, fill: 0xffffff,
					stroke: { color: 0x5b3300, width: 3 } },
			} );
			q.anchor.set( 0.5 );
			item.addChild( iBody );
			item.addChild( q );
			item.alpha = 0;
			app.stage.addChild( item );

			return { bg: bg, planet: planet, stars: stars, starData: starData, shooters: shooters,
				road: road, rails: rails, bloomRails: bloomRails, item: item,
				itemT: h.rand( 60 * 15, 60 * 50 ), itemPhase: 'idle',
				shootT: h.rand( 60 * 5, 60 * 20 ), offset: 0 };
		},
		onResize: function ( state, env ) {
			h.paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x0b0024, 0x000000, 12 );
		},
		tick: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;

			state.stars.clear();
			for ( var i = 0; i < state.starData.length; i++ ) {
				var st = state.starData[ i ];
				st.tw += 0.04 * env.dt;
				var a = 0.45 + 0.45 * Math.sin( st.tw );
				state.stars.circle( st.x, st.y, st.r ).fill( { color: 0xffffff, alpha: a } );
			}

			state.shootT -= env.dt;
			if ( state.shootT <= 0 ) {
				state.shootT = h.rand( 60 * 4, 60 * 18 );
				state.shooters.push( {
					x: h.rand( 0, w * 0.5 ), y: h.rand( 0, hh * 0.35 ),
					vx: h.rand( 4, 8 ), vy: h.rand( 2, 5 ), life: 1,
				} );
			}
			for ( var s2 = state.shooters.length - 1; s2 >= 0; s2-- ) {
				var sh = state.shooters[ s2 ];
				sh.x += sh.vx * env.dt; sh.y += sh.vy * env.dt;
				state.stars.moveTo( sh.x, sh.y )
					.lineTo( sh.x - sh.vx * 6, sh.y - sh.vy * 6 )
					.stroke( { color: 0xffffff, alpha: sh.life * 0.8, width: 1 } );
				sh.life -= 0.02 * env.dt;
				if ( sh.life <= 0 || sh.x > w + 40 ) state.shooters.splice( s2, 1 );
			}

			state.offset += 0.055 * env.dt;
			state.road.clear();
			state.rails.clear();
			state.bloomRails.clear();

			var horizon = hh * 0.48;
			var vpX = w / 2;
			var STRIPES = 60;
			for ( var sn = 0; sn < STRIPES; sn++ ) {
				var tNorm = ( sn / STRIPES + state.offset ) % 1;
				var y  = horizon + Math.pow( tNorm, 1.8 ) * ( hh - horizon );
				var y2 = horizon + Math.pow( tNorm + 1 / STRIPES, 1.8 ) * ( hh - horizon );
				var widthTop = ( y - horizon ) * 0.85;
				var widthBot = ( y2 - horizon ) * 0.85;
				var color = ROAD_COLORS[ sn % ROAD_COLORS.length ];
				state.road.poly( [
					vpX - widthTop, y,  vpX + widthTop, y,
					vpX + widthBot, y2, vpX - widthBot, y2,
				] ).fill( { color: color, alpha: 0.92 } );
			}
			state.road.rect( vpX - 2.5, horizon, 5, hh - horizon )
				.fill( { color: 0xffffff, alpha: 0.45 } );

			var pts = 30;
			for ( var g = 0; g < pts; g++ ) {
				var tt = ( g / pts ) + ( state.offset % ( 1 / pts ) ) * pts;
				var yy = horizon + Math.pow( tt, 1.8 ) * ( hh - horizon );
				var wt = ( yy - horizon ) * 0.85;
				state.rails.circle( vpX - wt - 2, yy, 1.2 + tt * 2 )
					.fill( { color: 0x64d8ff, alpha: 0.9 } );
				state.bloomRails.circle( vpX - wt - 2, yy, 3 + tt * 3 )
					.fill( { color: 0x64d8ff, alpha: 0.55 } );
				state.rails.circle( vpX + wt + 2, yy, 1.2 + tt * 2 )
					.fill( { color: 0xff4aa0, alpha: 0.9 } );
				state.bloomRails.circle( vpX + wt + 2, yy, 3 + tt * 3 )
					.fill( { color: 0xff4aa0, alpha: 0.55 } );
			}

			state.itemT -= env.dt;
			if ( state.itemPhase === 'idle' && state.itemT <= 0 ) {
				state.itemPhase = 'fly';
				state.item.alpha = 1;
				state.item.x = -50;
				state.item.y = h.rand( hh * 0.2, hh * 0.42 );
				state.item.rotation = 0;
				state.item.scale.set( h.rand( 0.8, 1.15 ) );
			}
			if ( state.itemPhase === 'fly' ) {
				state.item.x += 2.4 * env.dt;
				state.item.rotation += 0.04 * env.dt;
				if ( state.item.x > w + 50 ) {
					state.itemPhase = 'idle';
					state.item.alpha = 0;
					state.itemT = h.rand( 60 * 20, 60 * 60 );
				}
			}
		},
	};
} )();
