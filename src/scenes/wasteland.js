/**
 * B-Roll scene: Wasteland (Mad Max: Fury Road) — v0.10
 * ---------------------------------------------------------------
 * Ochre sky gradient, silhouette of a cracked-earth horizon,
 * rust-stained sandstone bluff in mid-ground. Hero motion is a
 * pursuit headlight pair zooming from the vanishing point toward
 * the camera along a painted road-line, then looping.
 *
 * Periodic beat: dust devils spinning across the horizon; flare
 * particles on warm-side highlights.
 *
 * Rare wow (~60s): a doof-guitar tint sting + an airborne silhouette
 * leaping across the upper frame (polecat-vaulter outline).
 *
 * Cross-cutting:
 *   - env.tod:    dusk deepens the orange, night fades sky to deep rust
 *   - env.season: unchanged (the wasteland doesn't know what spring is)
 *   - env.audio:  bass summons a second headlight pair; level drives flares
 *   - env.perfTier: 'low' removes dust devils
 *
 * Easter-egg hooks:
 *   - festival: full chase with 6 headlight pairs
 *   - reveal (witness me): chrome-mouth spray blooms from bottom edge
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/wasteland.webp' + qs;
	}

	function makeCars( count ) {
		var out = [];
		for ( var i = 0; i < count; i++ ) {
			out.push( { t: Math.random(), lane: h.rand( -0.08, 0.08 ), speed: h.rand( 0.003, 0.006 ) } );
		}
		return out;
	}

	window.__bRoll.scenes[ 'wasteland' ] = {
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

			var tint = new PIXI.Graphics(); app.stage.addChild( tint );
			var dust = new PIXI.Graphics(); app.stage.addChild( dust );

			var bloom = h.makeBloomLayer( PIXI, 10 );
			app.stage.addChild( bloom );
			var roadGlow = new PIXI.Graphics(); bloom.addChild( roadGlow );
			var flares   = new PIXI.Graphics(); bloom.addChild( flares );

			var chromeVeil = new PIXI.Graphics(); chromeVeil.alpha = 0;
			app.stage.addChild( chromeVeil );

			var fg = new PIXI.Container();
			app.stage.addChild( fg );
			var shared = await h.mountSharedDrifters( app, PIXI, [ 'crow' ], fg );
			var cutouts = await h.mountCutouts( app, PIXI, 'wasteland', fg );

			// Dust-devil vortices along the horizon.
			var devils = [];
			for ( var di = 0; di < 3; di++ ) {
				devils.push( {
					x: Math.random(),
					y: h.rand( 0.55, 0.62 ),
					size: h.rand( 0.4, 0.9 ),
					vx: h.rand( 0.0003, 0.0010 ) * ( Math.random() < 0.5 ? -1 : 1 ),
					twist: h.rand( 0.01, 0.03 ),
				} );
			}

			// Flare points: warm highlights on the bluff.
			var flarePts = [];
			for ( var fi = 0; fi < 30; fi++ ) {
				flarePts.push( {
					x: h.rand( 0.05, 0.95 ),
					y: h.rand( 0.6, 0.85 ),
					size: h.rand( 0.6, 2.0 ),
					phase: h.rand( 0, h.tau ),
					freq: h.rand( 0.01, 0.03 ),
				} );
			}

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				tint: tint, dust: dust, roadGlow: roadGlow, flares: flares, chromeVeil: chromeVeil, bloom: bloom,
				shared: shared, cutouts: cutouts,
				cars: makeCars( 2 ),
				devils: devils, flarePts: flarePts,
				time: 0,
				nextWow: 60 * h.rand( 50, 75 ),
				vaulter: -1,
			};
		},

		onResize: function ( state ) { state.fitBackdrop(); },

		stillFrame: function ( state, env ) {
			state.time = 40;
			for ( var i = 0; i < state.cars.length; i++ ) state.cars[ i ].t = 0.75;
			this.tick( state, env );
		},

		transitionOut: function ( state, env, done ) {
			// All headlights sprint forward then blackout.
			var steps = 20;
			var i = 0;
			var itv = setInterval( function () {
				i++;
				for ( var k = 0; k < state.cars.length; k++ ) {
					state.cars[ k ].t = Math.min( 1, state.cars[ k ].t + 0.08 );
				}
				if ( i >= steps ) { clearInterval( itv ); done(); }
			}, 25 );
		},

		onEgg: function ( name, state, env ) {
			if ( name === 'festival' ) {
				state.cars = makeCars( 6 );
				state.chromeVeil.alpha = 0.45;
			} else if ( name === 'reveal' ) {
				state.chromeVeil.alpha = 0.6;
			} else if ( name === 'peek' ) {
				state.vaulter = 0;
			}
		},

		onAudio: function ( state, env ) {
			if ( env.audio.bass > 0.55 && state.cars.length < 4 ) {
				state.cars.push( { t: 0, lane: h.rand( -0.12, 0.12 ), speed: h.rand( 0.005, 0.01 ) } );
			}
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.time += dt;
			h.tickDrifters( state.shared, env );
			h.tickDrifters( state.cutouts, env );

			// --- TOD tint --------------------------------------- //
			state.tint.clear();
			if ( env.tod === 'dusk' ) {
				state.tint.rect( 0, 0, w, hh ).fill( { color: 0xff5a20, alpha: 0.18 } );
			} else if ( env.tod === 'night' ) {
				state.tint.rect( 0, 0, w, hh ).fill( { color: 0x1a0808, alpha: 0.4 } );
			}

			// --- Headlight chase along vanishing road ----------- //
			// Road vanishes roughly at (0.5, 0.55). Cars lerp along
			// a parabolic path toward the bottom of the frame.
			var vpx = 0.5, vpy = 0.55;
			state.roadGlow.clear();
			for ( var ci = 0; ci < state.cars.length; ci++ ) {
				var car = state.cars[ ci ];
				car.t += car.speed * dt;
				if ( car.t > 1.08 ) car.t = 0;
				var progT = car.t;
				var ease  = progT * progT;
				var cx = ( vpx + car.lane * ease ) * w;
				var cy = ( vpy + ( 0.42 ) * ease ) * hh;
				var sz = 4 + ease * 48;
				// Twin headlights: two circles side by side.
				var offset = 2 + ease * 26;
				state.roadGlow.circle( cx - offset, cy, sz ).fill( { color: 0xfff5c4, alpha: 0.85 } );
				state.roadGlow.circle( cx + offset, cy, sz ).fill( { color: 0xfff5c4, alpha: 0.85 } );
				state.roadGlow.circle( cx, cy + sz * 0.2, sz * 1.8 ).fill( { color: 0xff8030, alpha: 0.25 } );
			}

			// --- Dust devils ------------------------------------ //
			state.dust.clear();
			if ( env.perfTier !== 'low' ) {
				for ( var dvi = 0; dvi < state.devils.length; dvi++ ) {
					var d = state.devils[ dvi ];
					d.x += d.vx * dt;
					if ( d.x > 1.05 ) d.x = -0.05;
					if ( d.x < -0.05 ) d.x = 1.05;
					var bx = d.x * w, by = d.y * hh;
					var rings = 8;
					for ( var ri = 0; ri < rings; ri++ ) {
						var r = ri * 8 * d.size;
						var a = Math.sin( state.time * d.twist + ri + dvi ) * 4 * d.size;
						state.dust.circle( bx + a, by - r * 0.5, 2 + ri * 0.7 ).fill( { color: 0xd89c58, alpha: 0.14 - ri * 0.015 } );
					}
				}
			}

			// --- Flares ----------------------------------------- //
			state.flares.clear();
			for ( var pi = 0; pi < state.flarePts.length; pi++ ) {
				var pt = state.flarePts[ pi ];
				var base = 0.3 + 0.4 * Math.sin( state.time * pt.freq + pt.phase );
				var boost = env.audio.enabled ? ( 0.5 + env.audio.level * 0.9 ) : 1;
				state.flares.circle( pt.x * w, pt.y * hh, pt.size * boost ).fill( { color: 0xffcc80, alpha: Math.max( 0, base ) * 0.85 } );
			}

			// --- Rare wow vaulter ------------------------------- //
			state.nextWow -= dt;
			if ( state.nextWow <= 0 && state.vaulter < 0 ) {
				state.vaulter = 0;
				state.chromeVeil.alpha = 0.25;
				state.nextWow = 60 * h.rand( 50, 80 );
			}
			if ( state.vaulter >= 0 ) {
				state.vaulter += dt;
				var vp = state.vaulter / 120;
				if ( vp > 1 ) { state.vaulter = -1; }
				else {
					var vx = vp * w;
					var vy = hh * 0.22 + Math.sin( vp * Math.PI ) * -60;
					state.roadGlow.rect( vx - 16, vy, 32, 6 ).fill( { color: 0x221108, alpha: 0.9 } );
					state.roadGlow.rect( vx - 3, vy - 20, 6, 22 ).fill( { color: 0x221108, alpha: 0.9 } );
				}
			}

			// --- Chrome veil ------------------------------------ //
			if ( state.chromeVeil.alpha > 0.01 ) {
				state.chromeVeil.clear().rect( 0, hh * 0.7, w, hh * 0.3 ).fill( { color: 0xe8f0ff, alpha: 1 } );
				state.chromeVeil.alpha = Math.max( 0, state.chromeVeil.alpha - dt * 0.007 );
			}
		},
	};
} )();
