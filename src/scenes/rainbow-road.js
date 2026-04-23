/**
 * B-Roll scene: Rainbow Road (Mario Kart) — v0.4
 * ---------------------------------------------------------------
 * Scrolling rainbow-striped road in exaggerated perspective with
 * neon guardrails (crisp + bloom), white chevron lane markings
 * scrolling toward the viewer, and periodic abstract kart
 * silhouettes that spawn at the horizon and race to the bottom,
 * growing in scale as they approach.
 *
 * Background: a tinted starfield (white / yellow / cyan / pink)
 * with per-star twinkle phase, a slow-rotating Saturn planet with
 * surface bands and a moving ring shadow, rare shooting stars,
 * and occasional speed-line bursts radiating from the vanishing
 * point. A spinning ? item box passes through a few times a
 * minute.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	var ROAD_COLORS = [ 0xff2d5a, 0xff993d, 0xffe84a, 0x31d16a, 0x3dc3ff, 0x8a5bff, 0xff2d5a ];
	var STAR_TINTS  = [ 0xffffff, 0xffffff, 0xffffff, 0xffe8a8, 0xa8d8ff, 0xffb0d8 ];
	var KART_COLORS = [ 0xff5a3d, 0x3dc3ff, 0x9cff3d, 0xffe84a, 0xff4aa0 ];

	window.__bRoll.scenes[ 'rainbow-road' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			var bg = new PIXI.Graphics(); app.stage.addChild( bg );
			h.paintVGradient( bg, app.renderer.width, app.renderer.height, 0x0b0024, 0x000000, 14 );

			// Saturn container.
			var planet = new PIXI.Container();
			var planetBody = new PIXI.Graphics();
			planetBody.circle( 0, 0, 34 ).fill( 0xe9a83e );
			planetBody.ellipse( 0, -14, 28, 2 ).fill( { color: 0xc97830, alpha: 0.8 } );
			planetBody.ellipse( 0, -6, 32, 2.5 ).fill( { color: 0xba6a28, alpha: 0.8 } );
			planetBody.ellipse( 0, 4, 32, 2 ).fill( { color: 0xc97830, alpha: 0.8 } );
			planetBody.ellipse( 0, 12, 28, 2 ).fill( { color: 0xba6a28, alpha: 0.8 } );
			planetBody.ellipse( 0, 20, 20, 1.5 ).fill( { color: 0xc97830, alpha: 0.8 } );
			planet.addChild( planetBody );
			var ringShadow = new PIXI.Graphics();
			ringShadow.ellipse( 0, 0, 46, 2.4 ).fill( { color: 0x7a4a1e, alpha: 0.55 } );
			planet.addChild( ringShadow );
			var ring = new PIXI.Graphics();
			ring.ellipse( 0, 0, 54, 11 ).stroke( { color: 0xf6dca0, width: 2, alpha: 0.85 } );
			ring.ellipse( 0, 0, 48, 8 ).stroke( { color: 0xeccb88, width: 0.8, alpha: 0.55 } );
			planet.addChild( ring );
			planet.x = app.renderer.width * 0.78;
			planet.y = app.renderer.height * 0.25;
			planet.alpha = 0.92;
			app.stage.addChild( planet );

			// Stars with color tints.
			var stars = new PIXI.Graphics();
			app.stage.addChild( stars );
			var starData = [];
			for ( var i = 0; i < 220; i++ ) {
				starData.push( {
					x: h.rand( 0, app.renderer.width ),
					y: h.rand( 0, app.renderer.height * 0.48 ),
					r: h.rand( 0.45, 1.9 ),
					tw: Math.random() * h.tau,
					twFreq: h.rand( 0.02, 0.06 ),
					tint: h.choose( STAR_TINTS ),
				} );
			}

			var shooters = [];
			var speedLines = [];

			var road   = new PIXI.Graphics(); app.stage.addChild( road );
			var chev   = new PIXI.Graphics(); app.stage.addChild( chev );
			var karts  = new PIXI.Graphics(); app.stage.addChild( karts );
			var rails  = new PIXI.Graphics(); app.stage.addChild( rails );

			var bloom = h.makeBloomLayer( PIXI, 8 );
			app.stage.addChild( bloom );
			var bloomRails = new PIXI.Graphics(); bloom.addChild( bloomRails );
			var bloomKarts = new PIXI.Graphics(); bloom.addChild( bloomKarts );
			var bloomSpeed = new PIXI.Graphics(); bloom.addChild( bloomSpeed );

			// Item box.
			var item = new PIXI.Container();
			var iBody = new PIXI.Graphics();
			iBody.roundRect( -20, -20, 40, 40, 8 ).fill( 0xff9e1a );
			iBody.roundRect( -18, -18, 36, 36, 6 ).fill( 0xffcc4a );
			var q = new PIXI.Text( {
				text: '?',
				style: {
					fontFamily: 'Impact, sans-serif', fontSize: 32, fill: 0xffffff,
					stroke: { color: 0x5b3300, width: 3 },
				},
			} );
			q.anchor.set( 0.5 );
			item.addChild( iBody );
			item.addChild( q );
			item.alpha = 0;
			app.stage.addChild( item );

			return {
				bg: bg, planet: planet, stars: stars, starData: starData,
				shooters: shooters, speedLines: speedLines,
				road: road, chev: chev, karts: karts, rails: rails,
				bloomRails: bloomRails, bloomKarts: bloomKarts, bloomSpeed: bloomSpeed,
				item: item,
				itemT: h.rand( 60 * 15, 60 * 50 ), itemPhase: 'idle',
				shootT: h.rand( 60 * 5, 60 * 20 ),
				speedBurstCD: h.rand( 60 * 3, 60 * 9 ),
				kartList: [], kartCD: h.rand( 60 * 3, 60 * 10 ),
				offset: 0,
				time: 0,
			};
		},

		onResize: function ( state, env ) {
			h.paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x0b0024, 0x000000, 14 );
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.time += dt;

			// --- Saturn slow rotation ------------------------------- //
			state.planet.rotation += 0.0008 * dt;

			// --- Stars + shooters + speed-line bursts --------------- //
			state.stars.clear();
			for ( var i = 0; i < state.starData.length; i++ ) {
				var st = state.starData[ i ];
				st.tw += st.twFreq * dt;
				var a = 0.45 + 0.45 * Math.sin( st.tw );
				state.stars.circle( st.x, st.y, st.r ).fill( { color: st.tint, alpha: a } );
			}

			state.shootT -= dt;
			if ( state.shootT <= 0 ) {
				state.shootT = h.rand( 60 * 4, 60 * 18 );
				state.shooters.push( {
					x: h.rand( 0, w * 0.5 ), y: h.rand( 0, hh * 0.35 ),
					vx: h.rand( 4, 8 ), vy: h.rand( 2, 5 ), life: 1,
				} );
			}
			for ( var s2 = state.shooters.length - 1; s2 >= 0; s2-- ) {
				var sh = state.shooters[ s2 ];
				sh.x += sh.vx * dt; sh.y += sh.vy * dt;
				state.stars.moveTo( sh.x, sh.y )
					.lineTo( sh.x - sh.vx * 6, sh.y - sh.vy * 6 )
					.stroke( { color: 0xffffff, alpha: sh.life * 0.8, width: 1 } );
				sh.life -= 0.02 * dt;
				if ( sh.life <= 0 || sh.x > w + 40 ) state.shooters.splice( s2, 1 );
			}

			// --- Road stripes --------------------------------------- //
			state.offset += 0.055 * dt;
			state.road.clear();
			state.chev.clear();
			state.rails.clear();
			state.bloomRails.clear();
			state.karts.clear();
			state.bloomKarts.clear();
			state.bloomSpeed.clear();

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

			// --- Chevron lane markings scrolling down --------------- //
			var chevCount = 8;
			for ( var cv = 0; cv < chevCount; cv++ ) {
				var ct = ( cv / chevCount + state.offset * 1.05 ) % 1;
				var cy = horizon + Math.pow( ct, 1.8 ) * ( hh - horizon );
				var half = ( cy - horizon ) * 0.14;
				if ( half < 1 ) continue;
				state.chev.moveTo( vpX - half, cy - half * 0.35 )
					.lineTo( vpX + half, cy )
					.lineTo( vpX - half, cy + half * 0.35 )
					.stroke( { color: 0xffffff, alpha: 0.5 + ct * 0.45, width: 1 + ct * 2.5 } );
			}

			// --- Guardrail neon dots (crisp + bloom) --------------- //
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

			// --- Abstract karts (horizon → bottom) ------------------- //
			state.kartCD -= dt;
			if ( state.kartCD <= 0 ) {
				state.kartCD = h.rand( 60 * 3, 60 * 10 );
				state.kartList.push( {
					t: 0, speed: h.rand( 0.004, 0.008 ),
					lane: h.rand( -0.45, 0.45 ),
					color: h.choose( KART_COLORS ),
				} );
			}
			for ( var ki = state.kartList.length - 1; ki >= 0; ki-- ) {
				var k = state.kartList[ ki ];
				k.t += k.speed * dt;
				if ( k.t >= 1.05 ) { state.kartList.splice( ki, 1 ); continue; }
				var ky = horizon + Math.pow( k.t, 1.8 ) * ( hh - horizon );
				var laneW = ( ky - horizon ) * 0.85;
				var kx = vpX + k.lane * laneW;
				var scale = 0.3 + k.t * 1.6;
				// Body.
				state.karts.ellipse( kx, ky, 8 * scale, 3.4 * scale ).fill( k.color );
				state.karts.ellipse( kx, ky - 1.5 * scale, 5 * scale, 2 * scale )
					.fill( { color: 0xffffff, alpha: 0.6 } );
				// Wheels.
				state.karts.circle( kx - 5 * scale, ky + 2 * scale, 2 * scale ).fill( 0x1a1020 );
				state.karts.circle( kx + 5 * scale, ky + 2 * scale, 2 * scale ).fill( 0x1a1020 );
				// Bloom halo under the kart (tire-glow).
				state.bloomKarts.ellipse( kx, ky + 2.5 * scale, 9 * scale, 2.5 * scale )
					.fill( { color: k.color, alpha: 0.45 } );
			}

			// --- Speed-line bursts ---------------------------------- //
			state.speedBurstCD -= dt;
			if ( state.speedBurstCD <= 0 ) {
				state.speedBurstCD = h.rand( 60 * 3, 60 * 9 );
				var count = h.irand( 6, 10 );
				for ( var sl = 0; sl < count; sl++ ) {
					var ang = h.rand( 0, h.tau );
					state.speedLines.push( {
						angle: ang,
						start: 8,
						len: h.rand( 30, 90 ),
						life: 1,
					} );
				}
			}
			for ( var sli = state.speedLines.length - 1; sli >= 0; sli-- ) {
				var ln = state.speedLines[ sli ];
				var cos = Math.cos( ln.angle ), sin = Math.sin( ln.angle );
				var x0 = vpX + cos * ln.start;
				var y0 = horizon + sin * ln.start;
				var x1 = vpX + cos * ( ln.start + ln.len );
				var y1 = horizon + sin * ( ln.start + ln.len );
				state.bloomSpeed.moveTo( x0, y0 ).lineTo( x1, y1 ).stroke( {
					color: 0xffffff, alpha: ln.life * 0.8, width: 1.3,
				} );
				ln.start += 3 * dt;
				ln.life -= 0.05 * dt;
				if ( ln.life <= 0 ) state.speedLines.splice( sli, 1 );
			}

			// --- Spinning item box ---------------------------------- //
			state.itemT -= dt;
			if ( state.itemPhase === 'idle' && state.itemT <= 0 ) {
				state.itemPhase = 'fly';
				state.item.alpha = 1;
				state.item.x = -50;
				state.item.y = h.rand( hh * 0.2, hh * 0.42 );
				state.item.rotation = 0;
				state.item.scale.set( h.rand( 0.8, 1.15 ) );
			}
			if ( state.itemPhase === 'fly' ) {
				state.item.x += 2.4 * dt;
				state.item.rotation += 0.04 * dt;
				if ( state.item.x > w + 50 ) {
					state.itemPhase = 'idle';
					state.item.alpha = 0;
					state.itemT = h.rand( 60 * 20, 60 * 60 );
				}
			}
		},
	};
} )();
