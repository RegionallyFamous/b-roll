/**
 * ODD scene: Weather Factory - v1.0.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (wallpaper.webp) with calm factory
 * weather: seasonal precipitation, conveyor steam, faint sky wisps,
 * a right-side valve rainbow, and rare spire lightning.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;
	var scriptUrl = document.currentScript && document.currentScript.src;

	var DROP_COUNTS = [ 58, 38, 22 ];
	var STEAM_COUNT = 16;
	var WISP_COUNT = 5;

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'weather-factory' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function seasonMode( season ) {
		switch ( season ) {
			case 'winter':    return 'snow';
			case 'autumn':    return 'leaves';
			case 'halloween': return 'leaves';
			case 'spring':    return 'petals';
			case 'summer':    return 'sparks';
			case 'newYear':   return 'snow';
			default:          return 'rain';
		}
	}

	function modeTint( mode ) {
		switch ( mode ) {
			case 'snow':   return 0xeaf4ff;
			case 'leaves': return 0xff9e3a;
			case 'petals': return 0xffcde3;
			case 'sparks': return 0xffd278;
			default:       return 0x9fc4ff;
		}
	}

	function makeDrops( w, hh, low ) {
		var layers = [];
		for ( var band = 0; band < 3; band++ ) {
			var arr = [];
			var count = low ? Math.max( 8, Math.round( DROP_COUNTS[ band ] * 0.42 ) ) : DROP_COUNTS[ band ];
			for ( var i = 0; i < count; i++ ) {
				var x = h.rand( w * 0.16, w );
				var y = h.rand( -hh * 0.2, hh );
				if ( x < w * 0.36 && y > hh * 0.48 ) x = h.rand( w * 0.42, w );
				arr.push( {
					x: x,
					y: y,
					speed: ( 1.4 + band * 1.1 ) * h.rand( 0.75, 1.25 ),
					swaySpeed: h.rand( 0.006, 0.02 ),
					phase: Math.random() * h.tau,
					len: 5 + band * 4,
					size: 0.8 + band * 0.45,
					rot: Math.random() * h.tau,
					rotSpeed: h.rand( -0.025, 0.025 ),
				} );
			}
			layers.push( arr );
		}
		return layers;
	}

	function makeSteam( w, hh, low ) {
		var arr = [];
		var count = low ? 7 : STEAM_COUNT;
		for ( var i = 0; i < count; i++ ) {
			arr.push( {
				x: w * h.rand( 0.52, 0.94 ),
				y: hh * h.rand( 0.62, 0.92 ),
				r: h.rand( 8, 22 ),
				phase: Math.random() * h.tau,
				life: Math.random(),
			} );
		}
		return arr;
	}

	function drawDrop( g, d, mode, tint, parallaxX, parallaxY ) {
		var x = d.x + parallaxX;
		var y = d.y + parallaxY;
		if ( mode === 'rain' ) {
			var dx = Math.sin( d.phase ) * 1.5;
			g.moveTo( x + dx, y ).lineTo( x + dx * 0.4, y + d.len )
				.stroke( { color: tint, width: d.size, alpha: 0.42, cap: 'round' } );
		} else if ( mode === 'snow' ) {
			g.circle( x, y, d.size * 1.5 ).fill( { color: 0xffffff, alpha: 0.58 } );
		} else if ( mode === 'leaves' ) {
			var cos = Math.cos( d.rot ), sin = Math.sin( d.rot );
			var rx = d.size * 1.4, ry = d.size * 2.2;
			g.moveTo( x - rx * sin, y - ry * cos )
				.lineTo( x + rx * cos, y - ry * sin )
				.lineTo( x + rx * sin, y + ry * cos )
				.lineTo( x - rx * cos, y + ry * sin )
				.fill( { color: tint, alpha: 0.62 } );
		} else if ( mode === 'petals' ) {
			g.ellipse( x, y, d.size * 2, d.size ).fill( { color: tint, alpha: 0.58 } );
		} else {
			g.circle( x, y, d.size * 1.1 ).fill( { color: 0xffffff, alpha: 0.7 } );
			g.circle( x, y, d.size * 2.5 ).fill( { color: tint, alpha: 0.16 } );
		}
	}

	window.__odd.scenes[ 'weather-factory' ] = {
		setup: async function ( env ) {
			var PIXI = env.PIXI, app = env.app;
			var tex = await PIXI.Assets.load( backdropUrl() );
			var backdrop = new PIXI.Sprite( tex );
			app.stage.addChild( backdrop );
			function fitBackdrop() {
				var s = Math.max( app.renderer.width / tex.width, app.renderer.height / tex.height );
				backdrop.scale.set( s );
				backdrop.x = ( app.renderer.width - tex.width * s ) / 2;
				backdrop.y = ( app.renderer.height - tex.height * s ) / 2;
			}
			fitBackdrop();

			var wisps = new PIXI.Graphics();
			wisps.blendMode = 'add';
			app.stage.addChild( wisps );

			var rainbow = new PIXI.Graphics();
			rainbow.blendMode = 'add';
			app.stage.addChild( rainbow );

			var steam = new PIXI.Graphics();
			steam.blendMode = 'add';
			app.stage.addChild( steam );

			var dropsBack = new PIXI.Graphics();
			dropsBack.blendMode = 'add';
			app.stage.addChild( dropsBack );
			var dropsMid = new PIXI.Graphics();
			dropsMid.blendMode = 'add';
			app.stage.addChild( dropsMid );
			var dropsFront = new PIXI.Graphics();
			dropsFront.blendMode = 'add';
			app.stage.addChild( dropsFront );

			var flash = new PIXI.Graphics();
			flash.blendMode = 'add';
			app.stage.addChild( flash );

			var w = app.renderer.width, hh = app.renderer.height;
			var low = env.perfTier === 'low';
			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				wisps: wisps, rainbow: rainbow, steam: steam, flash: flash,
				dropLayers: [ dropsBack, dropsMid, dropsFront ],
				drops: makeDrops( w, hh, low ),
				steamList: makeSteam( w, hh, low ),
				low: low,
				mode: seasonMode( env.season ),
				time: 0,
				flashV: 0,
				nextBolt: low ? 999 : h.rand( 18, 38 ),
				rainbowTimer: 0,
				ripple: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.drops = makeDrops( w, hh, state.low );
			state.steamList = makeSteam( w, hh, state.low );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.flashV *= 0.88;
			state.ripple *= 0.93;

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var mid = ( env.audio && env.audio.enabled ) ? env.audio.mid : 0;
			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;
			var tint = modeTint( state.mode );
			var speedMul = 0.75 + bass * 0.25;

			var wg = state.wisps;
			wg.clear();
			for ( var wi = 0; wi < WISP_COUNT; wi++ ) {
				var wy = hh * ( 0.18 + wi * 0.07 ) + Math.sin( state.time * 0.004 + wi ) * 8;
				wg.moveTo( w * 0.22, wy )
					.bezierCurveTo( w * 0.42, wy - 20, w * 0.62, wy + 18, w * 0.94, wy - 6 )
					.stroke( { color: wi % 2 ? 0xffd18b : 0x9ee8ff, width: 1.1, alpha: 0.025 + mid * 0.018 + state.ripple * 0.025, cap: 'round' } );
			}

			for ( var band = 0; band < 3; band++ ) {
				var g = state.dropLayers[ band ];
				g.clear();
				var drops = state.drops[ band ];
				var parX = px * ( 3 + band * 5 );
				var parY = py * ( 2 + band * 3 );
				for ( var i = 0; i < drops.length; i++ ) {
					var d = drops[ i ];
					if ( ! env.reducedMotion ) {
						d.phase += d.swaySpeed * dt;
						d.rot += d.rotSpeed * dt;
						if ( state.mode === 'snow' || state.mode === 'leaves' || state.mode === 'petals' ) {
							d.x += Math.sin( d.phase ) * 0.28 * dt;
							d.y += d.speed * 0.34 * dt * speedMul;
						} else {
							d.y += d.speed * dt * speedMul;
						}
						if ( d.y > hh + 12 ) {
							d.y = -20;
							d.x = h.rand( w * 0.16, w );
						}
						if ( d.x < w * 0.12 ) d.x = w + 12;
						if ( d.x > w + 16 ) d.x = w * 0.16;
					}
					if ( d.x < w * 0.35 && d.y > hh * 0.48 ) continue;
					drawDrop( g, d, state.mode, tint, parX, parY );
				}
			}

			var sg = state.steam;
			sg.clear();
			for ( var s = 0; s < state.steamList.length; s++ ) {
				var st = state.steamList[ s ];
				if ( ! env.reducedMotion ) {
					st.life += 0.0018 * dt;
					st.phase += 0.012 * dt;
					if ( st.life > 1 ) {
						st.life = 0;
						st.x = w * h.rand( 0.52, 0.94 );
						st.y = hh * h.rand( 0.62, 0.92 );
					}
				}
				var lifeAlpha = Math.sin( st.life * Math.PI ) * 0.38;
				var liftY = st.y - st.life * hh * 0.18;
				var sway = Math.sin( st.phase ) * 10;
				sg.circle( st.x + sway + px * 5, liftY + py * 2, st.r * ( 0.8 + st.life * 0.4 ) )
					.fill( { color: 0xfff4e0, alpha: lifeAlpha * ( 0.42 + high * 0.2 ) } );
			}

			var rg = state.rainbow;
			rg.clear();
			if ( ! state.low ) {
				state.rainbowTimer += dt;
				var amp = state.flashV < 0.1 ? ( 0.24 + mid * 0.22 + Math.sin( state.rainbowTimer * 0.002 ) * 0.08 ) : 0;
				var rCx = w * 0.78;
				var rCy = hh * 0.82;
				var rR = Math.min( w, hh ) * 0.18;
				var bands = [ 0xff80a8, 0xffb36b, 0xfff098, 0x9effb0, 0x8ed6ff ];
				for ( var rI = 0; rI < bands.length; rI++ ) {
					rg.arc( rCx, rCy, rR + rI * 4, -Math.PI * 0.82, Math.PI * 0.05 )
						.stroke( { color: bands[ rI ], width: 1.8, alpha: amp * 0.42 } );
				}
			}

			if ( ! env.reducedMotion && ! state.low ) {
				state.nextBolt -= dt / 60;
				if ( state.nextBolt <= 0 ) {
					state.flashV = 0.7;
					state.nextBolt = h.rand( 22, 46 );
				}
			}

			var fg = state.flash;
			fg.clear();
			if ( state.flashV > 0.02 ) {
				fg.rect( 0, 0, w, hh ).fill( { color: 0xfff4d0, alpha: state.flashV * 0.22 } );
				var bx = w * 0.86, by = hh * 0.22;
				var prevX = bx, prevY = by;
				for ( var j = 0; j < 6; j++ ) {
					var tx = bx + Math.sin( state.time + j * 1.7 ) * 26;
					var ty = by + ( j + 1 ) * hh * 0.055;
					fg.moveTo( prevX, prevY ).lineTo( tx, ty )
						.stroke( { color: 0xffffff, width: 1.5, alpha: state.flashV * 0.7, cap: 'round' } );
					prevX = tx;
					prevY = ty;
				}
			}
		},

		onRipple: function ( opts, state ) {
			state.ripple = Math.min( 1, state.ripple + ( ( opts && opts.intensity ) || 0.45 ) );
		},

		onGlitch: function ( opts, state ) {
			state.flashV = 0.75;
		},

		onAudio: function ( state, env ) {
			if ( env.audio && env.audio.enabled && env.audio.bass > 0.78 && ! state.low ) {
				state.flashV = Math.min( 0.8, state.flashV + 0.16 );
			}
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.drops = [];
			state.steamList = [];
		},
	};
} )();
