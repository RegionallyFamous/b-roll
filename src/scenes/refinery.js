/**
 * B-Roll scene: Refinery (Severance)
 * ---------------------------------------------------------------
 * Pale pool of drifting numerals clusters into three shapes (ring,
 * double-spiral, crescent). Cycles through a "scary" phase where
 * clustered numbers briefly flash red+bold. MDR-style selector
 * box drifts across, Lumon mark in the corner.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	var DIGITS = '0123456789'.split( '' );

	window.__bRoll.scenes[ 'refinery' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;
			var w = app.renderer.width, hh = app.renderer.height;

			var bg = new PIXI.Graphics();
			app.stage.addChild( bg );
			h.paintVGradient( bg, w, hh, 0xe6f0ea, 0xb8cec3, 12 );

			var grid = new PIXI.Graphics();
			grid.alpha = 0.12;
			app.stage.addChild( grid );
			function drawGrid() {
				grid.clear();
				var w = app.renderer.width, hh = app.renderer.height;
				for ( var x = 0; x < w; x += 24 ) grid.moveTo( x, 0 ).lineTo( x, hh ).stroke( { color: 0x0d2d4e, width: 0.5 } );
				for ( var y = 0; y < hh; y += 24 ) grid.moveTo( 0, y ).lineTo( w, y ).stroke( { color: 0x0d2d4e, width: 0.5 } );
			}
			drawGrid();

			var numberLayer = new PIXI.Container();
			app.stage.addChild( numberLayer );

			var style = new PIXI.TextStyle( {
				fontFamily: 'ui-monospace, "Courier New", monospace',
				fontSize: 18, fill: 0x0d2d4e,
			} );
			var styleAlt = new PIXI.TextStyle( {
				fontFamily: 'ui-monospace, "Courier New", monospace',
				fontSize: 12, fill: 0x0d2d4e,
			} );
			var styleScary = new PIXI.TextStyle( {
				fontFamily: 'ui-monospace, "Courier New", monospace',
				fontSize: 22, fill: 0xb22430, fontWeight: 'bold',
			} );

			var particles = [];
			for ( var i = 0; i < 260; i++ ) {
				var big = Math.random() < 0.3;
				var t = new PIXI.Text( {
					text: h.choose( DIGITS ),
					style: big ? style : styleAlt,
				} );
				t.anchor.set( 0.5 );
				t.x = h.rand( 0, w ); t.y = h.rand( 0, hh );
				t.alpha = h.rand( 0.35, 0.9 );
				numberLayer.addChild( t );
				particles.push( {
					node: t, vx: h.rand( -0.3, 0.3 ), vy: h.rand( -0.3, 0.3 ),
					homeX: t.x, homeY: t.y, scary: 0,
					bigStyle: big ? style : styleAlt, scaryStyle: styleScary,
				} );
			}

			var selector = new PIXI.Graphics();
			selector.rect( 0, 0, 120, 80 ).stroke( { color: 0x0d2d4e, width: 1.5, alpha: 0.8 } );
			selector.rect( 0, 0, 120, 80 ).fill( { color: 0x0d2d4e, alpha: 0.05 } );
			selector.pivot.set( 60, 40 );
			selector.x = w / 2; selector.y = hh / 2;
			app.stage.addChild( selector );

			var mark = new PIXI.Graphics();
			mark.circle( 0, 0, 22 ).stroke( { color: 0x0d2d4e, width: 2 } );
			mark.circle( 0, 0, 14 ).stroke( { color: 0x0d2d4e, width: 1.5 } );
			mark.moveTo( -22, 0 ).lineTo( 22, 0 ).stroke( { color: 0x0d2d4e, width: 1 } );
			mark.moveTo( 0, -22 ).lineTo( 0, 22 ).stroke( { color: 0x0d2d4e, width: 1 } );
			var markText = new PIXI.Text( {
				text: 'LUMON',
				style: { fontFamily: 'Georgia, serif', fontSize: 11, fill: 0x0d2d4e, letterSpacing: 2 },
			} );
			markText.anchor.set( 0.5, 0 );
			markText.y = 28;
			mark.addChild( markText );
			mark.alpha = 0.45;
			app.stage.addChild( mark );

			return { bg: bg, grid: grid, drawGrid: drawGrid,
				particles: particles, selector: selector, mark: mark,
				clusterT: 60 * 6, phase: 'idle', clusterShape: null, clusterCenter: null,
				selTargetX: w / 2, selTargetY: hh / 2, selT: 0 };
		},
		onResize: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			h.paintVGradient( state.bg, w, hh, 0xe6f0ea, 0xb8cec3, 12 );
			state.drawGrid();
			state.mark.x = w - 60; state.mark.y = hh - 60;
		},
		tick: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var t = env.app.ticker.lastTime;
			state.mark.x = w - 60; state.mark.y = hh - 60;

			state.selT -= env.dt;
			if ( state.selT <= 0 ) {
				state.selT = 60 * h.rand( 3, 8 );
				state.selTargetX = h.rand( w * 0.15, w * 0.85 );
				state.selTargetY = h.rand( hh * 0.15, hh * 0.85 );
			}
			state.selector.x += ( state.selTargetX - state.selector.x ) * 0.015 * env.dt;
			state.selector.y += ( state.selTargetY - state.selector.y ) * 0.015 * env.dt;

			state.clusterT -= env.dt;
			if ( state.clusterT <= 0 ) {
				if ( state.phase === 'idle' ) {
					state.phase = 'gather';
					state.clusterCenter = { x: h.rand( w * 0.25, w * 0.75 ), y: h.rand( hh * 0.25, hh * 0.75 ) };
					state.clusterShape = h.choose( [ 'ring', 'spiral', 'crescent' ] );
					state.clusterT = 60 * 5;
				} else if ( state.phase === 'gather' ) {
					state.phase = 'scary';
					state.clusterT = 60 * 2;
				} else if ( state.phase === 'scary' ) {
					state.phase = 'idle';
					state.clusterCenter = null;
					state.clusterT = 60 * h.rand( 10, 22 );
				}
			}

			var scary = state.phase === 'scary';

			for ( var i = 0; i < state.particles.length; i++ ) {
				var p = state.particles[ i ];
				var tx, ty;
				if ( state.clusterCenter ) {
					var idx = i / state.particles.length;
					if ( state.clusterShape === 'ring' ) {
						var ang = idx * h.tau * 3 + t * 0.0005;
						var r = 90 + Math.sin( ang * 2 ) * 15;
						tx = state.clusterCenter.x + Math.cos( ang ) * r;
						ty = state.clusterCenter.y + Math.sin( ang ) * r;
					} else if ( state.clusterShape === 'spiral' ) {
						var ang2 = idx * h.tau * 6;
						var r2 = 20 + idx * 80;
						tx = state.clusterCenter.x + Math.cos( ang2 ) * r2;
						ty = state.clusterCenter.y + Math.sin( ang2 ) * r2;
					} else {
						var ang3 = idx * Math.PI + t * 0.0004;
						var r3 = 100 + Math.sin( ang3 * 3 ) * 20;
						tx = state.clusterCenter.x + Math.cos( ang3 - Math.PI / 4 ) * r3;
						ty = state.clusterCenter.y + Math.sin( ang3 - Math.PI / 4 ) * r3 * 0.6;
					}
				} else {
					tx = p.homeX + Math.sin( t * 0.0004 + i * 0.25 ) * 50;
					ty = p.homeY + Math.cos( t * 0.00035 + i * 0.25 ) * 50;
				}
				p.node.x += ( tx - p.node.x ) * 0.022 * env.dt;
				p.node.y += ( ty - p.node.y ) * 0.022 * env.dt;
				if ( Math.random() < 0.004 ) p.node.text = h.choose( DIGITS );

				if ( scary && p.scary < 1 ) p.scary = Math.min( 1, p.scary + 0.04 * env.dt );
				else if ( ! scary && p.scary > 0 ) p.scary = Math.max( 0, p.scary - 0.02 * env.dt );
				p.node.style = p.scary > 0.5 ? p.scaryStyle : p.bigStyle;
			}

			state.mark.alpha = 0.35 + 0.12 * Math.sin( t * 0.0018 );
		},
	};
} )();
