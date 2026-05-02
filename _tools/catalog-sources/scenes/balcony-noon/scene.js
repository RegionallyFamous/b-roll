/**
 * ODD scene: Balcony Noon — v1.2.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (wallpaper.webp),
 * a Tokyo balcony at bright noon. Motion:
 *
 *   1. Laundry flap: a few vertical cloth strips above the backdrop
 *      that sway on a shared wind curve.
 *   2. Warm dust motes drifting on the sunbeam.
 *   3. Subtle heat-haze horizontal shimmer on the upper middle band.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;
	var scriptUrl = document.currentScript && document.currentScript.src;

	var MOTE_COUNT = 90;

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'balcony-noon' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	var LAUNDRY = [
		{ color: 0xfcb7c8, w: 44, h: 110, tx: 0.56 },
		{ color: 0xb9ecd0, w: 36, h: 90,  tx: 0.66 },
		{ color: 0xfde39b, w: 48, h: 120, tx: 0.76 },
		{ color: 0x9cc7ff, w: 40, h: 100, tx: 0.86 },
	];

	function makeMotes( w, hh ) {
		var out = [];
		for ( var i = 0; i < MOTE_COUNT; i++ ) {
			out.push( {
				x: h.rand( 0, w ), y: h.rand( 0, hh ),
				r: h.rand( 0.4, 1.6 ),
				phase: Math.random() * h.tau,
				speed: h.rand( 0.005, 0.013 ),
				alpha: h.rand( 0.15, 0.35 ),
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'balcony-noon' ] = {
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

			var haze = new PIXI.Graphics();
			haze.blendMode = 'add';
			app.stage.addChild( haze );

			var laundry = new PIXI.Graphics();
			app.stage.addChild( laundry );

			var motes = new PIXI.Graphics();
			motes.blendMode = 'add';
			app.stage.addChild( motes );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				hazeG: haze, laundryG: laundry, motesG: motes,
				moteList: makeMotes( app.renderer.width, app.renderer.height ),
				time: 0, pulse: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			state.moteList = makeMotes( env.app.renderer.width, env.app.renderer.height );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.pulse *= 0.92;

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			var lg = state.laundryG;
			lg.clear();
			var lineY = hh * 0.26;
			var wind = Math.sin( state.time * 0.02 ) * 1.0 + bass * 0.5 + state.pulse * 1.2;
			for ( var i = 0; i < LAUNDRY.length; i++ ) {
				var item = LAUNDRY[ i ];
				var bx = w * item.tx + px * 4;
				var topY = lineY;
				var localWind = wind + Math.sin( state.time * 0.04 + i * 1.3 ) * 0.7;
				var steps = 10;
				var prevX = bx, prevY = topY;
				for ( var s = 1; s <= steps; s++ ) {
					var t = s / steps;
					var offX = Math.sin( t * Math.PI + state.time * 0.05 + i ) * localWind * 14 * t;
					var x1 = bx + offX;
					var y1 = topY + t * item.h;
					lg.moveTo( prevX - item.w * 0.5, prevY )
						.lineTo( x1 - item.w * 0.5 - 1, y1 )
						.lineTo( x1 + item.w * 0.5 + 1, y1 )
						.lineTo( prevX + item.w * 0.5, prevY )
						.fill( { color: item.color, alpha: 0.92 } );
					prevX = x1; prevY = y1;
				}
				lg.circle( bx - item.w * 0.5, lineY, 2.2 ).fill( { color: 0x888, alpha: 0.7 } );
				lg.circle( bx + item.w * 0.5, lineY, 2.2 ).fill( { color: 0x888, alpha: 0.7 } );
			}

			var hg = state.hazeG;
			hg.clear();
			for ( var k = 0; k < 6; k++ ) {
				var y = hh * ( 0.46 + k * 0.04 ) + Math.sin( state.time * 0.015 + k ) * 3;
				hg.moveTo( 0, y ).lineTo( w, y )
					.stroke( { color: 0xfff6dc, width: 1, alpha: 0.05 } );
			}

			var mg = state.motesG;
			mg.clear();
			for ( var m = 0; m < state.moteList.length; m++ ) {
				var p = state.moteList[ m ];
				if ( ! env.reducedMotion ) p.phase += p.speed * dt;
				var dx = Math.sin( p.phase * 0.9 ) * 7 + px * 6;
				var dy = Math.cos( p.phase ) * 4 + py * 4;
				mg.circle( p.x + dx, p.y + dy, p.r )
					.fill( { color: 0xfff3c0, alpha: p.alpha * ( 0.8 + high * 0.3 ) } );
			}

		},

		onRipple: function ( opts, state ) {
			state.pulse = Math.min( 1, state.pulse + ( ( opts && opts.intensity ) || 0.6 ) );
		},

		onAudio: function ( state, env ) {
			if ( env.audio.bass > 0.55 ) state.pulse = Math.min( 1, state.pulse + 0.12 );
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
