/**
 * ODD example scene — slow radial rainbow.
 *
 * Self-registers into window.__odd.scenes['example-rainbow'] so the
 * shared mount runner in odd/src/wallpaper/index.js can drive it.
 * Demonstrates the minimum-viable implementation of the scene
 * contract: setup() builds the stage, tick() advances time.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};

	window.__odd.scenes[ 'example-rainbow' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI;
			var app  = env.app;
			var g    = new PIXI.Graphics();
			app.stage.addChild( g );
			return { g: g, t: 0, w: app.screen.width, h: app.screen.height };
		},
		tick: function ( state, env ) {
			state.t += env.dt * 0.006;
			var g = state.g;
			g.clear();
			var bands = 14;
			var cx = state.w / 2, cy = state.h / 2;
			var maxR = Math.hypot( state.w, state.h ) / 2;
			for ( var i = bands; i > 0; i-- ) {
				var hue = ( state.t * 360 + ( i / bands ) * 180 ) % 360;
				var rgb = hslToRgb( hue, 0.55, 0.42 );
				g.circle( cx, cy, ( i / bands ) * maxR ).fill( { color: rgb, alpha: 0.9 } );
			}
		},
		onResize: function ( state, env ) {
			state.w = env.app.screen.width;
			state.h = env.app.screen.height;
		},
	};

	function hslToRgb( h, s, l ) {
		h /= 360;
		var r, g, b;
		if ( s === 0 ) { r = g = b = l; }
		else {
			function hue2rgb( p, q, t ) {
				if ( t < 0 ) t += 1;
				if ( t > 1 ) t -= 1;
				if ( t < 1/6 ) return p + ( q - p ) * 6 * t;
				if ( t < 1/2 ) return q;
				if ( t < 2/3 ) return p + ( q - p ) * ( 2/3 - t ) * 6;
				return p;
			}
			var q = l < 0.5 ? l * ( 1 + s ) : l + s - l * s;
			var p = 2 * l - q;
			r = hue2rgb( p, q, h + 1/3 );
			g = hue2rgb( p, q, h );
			b = hue2rgb( p, q, h - 1/3 );
		}
		return ( Math.round( r * 255 ) << 16 ) | ( Math.round( g * 255 ) << 8 ) | Math.round( b * 255 );
	}
} )();
