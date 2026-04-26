/**
 * ODD scene: Pocket Dimension.
 *
 * GPT Image 2 backdrop with slow lens shimmer, floating dust, and portal
 * pulses.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/pocket-dimension.webp' + qs;
	}

	function makeMotes( w, hh ) {
		var out = [];
		for ( var i = 0; i < 100; i++ ) {
			out.push( {
				x: h.rand( w * 0.08, w * 0.95 ),
				y: h.rand( hh * 0.06, hh * 0.92 ),
				r: h.rand( 0.5, 1.8 ),
				phase: Math.random() * Math.PI * 2,
				speed: h.rand( 0.004, 0.013 ),
				alpha: h.rand( 0.08, 0.35 ),
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'pocket-dimension' ] = {
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
			var portal = new PIXI.Graphics();
			portal.blendMode = 'add';
			app.stage.addChild( portal );
			var motes = new PIXI.Graphics();
			motes.blendMode = 'add';
			app.stage.addChild( motes );
			return {
				backdrop: backdrop,
				fitBackdrop: fitBackdrop,
				portal: portal,
				motes: motes,
				moteList: makeMotes( app.renderer.width, app.renderer.height ),
				time: 0,
				ripple: 0,
				glitch: 0,
			};
		},
		onResize: function ( state, env ) {
			state.fitBackdrop();
			state.moteList = makeMotes( env.app.renderer.width, env.app.renderer.height );
		},
		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt;
			state.ripple *= 0.94;
			state.glitch *= 0.88;
			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;

			var pg = state.portal;
			pg.clear();
			var cx = w * 0.68;
			var cy = hh * 0.30;
			var rx = w * ( 0.075 + state.ripple * 0.012 );
			var ry = hh * ( 0.12 + state.ripple * 0.018 );
			var a = 0.08 + Math.sin( state.time * 0.01 ) * 0.025 + bass * 0.05 + state.ripple * 0.12;
			for ( var r = 0; r < 4; r++ ) {
				pg.ellipse( cx, cy, rx + r * 18, ry + r * 26 )
					.stroke( { color: r % 2 ? 0xff8ad8 : 0x84f6ff, width: 1.2, alpha: a * ( 1 - r * 0.18 ) } );
			}

			var mg = state.motes;
			mg.clear();
			for ( var i = 0; i < state.moteList.length; i++ ) {
				var p = state.moteList[ i ];
				if ( ! env.reducedMotion ) p.phase += p.speed * dt;
				var orbit = Math.sin( p.phase ) * 11;
				var x = p.x + orbit;
				var y = p.y + Math.cos( p.phase * 0.7 ) * 9 - state.ripple * 4;
				mg.circle( x, y, p.r ).fill( { color: 0xffd8a8, alpha: p.alpha * ( 0.7 + Math.sin( p.phase * 1.5 ) * 0.3 ) } );
			}

			if ( ! env.reducedMotion && env.parallax ) {
				state.backdrop.x += ( env.parallax.x * 10 - state.backdrop.x % 1 ) * 0.018;
				state.backdrop.y += ( env.parallax.y * 5 - state.backdrop.y % 1 ) * 0.018;
			}
		},
		onRipple: function ( opts, state ) {
			state.ripple = Math.min( 1, state.ripple + ( ( opts && opts.intensity ) || 0.55 ) );
		},
		onGlitch: function ( opts, state ) {
			state.glitch = 1;
			state.ripple = Math.min( 1, state.ripple + 0.5 );
		},
		onAudio: function ( state, env ) {
			if ( env.audio.high > 0.56 ) state.ripple = Math.min( 1, state.ripple + 0.06 );
		},
		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},
		cleanup: function ( state ) {
			state.moteList = [];
		},
	};
} )();
/**
 * ODD scene: Pocket Dimension � v1.1.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (assets/wallpapers/pocket-dimension.webp)
 * of an impossible floating room + portal, decorated with live Pixi:
 *
 *   1. A lensing ring around the painted portal that breathes and
 *      occasionally emits a refracting shimmer pass.
 *
 *   2. Orbiting shards � small glyph-like shapes circling the portal
 *      at three parallax depths, softly rotating.
 *
 *   3. A slow starfield drift behind the nebula for quiet motion.
 *
 *   4. Cursor-responsive depth: parallax biases shard orbits and
 *      gently pushes the portal opposite the cursor to sell depth.
 *
 * Audio: bass expands the lensing ring; highs trigger a shimmer burst.
 *
 * Reduced motion: static pose, still readable as a pocket dimension.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	var SHARD_COUNTS = [ 14, 10, 6 ];        // back, mid, front
	var SHARD_SCALES = [ 0.6, 0.9, 1.4 ];
	var STAR_COUNT = 180;

	// Portal anchor in unit-coords; the painted portal is in the
	// upper-right. Kept in sync with the prompt composition.
	var PORTAL_UX = 0.72;
	var PORTAL_UY = 0.34;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/pocket-dimension.webp' + qs;
	}

	function makeShards() {
		var layers = [];
		for ( var band = 0; band < 3; band++ ) {
			var arr = [];
			for ( var i = 0; i < SHARD_COUNTS[ band ]; i++ ) {
				arr.push( {
					angle: Math.random() * h.tau,
					radius: h.rand( 90, 260 ) * ( 1 + band * 0.35 ),
					orbitSpeed: h.rand( 0.0025, 0.006 ) * ( 1 - band * 0.18 ),
					rotSpeed: h.rand( -0.02, 0.02 ),
					rot: Math.random() * h.tau,
					size: h.rand( 8, 18 ) * SHARD_SCALES[ band ],
					shape: ( Math.random() * 3 ) | 0,
					tint: [ 0xffe1a0, 0xffa9d0, 0xb4a8ff, 0x9beaff ][ ( Math.random() * 4 ) | 0 ],
					alpha: 0.55 + band * 0.18,
				} );
			}
			layers.push( arr );
		}
		return layers;
	}

	function makeStars( w, hh ) {
		var arr = [];
		for ( var i = 0; i < STAR_COUNT; i++ ) {
			arr.push( {
				x: h.rand( 0, w ),
				y: h.rand( 0, hh * 0.75 ),
				r: h.rand( 0.4, 1.6 ),
				drift: h.rand( -0.03, 0.03 ),
				phase: Math.random() * h.tau,
				base: h.rand( 0.3, 0.95 ),
			} );
		}
		return arr;
	}

	function drawShard( g, x, y, size, rot, shape, tint, alpha ) {
		var s = size;
		g.save && g.save();
		// We don't actually push a transform stack in Pixi v8 Graphics;
		// compute rotated vertices inline instead.
		var cos = Math.cos( rot ), sin = Math.sin( rot );
		function rotate( dx, dy ) {
			return { x: x + dx * cos - dy * sin, y: y + dx * sin + dy * cos };
		}
		if ( shape === 0 ) {
			var p1 = rotate( 0, -s ), p2 = rotate( s, 0 ), p3 = rotate( 0, s ), p4 = rotate( -s, 0 );
			g.moveTo( p1.x, p1.y )
				.lineTo( p2.x, p2.y )
				.lineTo( p3.x, p3.y )
				.lineTo( p4.x, p4.y )
				.lineTo( p1.x, p1.y )
				.fill( { color: tint, alpha: alpha } );
		} else if ( shape === 1 ) {
			var t1 = rotate( 0, -s ), t2 = rotate( s, s * 0.7 ), t3 = rotate( -s, s * 0.7 );
			g.moveTo( t1.x, t1.y )
				.lineTo( t2.x, t2.y )
				.lineTo( t3.x, t3.y )
				.lineTo( t1.x, t1.y )
				.fill( { color: tint, alpha: alpha } );
		} else {
			g.circle( x, y, s * 0.9 ).fill( { color: tint, alpha: alpha * 0.9 } );
			g.moveTo( x - s, y ).lineTo( x + s, y )
				.stroke( { color: 0xffffff, width: 0.8, alpha: alpha * 0.65 } );
		}
	}

	window.__odd.scenes[ 'pocket-dimension' ] = {
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

			var stars = new PIXI.Graphics();
			stars.blendMode = 'add';
			app.stage.addChild( stars );

			var lensing = new PIXI.Graphics();
			lensing.blendMode = 'add';
			app.stage.addChild( lensing );

			var shardsBack  = new PIXI.Graphics();
			shardsBack.blendMode = 'add';
			app.stage.addChild( shardsBack );
			var shardsMid   = new PIXI.Graphics();
			shardsMid.blendMode = 'add';
			app.stage.addChild( shardsMid );
			var shardsFront = new PIXI.Graphics();
			shardsFront.blendMode = 'add';
			app.stage.addChild( shardsFront );

			var shimmer = new PIXI.Graphics();
			shimmer.blendMode = 'add';
			app.stage.addChild( shimmer );

			var w = app.renderer.width, hh = app.renderer.height;

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				stars: stars, lensing: lensing,
				shardLayers: [ shardsBack, shardsMid, shardsFront ],
				shimmer: shimmer,
				starList: makeStars( w, hh ),
				shards: makeShards(),
				time: 0,
				flare: 0,
				portalBreath: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.starList = makeStars( w, hh );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			state.time += dt;
			state.flare *= 0.93;

			var perfLow = env.perfTier === 'low';
			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;

			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			var pcx = w * PORTAL_UX - px * 18;
			var pcy = hh * PORTAL_UY - py * 10;

			state.portalBreath = ( state.portalBreath + 0.007 * dt ) % h.tau;
			var breath = 1 + Math.sin( state.portalBreath ) * 0.05 + bass * 0.15;

			var stg = state.stars;
			stg.clear();
			for ( var i = 0; i < state.starList.length; i++ ) {
				var s = state.starList[ i ];
				if ( ! env.reducedMotion ) {
					s.x += s.drift * dt;
					if ( s.x < -4 ) s.x = w + 4;
					if ( s.x > w + 4 ) s.x = -4;
					s.phase += 0.02 * dt;
				}
				var tw = 0.55 + Math.sin( s.phase ) * 0.45;
				stg.circle( s.x + px * 4, s.y + py * 2, s.r )
					.fill( { color: 0xffffff, alpha: s.base * tw * 0.8 } );
			}

			var lg = state.lensing;
			lg.clear();
			var baseR = Math.min( w, hh ) * 0.18;
			for ( var ring = 0; ring < 4; ring++ ) {
				var rr = baseR * ( 1 + ring * 0.18 ) * breath;
				lg.circle( pcx, pcy, rr )
					.stroke( { color: 0xffe9c6, width: 1.4 - ring * 0.2, alpha: 0.18 - ring * 0.035 + state.flare * 0.1 } );
			}
			lg.circle( pcx, pcy, baseR * 0.7 * breath )
				.fill( { color: 0xffd39b, alpha: 0.06 + state.flare * 0.1 } );

			for ( var band = 0; band < 3; band++ ) {
				var g = state.shardLayers[ band ];
				g.clear();
				var items = state.shards[ band ];
				var parallaxX = px * ( 4 + band * 10 );
				var parallaxY = py * ( 2 + band * 5 );
				for ( var k = 0; k < items.length; k++ ) {
					var sh = items[ k ];
					if ( ! env.reducedMotion ) {
						sh.angle += sh.orbitSpeed * dt;
						sh.rot += sh.rotSpeed * dt;
					}
					var rad = sh.radius * breath;
					var sx = pcx + Math.cos( sh.angle ) * rad + parallaxX;
					var sy = pcy + Math.sin( sh.angle ) * rad * 0.75 + parallaxY;
					drawShard( g, sx, sy, sh.size, sh.rot, sh.shape, sh.tint, sh.alpha );
				}
			}

			if ( ! perfLow ) {
				var sm = state.shimmer;
				sm.clear();
				if ( state.flare > 0.02 ) {
					for ( var arc = 0; arc < 8; arc++ ) {
						var ang = ( arc / 8 ) * h.tau + state.time * 0.01;
						var r1 = baseR * 1.2;
						var r2 = baseR * ( 1.9 + state.flare * 0.6 );
						var x1 = pcx + Math.cos( ang ) * r1;
						var y1 = pcy + Math.sin( ang ) * r1;
						var x2 = pcx + Math.cos( ang ) * r2;
						var y2 = pcy + Math.sin( ang ) * r2;
						sm.moveTo( x1, y1 ).lineTo( x2, y2 )
							.stroke( { color: 0xffffff, width: 1.0, alpha: state.flare * 0.45 } );
					}
				}
			}

			if ( ! env.reducedMotion && env.parallax ) {
				state.backdrop.x += ( px * 14 - state.backdrop.x % 1 ) * 0.02;
				state.backdrop.y += ( py * 7 - state.backdrop.y % 1 ) * 0.02;
			}

			if ( high > 0.6 && state.flare < 0.2 ) {
				state.flare = 0.6;
			}
		},

		onRipple: function ( opts, state ) {
			state.flare = Math.min( 1, state.flare + ( ( opts && opts.intensity ) || 0.7 ) );
		},

		onGlitch: function ( opts, state ) {
			state.flare = Math.min( 1, state.flare + 0.8 );
		},

		onAudio: function ( state, env ) {
			if ( env.audio.bass > 0.65 ) {
				state.flare = Math.min( 1, state.flare + 0.1 );
			}
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.starList = [];
			state.shards = [];
		},
	};
} )();
