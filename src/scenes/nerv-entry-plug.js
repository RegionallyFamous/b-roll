/**
 * B-Roll scene: NERV Entry Plug (Evangelion) — v0.10
 * ---------------------------------------------------------------
 * Amber LCL liquid. Refracted highlights drift across the frame.
 * A central cruciform AT-Field heartbeat pulses every ~5s.
 * Numeric sync-ratio HUD bars flicker and re-settle in the corners;
 * Angel-tracker glyphs orbit the cross.
 *
 * Rare wow (~80s): the full hex-lattice AT-Field snaps into place
 * for ~0.5s, then shatters outward as hex shards.
 *
 * Cross-cutting mechanics:
 *   - env.tod:    not used (LCL is always its own eerie twilight)
 *   - env.audio:  bass triggers a cruciform strobe; level drives
 *                 the sync-ratio bar activity
 *   - env.perfTier: 'low' disables the refraction ripple
 *
 * Easter-egg hooks:
 *   - festival: sync-ratio spikes to 400% + cruciform strobe
 *   - reveal:   LCL level visibly rises (darken bottom band)
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/nerv-entry-plug.webp' + qs;
	}

	window.__bRoll.scenes[ 'nerv-entry-plug' ] = {
		setup: async function ( env ) {
			var PIXI = env.PIXI, app = env.app;

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

			var ripple = new PIXI.Graphics();
			app.stage.addChild( ripple );

			var hexLattice = new PIXI.Graphics();
			hexLattice.alpha = 0;
			app.stage.addChild( hexLattice );

			var bloom = h.makeBloomLayer( PIXI, 8 );
			app.stage.addChild( bloom );
			var cross = new PIXI.Graphics(); bloom.addChild( cross );

			var hud = new PIXI.Graphics();
			app.stage.addChild( hud );

			var lclFill = new PIXI.Graphics(); lclFill.alpha = 0;
			app.stage.addChild( lclFill );

			var fg = new PIXI.Container();
			app.stage.addChild( fg );
			var cutouts = await h.mountCutouts( app, PIXI, 'nerv-entry-plug', fg );

			// Orbiting Angel-tracker glyphs around the cross.
			var glyphs = [];
			for ( var gi = 0; gi < 6; gi++ ) {
				glyphs.push( {
					angle: gi * ( h.tau / 6 ),
					speed: h.rand( 0.003, 0.006 ),
					radius: 0.22 + gi * 0.02,
					shape: gi % 3,
				} );
			}

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				ripple: ripple, hexLattice: hexLattice, cross: cross, hud: hud, lclFill: lclFill, bloom: bloom,
				cutouts: cutouts,
				glyphs: glyphs,
				time: 0,
				crossPulse: 0,
				nextPulse: 60 * 5,
				nextLattice: 60 * h.rand( 70, 100 ),
				latticeAlpha: 0,
				syncRatio: 72,
			};
		},

		onResize: function ( state ) { state.fitBackdrop(); },

		stillFrame: function ( state, env ) {
			state.crossPulse = 1;
			state.latticeAlpha = 0.3;
			state.syncRatio = 400;
			state.time = 0;
			this.tick( state, env );
		},

		transitionIn: function ( state, env ) {
			state.crossPulse = 1.2;
			state.nextLattice = 60 * 2;
		},

		onEgg: function ( name, state, env ) {
			if ( name === 'festival' ) {
				state.syncRatio = 400;
				state.crossPulse = 1.8;
			} else if ( name === 'reveal' ) {
				state.lclFill.alpha = 0.4;
			} else if ( name === 'peek' ) {
				state.latticeAlpha = 0.5;
			}
		},

		onAudio: function ( state, env ) {
			if ( env.audio.bass > 0.5 ) state.crossPulse = Math.max( state.crossPulse, 0.9 );
			state.syncRatio = 72 + env.audio.level * 280;
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var cx = w / 2, cy = hh / 2;
			state.time += dt;
			h.tickDrifters( state.cutouts, env );

			// --- Refraction ripple (perf-gated) ----------------- //
			if ( env.perfTier !== 'low' ) {
				state.ripple.clear();
				var lines = 14;
				for ( var r = 0; r < lines; r++ ) {
					var y = ( ( state.time * 0.4 + r * hh / lines ) % hh );
					var alpha = 0.06 + 0.06 * Math.sin( state.time * 0.02 + r );
					state.ripple.rect( 0, y, w, 2 ).fill( { color: 0xffd080, alpha: alpha } );
				}
			} else {
				state.ripple.clear();
			}

			// --- Cruciform AT-Field pulse ----------------------- //
			state.nextPulse -= dt;
			if ( state.nextPulse <= 0 ) {
				state.crossPulse = 1;
				state.nextPulse = 60 * h.rand( 4, 6 );
			}
			state.crossPulse = Math.max( 0, state.crossPulse - dt * 0.025 );

			state.cross.clear();
			var p = state.crossPulse;
			if ( p > 0.01 ) {
				var armW = Math.min( w, hh ) * 0.02 * ( 0.7 + p * 0.5 );
				var armL = Math.min( w, hh ) * 0.38 * ( 0.85 + p * 0.25 );
				var coreColor = 0xffe8a0;
				var armColor  = 0xffb04a;
				state.cross.rect( cx - armL, cy - armW * 0.5, armL * 2, armW ).fill( { color: armColor, alpha: 0.85 * p } );
				state.cross.rect( cx - armW * 0.5, cy - armL, armW, armL * 2 ).fill( { color: armColor, alpha: 0.85 * p } );
				state.cross.circle( cx, cy, armW * 2.2 ).fill( { color: coreColor, alpha: Math.min( 1, p + 0.2 ) } );
			}

			// --- Orbiting glyphs -------------------------------- //
			state.hud.clear();
			var orbitR = Math.min( w, hh ) * 0.3;
			for ( var gi = 0; gi < state.glyphs.length; gi++ ) {
				var g = state.glyphs[ gi ];
				g.angle += g.speed * dt;
				var rr = orbitR * g.radius / 0.3;
				var gx = cx + Math.cos( g.angle ) * rr;
				var gy = cy + Math.sin( g.angle ) * rr * 0.6;
				if ( g.shape === 0 ) {
					state.hud.circle( gx, gy, 4 ).stroke( { color: 0xff8040, alpha: 0.7, width: 1.3 } );
				} else if ( g.shape === 1 ) {
					state.hud.poly( [ gx, gy - 5, gx + 5, gy, gx, gy + 5, gx - 5, gy ] ).stroke( { color: 0xff8040, alpha: 0.7, width: 1.3 } );
				} else {
					state.hud.rect( gx - 4, gy - 4, 8, 8 ).stroke( { color: 0xff8040, alpha: 0.7, width: 1.3 } );
				}
			}

			// --- Sync-ratio HUD bars ---------------------------- //
			var barY = hh - 44;
			state.hud.rect( 24, barY, 230, 16 ).stroke( { color: 0xff8040, alpha: 0.6, width: 1 } );
			var pct = Math.min( 1, state.syncRatio / 450 );
			state.hud.rect( 26, barY + 2, 226 * pct, 12 ).fill( { color: 0xffa040, alpha: 0.7 } );
			var lbl = 'SYNC ' + Math.round( state.syncRatio ) + '%';
			state.hud.rect( 24, barY - 20, 100, 16 ).fill( { color: 0x201008, alpha: 0.55 } );

			// Use label-as-vector by drawing numeric ticks near the bar
			// (we don't ship a font sprite — this stays as atmospheric
			// HUD chrome rather than literal text). Flicker periodically.
			for ( var tk = 0; tk < 12; tk++ ) {
				var tx = 26 + tk * 19;
				var talpha = 0.4 + 0.4 * Math.sin( state.time * 0.08 + tk );
				state.hud.rect( tx, barY - 18, 12, 2 ).fill( { color: 0xffa040, alpha: talpha } );
			}
			// label mute
			void lbl;

			// --- Rare hex-lattice snap -------------------------- //
			state.nextLattice -= dt;
			if ( state.nextLattice <= 0 && state.latticeAlpha < 0.05 ) {
				state.latticeAlpha = 1;
				state.nextLattice = 60 * h.rand( 60, 100 );
			}
			state.hexLattice.clear();
			if ( state.latticeAlpha > 0.01 ) {
				var a = state.latticeAlpha;
				var size = 64;
				var cols = Math.ceil( w / ( size * 1.5 ) ) + 2;
				var rows = Math.ceil( hh / ( size * Math.sqrt( 3 ) ) ) + 2;
				for ( var rc = 0; rc < rows; rc++ ) {
					for ( var cc = 0; cc < cols; cc++ ) {
						var hx = cc * size * 1.5;
						var hy = rc * size * Math.sqrt( 3 ) + ( cc & 1 ? size * Math.sqrt( 3 ) * 0.5 : 0 );
						var poly = [];
						for ( var si = 0; si < 6; si++ ) {
							var ang = si * Math.PI / 3;
							poly.push( hx + Math.cos( ang ) * size );
							poly.push( hy + Math.sin( ang ) * size );
						}
						state.hexLattice.poly( poly ).stroke( { color: 0xffe8a0, alpha: 0.35 * a, width: 1.2 } );
					}
				}
				state.latticeAlpha = Math.max( 0, state.latticeAlpha - dt * 0.03 );
			}

			// --- LCL rise overlay ------------------------------- //
			if ( state.lclFill.alpha > 0.01 ) {
				state.lclFill.clear().rect( 0, hh * 0.55, w, hh * 0.45 ).fill( { color: 0x8a3010, alpha: 1 } );
				state.lclFill.alpha = Math.max( 0, state.lclFill.alpha - dt * 0.004 );
			}
		},
	};
} )();
