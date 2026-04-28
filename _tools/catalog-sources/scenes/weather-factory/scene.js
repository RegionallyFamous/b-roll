/**
 * ODD scene: Weather Factory.
 *
 * GPT Image 2 backdrop with gentle cloud drift, conveyor sparkle, and
 * small weather glyphs moving through the sky.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	// Signature moment: perf- and reduced-motion-aware overlay that
	// lands in the negative-space slot the v2 wallpaper prompt reserves.
	function signatureTick( state, env ) {
		if ( env.perfTier === 'low' || env.reducedMotion ) return;
		var app = env.app, PIXI = env.PIXI, dt = env.dt || 1;
		var s = state.__sig;
		if ( ! s || ! s.layer || ! s.layer.parent ) {
			s = state.__sig = {
				layer: new PIXI.Graphics(),
				timer: 55 + Math.random() * 75,
				life: 0,
			};
			s.flakes = [];
			app.stage.addChild( s.layer );
		}
		if ( s.life <= 0 ) {
			s.timer -= dt / 60;
			if ( s.timer > 0 ) { s.layer.clear(); return; }
			s.life = 1;
			s.timer = 55 + Math.random() * 75;
			s.flakes = [];
			            for ( var fi = 0; fi < 40; fi++ ) {
			                s.flakes.push( {
			                    x: Math.random() * app.renderer.width * 0.45,
			                    y: Math.random() * app.renderer.height * 0.6,
			                    vy: 0.6 + Math.random() * 1.0,
			                    vx: -0.2 + Math.random() * 0.4,
			                    r: 2 + Math.random() * 2.2
			                } );
			            }
		}
		s.life = Math.max( 0, s.life - dt * 0.0012 );

		            s.layer.clear();
		            for ( var fi = 0; fi < s.flakes.length; fi++ ) {
		                var fl = s.flakes[ fi ];
		                fl.x += fl.vx * dt;
		                fl.y += fl.vy * dt;
		                if ( fl.y > app.renderer.height * 0.78 ) {
		                    fl.y = -10;
		                    fl.x = Math.random() * app.renderer.width * 0.45;
		                }
		                s.layer.circle( fl.x, fl.y, fl.r )
		                    .fill( { color: 0xffffff, alpha: s.life * 0.82 } );
		            }
	}

	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'weather-factory' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/weather-factory.webp' + qs;
	}

	function makeWeather( w, hh ) {
		var colors = [ 0xffffff, 0x9fdcff, 0xffdf8a, 0xffa2c8 ];
		var out = [];
		for ( var i = 0; i < 95; i++ ) {
			out.push( {
				x: h.rand( w * 0.06, w * 0.92 ),
				y: h.rand( hh * 0.10, hh * 0.78 ),
				r: h.rand( 0.6, 2.4 ),
				vx: h.rand( -0.18, 0.18 ),
				phase: Math.random() * Math.PI * 2,
				speed: h.rand( 0.004, 0.015 ),
				alpha: h.rand( 0.09, 0.34 ),
				color: colors[ ( Math.random() * colors.length ) | 0 ],
			} );
		}
		return out;
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
			var motes = new PIXI.Graphics();
			motes.blendMode = 'add';
			app.stage.addChild( motes );
			return {
				backdrop: backdrop,
				fitBackdrop: fitBackdrop,
				wisps: wisps,
				motes: motes,
				weatherList: makeWeather( app.renderer.width, app.renderer.height ),
				time: 0,
				ripple: 0,
				glanceX: 0,
			};
		},
		onResize: function ( state, env ) {
			state.fitBackdrop();
			state.weatherList = makeWeather( env.app.renderer.width, env.app.renderer.height );
		},
		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt;
			state.ripple *= 0.94;
			state.glanceX *= 0.9;
			var mid = ( env.audio && env.audio.enabled ) ? env.audio.mid : 0;

			var wg = state.wisps;
			wg.clear();
			for ( var i = 0; i < 6; i++ ) {
				var y = hh * ( 0.22 + i * 0.08 ) + Math.sin( state.time * 0.008 + i ) * 10;
				wg.moveTo( w * 0.08, y )
					.bezierCurveTo( w * 0.28, y - 30, w * 0.58, y + 24, w * 0.92, y - 4 )
					.stroke( { color: i % 2 ? 0xffd18b : 0x9ee8ff, width: 1.4 + state.ripple, alpha: 0.035 + mid * 0.035 + state.ripple * 0.05, cap: 'round' } );
			}

			var mg = state.motes;
			mg.clear();
			for ( var m = 0; m < state.weatherList.length; m++ ) {
				var p = state.weatherList[ m ];
				if ( ! env.reducedMotion ) {
					p.phase += p.speed * dt;
					p.x += p.vx * dt;
				}
				if ( p.x < -10 ) p.x = w + 10;
				if ( p.x > w + 10 ) p.x = -10;
				var x = p.x + Math.sin( p.phase ) * 8 + state.glanceX * 6;
				var y = p.y + Math.cos( p.phase * 0.8 ) * 7;
				mg.circle( x, y, p.r ).fill( { color: p.color, alpha: p.alpha + state.ripple * 0.08 } );
			}

		
			signatureTick( state, env );
		},
		onRipple: function ( opts, state ) {
			state.ripple = Math.min( 1, state.ripple + ( ( opts && opts.intensity ) || 0.45 ) );
		},
		onGlance: function ( opts, state, env ) {
			if ( ! opts || opts.nod ) return;
			var w = env.app.renderer.width;
			state.glanceX = Math.max( -1, Math.min( 1, ( ( opts.x || w / 2 ) / w - 0.5 ) * 2 ) );
		},
		onGlitch: function ( opts, state ) {
			state.ripple = 1;
		},
		onAudio: function ( state, env ) {
			if ( env.audio.high > 0.58 ) state.ripple = Math.min( 1, state.ripple + 0.06 );
		},
		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},
		cleanup: function ( state ) {
			state.weatherList = [];
		},
	};
} )();
/**
 * ODD scene: Weather Factory � v1.1.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (assets/wallpapers/weather-factory.webp)
 * with live weather produced by the painted machine:
 *
 *   1. Precipitation in three depth tiers. Rain drops by default;
 *      swaps to snow in winter, leaves in autumn, blossom petals in
 *      spring, and warm sparks in summer.
 *
 *   2. Steam wisps rising from the conveyor belt area (lower right).
 *
 *   3. Rare lightning flashes tied to the spire in the upper right,
 *      with a short white haze across the stage.
 *
 *   4. A soft rainbow shimmer near the valve in the lower left when
 *      the scene is calm (no recent lightning).
 *
 * Audio: bass thickens the rainfall, highs brighten the steam, mid
 * nudges more rainbow.
 *
 * Reduced motion: precipitation paused, one lightning snapshot gone,
 * rainbow held at median strength.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	var DROP_COUNTS = [ 110, 70, 40 ]; // back, mid, front
	var STEAM_COUNT = 22;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'weather-factory' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/weather-factory.webp' + qs;
	}

	function seasonMode( season ) {
		switch ( season ) {
			case 'winter':    return 'snow';
			case 'autumn':    return 'leaves';
			case 'spring':    return 'petals';
			case 'summer':    return 'sparks';
			case 'halloween': return 'leaves';
			case 'newYear':   return 'snow';
			default:          return 'rain';
		}
	}

	function makeDrops( w, hh ) {
		var layers = [];
		for ( var band = 0; band < 3; band++ ) {
			var arr = [];
			var count = DROP_COUNTS[ band ];
			for ( var i = 0; i < count; i++ ) {
				arr.push( {
					x: h.rand( 0, w ),
					y: h.rand( -hh * 0.2, hh ),
					speed: ( 3.2 + band * 2.4 ) * h.rand( 0.7, 1.3 ),
					swaySpeed: h.rand( 0.01, 0.035 ),
					phase: Math.random() * h.tau,
					len: 6 + band * 5,
					size: 1 + band * 0.6,
					rot: Math.random() * h.tau,
					rotSpeed: h.rand( -0.04, 0.04 ),
				} );
			}
			layers.push( arr );
		}
		return layers;
	}

	function makeSteam( w, hh ) {
		var arr = [];
		for ( var i = 0; i < STEAM_COUNT; i++ ) {
			arr.push( {
				x: w * h.rand( 0.45, 0.95 ),
				y: hh * h.rand( 0.6, 0.95 ),
				r: h.rand( 10, 28 ),
				rise: h.rand( 0.15, 0.35 ),
				phase: Math.random() * h.tau,
				life: Math.random(),
				seed: Math.random(),
			} );
		}
		return arr;
	}

	function drawDrop( g, d, mode, tint, parallaxX, parallaxY ) {
		var x = d.x + parallaxX;
		var y = d.y + parallaxY;
		if ( mode === 'rain' ) {
			var dx = Math.sin( d.phase ) * 2;
			g.moveTo( x + dx, y ).lineTo( x + dx * 0.5, y + d.len )
				.stroke( { color: tint, width: d.size, alpha: 0.58, cap: 'round' } );
		} else if ( mode === 'snow' ) {
			g.circle( x, y, d.size * 1.6 ).fill( { color: 0xffffff, alpha: 0.72 } );
			g.circle( x, y, d.size * 3.2 ).fill( { color: 0xffffff, alpha: 0.14 } );
		} else if ( mode === 'leaves' ) {
			var cos = Math.cos( d.rot ), sin = Math.sin( d.rot );
			function rot( lx, ly ) {
				return { x: x + lx * cos - ly * sin, y: y + lx * sin + ly * cos };
			}
			var a = rot( 0, -d.size * 2.4 );
			var b = rot( d.size * 1.6, 0 );
			var c = rot( 0, d.size * 2.4 );
			var e = rot( -d.size * 1.6, 0 );
			g.moveTo( a.x, a.y )
				.lineTo( b.x, b.y )
				.lineTo( c.x, c.y )
				.lineTo( e.x, e.y )
				.lineTo( a.x, a.y )
				.fill( { color: tint, alpha: 0.78 } );
		} else if ( mode === 'petals' ) {
			g.ellipse( x, y, d.size * 2.2, d.size * 1.1 )
				.fill( { color: tint, alpha: 0.7 } );
		} else {
			// sparks
			g.circle( x, y, d.size * 1.2 ).fill( { color: 0xffffff, alpha: 0.85 } );
			g.circle( x, y, d.size * 3 ).fill( { color: tint, alpha: 0.22 } );
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

	window.__odd.scenes[ 'weather-factory' ] = {
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

			var rainbow = new PIXI.Graphics();
			rainbow.blendMode = 'add';
			app.stage.addChild( rainbow );

			var steam = new PIXI.Graphics();
			steam.blendMode = 'add';
			app.stage.addChild( steam );

			var dropsBack  = new PIXI.Graphics();
			dropsBack.blendMode = 'add';
			app.stage.addChild( dropsBack );
			var dropsMid   = new PIXI.Graphics();
			dropsMid.blendMode = 'add';
			app.stage.addChild( dropsMid );
			var dropsFront = new PIXI.Graphics();
			dropsFront.blendMode = 'add';
			app.stage.addChild( dropsFront );

			var flash = new PIXI.Graphics();
			flash.blendMode = 'add';
			app.stage.addChild( flash );

			var w = app.renderer.width, hh = app.renderer.height;
			var mode = seasonMode( env.season );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				rainbow: rainbow, steam: steam, flash: flash,
				dropLayers: [ dropsBack, dropsMid, dropsFront ],
				drops: makeDrops( w, hh ),
				steamList: makeSteam( w, hh ),
				mode: mode,
				time: 0,
				flashV: 0,
				nextBolt: h.rand( 8, 22 ),
				rainbowTimer: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.drops = makeDrops( w, hh );
			state.steamList = makeSteam( w, hh );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt;
			state.flashV *= 0.88;

			var perfLow = env.perfTier === 'low';
			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var mid  = ( env.audio && env.audio.enabled ) ? env.audio.mid  : 0;
			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;

			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			var tint = modeTint( state.mode );
			var speedMul = 1 + bass * 0.5;

			for ( var band = 0; band < 3; band++ ) {
				var g = state.dropLayers[ band ];
				g.clear();
				var drops = state.drops[ band ];
				var parX = px * ( 4 + band * 8 );
				var parY = py * ( 2 + band * 4 );
				for ( var i = 0; i < drops.length; i++ ) {
					var d = drops[ i ];
					if ( ! env.reducedMotion ) {
						d.phase += d.swaySpeed * dt;
						d.rot += d.rotSpeed * dt;
						if ( state.mode === 'snow' || state.mode === 'leaves' || state.mode === 'petals' ) {
							d.x += Math.sin( d.phase ) * 0.5 * dt;
							d.y += d.speed * 0.4 * dt * speedMul;
						} else {
							d.y += d.speed * dt * speedMul;
						}
						if ( d.y > hh + 12 ) {
							d.y = -20;
							d.x = h.rand( 0, w );
						}
						if ( d.x < -20 ) d.x = w + 20;
						if ( d.x > w + 20 ) d.x = -20;
					}
					drawDrop( g, d, state.mode, tint, parX, parY );
				}
			}

			var sg = state.steam;
			sg.clear();
			for ( var s = 0; s < state.steamList.length; s++ ) {
				var st = state.steamList[ s ];
				if ( ! env.reducedMotion ) {
					st.life += 0.003 * dt;
					if ( st.life > 1 ) {
						st.life = 0;
						st.x = w * h.rand( 0.45, 0.95 );
						st.y = hh * h.rand( 0.7, 0.95 );
					}
					st.phase += 0.02 * dt;
				}
				var lifeAlpha = Math.sin( st.life * Math.PI ) * 0.55;
				var liftY = st.y - st.life * hh * 0.25 - st.rise * dt * 0;
				var sway = Math.sin( st.phase ) * 12;
				sg.circle( st.x + sway + px * 6, liftY + py * 3, st.r * ( 0.8 + st.life * 0.4 ) )
					.fill( { color: 0xfff4e0, alpha: lifeAlpha * ( 0.45 + high * 0.25 ) } );
			}

			if ( ! perfLow ) {
				state.rainbowTimer += dt;
				var rg = state.rainbow;
				rg.clear();
				var calm = state.flashV < 0.1;
				var amp = calm ? ( 0.35 + mid * 0.4 + Math.sin( state.rainbowTimer * 0.003 ) * 0.12 ) : 0;
				if ( amp > 0.02 ) {
					var rCx = w * 0.22;
					var rCy = hh * 0.92;
					var rR = Math.min( w, hh ) * 0.24;
					var bands = [ 0xff80a8, 0xffb36b, 0xfff098, 0x9effb0, 0x8ed6ff, 0xbf9eff ];
					for ( var rI = 0; rI < bands.length; rI++ ) {
						var rr = rR + rI * 4;
						rg.arc( rCx, rCy, rr, -Math.PI, 0 )
							.stroke( { color: bands[ rI ], width: 2.2, alpha: amp * 0.55 } );
					}
				}
			}

			if ( ! env.reducedMotion ) {
				state.nextBolt -= dt / 60;
				if ( state.nextBolt <= 0 ) {
					state.flashV = 0.9;
					state.nextBolt = h.rand( 14, 34 );
				}
			}

			var fg = state.flash;
			fg.clear();
			if ( state.flashV > 0.02 ) {
				fg.rect( 0, 0, w, hh ).fill( { color: 0xfff4d0, alpha: state.flashV * 0.35 } );
				// Bolt from spire (~0.86, 0.22 unit) zig-zagging down.
				var bx = w * 0.86, by = hh * 0.22;
				var prevX = bx, prevY = by;
				for ( var j = 0; j < 8; j++ ) {
					var tx = bx + ( Math.random() - 0.5 ) * 60;
					var ty = by + ( j + 1 ) * hh * 0.06;
					fg.moveTo( prevX, prevY ).lineTo( tx, ty )
						.stroke( { color: 0xffffff, width: 2.0, alpha: state.flashV * 0.85, cap: 'round' } );
					prevX = tx; prevY = ty;
				}
			}

		},

		onRipple: function ( opts, state ) {
			state.flashV = Math.min( 1, state.flashV + ( ( opts && opts.intensity ) || 0.5 ) );
		},

		onGlitch: function ( opts, state ) {
			state.flashV = 1;
		},

		onAudio: function ( state, env ) {
			if ( env.audio.bass > 0.75 ) {
				state.flashV = Math.min( 1, state.flashV + 0.25 );
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
