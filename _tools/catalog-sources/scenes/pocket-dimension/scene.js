/**
 * ODD scene: Pocket Dimension — v1.1.0
 * ---------------------------------------------------------------
 * Painted impossible-room backdrop (wallpaper.webp), with Pixi adding
 * a quiet upper-right portal breath, orbiting glyph shards, and sparse
 * nebula dust. The left/lower-left desktop area stays visually calm.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers || {};
	var scriptUrl = document.currentScript && document.currentScript.src;

	var PORTAL_UX = 0.72;
	var PORTAL_UY = 0.34;
	var SHARD_COUNTS = [ 9, 7, 4 ];
	var STAR_COUNT = 96;

	function rand( min, max ) {
		if ( h.rand ) return h.rand( min, max );
		return min + Math.random() * ( max - min );
	}

	function tau() {
		return h.tau || Math.PI * 2;
	}

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'pocket-dimension' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function makeShards( tier ) {
		var low = tier === 'low';
		var layers = [];
		for ( var band = 0; band < 3; band++ ) {
			var count = low ? Math.max( 2, SHARD_COUNTS[ band ] >> 1 ) : SHARD_COUNTS[ band ];
			var arr = [];
			for ( var i = 0; i < count; i++ ) {
				arr.push( {
					angle: Math.random() * tau(),
					radius: rand( 74, 190 ) * ( 1 + band * 0.28 ),
					orbitSpeed: rand( 0.0012, 0.0032 ) * ( 1 - band * 0.14 ),
					rotSpeed: rand( -0.007, 0.007 ),
					rot: Math.random() * tau(),
					size: rand( 6, 14 ) * ( 0.75 + band * 0.28 ),
					shape: ( Math.random() * 3 ) | 0,
					tint: [ 0xffe1a0, 0xffa9d0, 0xb4a8ff, 0x9beaff ][ ( Math.random() * 4 ) | 0 ],
					alpha: 0.38 + band * 0.14,
				} );
			}
			layers.push( arr );
		}
		return layers;
	}

	function makeStars( w, hh, tier ) {
		var count = tier === 'low' ? 42 : STAR_COUNT;
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			arr.push( {
				x: rand( w * 0.34, w ),
				y: rand( 0, hh * 0.78 ),
				r: rand( 0.4, 1.35 ),
				drift: rand( -0.018, 0.018 ),
				phase: Math.random() * tau(),
				base: rand( 0.16, 0.62 ),
			} );
		}
		return arr;
	}

	function drawShard( g, x, y, size, rot, shape, tint, alpha ) {
		var cos = Math.cos( rot ), sin = Math.sin( rot );
		function p( dx, dy ) {
			return { x: x + dx * cos - dy * sin, y: y + dx * sin + dy * cos };
		}
		var s = size;
		if ( shape === 0 ) {
			var a = p( 0, -s ), b = p( s, 0 ), c = p( 0, s ), d = p( -s, 0 );
			g.poly( [ a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y ] )
				.fill( { color: tint, alpha: alpha } );
		} else if ( shape === 1 ) {
			var t = p( 0, -s ), r = p( s, s * 0.7 ), l = p( -s, s * 0.7 );
			g.poly( [ t.x, t.y, r.x, r.y, l.x, l.y ] )
				.fill( { color: tint, alpha: alpha } );
		} else {
			g.circle( x, y, s * 0.8 ).fill( { color: tint, alpha: alpha * 0.82 } );
			g.moveTo( x - s, y ).lineTo( x + s, y )
				.stroke( { color: 0xffffff, width: 0.7, alpha: alpha * 0.45 } );
		}
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

			var stars = new PIXI.Graphics();
			stars.blendMode = 'add';
			app.stage.addChild( stars );

			var lensing = new PIXI.Graphics();
			lensing.blendMode = 'add';
			app.stage.addChild( lensing );

			var shardsBack = new PIXI.Graphics();
			var shardsMid = new PIXI.Graphics();
			var shardsFront = new PIXI.Graphics();
			shardsBack.blendMode = 'add';
			shardsMid.blendMode = 'add';
			shardsFront.blendMode = 'add';
			app.stage.addChild( shardsBack );
			app.stage.addChild( shardsMid );
			app.stage.addChild( shardsFront );

			var shimmer = new PIXI.Graphics();
			shimmer.blendMode = 'add';
			app.stage.addChild( shimmer );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop,
				fitBackdrop: fitBackdrop,
				stars: stars,
				lensing: lensing,
				shardLayers: [ shardsBack, shardsMid, shardsFront ],
				shimmer: shimmer,
				starList: makeStars( w, hh, env.perfTier ),
				shards: makeShards( env.perfTier ),
				time: 0,
				flare: 0,
				breath: Math.random() * tau(),
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.starList = makeStars( w, hh, env.perfTier );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = typeof env.dt === 'number' ? env.dt : 1;
			var w = app.renderer.width, hh = app.renderer.height;
			var motion = env.reducedMotion ? 0 : 1;
			var bass = env.audio && env.audio.enabled ? env.audio.bass : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;
			var perfLow = env.perfTier === 'low';

			state.time += dt * motion;
			state.flare *= 0.93;
			state.breath = ( state.breath + 0.0038 * dt * motion ) % tau();

			var pcx = w * PORTAL_UX - px * 14;
			var pcy = hh * PORTAL_UY - py * 8;
			var breathe = 1 + Math.sin( state.breath ) * 0.035 + bass * 0.1 + state.flare * 0.045;

			var stg = state.stars;
			stg.clear();
			for ( var i = 0; i < state.starList.length; i++ ) {
				var s = state.starList[ i ];
				s.x += s.drift * dt * motion;
				s.phase += 0.011 * dt * motion;
				if ( s.x < w * 0.3 ) s.x = w + 4;
				if ( s.x > w + 4 ) s.x = w * 0.34;
				var tw = 0.58 + Math.sin( s.phase ) * 0.32;
				stg.circle( s.x + px * 3, s.y + py * 2, s.r )
					.fill( { color: 0xffffff, alpha: s.base * tw } );
			}

			var lg = state.lensing;
			lg.clear();
			var baseR = Math.min( w, hh ) * 0.15;
			for ( var ring = 0; ring < 4; ring++ ) {
				var rr = baseR * ( 1 + ring * 0.16 ) * breathe;
				lg.ellipse( pcx, pcy, rr * 1.08, rr * 0.76 )
					.stroke( { color: ring % 2 ? 0xffa9d0 : 0x9beaff, width: 1.1, alpha: 0.13 - ring * 0.022 + state.flare * 0.08 } );
			}

			for ( var band = 0; band < state.shards.length; band++ ) {
				var g = state.shardLayers[ band ];
				var items = state.shards[ band ];
				g.clear();
				for ( var k = 0; k < items.length; k++ ) {
					var sh = items[ k ];
					sh.angle += sh.orbitSpeed * dt * motion;
					sh.rot += sh.rotSpeed * dt * motion;
					var rad = sh.radius * breathe;
					var sx = pcx + Math.cos( sh.angle ) * rad + px * ( 3 + band * 6 );
					var sy = pcy + Math.sin( sh.angle ) * rad * 0.68 + py * ( 2 + band * 4 );
					if ( sx < w * 0.3 && sy > hh * 0.48 ) continue;
					drawShard( g, sx, sy, sh.size, sh.rot, sh.shape, sh.tint, sh.alpha );
				}
			}

			var sm = state.shimmer;
			sm.clear();
			if ( ! perfLow && state.flare > 0.025 ) {
				for ( var arc = 0; arc < 6; arc++ ) {
					var ang = ( arc / 6 ) * tau() + state.time * 0.004;
					var r1 = baseR * 1.15;
					var r2 = baseR * ( 1.75 + state.flare * 0.4 );
					sm.moveTo( pcx + Math.cos( ang ) * r1, pcy + Math.sin( ang ) * r1 * 0.72 )
						.lineTo( pcx + Math.cos( ang ) * r2, pcy + Math.sin( ang ) * r2 * 0.72 )
						.stroke( { color: 0xffffff, width: 0.9, alpha: state.flare * 0.36 } );
				}
			}
		},

		onRipple: function ( opts, state ) {
			state.flare = Math.min( 1, state.flare + ( ( opts && opts.intensity ) || 0.55 ) );
		},

		onGlitch: function ( opts, state ) {
			state.flare = Math.min( 1, state.flare + 0.65 );
		},

		onAudio: function ( state, env ) {
			if ( ! env.audio || ! env.audio.enabled ) return;
			if ( env.audio.high > 0.62 ) state.flare = Math.min( 1, state.flare + 0.08 );
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 0;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.starList = [];
			state.shards = [];
		},
	};
} )();
