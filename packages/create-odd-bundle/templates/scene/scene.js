/**
 * {{name}} — ODD scene.
 *
 * Self-registers into window.__odd.scenes['{{slug}}']. The shared
 * mount runner in ODD calls setup() once when the scene becomes
 * active, then tick() on every frame with env.dt as the clamped delta.
 *
 * Full contract: https://github.com/RegionallyFamous/odd/blob/main/docs/building-a-scene.md
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};

	window.__odd.scenes[ '{{slug}}' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI;
			var app  = env.app;
			var g    = new PIXI.Graphics();
			app.stage.addChild( g );
			return { g: g, t: 0, w: app.screen.width, h: app.screen.height };
		},
		tick: function ( state, env ) {
			state.t += env.dt * 0.01;
			var g = state.g;
			g.clear();
			g.rect( 0, 0, state.w, state.h ).fill( { color: 0x1a0b2e } );
			var r = 120 + Math.sin( state.t ) * 40;
			g.circle( state.w / 2, state.h / 2, r ).fill( { color: 0x6a5cff, alpha: 0.6 } );
		},
		onResize: function ( state, env ) {
			state.w = env.app.screen.width;
			state.h = env.app.screen.height;
		},
	};
} )();
