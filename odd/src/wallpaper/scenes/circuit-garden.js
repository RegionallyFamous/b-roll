/**
 * ODD scene: Circuit Garden.
 *
 * GPT Image 2 backdrop with quiet fireflies, trace pulses, and dew glints.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/circuit-garden.webp' + qs;
	}

	function makeSparks( w, hh ) {
		var out = [];
		for ( var i = 0; i < 120; i++ ) {
			out.push( {
				x: h.rand( w * 0.18, w * 0.95 ),
				y: h.rand( hh * 0.08, hh * 0.88 ),
				r: h.rand( 0.8, 2.2 ),
				phase: Math.random() * Math.PI * 2,
				speed: h.rand( 0.004, 0.018 ),
				alpha: h.rand( 0.12, 0.42 ),
				color: Math.random() > 0.55 ? 0xb6ff5c : 0x70fff0,
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'circuit-garden' ] = {
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
			var traces = new PIXI.Graphics();
			traces.blendMode = 'add';
			app.stage.addChild( traces );
			var sparks = new PIXI.Graphics();
			sparks.blendMode = 'add';
			app.stage.addChild( sparks );
			return {
				backdrop: backdrop,
				fitBackdrop: fitBackdrop,
				traces: traces,
				sparks: sparks,
				sparkList: makeSparks( app.renderer.width, app.renderer.height ),
				time: 0,
				ripple: 0,
				glanceX: 0,
			};
		},
		onResize: function ( state, env ) {
			state.fitBackdrop();
			state.sparkList = makeSparks( env.app.renderer.width, env.app.renderer.height );
		},
		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt;
			state.ripple *= 0.93;
			state.glanceX *= 0.9;
			var mid = ( env.audio && env.audio.enabled ) ? env.audio.mid : 0;

			var tg = state.traces;
			tg.clear();
			for ( var i = 0; i < 8; i++ ) {
				var y = hh * ( 0.22 + i * 0.075 );
				var pulse = 0.02 + Math.max( 0, Math.sin( state.time * 0.018 + i * 0.8 ) ) * 0.08;
				tg.moveTo( w * 0.18, y )
					.lineTo( w * ( 0.42 + state.glanceX * 0.02 ), y + Math.sin( i ) * 18 )
					.lineTo( w * 0.86, y + Math.cos( i ) * 26 )
					.stroke( { color: 0x8dff72, width: 1.2 + state.ripple, alpha: pulse + mid * 0.04 + state.ripple * 0.04, cap: 'round' } );
			}

			var sg = state.sparks;
			sg.clear();
			for ( var s = 0; s < state.sparkList.length; s++ ) {
				var p = state.sparkList[ s ];
				if ( ! env.reducedMotion ) p.phase += p.speed * dt;
				var x = p.x + Math.sin( p.phase ) * 10 + state.glanceX * 8;
				var y = p.y + Math.cos( p.phase * 0.8 ) * 8;
				var a = p.alpha * ( 0.6 + Math.sin( p.phase * 2 ) * 0.4 ) + state.ripple * 0.08;
				sg.circle( x, y, p.r ).fill( { color: p.color, alpha: Math.max( 0, a ) } );
			}

			if ( ! env.reducedMotion && env.parallax ) {
				state.backdrop.x += ( env.parallax.x * 6 - state.backdrop.x % 1 ) * 0.02;
				state.backdrop.y += ( env.parallax.y * 3 - state.backdrop.y % 1 ) * 0.02;
			}
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
			if ( env.audio.high > 0.62 ) state.ripple = Math.min( 1, state.ripple + 0.07 );
		},
		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},
		cleanup: function ( state ) {
			state.sparkList = [];
		},
	};
} )();
/**
 * ODD scene: Circuit Garden � v1.1.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (assets/wallpapers/circuit-garden.webp)
 * with a thin layer of "living circuitry":
 *
 *   1. ~80 data fireflies drifting on a slow noise field with short
 *      glowing tails. Speed scales with mid-range audio energy.
 *
 *   2. Circuit traces that pulse a moving spark along pre-seeded
 *      paths, as if a packet were routing through the garden.
 *
 *   3. A scatter of "blossoms" � small radial bursts that inhale
 *      and exhale on a breath rhythm, tinted by season.
 *
 *   4. Optional low-perf fallback: skip traces, keep fireflies and
 *      blossoms.
 *
 * Audio: bass makes blossoms exhale, mid speeds up fireflies, high
 * triggers extra trace sparks.
 *
 * Reduced motion: everything frozen on a settled pose.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	var FIREFLY_COUNT = 80;
	var TRACE_COUNT = 5;
	var BLOSSOM_COUNT = 16;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/circuit-garden.webp' + qs;
	}

	function seasonPalette( season ) {
		switch ( season ) {
			case 'spring':    return { firefly: 0xb5ffdf, blossom: 0xff9dd2, trace: 0x7effc8 };
			case 'summer':    return { firefly: 0xfff2a0, blossom: 0xff7f6b, trace: 0xffcb5b };
			case 'autumn':    return { firefly: 0xffc27a, blossom: 0xff8a3a, trace: 0xff7aa2 };
			case 'winter':    return { firefly: 0xcfe8ff, blossom: 0xbde3ff, trace: 0x9bd7ff };
			case 'halloween': return { firefly: 0xff9a3b, blossom: 0xb074ff, trace: 0x4ce0a5 };
			case 'newYear':   return { firefly: 0xffd79a, blossom: 0xffa9d0, trace: 0xffe88a };
			default:          return { firefly: 0xc8ffd0, blossom: 0xff9fd0, trace: 0x9affc5 };
		}
	}

	function makeFireflies( w, hh ) {
		var arr = [];
		for ( var i = 0; i < FIREFLY_COUNT; i++ ) {
			arr.push( {
				x: h.rand( 0, w ),
				y: h.rand( hh * 0.15, hh * 0.95 ),
				vx: h.rand( -0.25, 0.25 ),
				vy: h.rand( -0.15, 0.15 ),
				phase: Math.random() * h.tau,
				r: h.rand( 1.0, 2.2 ),
				base: h.rand( 0.4, 0.95 ),
				trail: [],
			} );
		}
		return arr;
	}

	function makeTraces( w, hh ) {
		var arr = [];
		for ( var i = 0; i < TRACE_COUNT; i++ ) {
			var points = [];
			var x = h.rand( 0, w );
			var y = h.rand( hh * 0.25, hh * 0.85 );
			var dir = Math.random() < 0.5 ? 1 : -1;
			points.push( { x: x, y: y } );
			var segs = 4 + ( ( Math.random() * 4 ) | 0 );
			for ( var s = 0; s < segs; s++ ) {
				if ( s % 2 === 0 ) {
					x += dir * h.rand( w * 0.08, w * 0.18 );
				} else {
					y += h.rand( -hh * 0.12, hh * 0.12 );
				}
				points.push( { x: x, y: y } );
			}
			arr.push( {
				points: points,
				t: Math.random(),
				speed: h.rand( 0.004, 0.009 ),
				spark: h.rand( 1.6, 2.8 ),
			} );
		}
		return arr;
	}

	function makeBlossoms( w, hh ) {
		var arr = [];
		for ( var i = 0; i < BLOSSOM_COUNT; i++ ) {
			arr.push( {
				x: h.rand( w * 0.04, w * 0.96 ),
				y: h.rand( hh * 0.35, hh * 0.9 ),
				r: h.rand( 6, 16 ),
				phase: Math.random() * h.tau,
				speed: h.rand( 0.008, 0.018 ),
				petals: 5 + ( ( Math.random() * 3 ) | 0 ),
			} );
		}
		return arr;
	}

	function totalLen( pts ) {
		var sum = 0;
		for ( var i = 1; i < pts.length; i++ ) {
			var dx = pts[ i ].x - pts[ i - 1 ].x;
			var dy = pts[ i ].y - pts[ i - 1 ].y;
			sum += Math.sqrt( dx * dx + dy * dy );
		}
		return sum;
	}

	function samplePath( pts, t ) {
		var total = totalLen( pts );
		var want = total * t;
		var acc = 0;
		for ( var i = 1; i < pts.length; i++ ) {
			var a = pts[ i - 1 ], b = pts[ i ];
			var dx = b.x - a.x, dy = b.y - a.y;
			var seg = Math.sqrt( dx * dx + dy * dy );
			if ( acc + seg >= want ) {
				var ft = seg > 0 ? ( want - acc ) / seg : 0;
				return { x: a.x + dx * ft, y: a.y + dy * ft };
			}
			acc += seg;
		}
		return pts[ pts.length - 1 ];
	}

	window.__odd.scenes[ 'circuit-garden' ] = {
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

			var traces = new PIXI.Graphics();
			traces.blendMode = 'add';
			app.stage.addChild( traces );

			var blossoms = new PIXI.Graphics();
			blossoms.blendMode = 'add';
			app.stage.addChild( blossoms );

			var fireflies = new PIXI.Graphics();
			fireflies.blendMode = 'add';
			app.stage.addChild( fireflies );

			var w = app.renderer.width, hh = app.renderer.height;

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				tracesG: traces, blossomsG: blossoms, firefliesG: fireflies,
				fireflies: makeFireflies( w, hh ),
				traces: makeTraces( w, hh ),
				blossoms: makeBlossoms( w, hh ),
				palette: seasonPalette( env.season ),
				time: 0,
				lastSeasonCheck: 0,
				breath: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.fireflies = makeFireflies( w, hh );
			state.traces = makeTraces( w, hh );
			state.blossoms = makeBlossoms( w, hh );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt;
			state.breath *= 0.93;

			// Re-sample season roughly every ~15s in case a tab survives
			// past midnight or an equinox without a reload.
			if ( state.time - state.lastSeasonCheck > 900 ) {
				state.palette = seasonPalette( env.season );
				state.lastSeasonCheck = state.time;
			}

			var pal = state.palette;
			var perfLow = env.perfTier === 'low';
			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var mid  = ( env.audio && env.audio.enabled ) ? env.audio.mid  : 0;

			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			if ( ! perfLow ) {
				var tg = state.tracesG;
				tg.clear();
				for ( var ti = 0; ti < state.traces.length; ti++ ) {
					var tr = state.traces[ ti ];
					// Faint path glow.
					for ( var pi = 1; pi < tr.points.length; pi++ ) {
						var a = tr.points[ pi - 1 ], b = tr.points[ pi ];
						tg.moveTo( a.x + px * 3, a.y + py * 2 )
							.lineTo( b.x + px * 3, b.y + py * 2 )
							.stroke( { color: pal.trace, width: 1.2, alpha: 0.16, cap: 'round' } );
					}
					if ( ! env.reducedMotion ) tr.t = ( tr.t + tr.speed * dt ) % 1;
					var sp = samplePath( tr.points, tr.t );
					tg.circle( sp.x + px * 3, sp.y + py * 2, tr.spark + state.breath * 1.5 )
						.fill( { color: pal.trace, alpha: 0.85 } );
					tg.circle( sp.x + px * 3, sp.y + py * 2, tr.spark * 2.4 )
						.fill( { color: pal.trace, alpha: 0.28 } );
				}
			}

			var bg = state.blossomsG;
			bg.clear();
			var bloomBoost = 1 + bass * 0.7 + state.breath * 0.6;
			for ( var bi = 0; bi < state.blossoms.length; bi++ ) {
				var bl = state.blossoms[ bi ];
				if ( ! env.reducedMotion ) bl.phase += bl.speed * dt;
				var breathing = 1 + Math.sin( bl.phase ) * 0.25;
				var rr = bl.r * breathing * bloomBoost;
				var cx = bl.x + px * 8;
				var cy = bl.y + py * 5;
				bg.circle( cx, cy, rr * 0.4 ).fill( { color: 0xffffff, alpha: 0.5 } );
				for ( var ptl = 0; ptl < bl.petals; ptl++ ) {
					var ang = ( ptl / bl.petals ) * h.tau + bl.phase * 0.3;
					var px2 = cx + Math.cos( ang ) * rr;
					var py2 = cy + Math.sin( ang ) * rr;
					bg.circle( px2, py2, rr * 0.5 )
						.fill( { color: pal.blossom, alpha: 0.42 } );
				}
			}

			var fg = state.firefliesG;
			fg.clear();
			var speedMul = 1 + mid * 1.5;
			for ( var fi = 0; fi < state.fireflies.length; fi++ ) {
				var f = state.fireflies[ fi ];
				if ( ! env.reducedMotion ) {
					f.phase += 0.03 * dt;
					f.vx += Math.cos( f.phase * 0.9 ) * 0.005;
					f.vy += Math.sin( f.phase * 1.1 ) * 0.004;
					f.vx *= 0.98; f.vy *= 0.98;
					f.x += f.vx * dt * speedMul;
					f.y += f.vy * dt * speedMul;
					if ( f.x < -10 ) f.x = w + 10;
					if ( f.x > w + 10 ) f.x = -10;
					if ( f.y < hh * 0.1 ) f.y = hh * 0.95;
					if ( f.y > hh + 10 ) f.y = hh * 0.15;
					f.trail.push( { x: f.x, y: f.y } );
					if ( f.trail.length > 6 ) f.trail.shift();
				}
				for ( var tri = 0; tri < f.trail.length; tri++ ) {
					var pt = f.trail[ tri ];
					var tta = tri / Math.max( 1, f.trail.length - 1 );
					fg.circle( pt.x + px * 2, pt.y + py * 1, f.r * ( 0.45 + tta * 0.55 ) )
						.fill( { color: pal.firefly, alpha: f.base * tta * 0.5 } );
				}
				var twinkle = 0.55 + Math.sin( f.phase ) * 0.45;
				fg.circle( f.x + px * 2, f.y + py * 1, f.r )
					.fill( { color: 0xffffff, alpha: f.base * twinkle } );
				fg.circle( f.x + px * 2, f.y + py * 1, f.r * 2.4 )
					.fill( { color: pal.firefly, alpha: f.base * twinkle * 0.25 } );
			}

			if ( ! env.reducedMotion && env.parallax ) {
				state.backdrop.x += ( px * 10 - state.backdrop.x % 1 ) * 0.02;
				state.backdrop.y += ( py * 5 - state.backdrop.y % 1 ) * 0.02;
			}
		},

		onRipple: function ( opts, state ) {
			state.breath = Math.min( 1, state.breath + ( ( opts && opts.intensity ) || 0.5 ) );
		},

		onAudio: function ( state, env ) {
			if ( env.audio.high > 0.62 ) {
				state.breath = Math.min( 1, state.breath + 0.12 );
			}
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.fireflies = [];
			state.traces = [];
			state.blossoms = [];
		},
	};
} )();
