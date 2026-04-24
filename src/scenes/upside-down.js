/**
 * B-Roll scene: The Upside Down (Stranger Things) — v0.5
 * ---------------------------------------------------------------
 * Painted backdrop (assets/wallpapers/upside-down.jpg — heavy
 * red-violet fog, dense oxblood smoke at the base, faint ember
 * highlights) loaded as a Sprite. On top: 3 depth tiers of
 * drifting spores, ash flakes with subtle chromatic aberration,
 * and tendrils that animate as four distinct life phases — grow
 * (ink spreading from an edge along a quadratic curve), hold,
 * retract (shrinking back), gone (sleep) — then respawn with
 * fresh endpoints.
 *
 * Red lightning strikes now also brighten the entire scene via a
 * short white/red veil flash. Every 30–90 seconds a bright static
 * line sweeps from the top of the frame to the bottom like a TV
 * rolling out of sync. A CRT scanline overlay and a 3-channel
 * chromatic glitch title card round it out. The v0.4 horizontal
 * murk gradient is now baked into the painting.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	var CHAPTERS = [ 'CHAPTER ONE', 'CHAPTER TWO', 'CHAPTER SIX', 'VECNA', 'HAWKINS', 'THE MIND FLAYER' ];

	// Spore depth buckets (far/mid/near) for parallax.
	var SPORE_BUCKETS = [
		{ name: 'far',  size: [ 0.6, 1.4 ], vy: [ 0.05, 0.2 ], alpha: 0.45, halo: 2.0, count: 70 },
		{ name: 'mid',  size: [ 1.2, 2.4 ], vy: [ 0.15, 0.4 ], alpha: 0.75, halo: 2.4, count: 50 },
		{ name: 'near', size: [ 2.0, 3.4 ], vy: [ 0.3,  0.7 ], alpha: 0.95, halo: 2.8, count: 28 },
	];

	function randomTendril( w, hh ) {
		// Pick a random edge, spawn a quadratic curve inward.
		var edge = Math.floor( Math.random() * 4 );
		var x0, y0, x1, y1, cpx, cpy;
		if ( edge === 0 ) {        // left
			x0 = 0; y0 = h.rand( 10, hh - 10 );
			x1 = h.rand( 40, w * 0.45 ); y1 = y0 + h.rand( -80, 80 );
		} else if ( edge === 1 ) { // right
			x0 = w; y0 = h.rand( 10, hh - 10 );
			x1 = w - h.rand( 40, w * 0.45 ); y1 = y0 + h.rand( -80, 80 );
		} else if ( edge === 2 ) { // top
			x0 = h.rand( 10, w - 10 ); y0 = 0;
			x1 = x0 + h.rand( -80, 80 ); y1 = h.rand( 40, hh * 0.45 );
		} else {                   // bottom
			x0 = h.rand( 10, w - 10 ); y0 = hh;
			x1 = x0 + h.rand( -80, 80 ); y1 = hh - h.rand( 40, hh * 0.45 );
		}
		cpx = ( x0 + x1 ) / 2 + h.rand( -80, 80 );
		cpy = ( y0 + y1 ) / 2 + h.rand( -80, 80 );
		return {
			x0: x0, y0: y0, x1: x1, y1: y1, cpx: cpx, cpy: cpy,
			growth: 0, phase: 'grow',
			timer: 0,
			growSpeed: h.rand( 0.006, 0.012 ),
			holdTime: h.rand( 60 * 2, 60 * 8 ),
			sleepTime: h.rand( 60 * 1, 60 * 5 ),
			thick: h.rand( 1, 1.8 ),
		};
	}

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/upside-down.jpg' + qs;
	}

	window.__bRoll.scenes[ 'upside-down' ] = {
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

			var veil      = new PIXI.Graphics(); app.stage.addChild( veil );
			var flash     = new PIXI.Graphics(); app.stage.addChild( flash );
			var tendrils  = new PIXI.Graphics(); app.stage.addChild( tendrils );
			var ashLayer  = new PIXI.Graphics(); app.stage.addChild( ashLayer );
			var sporeLayer = new PIXI.Graphics(); app.stage.addChild( sporeLayer );
			var sweep     = new PIXI.Graphics(); app.stage.addChild( sweep );

			// Build spore sets per bucket.
			var spores = [];
			SPORE_BUCKETS.forEach( function ( B ) {
				for ( var k = 0; k < B.count; k++ ) {
					spores.push( {
						bucket: B,
						x: h.rand( 0, w ), y: h.rand( 0, hh ),
						r: h.rand( B.size[ 0 ], B.size[ 1 ] ),
						vy: -h.rand( B.vy[ 0 ], B.vy[ 1 ] ),
						phase: Math.random() * h.tau, spin: h.rand( 0.01, 0.05 ),
					} );
				}
			} );

			// Ash flakes (heavier, falling slowly downward).
			var ash = [];
			for ( var ai = 0; ai < 36; ai++ ) {
				ash.push( {
					x: h.rand( 0, w ), y: h.rand( 0, hh ),
					vx: h.rand( -0.15, 0.15 ), vy: h.rand( 0.08, 0.35 ),
					r: h.rand( 0.8, 1.8 ),
					tilt: Math.random() * h.tau, tiltSpin: h.rand( 0.02, 0.05 ),
				} );
			}

			// Tendrils as animated life-cycle objects.
			var tendrilList = [];
			for ( var ti = 0; ti < 6; ti++ ) {
				var t = randomTendril( w, hh );
				// Stagger: some start mid-grow, some idle.
				t.growth = Math.random() * 0.4;
				tendrilList.push( t );
			}

			var scan = new PIXI.Graphics();
			scan.alpha = 0.08;
			app.stage.addChild( scan );
			function drawScan() {
				scan.clear();
				var w = app.renderer.width, hh = app.renderer.height;
				for ( var y = 0; y < hh; y += 3 ) scan.rect( 0, y, w, 1 ).fill( 0x000000 );
			}
			drawScan();

			var card = new PIXI.Container();
			var tR = new PIXI.Text( {
				text: h.choose( CHAPTERS ),
				style: { fontFamily: 'Georgia,serif', fontSize: 44, fill: 0xff2420, letterSpacing: 3, fontStyle: 'italic' },
			} );
			var tG = new PIXI.Text( { text: tR.text, style: Object.assign( {}, tR.style, { fill: 0x00ffaa } ) } );
			var tB = new PIXI.Text( { text: tR.text, style: Object.assign( {}, tR.style, { fill: 0x64e0ff } ) } );
			tR.anchor.set( 0.5 ); tG.anchor.set( 0.5 ); tB.anchor.set( 0.5 );
			card.addChild( tB ); card.addChild( tG ); card.addChild( tR );
			card.alpha = 0;
			card.x = w / 2; card.y = hh * 0.45;
			app.stage.addChild( card );

			var fg = new PIXI.Container();
			app.stage.addChild( fg );
			var drifters = await h.mountCutouts( app, PIXI, 'upside-down', fg );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				veil: veil, flash: flash, tendrils: tendrils,
				ashLayer: ashLayer, ash: ash,
				sporeLayer: sporeLayer, spores: spores,
				sweep: sweep, sweepY: -1, sweepCD: h.rand( 60 * 30, 60 * 90 ),
				scan: scan, drawScan: drawScan,
				tendrilList: tendrilList,
				card: card, tR: tR, tG: tG, tB: tB,
				cardT: h.rand( 60 * 30, 60 * 75 ), cardPhase: 'idle', hold: 0,
				lightT: h.rand( 60 * 10, 60 * 25 ), lightLife: 0,
				flashLife: 0,
				time: 0,
				fg: fg, drifters: drifters,
			};
		},

		onEgg: function ( name, state, env ) {
			if ( name === 'festival' ) {
				// Konami → Demogorgon stomps in for a moment.
				h.showEggDrifter( state.drifters, 'demogorgon.png', { resetT: true, scaleMul: 1.2 } );
				state.lightLife = 1;
				state.flashLife = 1;
				setTimeout( function () { h.hideEggDrifter( state.drifters, 'demogorgon.png' ); }, 6000 );
			} else if ( name === 'reveal' ) {
				// Type 'hawkins' → fire title card immediately.
				state.cardPhase = 'in';
				state.tR.text = 'RUN'; state.tG.text = 'RUN'; state.tB.text = 'RUN';
				state.card.alpha = 0;
				state.lightLife = 1;
				state.flashLife = 1;
			} else if ( name === 'peek' ) {
				// Triple-click → quick lightning sweep.
				state.sweepY = 0;
				state.lightLife = 1;
			}
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			state.drawScan();
			state.card.x = env.app.renderer.width / 2;
			state.card.y = env.app.renderer.height * 0.45;
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.time += dt;
			h.tickDrifters( state.drifters, env );

			// --- Spores with parallax --------------------------- //
			state.sporeLayer.clear();
			for ( var s = 0; s < state.spores.length; s++ ) {
				var sp = state.spores[ s ];
				sp.phase += sp.spin * dt;
				sp.y += sp.vy * dt;
				var px = sp.x + Math.sin( sp.phase * 2 ) * 8;
				if ( sp.y < -10 ) { sp.y = hh + 10; sp.x = h.rand( 0, w ); }
				state.sporeLayer.circle( px, sp.y, sp.r )
					.fill( { color: 0xffccdd, alpha: sp.bucket.alpha } );
				state.sporeLayer.circle( px, sp.y, sp.r * sp.bucket.halo )
					.fill( { color: 0xffccdd, alpha: sp.bucket.alpha * 0.12 } );
			}

			// --- Ash with chromatic aberration ----------------- //
			state.ashLayer.clear();
			for ( var ai = 0; ai < state.ash.length; ai++ ) {
				var a = state.ash[ ai ];
				a.x += a.vx * dt;
				a.y += a.vy * dt;
				a.tilt += a.tiltSpin * dt;
				if ( a.y > hh + 10 ) { a.y = -10; a.x = h.rand( 0, w ); }
				if ( a.x < -10 ) a.x = w + 10;
				if ( a.x > w + 10 ) a.x = -10;
				var ax = a.x + Math.sin( a.tilt ) * 1.2;
				// Red ghost (slightly left).
				state.ashLayer.circle( ax - 0.8, a.y, a.r )
					.fill( { color: 0xff4060, alpha: 0.28 } );
				// Cyan ghost (slightly right).
				state.ashLayer.circle( ax + 0.8, a.y, a.r )
					.fill( { color: 0x60e0ff, alpha: 0.22 } );
				// Core flake.
				state.ashLayer.circle( ax, a.y, a.r )
					.fill( { color: 0x1a0008, alpha: 0.85 } );
			}

			// --- Tendril growth / retraction ------------------- //
			state.tendrils.clear();
			for ( var ti = 0; ti < state.tendrilList.length; ti++ ) {
				var td = state.tendrilList[ ti ];
				if ( td.phase === 'grow' ) {
					td.growth += td.growSpeed * dt;
					if ( td.growth >= 1 ) { td.growth = 1; td.phase = 'hold'; td.timer = td.holdTime; }
				} else if ( td.phase === 'hold' ) {
					td.timer -= dt;
					if ( td.timer <= 0 ) td.phase = 'retract';
				} else if ( td.phase === 'retract' ) {
					td.growth -= td.growSpeed * dt;
					if ( td.growth <= 0 ) { td.growth = 0; td.phase = 'gone'; td.timer = td.sleepTime; }
				} else if ( td.phase === 'gone' ) {
					td.timer -= dt;
					if ( td.timer <= 0 ) {
						var fresh = randomTendril( w, hh );
						td.x0 = fresh.x0; td.y0 = fresh.y0;
						td.x1 = fresh.x1; td.y1 = fresh.y1;
						td.cpx = fresh.cpx; td.cpy = fresh.cpy;
						td.growSpeed = fresh.growSpeed;
						td.holdTime = fresh.holdTime; td.sleepTime = fresh.sleepTime;
						td.thick = fresh.thick;
						td.phase = 'grow'; td.growth = 0;
					}
				}

				if ( td.growth > 0 ) {
					// Sample quadratic in many small segments.
					var SAMPLES = 22;
					var wob = Math.sin( state.time * 0.0008 + ti ) * 4;
					var prevX = td.x0, prevY = td.y0;
					var limit = Math.floor( SAMPLES * td.growth );
					for ( var i = 1; i <= limit; i++ ) {
						var u = i / SAMPLES;
						var omu = 1 - u;
						var bx = omu * omu * td.x0 + 2 * omu * u * ( td.cpx + wob ) + u * u * td.x1;
						var by = omu * omu * td.y0 + 2 * omu * u * ( td.cpy + wob * 0.5 ) + u * u * td.y1;
						state.tendrils.moveTo( prevX, prevY ).lineTo( bx, by )
							.stroke( { color: 0x3a0614, width: td.thick, alpha: 0.75 } );
						prevX = bx; prevY = by;
					}
					// Bright tip blossom at the head of the curve.
					state.tendrils.circle( prevX, prevY, 1.8 )
						.fill( { color: 0x8a1a2e, alpha: 0.7 } );
				}
			}

			// --- Red lightning + full-scene flash --------------- //
			state.lightT -= dt;
			if ( state.lightT <= 0 && state.lightLife <= 0 ) {
				state.lightT = h.rand( 60 * 8, 60 * 25 );
				state.lightLife = 1;
				state.flashLife = 1;
			}
			state.veil.clear();
			state.flash.clear();
			if ( state.lightLife > 0 ) {
				state.lightLife -= 0.05 * dt;
				var steps = 12;
				var startX = h.rand( 0, w );
				var y = 0, x = startX;
				for ( var i2 = 0; i2 < steps; i2++ ) {
					var nx = x + h.rand( -30, 30 );
					var ny = y + ( hh * 0.35 ) / steps;
					state.veil.moveTo( x, y ).lineTo( nx, ny )
						.stroke( { color: 0xff3322, alpha: state.lightLife * 0.95, width: 1.2 } );
					state.veil.moveTo( x, y ).lineTo( nx, ny )
						.stroke( { color: 0xff8855, alpha: state.lightLife * 0.5, width: 3 } );
					x = nx; y = ny;
				}
			}
			if ( state.flashLife > 0 ) {
				state.flashLife -= 0.08 * dt;
				state.flash.rect( 0, 0, w, hh )
					.fill( { color: 0xffe0d8, alpha: state.flashLife * 0.18 } );
			}

			// --- Static-line sweep (top → bottom) --------------- //
			state.sweep.clear();
			state.sweepCD -= dt;
			if ( state.sweepCD <= 0 && state.sweepY < 0 ) {
				state.sweepCD = h.rand( 60 * 30, 60 * 90 );
				state.sweepY = 0;
			}
			if ( state.sweepY >= 0 ) {
				state.sweepY += 3.2 * dt;
				if ( state.sweepY > hh + 20 ) {
					state.sweepY = -1;
				} else {
					// Bright band with fringe.
					state.sweep.rect( 0, state.sweepY - 6, w, 2 )
						.fill( { color: 0xff4055, alpha: 0.35 } );
					state.sweep.rect( 0, state.sweepY, w, 1.4 )
						.fill( { color: 0xffffff, alpha: 0.75 } );
					state.sweep.rect( 0, state.sweepY + 6, w, 2 )
						.fill( { color: 0x60e0ff, alpha: 0.25 } );
				}
			}

			// --- Glitch title card ------------------------------ //
			state.cardT -= dt;
			if ( state.cardPhase === 'idle' && state.cardT <= 0 ) {
				state.cardPhase = 'in';
				var ch = h.choose( CHAPTERS );
				state.tR.text = ch; state.tG.text = ch; state.tB.text = ch;
			}
			if ( state.cardPhase === 'in' ) {
				state.card.alpha = Math.min( 1, state.card.alpha + 0.04 * dt );
				var off = Math.random() < 0.15 ? h.rand( -8, 8 ) : 0;
				state.tR.x = -off * 1.2; state.tG.x = 0; state.tB.x = off * 1.2;
				// Vertical block jitter during fade-in.
				var blockY = Math.random() < 0.08 ? h.rand( -4, 4 ) : 0;
				state.tR.y = -blockY; state.tB.y = blockY;
				state.card.x = env.app.renderer.width / 2 + h.rand( -3, 3 );
				if ( state.card.alpha >= 1 ) { state.cardPhase = 'hold'; state.hold = 80; }
			} else if ( state.cardPhase === 'hold' ) {
				state.hold -= dt;
				state.card.x = env.app.renderer.width / 2 + ( Math.random() < 0.05 ? h.rand( -8, 8 ) : 0 );
				state.tR.x = Math.random() < 0.12 ? h.rand( -4, 4 ) : 0;
				state.tB.x = -state.tR.x;
				state.tG.y = Math.random() < 0.05 ? h.rand( -2, 2 ) : 0;
				if ( state.hold <= 0 ) state.cardPhase = 'out';
			} else if ( state.cardPhase === 'out' ) {
				state.card.alpha -= 0.03 * dt;
				if ( state.card.alpha <= 0 ) { state.cardPhase = 'idle'; state.cardT = h.rand( 60 * 45, 60 * 110 ); state.tR.y = state.tG.y = state.tB.y = 0; }
			}
		},
	};
} )();
