/**
 * B-Roll scene: The Grid (Tron) — v0.5
 * ---------------------------------------------------------------
 * Painted backdrop (assets/wallpapers/tron-grid.jpg — sunset sky,
 * horizon glow, distant moons, and a dark reflective plain
 * stretching to the vanishing point) loaded as a Sprite. On top:
 * a perspective grid with horizontal rows that scroll toward the
 * viewer and grow brighter/wider as they approach. Near-row
 * intersections gain small bright dots so the grid "flashes" as
 * cells pass under the camera.
 *
 * Two light cycles step cell-by-cell on the grid leaving long
 * fade-trails drawn in crisp + bloom passes. Data-packet sprites
 * periodically spawn at a cycle head and travel backward along
 * the trail toward the tail, glowing as they go. When a cycle
 * head intersects another cycle's trail, a collision flash
 * detonates and the colliding cycle respawns.
 *
 * The v0.4 bg gradient + horizon glow + floor reflection band
 * are now baked into the painting.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	var N_ROWS = 14;
	var CYCLE_COLORS = [ 0x00eaff, 0xff6d1f ];

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/tron-grid.jpg' + qs;
	}

	window.__bRoll.scenes[ 'tron-grid' ] = {
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

			var grid    = new PIXI.Graphics(); app.stage.addChild( grid );
			var dots    = new PIXI.Graphics(); app.stage.addChild( dots );
			var trails  = new PIXI.Graphics(); app.stage.addChild( trails );
			var packets = new PIXI.Graphics(); app.stage.addChild( packets );

			var bloom = h.makeBloomLayer( PIXI, 10 );
			app.stage.addChild( bloom );
			var bloomGrid    = new PIXI.Graphics(); bloom.addChild( bloomGrid );
			var bloomTrails  = new PIXI.Graphics(); bloom.addChild( bloomTrails );
			var bloomPackets = new PIXI.Graphics(); bloom.addChild( bloomPackets );

			var flash = new PIXI.Graphics(); flash.alpha = 0; app.stage.addChild( flash );

			var fg = new PIXI.Container();
			app.stage.addChild( fg );
			var drifters = await h.mountCutouts( app, PIXI, 'tron-grid', fg );

			function makeCycle( color, gx, gy, dir ) {
				return {
					gx: gx != null ? gx : h.irand( 2, 18 ),
					gy: gy != null ? gy : h.irand( 2, 14 ),
					dir: dir != null ? dir : h.irand( 0, 4 ),
					color: color,
					trail: [],
					stepT: 0,
					interval: 8,
				};
			}
			var cycles = [
				makeCycle( CYCLE_COLORS[ 0 ], 4, 4, 0 ),
				makeCycle( CYCLE_COLORS[ 1 ], 16, 12, 2 ),
			];
			var dataPackets = [];
			var collisions = [];

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				grid: grid, dots: dots, trails: trails, packets: packets,
				bloomGrid: bloomGrid, bloomTrails: bloomTrails,
				bloomPackets: bloomPackets, flash: flash,
				cycles: cycles, dataPackets: dataPackets, collisions: collisions,
				makeCycle: makeCycle,
				phase: 0,
				packetCD: h.rand( 90, 240 ),
				fg: fg, drifters: drifters,
			};
		},

		onResize: function ( state ) {
			state.fitBackdrop();
		},

		onEgg: function ( name, state, env ) {
			if ( name === 'festival' ) {
				h.showEggDrifter( state.drifters, 'mcp.webp', { resetT: true } );
				state.flash.clear().rect( 0, 0, env.app.renderer.width, env.app.renderer.height )
					.fill( { color: 0xff6d1f, alpha: 0.6 } );
				state.flash.alpha = 1;
				setTimeout( function () { h.hideEggDrifter( state.drifters, 'mcp.webp' ); }, 10000 );
			} else if ( name === 'reveal' ) {
				// Type 'tron' → both cycles speed up + force packet bursts.
				for ( var i = 0; i < state.cycles.length; i++ ) state.cycles[ i ].interval = 3;
				setTimeout( function () {
					for ( var j = 0; j < state.cycles.length; j++ ) state.cycles[ j ].interval = 8;
				}, 6000 );
				state.packetCD = 0;
			} else if ( name === 'peek' ) {
				h.showEggDrifter( state.drifters, 'disc.webp', { scaleMul: 2.0, resetT: true } );
				setTimeout( function () { h.hideEggDrifter( state.drifters, 'disc.webp' ); }, 4000 );
			}
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var hy = hh * 0.52;
			var floorH = hh - hy;
			h.tickDrifters( state.drifters, env );

			// Convert (gx, gy) grid space to (sx, sy) screen space.
			// gx: 0..20 across, gy: 0..16 deep.
			function project( gx, gy ) {
				var frac = ( ( gy + state.phase ) % N_ROWS ) / N_ROWS;
				var sy = hy + Math.pow( frac, 2.0 ) * floorH;
				var persp = 0.25 + frac * 0.75;
				var sx = w / 2 + ( gx - 10 ) * ( w / 28 ) * persp;
				return { x: sx, y: sy, frac: frac };
			}

			// --- Animated grid floor --------------------------------- //
			state.phase += dt * 0.035;
			state.grid.clear(); state.dots.clear(); state.bloomGrid.clear();

			// Vertical convergence lines.
			for ( var c = -14; c <= 14; c++ ) {
				var xNear = w / 2 + c * ( w / 28 );
				var xHor  = w / 2 + c * ( w / 56 );
				state.grid.moveTo( xNear, hh ).lineTo( xHor, hy ).stroke( {
					color: 0x00aaff, alpha: 0.28, width: 0.8,
				} );
			}

			// Horizontal rows.
			for ( var r = 0; r < N_ROWS; r++ ) {
				var frac = ( ( r + state.phase ) % N_ROWS ) / N_ROWS;
				var yRow = hy + Math.pow( frac, 2.0 ) * floorH;
				var a = 0.18 + frac * 0.85;
				var ww = 0.6 + frac * 1.6;
				state.grid.moveTo( 0, yRow ).lineTo( w, yRow ).stroke( {
					color: 0x00aaff, alpha: Math.min( 1, a ), width: ww,
				} );
				// Bloom pass for the near half of the rows only.
				if ( frac > 0.55 ) {
					state.bloomGrid.moveTo( 0, yRow ).lineTo( w, yRow ).stroke( {
						color: 0x40d8ff, alpha: ( frac - 0.55 ) * 1.6, width: ww * 1.6,
					} );
				}
				// Intersection dots on the nearer half of the rows.
				if ( frac > 0.4 ) {
					for ( var ic = -12; ic <= 12; ic++ ) {
						var persp = 0.25 + frac * 0.75;
						var ix = w / 2 + ic * ( w / 28 ) * persp;
						var da = ( frac - 0.35 ) * 1.4;
						state.dots.circle( ix, yRow, 0.6 + frac * 1.8 ).fill( {
							color: 0x9ef2ff, alpha: Math.min( 0.9, da ),
						} );
					}
				}
			}

			// --- Cycles --------------------------------------------- //
			var dirs = [ [ 1, 0 ], [ 0, 1 ], [ -1, 0 ], [ 0, -1 ] ];
			for ( var i = 0; i < state.cycles.length; i++ ) {
				var cy = state.cycles[ i ];
				cy.stepT += dt;
				if ( cy.stepT >= cy.interval ) {
					cy.stepT = 0;
					var d = dirs[ cy.dir ];
					cy.gx += d[ 0 ]; cy.gy += d[ 1 ];
					if ( Math.random() < 0.18 ) {
						cy.dir = ( cy.dir + ( Math.random() < 0.5 ? 1 : 3 ) ) % 4;
					}
					var p = project( cy.gx, cy.gy );
					cy.trail.push( { x: p.x, y: p.y, gx: cy.gx, gy: cy.gy, life: 1 } );
					if ( cy.trail.length > 140 ) cy.trail.shift();
					if ( cy.gx < -3 || cy.gx > 23 || cy.gy < -1 || cy.gy > 18 ) {
						Object.assign( cy, state.makeCycle( cy.color ) );
					}
					// Collision check: cycle head vs the OTHER cycle's trail.
					for ( var oi = 0; oi < state.cycles.length; oi++ ) {
						if ( oi === i ) continue;
						var other = state.cycles[ oi ];
						for ( var ti = 0; ti < other.trail.length - 4; ti++ ) {
							var pt = other.trail[ ti ];
							if ( pt.gx === cy.gx && pt.gy === cy.gy ) {
								state.collisions.push( { x: p.x, y: p.y, life: 1 } );
								state.flash.clear().rect( 0, 0, w, hh ).fill( {
									color: 0xeaf6ff, alpha: 1,
								} );
								state.flash.alpha = 0.45;
								Object.assign( cy, state.makeCycle( cy.color ) );
								break;
							}
						}
					}
				}
			}

			// --- Trails + heads ------------------------------------- //
			state.trails.clear(); state.bloomTrails.clear();
			for ( var cc = 0; cc < state.cycles.length; cc++ ) {
				var cyc = state.cycles[ cc ];
				for ( var tt = cyc.trail.length - 1; tt >= 1; tt-- ) {
					var a0 = cyc.trail[ tt - 1 ], b0 = cyc.trail[ tt ];
					state.trails.moveTo( a0.x, a0.y ).lineTo( b0.x, b0.y ).stroke( {
						color: cyc.color, alpha: b0.life * 0.95, width: 2,
					} );
					state.bloomTrails.moveTo( a0.x, a0.y ).lineTo( b0.x, b0.y ).stroke( {
						color: cyc.color, alpha: b0.life * 0.7, width: 4.5,
					} );
					b0.life = Math.max( 0, b0.life - 0.006 * dt );
				}
				if ( cyc.trail.length ) {
					var head = cyc.trail[ cyc.trail.length - 1 ];
					state.trails.rect( head.x - 5, head.y - 2.5, 10, 5 ).fill( 0xffffff );
					state.bloomTrails.circle( head.x, head.y, 8 ).fill( {
						color: cyc.color, alpha: 0.75,
					} );
					state.bloomTrails.circle( head.x, head.y, 14 ).fill( {
						color: cyc.color, alpha: 0.35,
					} );
				}
			}

			// --- Data packets --------------------------------------- //
			state.packetCD -= dt;
			if ( state.packetCD <= 0 ) {
				state.packetCD = h.rand( 60, 200 );
				var host = h.choose( state.cycles );
				if ( host.trail.length > 6 ) {
					state.dataPackets.push( {
						cycle: host,
						t: host.trail.length - 1,
						speed: h.rand( 0.3, 1.0 ),
						color: host.color,
					} );
				}
			}
			state.packets.clear(); state.bloomPackets.clear();
			for ( var pi = state.dataPackets.length - 1; pi >= 0; pi-- ) {
				var pk = state.dataPackets[ pi ];
				pk.t -= pk.speed * dt;
				if ( pk.t < 0 || !pk.cycle.trail.length ) {
					state.dataPackets.splice( pi, 1 );
					continue;
				}
				var it = Math.floor( pk.t );
				if ( it >= pk.cycle.trail.length ) continue;
				var pkt = pk.cycle.trail[ it ];
				if ( pkt.life <= 0 ) {
					state.dataPackets.splice( pi, 1 );
					continue;
				}
				state.packets.circle( pkt.x, pkt.y, 2.2 ).fill( 0xffffff );
				state.bloomPackets.circle( pkt.x, pkt.y, 5 ).fill( {
					color: pk.color, alpha: 0.85,
				} );
				state.bloomPackets.circle( pkt.x, pkt.y, 10 ).fill( {
					color: pk.color, alpha: 0.4,
				} );
			}

			// --- Collision rings ------------------------------------ //
			for ( var ci = state.collisions.length - 1; ci >= 0; ci-- ) {
				var co = state.collisions[ ci ];
				state.bloomTrails.circle( co.x, co.y, ( 1 - co.life ) * 40 ).stroke( {
					color: 0xffffff, alpha: co.life, width: 2,
				} );
				state.bloomTrails.circle( co.x, co.y, ( 1 - co.life ) * 70 ).stroke( {
					color: 0xffffff, alpha: co.life * 0.4, width: 1,
				} );
				co.life -= 0.04 * dt;
				if ( co.life <= 0 ) state.collisions.splice( ci, 1 );
			}

			if ( state.flash.alpha > 0 ) {
				state.flash.alpha = Math.max( 0, state.flash.alpha - 0.08 * dt );
			}
		},
	};
} )();
