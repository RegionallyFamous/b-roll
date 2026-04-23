/**
 * B-Roll scene: The Grid (Tron)
 * ---------------------------------------------------------------
 * Isometric neon grid with bright orange horizon + soft halo.
 * Three light-cycles race on grid cells, leaving gradient trails
 * drawn in both crisp and bloom layers. Intersection pulse rings
 * radiate outward when a cycle steps.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	window.__bRoll.scenes[ 'tron-grid' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			var bg = new PIXI.Graphics();
			app.stage.addChild( bg );
			h.paintVGradient( bg, app.renderer.width, app.renderer.height, 0x001626, 0x000000, 14 );

			var horizon = new PIXI.Graphics();
			app.stage.addChild( horizon );

			var grid = new PIXI.Graphics();
			app.stage.addChild( grid );

			var trails = new PIXI.Graphics();
			app.stage.addChild( trails );

			var bloom = h.makeBloomLayer( PIXI, 9 );
			app.stage.addChild( bloom );
			var bloomLayer = new PIXI.Graphics();
			bloom.addChild( bloomLayer );

			function drawHorizon() {
				var w = app.renderer.width, hh = app.renderer.height;
				horizon.clear();
				var hy = hh * 0.52;
				horizon.rect( 0, hy - 1, w, 2 ).fill( 0xff7a1a );
				for ( var i = 0; i < 20; i++ ) {
					var t = i / 20;
					horizon.rect( 0, hy - i, w, 1 )
						.fill( { color: h.lerpColor( 0xff6d1f, 0x000000, t ), alpha: ( 1 - t ) * 0.55 } );
					horizon.rect( 0, hy + i, w, 1 )
						.fill( { color: h.lerpColor( 0xff6d1f, 0x000000, t ), alpha: ( 1 - t ) * 0.3 } );
				}
			}

			function drawGrid() {
				var w = app.renderer.width, hh = app.renderer.height;
				grid.clear();
				var hy = hh * 0.52;
				var rows = 16;
				for ( var r = 0; r < rows; r++ ) {
					var t = r / ( rows - 1 );
					var y = hy + Math.pow( t, 1.8 ) * ( hh - hy );
					grid.moveTo( 0, y ).lineTo( w, y )
						.stroke( { color: 0x00aaff, alpha: 0.25 + t * 0.55, width: 1 } );
				}
				var vp = { x: w / 2, y: hy };
				for ( var c = -12; c <= 12; c++ ) {
					var x0 = w / 2 + c * ( w / 26 );
					grid.moveTo( x0, hh ).lineTo( vp.x + c * 5, vp.y )
						.stroke( { color: 0x00aaff, alpha: 0.28, width: 1 } );
				}
			}
			drawHorizon();
			drawGrid();

			function makeCycle( color ) {
				return {
					gx: h.irand( 2, 18 ), gy: h.irand( 2, 14 ),
					dir: h.irand( 0, 4 ), color: color,
					trail: [], stepT: 0,
				};
			}
			var cycles = [ makeCycle( 0x00eaff ), makeCycle( 0xff6d1f ), makeCycle( 0xbaff3d ) ];
			var pulses = [];

			return { bg: bg, horizon: horizon, grid: grid, trails: trails, bloomLayer: bloomLayer,
				cycles: cycles, makeCycle: makeCycle, pulses: pulses,
				drawHorizon: drawHorizon, drawGrid: drawGrid };
		},
		onResize: function ( state, env ) {
			h.paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x001626, 0x000000, 14 );
			state.drawHorizon();
			state.drawGrid();
		},
		tick: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var hy = hh * 0.52;
			var dirs = [ [ 1, 0 ], [ 0, 1 ], [ -1, 0 ], [ 0, -1 ] ];

			for ( var i = 0; i < state.cycles.length; i++ ) {
				var cy = state.cycles[ i ];
				cy.stepT += env.dt;
				if ( cy.stepT >= 8 ) {
					cy.stepT = 0;
					var d = dirs[ cy.dir ];
					cy.gx += d[ 0 ]; cy.gy += d[ 1 ];
					if ( Math.random() < 0.2 ) cy.dir = ( cy.dir + ( Math.random() < 0.5 ? 1 : 3 ) ) % 4;
					var sx = w / 2 + ( cy.gx - 10 ) * ( w / 26 );
					var sy = hy + Math.pow( cy.gy / 16, 1.8 ) * ( hh - hy );
					cy.trail.push( { x: sx, y: sy, life: 1 } );
					if ( cy.trail.length > 90 ) cy.trail.shift();
					state.pulses.push( { x: sx, y: sy, life: 1, color: cy.color } );
					if ( cy.gx < -3 || cy.gx > 23 || cy.gy < -1 || cy.gy > 17 ) {
						Object.assign( cy, state.makeCycle( cy.color ) );
					}
				}
			}

			state.trails.clear();
			state.bloomLayer.clear();

			for ( var c = 0; c < state.cycles.length; c++ ) {
				var cyc = state.cycles[ c ];
				for ( var t = cyc.trail.length - 1; t >= 1; t-- ) {
					var a = cyc.trail[ t - 1 ], b = cyc.trail[ t ];
					state.trails.moveTo( a.x, a.y ).lineTo( b.x, b.y )
						.stroke( { color: cyc.color, alpha: b.life * 0.95, width: 2 } );
					state.bloomLayer.moveTo( a.x, a.y ).lineTo( b.x, b.y )
						.stroke( { color: cyc.color, alpha: b.life * 0.7, width: 4 } );
					b.life = Math.max( 0, b.life - 0.009 * env.dt );
				}
				if ( cyc.trail.length ) {
					var head = cyc.trail[ cyc.trail.length - 1 ];
					state.trails.rect( head.x - 5, head.y - 2.5, 10, 5 ).fill( 0xffffff );
					state.bloomLayer.circle( head.x, head.y, 8 ).fill( { color: cyc.color, alpha: 0.7 } );
					state.bloomLayer.circle( head.x, head.y, 14 ).fill( { color: cyc.color, alpha: 0.35 } );
				}
			}

			for ( var p = state.pulses.length - 1; p >= 0; p-- ) {
				var pu = state.pulses[ p ];
				state.bloomLayer.circle( pu.x, pu.y, ( 1 - pu.life ) * 20 )
					.stroke( { color: pu.color, alpha: pu.life, width: 1.4 } );
				pu.life -= 0.05 * env.dt;
				if ( pu.life <= 0 ) state.pulses.splice( p, 1 );
			}
		},
	};
} )();
