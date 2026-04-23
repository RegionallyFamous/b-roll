/**
 * B-Roll scene: Refinery (Severance) — v0.5
 * ---------------------------------------------------------------
 * Painted backdrop (assets/wallpapers/refinery.jpg — sterile
 * seafoam-and-cream void with a soft radial vignette, faint CRT
 * scanlines, and a subtle Lumon-style sigil in the lower-left
 * corner) loaded as a Sprite. On top: a pool of drifting numerals
 * that bob on a per-instance sine wobble so the whole pool
 * breathes even while "idle."
 *
 * Periodically numbers gather into a cluster shape (ring, spiral,
 * crescent) and enter a "scary" phase: affected numbers briefly
 * flash red+bold AND scale-pulse with a sine amp, mimicking the
 * show's MDR scary-numbers beat.
 *
 * MDR-style selector box snaps through an invisible 6×4 cell grid
 * one cell at a time (dwell, then ease to the next cell). A bin
 * progress bar at the bottom of the frame fills over ~20s and
 * resets. A CRT text cursor blinks in the top-left. The v0.4
 * 24×24 graph grid, radial vignette, and rotating Lumon mark
 * are now baked into the painting (the painted vignette and
 * sigil are static, but the painting's softer aesthetic preserves
 * the Severance mood without the rotation animation).
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	var DIGITS = '0123456789'.split( '' );
	var SEL_COLS = 6, SEL_ROWS = 4;

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/refinery.jpg' + qs;
	}

	window.__bRoll.scenes[ 'refinery' ] = {
		setup: async function ( env ) {
			var PIXI = env.PIXI, app = env.app;
			var w = app.renderer.width, hh = app.renderer.height;

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
					bobPhase: Math.random() * h.tau,
					bobFreqX: h.rand( 0.004, 0.01 ),
					bobFreqY: h.rand( 0.004, 0.01 ),
					bobAmp: h.rand( 2, 6 ),
					bigStyle: big ? style : styleAlt, scaryStyle: styleScary,
				} );
			}

			// Selector box (snapping through a 6×4 cell grid).
			var selector = new PIXI.Graphics();
			var CELL_W = w / SEL_COLS, CELL_H = hh / SEL_ROWS;
			selector.rect( 0, 0, CELL_W * 0.85, CELL_H * 0.78 )
				.stroke( { color: 0x0d2d4e, width: 1.5, alpha: 0.9 } );
			selector.rect( 0, 0, CELL_W * 0.85, CELL_H * 0.78 )
				.fill( { color: 0x0d2d4e, alpha: 0.05 } );
			selector.pivot.set( CELL_W * 0.425, CELL_H * 0.39 );
			selector.x = w / 2; selector.y = hh / 2;
			app.stage.addChild( selector );

			// Progress bar at the bottom.
			var progress = new PIXI.Container();
			var progressFrame = new PIXI.Graphics();
			var progressFill = new PIXI.Graphics();
			progress.addChild( progressFrame );
			progress.addChild( progressFill );
			app.stage.addChild( progress );
			var progressLabel = new PIXI.Text( {
				text: 'QUOTA',
				style: { fontFamily: 'ui-monospace,monospace', fontSize: 10, fill: 0x0d2d4e, letterSpacing: 2 },
			} );
			progressLabel.anchor.set( 0, 0.5 );
			progress.addChild( progressLabel );

			// CRT cursor (blinking block) in the top-left.
			var cursor = new PIXI.Graphics();
			cursor.rect( 0, 0, 8, 14 ).fill( { color: 0x0d2d4e, alpha: 0.85 } );
			cursor.x = 24; cursor.y = 20;
			app.stage.addChild( cursor );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				particles: particles, selector: selector,
				progress: progress, progressFrame: progressFrame, progressFill: progressFill,
				progressLabel: progressLabel, progressT: 0,
				cursor: cursor, cursorBlink: 0,
				clusterT: 60 * 6, phase: 'idle',
				clusterShape: null, clusterCenter: null,
				selCell: { col: 2, row: 1 }, selTargetCell: { col: 2, row: 1 },
				selDwell: 60,
				selCellW: CELL_W, selCellH: CELL_H,
				time: 0,
			};
		},

		onResize: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.fitBackdrop();
			state.selCellW = w / SEL_COLS;
			state.selCellH = hh / SEL_ROWS;
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var t = env.app.ticker.lastTime;
			state.time += dt;

			// --- MDR selector snap through grid cells ---------- //
			state.selDwell -= dt;
			if ( state.selDwell <= 0 ) {
				state.selDwell = h.rand( 40, 120 );
				state.selCell.col = state.selTargetCell.col;
				state.selCell.row = state.selTargetCell.row;
				// Pick an adjacent cell (or sometimes a hop).
				if ( Math.random() < 0.7 ) {
					state.selTargetCell.col = Math.max( 0, Math.min( SEL_COLS - 1,
						state.selTargetCell.col + h.choose( [ -1, 1 ] ) ) );
				} else {
					state.selTargetCell.row = Math.max( 0, Math.min( SEL_ROWS - 1,
						state.selTargetCell.row + h.choose( [ -1, 1 ] ) ) );
				}
			}
			var targetSX = ( state.selTargetCell.col + 0.5 ) * state.selCellW;
			var targetSY = ( state.selTargetCell.row + 0.5 ) * state.selCellH;
			state.selector.x += ( targetSX - state.selector.x ) * 0.12 * dt;
			state.selector.y += ( targetSY - state.selector.y ) * 0.12 * dt;

			// --- Cluster cycle ---------------------------------- //
			state.clusterT -= dt;
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
			var scaryPulse = 1 + Math.sin( state.time * 0.18 ) * 0.18;

			for ( var i = 0; i < state.particles.length; i++ ) {
				var p = state.particles[ i ];
				p.bobPhase += 0.003 * dt;
				var bobX = Math.sin( state.time * p.bobFreqX + p.bobPhase ) * p.bobAmp;
				var bobY = Math.cos( state.time * p.bobFreqY + p.bobPhase * 1.3 ) * p.bobAmp * 0.7;
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
				tx += bobX; ty += bobY;
				p.node.x += ( tx - p.node.x ) * 0.022 * dt;
				p.node.y += ( ty - p.node.y ) * 0.022 * dt;
				if ( Math.random() < 0.004 ) p.node.text = h.choose( DIGITS );

				if ( scary && p.scary < 1 ) p.scary = Math.min( 1, p.scary + 0.04 * dt );
				else if ( ! scary && p.scary > 0 ) p.scary = Math.max( 0, p.scary - 0.02 * dt );
				p.node.style = p.scary > 0.5 ? p.scaryStyle : p.bigStyle;
				// Scary numbers scale-pulse on top of the red style.
				var sc = 1 + ( scaryPulse - 1 ) * p.scary;
				p.node.scale.set( sc );
			}

			// --- Quota progress bar ---------------------------- //
			state.progressT += dt;
			var fillFrac = ( state.progressT / ( 60 * 20 ) ) % 1;
			var barW = Math.min( 160, w * 0.45 );
			var barH = 6;
			var barX = w * 0.28;
			var barY = hh - 18;
			state.progressFrame.clear();
			state.progressFrame.rect( barX, barY, barW, barH )
				.stroke( { color: 0x0d2d4e, width: 1, alpha: 0.8 } );
			state.progressFill.clear();
			state.progressFill.rect( barX + 1, barY + 1, ( barW - 2 ) * fillFrac, barH - 2 )
				.fill( { color: 0x0d2d4e, alpha: 0.55 } );
			state.progressLabel.x = barX - 48;
			state.progressLabel.y = barY + barH / 2;

			// --- CRT cursor blink ------------------------------ //
			state.cursorBlink += dt;
			if ( state.cursorBlink > 30 ) {
				state.cursor.visible = ! state.cursor.visible;
				state.cursorBlink = 0;
			}
		},
	};
} )();
