/**
 * B-Roll scene: Neon Rain (Blade Runner 2049) — v0.5
 * ---------------------------------------------------------------
 * Painted backdrop (assets/wallpapers/neon-rain.jpg — three depths
 * of city silhouettes, neon signs, lit windows, wet asphalt with
 * reflections, low fog, cloudy night sky) loaded as a Sprite. On
 * top: diagonal rain drops that produce splash circles on ground
 * contact, rare distant lightning that brightens the upper sky,
 * and an occasional spinner-car gliding across the upper third.
 *
 * The v0.4 layered Pixi cityscape, per-window flicker, sign
 * flicker, fog bands, and water-surface ripples are now baked
 * into the painting; their procedural counterparts have been
 * removed because they were tied to procedurally-generated
 * building geometry that no longer exists.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/neon-rain.jpg' + qs;
	}

	window.__bRoll.scenes[ 'neon-rain' ] = {
		setup: async function ( env ) {
			var PIXI = env.PIXI, app = env.app;
			var w = app.renderer.width, hh = app.renderer.height;

			// Painted city backdrop.
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

			// Lightning veil sits below rain so drops stay visible during a strike.
			var lightning = new PIXI.Graphics();
			lightning.alpha = 0;
			app.stage.addChild( lightning );

			var rain = new PIXI.Graphics();
			app.stage.addChild( rain );

			// Spinner-car silhouette that drifts across the upper third.
			var spinner = new PIXI.Graphics();
			spinner.rect( -30, -6, 60, 12 ).fill( 0x1a1a2e );
			spinner.rect( -14, -12, 28, 6 ).fill( 0x1a1a2e );
			spinner.rect( -26, -2, 6, 4 ).fill( 0xff9640 );
			spinner.rect( 20, -2, 6, 4 ).fill( 0xff9640 );
			spinner.circle( 0, 0, 3 ).fill( 0x64d8ff );
			spinner.alpha = 0;
			spinner.y = hh * 0.28; spinner.x = -80;
			app.stage.addChild( spinner );

			var DROPS = 320;
			var drops = [];
			for ( var d = 0; d < DROPS; d++ ) {
				drops.push( {
					x: h.rand( -w, w ), y: h.rand( -hh, hh ),
					len: h.rand( 10, 22 ), speed: h.rand( 7, 13 ),
					alpha: h.rand( 0.25, 0.8 ),
				} );
			}
			var splashes = [];

			// Foreground cut-out layer (v0.7).
			var fg = new PIXI.Container();
			app.stage.addChild( fg );
			var drifters = await h.mountCutouts( app, PIXI, 'neon-rain', fg );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				lightning: lightning, lightT: h.rand( 60 * 8, 60 * 30 ),
				rain: rain, drops: drops, splashes: splashes,
				spinner: spinner, spinnerT: h.rand( 60 * 12, 60 * 35 ),
				time: 0,
				fg: fg, drifters: drifters,
				eggRainBoost: 0,
			};
		},

		onEgg: function ( name, state, env ) {
			if ( name === 'festival' ) {
				// All cut-outs visible at once + force lightning + rain boost.
				h.showEggDrifter( state.drifters, 'unicorn.webp', { resetT: true } );
				state.lightT = 0;
				state.eggRainBoost = 600;
				setTimeout( function () { h.hideEggDrifter( state.drifters, 'unicorn.webp' ); }, 9000 );
			} else if ( name === 'reveal' ) {
				// Type 'blade' → unicorn appears center, glowing.
				h.showEggDrifter( state.drifters, 'unicorn.webp', { scaleMul: 1.4, resetT: true } );
				setTimeout( function () { h.hideEggDrifter( state.drifters, 'unicorn.webp' ); }, 7000 );
			} else if ( name === 'peek' ) {
				// Quick lightning + spinner pass.
				state.lightT = 0;
				state.spinnerT = 0;
			}
		},

		onResize: function ( state ) {
			state.fitBackdrop();
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.time += dt;
			h.tickDrifters( state.drifters, env );

			if ( state.eggRainBoost > 0 ) {
				state.eggRainBoost = Math.max( 0, state.eggRainBoost - dt );
				dt = dt * 1.6;
			}

			// --- Lightning (back layer) ------------------------------ //
			state.lightT -= dt;
			if ( state.lightT <= 0 && state.lightning.alpha < 0.02 ) {
				state.lightT = h.rand( 60 * 15, 60 * 60 );
				state.lightning.clear().rect( 0, 0, w, hh * 0.7 )
					.fill( { color: 0xe6cfff, alpha: 1 } );
				state.lightning.alpha = 1;
			}
			if ( state.lightning.alpha > 0 ) {
				state.lightning.alpha = Math.max( 0, state.lightning.alpha - 0.09 * dt );
			}

			// --- Rain + splashes ------------------------------------ //
			state.rain.clear();
			var ground = hh * 0.94;
			for ( var d = 0; d < state.drops.length; d++ ) {
				var dr = state.drops[ d ];
				dr.x += dr.speed * 0.4 * dt;
				dr.y += dr.speed * dt;
				if ( dr.y > ground ) {
					state.splashes.push( { x: dr.x, y: ground, life: 1 } );
					dr.y = h.rand( -hh * 0.5, 0 );
					dr.x = h.rand( -w * 0.2, w );
				}
				if ( dr.x > w + 20 ) dr.x -= w + 40;
				state.rain.moveTo( dr.x, dr.y )
					.lineTo( dr.x - dr.len * 0.35, dr.y - dr.len )
					.stroke( { color: 0xb4c8ff, alpha: dr.alpha, width: 1 } );
			}
			for ( var s2 = state.splashes.length - 1; s2 >= 0; s2-- ) {
				var sp = state.splashes[ s2 ];
				state.rain.circle( sp.x, sp.y, ( 1 - sp.life ) * 4 )
					.stroke( { color: 0xa8c8ff, alpha: sp.life * 0.6, width: 0.8 } );
				sp.life -= 0.08 * dt;
				if ( sp.life <= 0 ) state.splashes.splice( s2, 1 );
			}

			// --- Spinner (upper third) ------------------------------ //
			state.spinnerT -= dt;
			if ( state.spinnerT <= 0 && state.spinner.alpha === 0 ) {
				state.spinner.alpha = 1;
				state.spinner.x = -80;
				state.spinner.y = h.rand( hh * 0.18, hh * 0.34 );
			}
			if ( state.spinner.alpha > 0 ) {
				state.spinner.x += 3.6 * dt;
				if ( state.spinner.x > w + 120 ) {
					state.spinner.alpha = 0;
					state.spinnerT = h.rand( 60 * 12, 60 * 35 );
				}
			}
		},
	};
} )();
