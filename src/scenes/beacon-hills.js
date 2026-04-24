/**
 * B-Roll scene: Beacon Hills (Teen Wolf) — v0.12
 * ---------------------------------------------------------------
 * A misty Pacific Northwest forest at dusk — Beacon Hills, the town,
 * ringed by silhouetted firs. Hero motion is the beacon chain:
 * watchtower fires on successive ridgelines kindle one after another
 * across the frame, L→R, on a ~40s cycle, each with a warm bloom
 * flash and a cold-blue tint swell — the town signaling itself that
 * something is loose in the woods tonight.
 *
 * Periodic beat (~20s): faint ember sparks rise from below the
 * frame, curling upward like fireflies through the canopy.
 *
 * Rare wow (~90s): a distant howl-veil — a brief full-frame wash of
 * silver moonlight, held ~0.8s, then eased out.
 *
 * Foreground cut-outs (per-scene, painted): a wolf mid-howl, a
 * lacrosse stick, and a full moon — drifting / bobbing at z-depths
 * defined in scenes.json.
 *
 * Cross-cutting mechanics read from env:
 *   - env.tod:    'night' deepens the cold tint, 'dawn'/'day' lightens
 *   - env.season: 'winter' biases embers toward snow-like motes
 *   - env.audio:  bass kicks advance the beacon chain by one step
 *   - env.perfTier: 'low' halves ember count
 *
 * Easter-egg hooks:
 *   - festival: all 5 beacons light at once + howl veil
 *   - reveal:   borrowed lantern flares as a stand-in moonglow
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	var BEACONS = [
		{ x: 0.12, y: 0.48, size: 0.9 },
		{ x: 0.30, y: 0.40, size: 1.1 },
		{ x: 0.50, y: 0.35, size: 1.3 },
		{ x: 0.70, y: 0.42, size: 1.1 },
		{ x: 0.88, y: 0.50, size: 0.85 },
	];
	var EMBER_NUM_NORMAL = 90;

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/beacon-hills.webp' + qs;
	}

	window.__bRoll.scenes[ 'beacon-hills' ] = {
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

			// Cold tint overlay so env.tod can lift toward dawn
			// without repainting the backdrop.
			var tint = new PIXI.Graphics();
			app.stage.addChild( tint );

			// Ember particle layer + bloom for the beacons.
			var embers = new PIXI.Graphics(); app.stage.addChild( embers );
			var bloom  = h.makeBloomLayer( PIXI, 12 );
			app.stage.addChild( bloom );
			var beaconGlow = new PIXI.Graphics(); bloom.addChild( beaconGlow );

			// Full-frame warm veil for the horn-call wow moment.
			var hornVeil = new PIXI.Graphics(); hornVeil.alpha = 0;
			app.stage.addChild( hornVeil );

			var fg = new PIXI.Container();
			app.stage.addChild( fg );

			var shared = await h.mountSharedDrifters( app, PIXI, [ 'crow', 'lantern' ], fg );
			var cutouts = await h.mountCutouts( app, PIXI, 'beacon-hills', fg );

			var emberPool = [];
			for ( var i = 0; i < EMBER_NUM_NORMAL; i++ ) {
				emberPool.push( {
					x: Math.random(), y: 1 + Math.random() * 0.2,
					vx: h.rand( -0.02, 0.02 ), vy: h.rand( -0.0006, -0.0018 ),
					life: Math.random(),
					size: h.rand( 0.6, 2.0 ),
					hue: Math.random(),
				} );
			}

			// Beacon chain state: beacons[i].lit goes 0..1.
			// currentIdx is the beacon currently being lit (fades in);
			// preceding beacons stay lit but decay slowly.
			var beacons = BEACONS.map( function ( b ) {
				return { x: b.x, y: b.y, size: b.size, lit: 0 };
			} );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				tint: tint, embers: embers, beaconGlow: beaconGlow,
				hornVeil: hornVeil, bloom: bloom,
				beacons: beacons, emberPool: emberPool, shared: shared, cutouts: cutouts,
				time: 0, currentIdx: -1, chainT: 0,
				nextHornT: 60 * h.rand( 60, 90 ),
				hornAlpha: 0,
				fg: fg,
			};
		},

		onResize: function ( state ) { state.fitBackdrop(); },

		stillFrame: function ( state, env ) {
			// For reduced-motion: snapshot at peak dramatic beat — all
			// five beacons lit, horn veil just starting to rise.
			for ( var i = 0; i < state.beacons.length; i++ ) {
				state.beacons[ i ].lit = 1;
			}
			state.hornAlpha = 0.3;
			state.time = 0;
			this.tick( state, env );
		},

		transitionOut: function ( state, env, done ) {
			// All beacons flare + fade quickly — like blowing out
			// torches before the next scene arrives.
			var steps = 24;
			var i = 0;
			var itv = setInterval( function () {
				i++;
				var t = 1 - i / steps;
				for ( var k = 0; k < state.beacons.length; k++ ) {
					state.beacons[ k ].lit = state.beacons[ k ].lit * t + 1.2 * ( 1 - t ) * Math.min( 1, i / 6 );
				}
				if ( i >= steps ) {
					clearInterval( itv );
					done();
				}
			}, 22 );
		},

		onEgg: function ( name, state, env ) {
			if ( name === 'festival' ) {
				for ( var i = 0; i < state.beacons.length; i++ ) state.beacons[ i ].lit = 1.4;
				state.hornAlpha = 0.6;
			} else if ( name === 'reveal' || name === 'peek' ) {
				// Borrow the lantern sprite as a stand-in moonglow flare.
				if ( state.shared && state.shared.length ) {
					state.shared[ 0 ].t = 0;
					state.shared[ 0 ].alphaMul = 1.5;
				}
				state.hornAlpha = 0.35;
			}
		},

		onAudio: function ( state, env ) {
			// Bass spikes advance the beacon chain by one step.
			if ( env.audio.bass > 0.55 ) {
				state.chainT += 40;
			}
			if ( env.audio.level > 0.8 ) state.hornAlpha = Math.max( state.hornAlpha, 0.3 );
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.time += dt;
			h.tickDrifters( state.shared, env );
			h.tickDrifters( state.cutouts, env );

			// --- Time-of-day cold tint -------------------------- //
			// Default pre-dawn: subtle cold blue wash. Dawn/day
			// lightens and warms; night deepens.
			var tintColor = 0x0d1820, tintA = 0.35;
			if ( env.tod === 'dawn' )      { tintColor = 0xb27a55; tintA = 0.14 + 0.14 * ( 1 - env.todPhase ); }
			else if ( env.tod === 'day' )  { tintColor = 0xcfe0ff; tintA = 0.08; }
			else if ( env.tod === 'dusk' ) { tintColor = 0x4a2a6a; tintA = 0.26; }
			else                           { tintColor = 0x0d1820; tintA = 0.42; }
			state.tint.clear().rect( 0, 0, w, hh ).fill( { color: tintColor, alpha: tintA } );

			// --- Beacon chain ----------------------------------- //
			state.chainT += dt;
			// ~40s for full chain = each beacon gets ~8s.
			var STEP = 60 * 8;
			while ( state.chainT > STEP ) {
				state.chainT -= STEP;
				state.currentIdx = ( state.currentIdx + 1 ) % state.beacons.length;
				state.beacons[ state.currentIdx ].lit = Math.max( state.beacons[ state.currentIdx ].lit, 1 );
				if ( state.currentIdx === 0 ) {
					// chain reset: fade all previous torches
					for ( var fi = 1; fi < state.beacons.length; fi++ ) state.beacons[ fi ].lit *= 0.3;
				}
			}

			state.beaconGlow.clear();
			for ( var bi = 0; bi < state.beacons.length; bi++ ) {
				var b = state.beacons[ bi ];
				if ( b.lit < 0.01 ) continue;
				// Flicker: each beacon has its own subtle pulse.
				var flicker = 0.82 + 0.18 * Math.sin( state.time * 0.18 + bi * 1.9 );
				var strength = Math.min( 1.4, b.lit ) * flicker;
				var cx = b.x * w, cy = b.y * hh;
				var r  = 48 * b.size;
				state.beaconGlow.circle( cx, cy, r ).fill( { color: 0xffdd99, alpha: 0.9 * strength } );
				state.beaconGlow.circle( cx, cy, r * 0.5 ).fill( { color: 0xfff5d0, alpha: Math.min( 1, strength ) } );
				state.beaconGlow.circle( cx, cy, r * 2.2 ).fill( { color: 0xff8a3a, alpha: 0.28 * strength } );
				// Slow decay once lit.
				b.lit = Math.max( 0, b.lit - dt * 0.0018 );
			}

			// --- Embers ----------------------------------------- //
			var count = env.perfTier === 'low' ? ( EMBER_NUM_NORMAL >> 1 ) : EMBER_NUM_NORMAL;
			state.embers.clear();
			for ( var ei = 0; ei < count; ei++ ) {
				var e = state.emberPool[ ei ];
				e.y += e.vy * dt;
				e.x += e.vx * dt * 0.01;
				e.life += dt * 0.004;
				if ( e.y < -0.05 || e.life > 1 ) {
					e.x = Math.random(); e.y = 1 + Math.random() * 0.1;
					e.vx = h.rand( -0.015, 0.015 );
					e.vy = h.rand( -0.0006, -0.0020 );
					e.life = 0;
					e.size = h.rand( 0.6, 2.0 );
					e.hue  = Math.random();
				}
				var color = env.season === 'winter' ? 0xf0f4ff : ( e.hue < 0.5 ? 0xffb96b : 0xffe0a0 );
				var alpha = 0.65 * ( 1 - e.life );
				state.embers.circle( e.x * w, e.y * hh, e.size ).fill( { color: color, alpha: alpha } );
			}

			// --- Horn-call veil --------------------------------- //
			state.nextHornT -= dt;
			if ( state.nextHornT <= 0 && state.hornAlpha < 0.05 ) {
				state.hornAlpha = 0.45;
				state.nextHornT = 60 * h.rand( 70, 110 );
			}
			if ( state.hornAlpha > 0.01 ) {
				state.hornVeil.clear().rect( 0, 0, w, hh ).fill( { color: 0xffb067, alpha: state.hornAlpha } );
				state.hornAlpha = Math.max( 0, state.hornAlpha - dt * 0.006 );
			} else {
				state.hornVeil.clear();
			}
		},
	};
} )();
