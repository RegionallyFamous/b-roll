/**
 * ODD scene: Rainfall — v1.3.0
 * ---------------------------------------------------------------
 * A night-time rain scene that uses the collision-aware surface
 * API the WP Desktop Mode shell exposes at
 * `wp.desktop.getWallpaperSurfaces()`. Each frame we ask the host
 * for the live list of solid edges — every non-minimized window's
 * top, the taskbar, the dock, widget cards, the shell floor — and
 * splash raindrops onto whichever one they cross.
 *
 * That means:
 *   - Dragging a window across the screen makes rain splash on its
 *     title bar in real time.
 *   - Closing / minimizing a window removes its splash surface.
 *   - Widget cards (clock, postcards, etc) get rained on.
 *
 * Painted backdrop (wallpaper.webp — dark stormy
 * night, slight city-lights haze at the bottom edge). On top:
 *
 *   1. A mid-distance sheet of ~140 thin raindrops falling at
 *      slightly randomised speeds and angles. Fresh drops spawn at
 *      the top as they die.
 *   2. A foreground layer of ~35 fatter, faster, more opaque drops
 *      with a tiny motion-blur streak so they read as "close".
 *   3. Splash rings drawn at every surface collision — a short
 *      radial burst that fades out over 400ms, plus a 1-frame
 *      highlight flash.
 *   4. A thin puddle shimmer along every horizontal surface top
 *      edge, subtly pulsing so the viewer clocks which surfaces
 *      are "wet".
 *
 * Audio reactive: bass increases wind (drop angle offset); highs
 * thicken the drop count briefly. Reduced motion: drops frozen in
 * a photorealistic still.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers || {};
	var scriptUrl = document.currentScript && document.currentScript.src;

	var MID_COUNT_HIGH    = 105;
	var MID_COUNT_NORMAL  = 74;
	var MID_COUNT_LOW     = 42;
	var FG_COUNT_HIGH     = 24;
	var FG_COUNT_NORMAL   = 16;
	var FG_COUNT_LOW      = 9;
	var MAX_SPLASHES      = 64;   // ring pool
	var SURFACE_REFRESH_MS = 120; // throttle host call

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'rainfall' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function rand( min, max ) {
		if ( h.rand ) return h.rand( min, max );
		return min + Math.random() * ( max - min );
	}

	function paintFallback( g, w, hh ) {
		g.clear();
		if ( h.paintVGradient ) {
			h.paintVGradient( g, w, hh, 0x050811, 0x111b2e );
		} else {
			g.rect( 0, 0, w, hh ).fill( { color: 0x09101e, alpha: 1 } );
		}
	}

	function makeMidDrop( w, hh, wind ) {
		return {
			x:  Math.random() * w,
			y:  Math.random() * hh,
			vy: rand( 5.4, 8.2 ),
			vx: wind,
			len: rand( 10, 20 ),
			alpha: rand( 0.18, 0.42 ),
		};
	}
	function makeFgDrop( w, hh, wind ) {
		return {
			x:  Math.random() * w,
			y:  Math.random() * hh,
			vy: rand( 9.5, 14 ),
			vx: wind * 1.4,
			len: rand( 20, 32 ),
			alpha: rand( 0.42, 0.7 ),
		};
	}

	function counts( tier ) {
		if ( tier === 'low'    ) return { mid: MID_COUNT_LOW,    fg: FG_COUNT_LOW };
		if ( tier === 'normal' ) return { mid: MID_COUNT_NORMAL, fg: FG_COUNT_NORMAL };
		return                     { mid: MID_COUNT_HIGH,   fg: FG_COUNT_HIGH };
	}

	window.__odd.scenes.rainfall = {

		setup: async function ( env ) {
			var PIXI = env.PIXI;
			var app  = env.app;
			var w = app.renderer.width;
			var hh = app.renderer.height;

			var bgSprite = null;
			var bgTex = null;
			try {
				bgTex = await PIXI.Assets.load( backdropUrl() );
				bgSprite = new PIXI.Sprite( bgTex );
				app.stage.addChild( bgSprite );
			} catch ( e ) {}
			function fitBackdrop() {
				if ( ! bgSprite || ! bgTex ) return;
				var scale = Math.max( app.renderer.width / bgTex.width, app.renderer.height / bgTex.height );
				bgSprite.scale.set( scale );
				bgSprite.x = ( app.renderer.width - bgTex.width * scale ) / 2;
				bgSprite.y = ( app.renderer.height - bgTex.height * scale ) / 2;
			}
			fitBackdrop();

			// Subtle navy haze doubles as the fallback if the WebP fails.
			var haze = new PIXI.Graphics();
			paintFallback( haze, w, hh );
			haze.alpha = bgSprite ? 0.18 : 0.94;
			app.stage.addChild( haze );
			var hazeRef = haze;

			var wind = rand( -0.32, 0.24 );

			// Layers.
			var puddleLayer = new PIXI.Graphics();
			app.stage.addChild( puddleLayer );

			var midLayer = new PIXI.Graphics();
			app.stage.addChild( midLayer );

			var splashLayer = new PIXI.Graphics();
			app.stage.addChild( splashLayer );

			var fgLayer = new PIXI.Graphics();
			app.stage.addChild( fgLayer );

			var c = counts( env.perfTier );
			var mid = []; for ( var i = 0; i < c.mid; i++ ) mid.push( makeMidDrop( w, hh, wind ) );
			var fg  = []; for ( var j = 0; j < c.fg;  j++ ) fg.push( makeFgDrop( w, hh, wind ) );

			// Splash ring pool.
			var splashes = [];
			for ( var s = 0; s < MAX_SPLASHES; s++ ) splashes.push( { life: 0, x: 0, y: 0, r: 0 } );

			// Cached host surfaces. The host's `getWallpaperSurfaces`
			// walks the DOM, so we only refresh every SURFACE_REFRESH_MS
			// rather than every frame.
			var surfaces = [];
			var lastSurfaceAt = 0;
			function refreshSurfaces( now, container ) {
				if ( now - lastSurfaceAt < SURFACE_REFRESH_MS ) return;
				lastSurfaceAt = now;
				try {
					var host = window.wp && window.wp.desktop;
					if ( ! host || typeof host.getWallpaperSurfaces !== 'function' ) {
						surfaces = [];
						return;
					}
					var raw = host.getWallpaperSurfaces() || [];
					// Convert viewport coordinates → our container's local coords.
					var box = container && container.getBoundingClientRect ? container.getBoundingClientRect() : null;
					var dx = box ? -box.left : 0;
					var dy = box ? -box.top  : 0;
					var next = [];
					for ( var k = 0; k < raw.length; k++ ) {
						var r = raw[ k ];
						if ( ! r || ! r.rect ) continue;
						if ( r.face && r.face !== 'top' ) continue; // we only splash on top faces
						next.push( {
							x: r.rect.x + dx,
							y: r.rect.y + dy,
							w: r.rect.width,
							h: r.rect.height,
							kind: r.kind || 'custom',
						} );
					}
					surfaces = next;
				} catch ( e ) { surfaces = []; }
			}

			function surfaceAt( x, yTop, yBottom ) {
				// Return the first top-face surface whose rect contains
				// `x` horizontally and whose top edge lies between
				// `yTop` (previous frame y) and `yBottom` (current y).
				for ( var i = 0; i < surfaces.length; i++ ) {
					var s = surfaces[ i ];
					if ( x < s.x || x > s.x + s.w ) continue;
					if ( s.y < yTop || s.y > yBottom ) continue;
					return s;
				}
				return null;
			}

			function spawnSplash( x, y, r ) {
				for ( var i = 0; i < splashes.length; i++ ) {
					if ( splashes[ i ].life <= 0 ) {
						splashes[ i ].x = x;
						splashes[ i ].y = y;
						splashes[ i ].r = r;
						splashes[ i ].life = 1;
						return;
					}
				}
				// Pool exhausted — overwrite oldest.
				splashes[ 0 ].x = x; splashes[ 0 ].y = y; splashes[ 0 ].r = r; splashes[ 0 ].life = 1;
			}

			return {
				w: w, hh: hh, wind: wind,
				bgRef: bgSprite,
				fitBackdrop: fitBackdrop,
				hazeRef: hazeRef,
				puddleLayer: puddleLayer,
				midLayer: midLayer,
				splashLayer: splashLayer,
				fgLayer: fgLayer,
				mid: mid, fg: fg,
				splashes: splashes,
				refreshSurfaces: refreshSurfaces,
				surfaceAt: surfaceAt,
				spawnSplash: spawnSplash,
				getSurfaces: function () { return surfaces; },
				windOffset: 0,
				puddlePulse: 0,
			};
		},

		tick: function ( state, env ) {
			var app = env.app;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( w !== state.w || hh !== state.hh ) {
				state.w = w; state.hh = hh;
				state.fitBackdrop();
				if ( state.hazeRef ) {
					paintFallback( state.hazeRef, w, hh );
				}
			}

			var dt = typeof env.dt === 'number' ? env.dt : 1;
			var motionDt = env.reducedMotion ? 0 : dt;
			state.refreshSurfaces( ( window.performance && window.performance.now ) ? window.performance.now() : Date.now(), env.app.canvas );

			// Audio wind sway: bass adds a sideways pulse; subtle.
			var bass = env.audio && env.audio.enabled ? env.audio.bass : 0;
			state.windOffset += ( ( bass * 0.9 ) - state.windOffset ) * 0.04;
			var wind = state.wind + state.windOffset;

			// ---- Puddle shimmer (below drops) ---- //
			state.puddlePulse += 0.015 * motionDt;
			var pp = state.puddleLayer;
			pp.clear();
			var pulse = 0.55 + Math.sin( state.puddlePulse ) * 0.1;
			var surfs = state.getSurfaces();
			for ( var i = 0; i < surfs.length; i++ ) {
				var s = surfs[ i ];
				// Skip tiny surfaces (<40px wide) — they read as glitchy.
				if ( s.w < 40 ) continue;
				pp.rect( s.x, s.y - 1, s.w, 2 ).fill( { color: 0xa7c4e8, alpha: 0.16 * pulse } );
				pp.rect( s.x, s.y,     s.w, 1 ).fill( { color: 0xffffff, alpha: 0.08 * pulse } );
			}

			// ---- Mid layer drops ---- //
			var m = state.midLayer;
			m.clear();
			for ( var j = 0; j < state.mid.length; j++ ) {
				var d = state.mid[ j ];
				var prevY = d.y;
				d.x += d.vx * motionDt;
				d.y += d.vy * motionDt;

				// Wrap X.
				if ( d.x < -20 ) d.x += w + 40;
				else if ( d.x > w + 20 ) d.x -= w + 40;

				// Surface collision.
				var hit = state.surfaceAt( d.x, prevY, d.y );
				if ( hit ) {
					state.spawnSplash( d.x, hit.y, rand( 5, 9 ) );
					d.y = -rand( 10, 80 );
					d.x = Math.random() * w;
					continue;
				}

				if ( d.y > hh + 5 ) {
					d.y = -rand( 5, 60 );
					d.x = Math.random() * w;
					continue;
				}

				m.moveTo( d.x, d.y )
				 .lineTo( d.x - d.vx * 1.2, d.y - d.len )
				 .stroke( { color: 0xcfe0f2, alpha: d.alpha, width: 1 } );
			}

			// ---- Splashes ---- //
			var sp = state.splashLayer;
			sp.clear();
			for ( var k = 0; k < state.splashes.length; k++ ) {
				var sx = state.splashes[ k ];
				if ( sx.life <= 0 ) continue;
				sx.life -= 0.08 * motionDt;
				if ( sx.life <= 0 ) continue;
				var radius = sx.r * ( 1 + ( 1 - sx.life ) * 1.8 );
				sp.circle( sx.x, sx.y, radius ).stroke( { color: 0xd8e6f5, alpha: sx.life * 0.55, width: 1.2 } );
				sp.circle( sx.x, sx.y, radius * 0.55 ).stroke( { color: 0xffffff, alpha: sx.life * 0.35, width: 1 } );
				// Tiny up-splash drops on the first few frames.
				if ( sx.life > 0.7 ) {
					var up = ( 1 - sx.life ) * 14;
					sp.rect( sx.x - 0.7, sx.y - up, 1.4, 3 ).fill( { color: 0xffffff, alpha: sx.life * 0.6 } );
				}
			}

			// ---- Foreground drops ---- //
			var f = state.fgLayer;
			f.clear();
			for ( var a = 0; a < state.fg.length; a++ ) {
				var fd = state.fg[ a ];
				var prevY2 = fd.y;
				fd.x += fd.vx * motionDt;
				fd.y += fd.vy * motionDt;
				if ( fd.x < -30 ) fd.x += w + 60;
				else if ( fd.x > w + 30 ) fd.x -= w + 60;

				var hit2 = state.surfaceAt( fd.x, prevY2, fd.y );
				if ( hit2 ) {
					state.spawnSplash( fd.x, hit2.y, rand( 8, 13 ) );
					fd.y = -rand( 10, 80 );
					fd.x = Math.random() * w;
					continue;
				}
				if ( fd.y > hh + 8 ) {
					fd.y = -rand( 5, 60 );
					fd.x = Math.random() * w;
					continue;
				}
				f.moveTo( fd.x, fd.y )
				 .lineTo( fd.x - fd.vx * 1.2, fd.y - fd.len )
				 .stroke( { color: 0xe7eff8, alpha: fd.alpha, width: 1.6 } );
			}

			// Keep the stored wind in case it changes tier next frame.
			state.wind = wind - state.windOffset;
		},

		onResize: function ( state, env ) {
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.w = w; state.hh = hh;
			state.fitBackdrop();
		},

		onAudio: function ( state, env ) {
			// Add a short burst of highs = more close drops.
			if ( ! env.audio || ! env.audio.enabled ) return;
			if ( env.audio.high > 0.72 && state.fg.length < 80 ) {
				var spawn = Math.min( 3, ( ( env.audio.high - 0.7 ) * 10 ) | 0 );
				for ( var i = 0; i < spawn; i++ ) {
					state.fg.push( {
						x: Math.random() * state.w,
						y: -rand( 5, 40 ),
						vy: rand( 10, 15 ),
						vx: state.wind * 1.4,
						len: rand( 22, 34 ),
						alpha: rand( 0.55, 0.8 ),
					} );
				}
			}
		},

		stillFrame: function ( state, env ) {
			// Render one frame with zero movement.
			var saveDt = env.dt;
			env.dt = 0;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function () {
			// Pixi destroys the stage for us; nothing ticks-outside-Pixi here.
		},
	};
} )();
