/**
 * B-Roll scene: Outrun (synthwave / Kavinsky) — v0.10
 * ---------------------------------------------------------------
 * Violet-to-orange sunset behind painted triangular mountains and
 * palm silhouettes. A neon chrome grid scrolls toward the camera
 * with perspective converging at the horizon; neon-pink gridlines
 * pulse in waves. The retrowave "sun" sinks rhythmically and
 * re-rises, and scanline bands sweep the sky.
 *
 * Rare wow (~75s): a chrome "FAR OUT" text drifter sweeps in with
 * lens flare and sinks below the horizon (implied by a single
 * bright chrome bar for now; backdrop art finishes the gag).
 *
 * Cross-cutting:
 *   - env.tod:    dusk/night is always-on for this aesthetic
 *   - env.audio:  grid scroll speed tracks level; bass pulses the sun
 *   - env.perfTier: 'low' halves grid line count
 *
 * Easter-egg hooks:
 *   - festival: grid accelerates to OUTRUN speed
 *   - reveal (kavinsky): night-vision green tint for 4s
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/outrun.webp' + qs;
	}

	window.__bRoll.scenes[ 'outrun' ] = {
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

			var bloom = h.makeBloomLayer( PIXI, 10 );
			app.stage.addChild( bloom );
			var sun    = new PIXI.Graphics(); bloom.addChild( sun );
			var grid   = new PIXI.Graphics(); bloom.addChild( grid );
			var chrome = new PIXI.Graphics(); bloom.addChild( chrome );
			var scan   = new PIXI.Graphics(); app.stage.addChild( scan );
			var nightVision = new PIXI.Graphics(); nightVision.alpha = 0;
			app.stage.addChild( nightVision );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				sun: sun, grid: grid, chrome: chrome, scan: scan, nightVision: nightVision, bloom: bloom,
				time: 0,
				scroll: 0,
				speed: 1,
				chromeT: -1,
				nextChrome: 60 * h.rand( 60, 90 ),
				sunPulse: 0,
			};
		},

		onResize: function ( state ) { state.fitBackdrop(); },

		stillFrame: function ( state, env ) {
			state.time = 0;
			state.scroll = 0.4;
			this.tick( state, env );
		},

		transitionIn: function ( state, env ) {
			// Brief grid acceleration on arrival.
			state.speed = 3.5;
			setTimeout( function () { state.speed = 1; }, 800 );
		},

		transitionOut: function ( state, env, done ) {
			// Grid locks to outrun-speed on exit.
			state.speed = 6;
			setTimeout( done, 520 );
		},

		onEgg: function ( name, state, env ) {
			if ( name === 'festival' ) {
				state.speed = 5;
				setTimeout( function () { state.speed = 1; }, 6000 );
			} else if ( name === 'reveal' ) {
				state.nightVision.alpha = 0.55;
			} else if ( name === 'peek' ) {
				state.chromeT = 0;
			}
		},

		onAudio: function ( state, env ) {
			// Level boosts grid speed (persistent); bass punches sun.
			state.speed = 1 + env.audio.level * 3;
			if ( env.audio.bass > 0.55 ) state.sunPulse = 1;
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.time += dt;
			var horizonY = hh * 0.55;

			// --- Retrowave sun ---------------------------------- //
			state.sun.clear();
			state.sunPulse = Math.max( 0, state.sunPulse - dt * 0.03 );
			var sunY = horizonY - 30 + Math.sin( state.time * 0.015 ) * 20 - state.sunPulse * 16;
			var sunR = Math.min( w, hh ) * 0.18;
			state.sun.circle( w / 2, sunY, sunR ).fill( { color: 0xffaa66, alpha: 0.65 } );
			state.sun.circle( w / 2, sunY, sunR * 0.6 ).fill( { color: 0xffe8a0, alpha: 0.85 } );
			// Horizontal bands carved out of the sun.
			var bands = 7;
			for ( var bi = 0; bi < bands; bi++ ) {
				var by = sunY + ( bi - bands / 2 ) * ( sunR * 0.14 );
				state.sun.rect( w / 2 - sunR, by, sunR * 2, 2 + bi ).fill( { color: 0x2a0a3a, alpha: 0.6 } );
			}

			// --- Chrome grid floor ------------------------------ //
			state.grid.clear();
			state.scroll += state.speed * dt * 0.008;
			var rows = env.perfTier === 'low' ? 10 : 20;
			var cols = env.perfTier === 'low' ? 16 : 28;
			// Horizontal lines (rows receding to horizon).
			for ( var ri = 0; ri < rows; ri++ ) {
				var rowT = ( ri + ( state.scroll % 1 ) ) / rows;
				var y = horizonY + Math.pow( rowT, 2.2 ) * ( hh - horizonY );
				var alpha = 0.1 + rowT * 0.85;
				state.grid.moveTo( 0, y ).lineTo( w, y ).stroke( { color: 0xff2d9f, alpha: alpha, width: 1.4 } );
			}
			// Vertical perspective lines.
			for ( var ci = 0; ci <= cols; ci++ ) {
				var lx = ( ci / cols - 0.5 );
				var xTop = w / 2 + lx * w * 0.08;
				var xBot = w / 2 + lx * w * 1.2;
				state.grid.moveTo( xTop, horizonY ).lineTo( xBot, hh ).stroke( { color: 0xff2d9f, alpha: 0.55, width: 1.2 } );
			}

			// --- Scanlines in sky ------------------------------- //
			state.scan.clear();
			var scanCount = 5;
			for ( var si = 0; si < scanCount; si++ ) {
				var sY = ( ( state.time * 0.4 + si * horizonY / scanCount ) % horizonY );
				state.scan.rect( 0, sY, w, 2 ).fill( { color: 0xffffff, alpha: 0.08 } );
			}

			// --- Chrome drifter (rare wow) ---------------------- //
			state.nextChrome -= dt;
			if ( state.nextChrome <= 0 && state.chromeT < 0 ) {
				state.chromeT = 0;
				state.nextChrome = 60 * h.rand( 70, 100 );
			}
			state.chrome.clear();
			if ( state.chromeT >= 0 ) {
				state.chromeT += dt;
				var cp = state.chromeT / 220;
				if ( cp > 1 ) { state.chromeT = -1; }
				else {
					var cy = horizonY - 40 + cp * cp * 120;
					var cw = w * 0.6;
					var cx = w * 0.5 - cw / 2 + Math.sin( cp * Math.PI ) * 40;
					var grad = 6;
					for ( var gi = 0; gi < grad; gi++ ) {
						var t = gi / ( grad - 1 );
						state.chrome.rect( cx, cy + gi * 3, cw, 3 ).fill( { color: h.lerpColor( 0xffe8a0, 0xff50a0, t ), alpha: 0.85 * ( 1 - cp * 0.5 ) } );
					}
				}
			}

			// --- Night vision reveal ---------------------------- //
			if ( state.nightVision.alpha > 0.01 ) {
				state.nightVision.clear().rect( 0, 0, w, hh ).fill( { color: 0x20ff60, alpha: 1 } );
				state.nightVision.alpha = Math.max( 0, state.nightVision.alpha - dt * 0.0025 );
			}
		},
	};
} )();
