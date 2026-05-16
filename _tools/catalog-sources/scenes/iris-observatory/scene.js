/**
 * ODD scene: Iris Observatory.
 *
 * Starfield and telescope backdrop with restrained sky shimmer,
 * telescope glass glints, and a faint observatory breath.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers || {};
	var scriptUrl = document.currentScript && document.currentScript.src;
	var TAU = h.tau || Math.PI * 2;

	function rand( min, max ) {
		return h.rand ? h.rand( min, max ) : min + Math.random() * ( max - min );
	}

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'iris-observatory' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function countFor( env, normal, low ) {
		return env.perfTier === 'low' ? low : normal;
	}

	function makeDust( w, hh, count ) {
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			var rightGlass = Math.random() > 0.55;
			arr.push( {
				x: rightGlass ? rand( w * 0.52, w * 0.91 ) : rand( w * 0.12, w * 0.58 ),
				y: rightGlass ? rand( hh * 0.09, hh * 0.55 ) : rand( hh * 0.06, hh * 0.42 ),
				r: rand( 0.45, 1.55 ),
				phase: Math.random() * TAU,
				speed: rand( 0.002, 0.008 ),
				alpha: rand( 0.07, 0.24 ),
			} );
		}
		return arr;
	}

	function makeRibbons( w, hh, count ) {
		var colors = [ 0x7cf8ff, 0x9d7cff, 0x6d8cff ];
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			arr.push( {
				x0: w * 0.06,
				x1: w * 0.54,
				y: hh * ( 0.17 + i * 0.06 ),
				amp: rand( 8, 20 ),
				phase: Math.random() * TAU,
				speed: rand( 0.0016, 0.0032 ),
				width: 1.1 + i * 0.45,
				color: colors[ i % colors.length ],
				alpha: 0.035 + i * 0.016,
			} );
		}
		return arr;
	}

	window.__odd.scenes[ 'iris-observatory' ] = {
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

			var ribbons = new PIXI.Graphics();
			ribbons.blendMode = 'add';
			app.stage.addChild( ribbons );
			var dust = new PIXI.Graphics();
			dust.blendMode = 'add';
			app.stage.addChild( dust );
			var glints = new PIXI.Graphics();
			glints.blendMode = 'add';
			app.stage.addChild( glints );
			var vignette = new PIXI.Graphics();
			app.stage.addChild( vignette );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop,
				fitBackdrop: fitBackdrop,
				ribbonsG: ribbons,
				dustG: dust,
				glintsG: glints,
				vignetteG: vignette,
				ribbons: makeRibbons( w, hh, countFor( env, 3, 1 ) ),
				dust: makeDust( w, hh, countFor( env, 95, 38 ) ),
				time: 0,
				ripple: 0,
				glitch: 0,
				glanceX: 0,
				glanceY: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.ribbons = makeRibbons( w, hh, countFor( env, 3, 1 ) );
			state.dust = makeDust( w, hh, countFor( env, 95, 38 ) );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.ripple *= 0.94;
			state.glitch *= 0.88;
			state.glanceX *= 0.9;
			state.glanceY *= 0.9;

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;
			var shimmer = 1 + bass * 0.3 + state.ripple * 0.5;

			var rg = state.ribbonsG;
			rg.clear();
			for ( var r = 0; r < state.ribbons.length; r++ ) {
				var rib = state.ribbons[ r ];
				var steps = 20;
				var prevX = rib.x0 + px * 4;
				var prevY = rib.y + py * 2;
				for ( var i = 1; i <= steps; i++ ) {
					var t = i / steps;
					var x = rib.x0 + ( rib.x1 - rib.x0 ) * t + px * 4;
					var y = rib.y + Math.sin( state.time * rib.speed + rib.phase + t * 5.2 ) * rib.amp + py * 2;
					rg.moveTo( prevX, prevY ).lineTo( x, y )
						.stroke( { color: rib.color, width: rib.width + state.ripple * 1.1, alpha: rib.alpha * shimmer, cap: 'round' } );
					prevX = x;
					prevY = y;
				}
			}

			var dg = state.dustG;
			dg.clear();
			for ( var d = 0; d < state.dust.length; d++ ) {
				var p = state.dust[ d ];
				if ( ! env.reducedMotion ) p.phase += p.speed * dt;
				var driftX = Math.sin( p.phase * 0.8 ) * 5 + state.glanceX * 5;
				var driftY = Math.cos( p.phase ) * 4 + state.glanceY * 4;
				var pulse = 0.68 + Math.sin( p.phase * 1.7 ) * 0.25;
				dg.circle( p.x + driftX + px * 2, p.y + driftY + py * 2, p.r )
					.fill( { color: 0xdcd4ff, alpha: p.alpha * pulse * ( 1 + high * 0.2 ) } );
			}

			var gg = state.glintsG;
			gg.clear();
			var starAlpha = 0.1 + Math.sin( state.time * 0.007 ) * 0.035 + state.ripple * 0.12;
			var sx = w * 0.345 + state.glanceX * 6;
			var sy = hh * 0.175 + state.glanceY * 4;
			gg.moveTo( sx - 34, sy ).lineTo( sx + 34, sy )
				.stroke( { color: 0xbfd4ff, width: 1, alpha: starAlpha, cap: 'round' } );
			gg.moveTo( sx, sy - 24 ).lineTo( sx, sy + 24 )
				.stroke( { color: 0xbfd4ff, width: 0.8, alpha: starAlpha * 0.7, cap: 'round' } );

			var lensX = w * ( 0.765 + state.glanceX * 0.006 );
			var lensY = hh * ( 0.445 + state.glanceY * 0.006 );
			var rim = 0.09 + Math.sin( state.time * 0.004 ) * 0.025 + state.ripple * 0.09;
			gg.ellipse( lensX, lensY, w * 0.068, hh * 0.12 )
				.stroke( { color: 0xffc07a, width: 1.2, alpha: rim, cap: 'round' } );
			gg.moveTo( lensX - w * 0.03, lensY - hh * 0.095 )
				.lineTo( lensX + w * 0.02, lensY - hh * 0.12 )
				.stroke( { color: 0xffffff, width: 1, alpha: rim * 0.75, cap: 'round' } );

			var vg = state.vignetteG;
			vg.clear();
			vg.rect( 0, 0, w, hh ).fill( {
				color: state.glitch > 0.01 ? 0x160826 : 0x000000,
				alpha: 0.025 + Math.sin( state.time * 0.004 ) * 0.008 + state.glitch * 0.035,
			} );
		},

		onRipple: function ( opts, state ) {
			state.ripple = Math.min( 1, state.ripple + ( ( opts && opts.intensity ) || 0.45 ) );
		},

		onGlance: function ( opts, state, env ) {
			if ( ! opts || opts.nod ) return;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.glanceX = Math.max( -1, Math.min( 1, ( ( opts.x || w / 2 ) / w - 0.5 ) * 2 ) );
			state.glanceY = Math.max( -1, Math.min( 1, ( ( opts.y || hh / 2 ) / hh - 0.5 ) * 2 ) );
		},

		onGlitch: function ( opts, state ) {
			state.glitch = Math.min( 1, state.glitch + 0.8 );
			state.ripple = Math.min( 1, state.ripple + 0.35 );
		},

		onAudio: function ( state, env ) {
			if ( env.audio && env.audio.enabled && env.audio.high > 0.6 ) {
				state.ripple = Math.min( 1, state.ripple + 0.06 );
			}
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.dust = [];
			state.ribbons = [];
		},
	};
} )();
