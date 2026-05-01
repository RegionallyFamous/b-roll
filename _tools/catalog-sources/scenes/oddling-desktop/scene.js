/**
 * ODD scene: Oddling Desktop — v1.0.0
 * ---------------------------------------------------------------
 * The ODD default wallpaper. A painted plum "CRT terrarium"
 * (wallpaper.webp) establishes mood. On top, Pixi paints three
 * lightweight populations:
 *
 *   1. Specimens — little creature silhouettes that slow-float
 *      across the mid-ground. Each has two pinprick eyes that
 *      blink on a 3–9 s cadence and a soft neon halo in cyan,
 *      pink, yellow, or lime.
 *
 *   2. File-tabs — translucent rounded rectangles that drift
 *      diagonally like specimens in a petri dish. They carry the
 *      desktop iconography forward into motion.
 *
 *   3. Peek-eyes — two larger "oddling" eyes that occasionally
 *      blink into visibility at the screen edges and glance
 *      around before receding. Rate-limited so they stay curious,
 *      not crowded.
 *
 * Audio reactive: bass speeds up specimen drift; treble triggers
 * a cyan "scanline flare" across the horizon.
 *
 * Reduced motion: stillFrame() settles specimens and parks eyes
 * half-lidded for a calm living-wallpaper pose.
 *
 * Perf tier: at 'low' we halve specimen count, skip the halo
 * blur layer, and disable peek-eyes.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	var SPECIMEN_COUNT = 18;
	var TAB_COUNT      = 10;
	var PALETTE        = [ 0x38e8ff, 0xff5fa8, 0xffd84a, 0xb8ff5a, 0xb266ff ];

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'oddling-desktop' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/oddling-desktop.webp' + qs;
	}

	function pickColor() {
		return PALETTE[ ( Math.random() * PALETTE.length ) | 0 ];
	}

	function spawnSpecimen( w, hh ) {
		return {
			x: h.rand( 0, w ),
			y: h.rand( hh * 0.35, hh * 0.95 ),
			vx: h.rand( -0.2, 0.2 ),
			vy: h.rand( -0.08, 0.08 ),
			r: h.rand( 16, 34 ),
			color: pickColor(),
			blink: h.rand( 0.4, 1 ),
			blinkTimer: h.rand( 3, 9 ),
			bob: Math.random() * Math.PI * 2,
			bobSpeed: h.rand( 0.015, 0.03 ),
		};
	}

	function spawnTab( w, hh ) {
		return {
			x: h.rand( -120, w ),
			y: h.rand( hh * 0.1, hh * 0.7 ),
			vx: h.rand( 0.15, 0.45 ),
			vy: h.rand( -0.05, 0.05 ),
			w: h.rand( 70, 160 ),
			alpha: h.rand( 0.08, 0.22 ),
			color: pickColor(),
			tilt: h.rand( -0.08, 0.08 ),
		};
	}

	window.__odd.scenes[ 'oddling-desktop' ] = {
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

			// Halo layer — additive soft glow behind creatures.
			var haloLayer = h && h.makeBloomLayer
				? h.makeBloomLayer( PIXI, 0.7 )
				: ( function () {
					var c = new PIXI.Container();
					c.blendMode = 'add';
					return c;
				} )();
			app.stage.addChild( haloLayer );

			var tabLayer = new PIXI.Graphics();
			app.stage.addChild( tabLayer );

			var bodyLayer = new PIXI.Graphics();
			app.stage.addChild( bodyLayer );

			var eyeLayer = new PIXI.Graphics();
			app.stage.addChild( eyeLayer );

			// Scanline flare — a single cyan bar we briefly unhide.
			var flare = new PIXI.Graphics();
			flare.alpha = 0;
			app.stage.addChild( flare );

			var w  = app.renderer.width;
			var hh = app.renderer.height;

			var specimens = [];
			for ( var i = 0; i < SPECIMEN_COUNT; i++ ) {
				specimens.push( spawnSpecimen( w, hh ) );
			}
			var tabs = [];
			for ( var j = 0; j < TAB_COUNT; j++ ) {
				tabs.push( spawnTab( w, hh ) );
			}

			// Peek-eyes live at pre-assigned edge anchors so they
			// don't all pop from the same spot.
			var peek = {
				active: false,
				anchor: null,
				phase: 0,
				cooldown: h.rand( 6, 14 ),
				life: 0,
			};

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				haloLayer: haloLayer,
				tabLayer: tabLayer, bodyLayer: bodyLayer,
				eyeLayer: eyeLayer, flare: flare,
				specimens: specimens, tabs: tabs, peek: peek,
				time: 0,
				flareBoost: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w  = env.app.renderer.width;
			var hh = env.app.renderer.height;
			// Rewrap off-screen specimens so they aren't stuck.
			for ( var i = 0; i < state.specimens.length; i++ ) {
				var s = state.specimens[ i ];
				if ( s.x < -50 || s.x > w + 50 ) s.x = h.rand( 0, w );
				if ( s.y < -50 || s.y > hh + 50 ) s.y = h.rand( hh * 0.35, hh * 0.95 );
			}
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt / 60;

			var perfLow = env.perfTier === 'low';
			var targetSpec = perfLow ? ( SPECIMEN_COUNT >> 1 ) : SPECIMEN_COUNT;
			while ( state.specimens.length > targetSpec ) state.specimens.pop();
			while ( state.specimens.length < targetSpec ) state.specimens.push( spawnSpecimen( w, hh ) );

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var desktopActivity = env.desktop && env.desktop.activity && ! env.reducedMotion && env.perfTier !== 'low'
				? ( env.desktop.activity.window || 0 )
				: 0;
			var speed = 1 + bass * 1.4 + desktopActivity * 0.22;

			state.tabLayer.clear();
			for ( var i = 0; i < state.tabs.length; i++ ) {
				var t = state.tabs[ i ];
				t.x += t.vx * dt * speed;
				t.y += t.vy * dt * speed;
				if ( t.x > w + 150 ) {
					t.x = -150; t.y = h.rand( hh * 0.1, hh * 0.7 );
					t.color = pickColor();
				}
				var hw = t.w / 2, hHeight = t.w * 0.62 / 2;
				state.tabLayer
					.roundRect( t.x - hw, t.y - hHeight, t.w, t.w * 0.62, 14 )
					.fill( { color: t.color, alpha: Math.min( 0.32, t.alpha + desktopActivity * 0.04 ) } );
			}

			state.bodyLayer.clear();
			state.eyeLayer.clear();
			state.haloLayer.removeChildren();

			for ( var k = 0; k < state.specimens.length; k++ ) {
				var s = state.specimens[ k ];
				s.bob += s.bobSpeed * dt;
				s.x += s.vx * dt * speed;
				s.y += s.vy * dt * speed + Math.sin( s.bob ) * 0.15;

				if ( s.x < -60 ) s.x = w + 60;
				if ( s.x > w + 60 ) s.x = -60;
				if ( s.y < hh * 0.3 ) s.y = hh * 0.3;
				if ( s.y > hh - 20 ) s.y = hh - 20;

				s.blinkTimer -= dt / 60;
				if ( s.blinkTimer <= 0 ) {
					s.blink = 0.05;
					s.blinkTimer = h.rand( 3, 9 );
				} else if ( s.blink < 1 ) {
					s.blink = Math.min( 1, s.blink + dt * 0.08 );
				}

				// Body silhouette — small asymmetric blob.
				var r = s.r;
				state.bodyLayer
					.ellipse( s.x, s.y + 4, r, r * 0.88 )
					.fill( { color: 0x0a0418, alpha: 0.85 } );

				// Halo behind body via a soft bloom sprite.
				if ( ! perfLow ) {
					var halo = new env.PIXI.Graphics();
					halo
						.circle( s.x, s.y, r * 1.6 )
						.fill( { color: s.color, alpha: 0.08 } );
					state.haloLayer.addChild( halo );
				}

				// Two pinprick eyes.
				var ey = s.y - r * 0.08;
				var ex1 = s.x - r * 0.42;
				var ex2 = s.x + r * 0.42;
				var lid = s.blink;
				state.eyeLayer
					.ellipse( ex1, ey, r * 0.18, r * 0.18 * lid )
					.fill( { color: s.color, alpha: 1 } )
					.ellipse( ex2, ey, r * 0.18, r * 0.18 * lid )
					.fill( { color: s.color, alpha: 1 } );
			}

			// Peek-eyes.
			var peek = state.peek;
			if ( ! perfLow ) {
				if ( peek.active ) {
					peek.phase += dt / 60;
					peek.life  -= dt / 60;
					var open = Math.min( 1, peek.phase / 0.7 );
					if ( peek.life < 0.7 ) open = Math.max( 0, peek.life / 0.7 );
					this._drawPeekEyes( state, peek.anchor, open );
					if ( peek.life <= 0 ) {
						peek.active = false;
						peek.cooldown = h.rand( 8, 18 );
					}
				} else {
					peek.cooldown -= dt / 60;
					if ( peek.cooldown <= 0 ) {
						peek.active = true;
						peek.phase = 0;
						peek.life = h.rand( 3, 5 );
						peek.anchor = this._pickPeekAnchor( w, hh );
					}
				}
			}

			// Flare decay.
			if ( state.flareBoost > 0 ) {
				state.flareBoost = Math.max( 0, state.flareBoost - dt * 0.015 );
				state.flare.clear();
				state.flare
					.rect( 0, hh * 0.55, w, 8 )
					.fill( { color: 0x38e8ff, alpha: state.flareBoost } );
				state.flare.alpha = state.flareBoost;
			} else if ( state.flare.alpha !== 0 ) {
				state.flare.clear();
				state.flare.alpha = 0;
			}
		},

		_pickPeekAnchor: function ( w, hh ) {
			var edges = [
				{ x: w * 0.04, y: hh * 0.18, dir: 1 },
				{ x: w * 0.96, y: hh * 0.22, dir: -1 },
				{ x: w * 0.12, y: hh * 0.9,  dir: 1 },
				{ x: w * 0.88, y: hh * 0.88, dir: -1 },
			];
			return edges[ ( Math.random() * edges.length ) | 0 ];
		},

		_drawPeekEyes: function ( state, a, open ) {
			if ( ! a ) return;
			var r = 38;
			var gap = 56;
			var ex1 = a.x - gap * 0.5;
			var ex2 = a.x + gap * 0.5;
			state.eyeLayer
				.ellipse( ex1, a.y, r, r * open )
				.fill( { color: 0xfff7ea, alpha: 0.96 } )
				.ellipse( ex2, a.y, r, r * open )
				.fill( { color: 0xfff7ea, alpha: 0.96 } )
				.ellipse( ex1 + a.dir * 6, a.y, r * 0.45, r * 0.45 * open )
				.fill( { color: 0x38e8ff, alpha: 1 } )
				.ellipse( ex2 + a.dir * 6, a.y, r * 0.45, r * 0.45 * open )
				.fill( { color: 0x38e8ff, alpha: 1 } )
				.ellipse( ex1 + a.dir * 10, a.y, r * 0.18, r * 0.18 * open )
				.fill( { color: 0x140420, alpha: 1 } )
				.ellipse( ex2 + a.dir * 10, a.y, r * 0.18, r * 0.18 * open )
				.fill( { color: 0x140420, alpha: 1 } );
		},

		onAudio: function ( state, env ) {
			if ( env.audio.high > 0.55 && state.flareBoost < 0.3 ) {
				state.flareBoost = 0.7;
			}
		},

		onRipple: function ( opts, state ) {
			var i = ( opts && opts.intensity ) || 0.8;
			state.flareBoost = Math.min( 1, state.flareBoost + i * 0.5 );
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			for ( var i = 0; i < 60; i++ ) this.tick( state, env );
			env.dt = saveDt;
			// Park every specimen half-lidded for a calm pose.
			for ( var k = 0; k < state.specimens.length; k++ ) {
				state.specimens[ k ].blink = 0.55;
			}
		},

		cleanup: function ( state ) {
			state.specimens = [];
			state.tabs = [];
		},
	};
} )();
