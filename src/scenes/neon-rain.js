/**
 * B-Roll scene: Neon Rain (Blade Runner 2049) — v0.4
 * ---------------------------------------------------------------
 * Three-layer parallax city silhouette with atmospheric haze bands
 * between the layers. Every window is an individually flickering
 * light (sinusoidal base + occasional pulse + rare block blackout).
 * Neon signs flicker on independent patterns with additive bloom.
 *
 * A wet-ground reflection band at the bottom mirrors the skyline
 * flipped and tinted blue-purple with horizontal sinusoidal ripple
 * bands that shift over time. Diagonal rain drops produce splash
 * circles on ground contact. Rare distant lightning silhouettes
 * the far skyline. An occasional spinner-car glides across the
 * upper third.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	var SIGN_TEXTS  = [ 'ATARI', 'TYRELL', 'WALLACE', 'シティ', 'NEXUS', '強化', '2049', 'JOI' ];
	var SIGN_COLORS = [ 0xff4aa0, 0xff6a3d, 0x64d8ff, 0xfff14d, 0xd65bff ];

	// Build one city layer as a list of rectangular buildings plus a window
	// registry. The buildings are painted once; windows get redrawn each
	// frame so they can flicker individually.
	function buildCityLayer( w, hh, base, minH, maxH, color, windowDensity, windowColor ) {
		var blocks = [];
		var windows = [];
		var x = 0;
		while ( x < w + 20 ) {
			var bw = h.rand( 28, 120 );
			var bh = h.rand( minH, maxH );
			blocks.push( { x: x, y: base - bh, w: bw, h: bh + ( hh - base ), color: color } );
			for ( var wy = base - bh + 8; wy < hh - 4; wy += 10 ) {
				for ( var wx = x + 3; wx < x + bw - 5; wx += 7 ) {
					if ( Math.random() < windowDensity ) {
						windows.push( {
							x: wx, y: wy, w: 2.5, wh: 3,
							color: windowColor,
							base: h.rand( 0.4, 0.95 ),
							freq: h.rand( 0.003, 0.02 ),
							phase: h.rand( 0, h.tau ),
						} );
					}
				}
			}
			x += bw + h.rand( 1, 5 );
		}
		return { blocks: blocks, windows: windows };
	}

	function paintBlocks( g, blocks ) {
		g.clear();
		for ( var i = 0; i < blocks.length; i++ ) {
			var b = blocks[ i ];
			g.rect( b.x, b.y, b.w, b.h ).fill( b.color );
		}
	}

	function paintWindows( g, windows, time, blackout ) {
		g.clear();
		for ( var i = 0; i < windows.length; i++ ) {
			var w = windows[ i ];
			// Base sinusoidal flicker, plus a blackout zone wipes a rectangular
			// region of windows temporarily dark.
			var a = w.base * ( 0.65 + 0.35 * Math.sin( time * w.freq + w.phase ) );
			if ( blackout &&
				w.x >= blackout.x && w.x <= blackout.x + blackout.w &&
				w.y >= blackout.y && w.y <= blackout.y + blackout.h ) {
				a *= blackout.level;
			}
			if ( a < 0.05 ) continue;
			g.rect( w.x, w.y, w.w, w.wh ).fill( { color: w.color, alpha: a } );
		}
	}

	function paintReflection( g, blocks, waterY, hh, time ) {
		// Flip the skyline downward below waterY. Tint blue-purple, dim the
		// alpha, and let horizontal ripple bands shimmer across the result.
		g.clear();
		for ( var i = 0; i < blocks.length; i++ ) {
			var b = blocks[ i ];
			var topY = b.y;
			var reflHeight = ( waterY - topY ) * 0.55; // compressed vertical
			if ( reflHeight <= 0 ) continue;
			g.rect( b.x, waterY, b.w, reflHeight ).fill( { color: 0x2a1840, alpha: 0.6 } );
		}
		// Horizontal ripple bands: alternating bright/dark lines that shift
		// with time to fake water motion.
		var bands = 16;
		var maxRefl = hh - waterY;
		for ( var k = 0; k < bands; k++ ) {
			var t = k / bands;
			var y = waterY + t * maxRefl;
			var shimmer = 0.4 + 0.6 * Math.sin( time * 0.04 + t * 8 );
			g.rect( 0, y, 99999, 1 ).fill( { color: 0x64a0ff, alpha: 0.06 + shimmer * 0.05 } );
		}
	}

	window.__bRoll.scenes[ 'neon-rain' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;
			var w = app.renderer.width, hh = app.renderer.height;

			// Layer stack (back→front).
			var bg         = new PIXI.Graphics(); app.stage.addChild( bg );
			var lightning  = new PIXI.Graphics(); lightning.alpha = 0; app.stage.addChild( lightning );
			var cityFar    = new PIXI.Graphics(); app.stage.addChild( cityFar );
			var fogFar     = new PIXI.Graphics(); app.stage.addChild( fogFar );
			var cityMid    = new PIXI.Graphics(); app.stage.addChild( cityMid );
			var fogMid     = new PIXI.Graphics(); app.stage.addChild( fogMid );
			var cityNear   = new PIXI.Graphics(); app.stage.addChild( cityNear );
			var winFar     = new PIXI.Graphics(); app.stage.addChild( winFar );
			var winMid     = new PIXI.Graphics(); app.stage.addChild( winMid );
			var winNear    = new PIXI.Graphics(); app.stage.addChild( winNear );
			var reflection = new PIXI.Graphics(); app.stage.addChild( reflection );
			var waterSurface = new PIXI.Graphics(); app.stage.addChild( waterSurface );

			var bloom = h.makeBloomLayer( PIXI, 10 );
			app.stage.addChild( bloom );
			var bloomSigns = new PIXI.Container();
			bloom.addChild( bloomSigns );

			var signLayer = new PIXI.Container(); app.stage.addChild( signLayer );
			var rain = new PIXI.Graphics(); app.stage.addChild( rain );

			var spinner = new PIXI.Graphics();
			spinner.rect( -30, -6, 60, 12 ).fill( 0x1a1a2e );
			spinner.rect( -14, -12, 28, 6 ).fill( 0x1a1a2e );
			spinner.rect( -26, -2, 6, 4 ).fill( 0xff9640 );
			spinner.rect( 20, -2, 6, 4 ).fill( 0xff9640 );
			spinner.circle( 0, 0, 3 ).fill( 0x64d8ff );
			spinner.alpha = 0;
			spinner.y = hh * 0.28; spinner.x = -80;
			app.stage.addChild( spinner );

			var waterY = hh * 0.88;

			function paintBg() {
				h.paintVGradient( bg, app.renderer.width, app.renderer.height, 0x1a0420, 0x000000, 14 );
			}
			paintBg();

			var cityData = { far: null, mid: null, near: null };
			function rebuildCity() {
				var ww = app.renderer.width, hhh = app.renderer.height;
				cityData.far  = buildCityLayer( ww, hhh, hhh * 0.68, 30, 120, 0x0c0812, 0.10, 0xff8866 );
				cityData.mid  = buildCityLayer( ww, hhh, hhh * 0.78, 60, 200, 0x050308, 0.18, 0xffcc66 );
				cityData.near = buildCityLayer( ww, hhh, hhh * 0.92, 40, 160, 0x020104, 0.24, 0xffe08a );
				paintBlocks( cityFar,  cityData.far.blocks );
				paintBlocks( cityMid,  cityData.mid.blocks );
				paintBlocks( cityNear, cityData.near.blocks );
			}
			rebuildCity();

			function paintFog() {
				var ww = app.renderer.width, hhh = app.renderer.height;
				fogFar.clear();
				h.paintVGradient( fogFar, ww, hhh, 0x000000, 0x000000, 2 );
				fogFar.clear();
				fogFar.rect( 0, hhh * 0.45, ww, hhh * 0.35 ).fill( { color: 0x3a1440, alpha: 0.25 } );
				fogMid.clear();
				fogMid.rect( 0, hhh * 0.58, ww, hhh * 0.32 ).fill( { color: 0x1a0420, alpha: 0.22 } );
			}
			paintFog();

			function paintWaterSurface() {
				var ww = app.renderer.width;
				waterSurface.clear();
				waterSurface.rect( 0, waterY - 1, ww, 2 ).fill( { color: 0x8a64b0, alpha: 0.5 } );
			}
			paintWaterSurface();

			// Signs (crisp + bloom) — built on setup.
			var signs = [];
			for ( var i = 0; i < 6; i++ ) {
				var color = h.choose( SIGN_COLORS );
				var fontSize = h.irand( 22, 48 );
				var crisp = new PIXI.Text( {
					text: h.choose( SIGN_TEXTS ),
					style: {
						fontFamily: 'Impact, "Helvetica Neue", sans-serif',
						fontSize: fontSize, fill: color, letterSpacing: 2,
					},
				} );
				crisp.x = h.rand( 20, app.renderer.width - 180 );
				crisp.y = h.rand( 20, app.renderer.height * 0.5 );
				signLayer.addChild( crisp );
				var glowSign = new PIXI.Text( {
					text: crisp.text,
					style: {
						fontFamily: crisp.style.fontFamily, fontSize: fontSize,
						fill: color, letterSpacing: 2,
					},
				} );
				glowSign.x = crisp.x; glowSign.y = crisp.y;
				bloomSigns.addChild( glowSign );
				signs.push( {
					crisp: crisp, glow: glowSign,
					flickerCD: h.rand( 60, 240 ),
					on: true,
					// Each sign gets its own base flicker frequency + phase.
					baseFreq: h.rand( 0.002, 0.02 ),
					phase: h.rand( 0, h.tau ),
				} );
			}

			// Rain.
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

			return {
				bg: bg, paintBg: paintBg,
				lightning: lightning, lightT: h.rand( 60 * 8, 60 * 30 ),
				cityFar: cityFar, cityMid: cityMid, cityNear: cityNear,
				winFar: winFar, winMid: winMid, winNear: winNear,
				fogFar: fogFar, fogMid: fogMid, paintFog: paintFog,
				reflection: reflection, waterSurface: waterSurface, paintWaterSurface: paintWaterSurface,
				waterY: waterY,
				cityData: cityData, rebuildCity: rebuildCity,
				signs: signs, rain: rain, drops: drops, splashes: splashes,
				spinner: spinner, spinnerT: h.rand( 60 * 12, 60 * 35 ),
				time: 0,
				blackout: null,
				blackoutCD: h.rand( 60 * 4, 60 * 12 ),
			};
		},

		onResize: function ( state, env ) {
			var hhh = env.app.renderer.height;
			state.paintBg();
			state.rebuildCity();
			state.paintFog();
			state.waterY = hhh * 0.88;
			state.paintWaterSurface();
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.time += dt;

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

			// --- Blackout event ------------------------------------- //
			if ( state.blackout ) {
				state.blackout.elapsed += dt;
				var lifeT = state.blackout.elapsed / state.blackout.duration;
				state.blackout.level = lifeT < 0.15
					? 1 - lifeT / 0.15        // fade to dark
					: lifeT > 0.85
					? ( lifeT - 0.85 ) / 0.15 // fade back to full
					: 0;                      // fully dark mid-event
				if ( state.blackout.elapsed >= state.blackout.duration ) {
					state.blackout = null;
					state.blackoutCD = h.rand( 60 * 8, 60 * 25 );
				}
			} else {
				state.blackoutCD -= dt;
				if ( state.blackoutCD <= 0 ) {
					state.blackout = {
						x: h.rand( 0, w - 120 ),
						y: h.rand( hh * 0.4, hh * 0.8 ),
						w: h.rand( 60, 160 ),
						h: h.rand( 20, 80 ),
						level: 0,
						duration: h.rand( 40, 100 ),
						elapsed: 0,
					};
				}
			}

			// --- Per-window flicker --------------------------------- //
			paintWindows( state.winFar,  state.cityData.far.windows,  state.time, state.blackout );
			paintWindows( state.winMid,  state.cityData.mid.windows,  state.time, state.blackout );
			paintWindows( state.winNear, state.cityData.near.windows, state.time, state.blackout );

			// --- Wet-ground reflection ------------------------------ //
			paintReflection( state.reflection,
				state.cityData.near.blocks.concat( state.cityData.mid.blocks ),
				state.waterY, hh, state.time );

			// --- Sign flicker --------------------------------------- //
			for ( var i = 0; i < state.signs.length; i++ ) {
				var s = state.signs[ i ];
				s.flickerCD -= dt;
				// Continuous sinusoidal breathing on top of discrete on/off toggles.
				var breath = 0.85 + 0.15 * Math.sin( state.time * s.baseFreq + s.phase );
				if ( s.flickerCD <= 0 ) {
					s.on = Math.random() < 0.85;
					s.flickerCD = h.rand( 4, 140 );
				}
				var a = s.on ? h.rand( 0.8, 1 ) * breath : h.rand( 0.1, 0.4 ) * breath;
				s.crisp.alpha = a;
				s.glow.alpha = a * 0.85;
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
