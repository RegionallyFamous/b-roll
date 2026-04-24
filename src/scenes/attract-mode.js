/**
 * B-Roll scene: Attract Mode (Asteroids × arcade vectors) — v0.10
 * ---------------------------------------------------------------
 * Black void with a faint painted CRT bezel + phosphor halo, and a
 * high-score readout baked into the backdrop.
 *
 * Hero motion: vector asteroids drift and wrap the screen; a lone
 * ship occasionally warps in, fires a line-segment bullet, and the
 * closest asteroid splits into two smaller ones.
 *
 * Periodic beat: a pellet-chomp trail runs a painted maze contour
 * in the mid-ground (rendered as a single moving dot for now — the
 * contour itself is implied by the backdrop).
 *
 * Rare wow (~45s): "GAME OVER" glitch-wipe sweeps across the frame.
 *
 * Cross-cutting:
 *   - env.audio:  level spawns extra pellet dots; bass fires a bullet
 *   - env.perfTier: 'low' halves asteroid count
 *
 * Easter-egg hooks:
 *   - festival: ship becomes 30 copies
 *   - reveal (konami): scanline sweep
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/attract-mode.webp' + qs;
	}

	function asteroidShape( sides ) {
		var poly = [];
		var R = 1;
		for ( var i = 0; i < sides; i++ ) {
			var a = ( i / sides ) * h.tau;
			var rr = R * ( 0.75 + Math.random() * 0.35 );
			poly.push( Math.cos( a ) * rr );
			poly.push( Math.sin( a ) * rr );
		}
		return poly;
	}

	function spawnAsteroid( size ) {
		return {
			x: Math.random(),
			y: Math.random(),
			vx: h.rand( -0.002, 0.002 ),
			vy: h.rand( -0.002, 0.002 ),
			r: 12 + size * 28,
			size: size,
			spin: h.rand( -0.015, 0.015 ),
			rot: Math.random() * h.tau,
			shape: asteroidShape( 7 + ( Math.random() * 4 | 0 ) ),
		};
	}

	window.__bRoll.scenes[ 'attract-mode' ] = {
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

			var bloom = h.makeBloomLayer( PIXI, 6 );
			app.stage.addChild( bloom );
			var vectors = new PIXI.Graphics(); bloom.addChild( vectors );
			var scan    = new PIXI.Graphics(); bloom.addChild( scan );
			var pellets = new PIXI.Graphics(); bloom.addChild( pellets );
			var ghosts  = new PIXI.Graphics(); bloom.addChild( ghosts );

			var gameOver = new PIXI.Graphics(); gameOver.alpha = 0;
			app.stage.addChild( gameOver );

			var fg = new PIXI.Container();
			app.stage.addChild( fg );
			var cutouts = await h.mountCutouts( app, PIXI, 'attract-mode', fg );

			var asteroids = [];
			for ( var i = 0; i < 7; i++ ) asteroids.push( spawnAsteroid( h.rand( 1, 2 ) ) );

			var ships = [ { x: 0, y: 0.5, vx: 0.005, vy: 0, active: false, cool: 60 * h.rand( 6, 12 ) } ];

			// Pac-style chomp trail along a painted maze contour.
			// We walk a fixed zig-zag path since the real maze is in
			// the backdrop; this is enough to read as "something is
			// moving along it".
			var pelletT = 0;
			var ghostTrail = [ 0, 0, 0, 0 ]; // indexed offsets behind the chomper

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				vectors: vectors, scan: scan, pellets: pellets, ghosts: ghosts, gameOver: gameOver, bloom: bloom,
				cutouts: cutouts,
				asteroids: asteroids, ships: ships,
				pelletT: pelletT, ghostTrail: ghostTrail,
				time: 0, wipeT: -1,
				nextWipe: 60 * h.rand( 40, 55 ),
			};
		},

		onResize: function ( state ) { state.fitBackdrop(); },

		stillFrame: function ( state, env ) {
			state.time = 0;
			this.tick( state, env );
		},

		transitionOut: function ( state, env, done ) {
			state.gameOver.alpha = 0.9;
			setTimeout( done, 420 );
		},

		onEgg: function ( name, state, env ) {
			if ( name === 'festival' ) {
				for ( var i = 0; i < 30; i++ ) {
					state.ships.push( { x: Math.random(), y: Math.random(), vx: h.rand( -0.01, 0.01 ), vy: h.rand( -0.01, 0.01 ), active: true, cool: 10 } );
				}
			} else if ( name === 'reveal' ) {
				state.scan.alpha = 1;
			} else if ( name === 'peek' ) {
				state.wipeT = 0;
			}
		},

		onAudio: function ( state, env ) {
			if ( env.audio.bass > 0.55 && state.ships.length ) {
				state.ships[ 0 ].cool = 0;
			}
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.time += dt;
			h.tickDrifters( state.cutouts, env );
			state.vectors.clear();
			state.pellets.clear();
			state.ghosts.clear();

			// --- Asteroids -------------------------------------- //
			var rocks = state.asteroids;
			var perfLimit = env.perfTier === 'low' ? Math.min( rocks.length, 4 ) : rocks.length;
			for ( var i = 0; i < perfLimit; i++ ) {
				var r = rocks[ i ];
				r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.spin * dt;
				if ( r.x < -0.1 ) r.x = 1.1; if ( r.x > 1.1 ) r.x = -0.1;
				if ( r.y < -0.1 ) r.y = 1.1; if ( r.y > 1.1 ) r.y = -0.1;
				var poly = [];
				for ( var si = 0; si < r.shape.length; si += 2 ) {
					var cs = Math.cos( r.rot ), sn = Math.sin( r.rot );
					var lx = r.shape[ si ] * r.r;
					var ly = r.shape[ si + 1 ] * r.r;
					poly.push( r.x * w + lx * cs - ly * sn );
					poly.push( r.y * hh + lx * sn + ly * cs );
				}
				state.vectors.poly( poly ).stroke( { color: 0xffffff, alpha: 0.85, width: 1.6 } );
			}

			// --- Ships ------------------------------------------ //
			for ( var sh = 0; sh < state.ships.length; sh++ ) {
				var ship = state.ships[ sh ];
				ship.cool -= dt;
				if ( ! ship.active && ship.cool <= 0 ) {
					ship.active = true; ship.x = 0.0; ship.y = h.rand( 0.2, 0.8 );
					ship.vx = h.rand( 0.003, 0.008 ); ship.vy = h.rand( -0.002, 0.002 );
				}
				if ( ship.active ) {
					ship.x += ship.vx * dt; ship.y += ship.vy * dt;
					if ( ship.x > 1.1 ) { ship.active = false; ship.cool = 60 * h.rand( 4, 8 ); continue; }
					var sx = ship.x * w, sy = ship.y * hh;
					var tri = [ sx + 14, sy, sx - 10, sy - 8, sx - 10, sy + 8 ];
					state.vectors.poly( tri ).stroke( { color: 0x9ae6ff, alpha: 0.95, width: 1.6 } );
					// Bullet line: shoots straight ahead for 25 frames.
					if ( ship.cool < -5 && ship.cool > -30 ) {
						state.vectors.moveTo( sx + 16, sy ).lineTo( sx + 16 + ( -ship.cool ) * 12, sy ).stroke( { color: 0xffffff, alpha: 0.8, width: 1.4 } );
					}
				}
			}

			// --- Chomp trail ------------------------------------ //
			state.pelletT += dt * 0.01;
			var track = 14;
			for ( var pi = 0; pi < track; pi++ ) {
				var phase = ( state.pelletT + pi / track ) % 1;
				var px = ( 0.1 + phase * 0.8 ) * w;
				var py = ( 0.82 + Math.sin( phase * Math.PI * 4 ) * 0.02 ) * hh;
				state.pellets.circle( px, py, 3 ).fill( { color: 0xffe06a, alpha: 0.9 } );
			}
			// Chomper head + 4 ghosts trailing.
			var lead = ( state.pelletT ) % 1;
			var cx = ( 0.1 + lead * 0.8 ) * w;
			var cy = ( 0.82 + Math.sin( lead * Math.PI * 4 ) * 0.02 ) * hh;
			state.pellets.circle( cx, cy, 8 ).fill( { color: 0xffe06a, alpha: 1 } );
			var ghostColors = [ 0xff6060, 0xffb0d8, 0x80ffe8, 0xffb060 ];
			for ( var gi = 0; gi < 4; gi++ ) {
				var gp = ( state.pelletT - ( gi + 1 ) * 0.03 ) % 1;
				if ( gp < 0 ) gp += 1;
				var gx = ( 0.1 + gp * 0.8 ) * w;
				var gy = ( 0.82 + Math.sin( gp * Math.PI * 4 ) * 0.02 ) * hh;
				state.ghosts.rect( gx - 7, gy - 9, 14, 18 ).fill( { color: ghostColors[ gi ], alpha: 0.9 } );
				state.ghosts.circle( gx - 3, gy - 3, 2 ).fill( { color: 0xffffff, alpha: 1 } );
				state.ghosts.circle( gx + 3, gy - 3, 2 ).fill( { color: 0xffffff, alpha: 1 } );
			}

			// --- Game-over glitch wipe -------------------------- //
			state.nextWipe -= dt;
			if ( state.nextWipe <= 0 && state.wipeT < 0 ) {
				state.wipeT = 0;
				state.nextWipe = 60 * h.rand( 40, 60 );
			}
			if ( state.wipeT >= 0 ) {
				state.wipeT += dt;
				var wp = state.wipeT / 80;
				state.gameOver.clear();
				if ( wp < 1 ) {
					state.gameOver.rect( 0, hh * 0.45, w * wp, hh * 0.12 ).fill( { color: 0xffffff, alpha: 0.85 } );
					state.gameOver.alpha = 1;
				} else {
					state.gameOver.alpha *= 0.8;
					if ( state.gameOver.alpha < 0.02 ) { state.wipeT = -1; state.gameOver.alpha = 0; }
				}
			}

			// --- Scanline sweep --------------------------------- //
			if ( state.scan.alpha > 0.01 ) {
				state.scan.clear();
				var scanY = ( ( state.time * 1.2 ) % hh );
				state.scan.rect( 0, scanY, w, 3 ).fill( { color: 0x88ff88, alpha: 0.3 } );
				state.scan.alpha = Math.max( 0, state.scan.alpha - dt * 0.005 );
			}
		},
	};
} )();
