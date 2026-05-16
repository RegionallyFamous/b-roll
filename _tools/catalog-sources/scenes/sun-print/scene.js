/**
 * ODD scene: Sun Print — v1.0.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (wallpaper.webp),
 * an overhead summer lawn with cyanotype prints on a clothesline.
 * Motion:
 *
 *   1. A row of cloth "print" quads sways on a shared breeze curve.
 *   2. Dry grass-tip specks rustle.
 *   3. A few blown leaves drift diagonally across the lawn.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers || {};
	var scriptUrl = document.currentScript && document.currentScript.src;

	var PRINT_COUNT = 5;
	var GRASS_SPECKS = 110;
	var LEAF_COUNT = 4;

	function rand( min, max ) {
		if ( h.rand ) return h.rand( min, max );
		return min + Math.random() * ( max - min );
	}

	function choose( arr ) {
		if ( h.choose ) return h.choose( arr );
		return arr[ ( Math.random() * arr.length ) | 0 ];
	}

	function tau() {
		return h.tau || Math.PI * 2;
	}

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'sun-print' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function counts( tier ) {
		return tier === 'low'
			? { prints: 4, grass: 48, leaves: 2 }
			: { prints: PRINT_COUNT, grass: GRASS_SPECKS, leaves: LEAF_COUNT };
	}

	function makePrints( w, hh, count ) {
		var out = [];
		var startX = w * 0.38;
		var endX = w * 0.92;
		for ( var i = 0; i < count; i++ ) {
			var t = count > 1 ? i / ( count - 1 ) : 0;
			out.push( {
				x: startX + ( endX - startX ) * t,
				y: hh * 0.26,
				w: rand( 66, 86 ),
				h: rand( 88, 112 ),
				phase: Math.random() * tau(),
			} );
		}
		return out;
	}

	function makeGrassSpecks( w, hh, count ) {
		var out = [];
		for ( var i = 0; i < count; i++ ) {
			out.push( {
				x: rand( 0, w ),
				y: rand( hh * 0.5, hh ),
				r: rand( 0.4, 1.1 ),
				phase: Math.random() * tau(),
				color: choose( [ 0xffffff, 0xe6f0b5, 0xfff2c9 ] ),
				alpha: rand( 0.22, 0.58 ),
			} );
		}
		return out;
	}

	function makeLeaves( w, hh, count ) {
		var out = [];
		for ( var i = 0; i < count; i++ ) {
			out.push( {
				x: rand( w * 0.36, w ),
				y: rand( hh * 0.42, hh * 0.92 ),
				vx: rand( 0.12, 0.32 ),
				vy: rand( 0.02, 0.08 ),
				size: rand( 4, 6.5 ),
				phase: Math.random() * tau(),
				color: choose( [ 0xc4a85a, 0xa9913c, 0x8fb04a ] ),
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'sun-print' ] = {
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

			var grass = new PIXI.Graphics(); app.stage.addChild( grass );
			var leaves = new PIXI.Graphics(); app.stage.addChild( leaves );
			var prints = new PIXI.Graphics(); app.stage.addChild( prints );

			var w = app.renderer.width, hh = app.renderer.height;
			var c = counts( env.perfTier );
			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				grassG: grass, leavesG: leaves, printsG: prints,
				prints: makePrints( w, hh, c.prints ),
				grass: makeGrassSpecks( w, hh, c.grass ),
				leaves: makeLeaves( w, hh, c.leaves ),
				time: 0, pulse: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			var c = counts( env.perfTier );
			state.prints = makePrints( w, hh, c.prints );
			state.grass = makeGrassSpecks( w, hh, c.grass );
			state.leaves = makeLeaves( w, hh, c.leaves );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.pulse *= 0.92;

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;
			var wind = Math.sin( state.time * 0.025 ) + 0.4 * Math.sin( state.time * 0.008 );

			var pg = state.printsG;
			pg.clear();
			for ( var i = 0; i < state.prints.length; i++ ) {
				var p = state.prints[ i ];
				if ( ! env.reducedMotion ) p.phase += 0.05 * dt;
				var localWind = wind + Math.sin( p.phase + i ) * 0.4 + bass * 0.5 + state.pulse * 0.8;
				var steps = 8;
				var hx0 = p.x, hy0 = p.y;
				var hx1 = p.x, hy1 = p.y;
				pg.circle( p.x - p.w * 0.5, p.y, 2 ).fill( { color: 0x2a1a0e, alpha: 0.7 } );
				pg.circle( p.x + p.w * 0.5, p.y, 2 ).fill( { color: 0x2a1a0e, alpha: 0.7 } );
				for ( var s = 1; s <= steps; s++ ) {
					var t = s / steps;
					var offX = Math.sin( t * Math.PI + p.phase + state.time * 0.04 ) * localWind * 10 * t;
					var nx = p.x + offX;
					var ny = p.y + t * p.h;
					pg.moveTo( hx0 - p.w * 0.5, hy0 )
						.lineTo( nx - p.w * 0.5 - 1, ny )
						.lineTo( nx + p.w * 0.5 + 1, ny )
						.lineTo( hx1 + p.w * 0.5, hy1 )
						.fill( { color: 0x1b4e88, alpha: 0.95 } );
					hx0 = nx; hy0 = ny;
					hx1 = nx; hy1 = ny;
				}
				var stripes = 3;
				for ( var st = 0; st < stripes; st++ ) {
					var sy = p.y + p.h * ( 0.3 + st * 0.2 );
					pg.moveTo( p.x - p.w * 0.35, sy ).lineTo( p.x + p.w * 0.35, sy )
						.stroke( { color: 0xe8f4ff, width: 1.2, alpha: 0.7 } );
				}
			}

			var gg = state.grassG;
			gg.clear();
			for ( var k = 0; k < state.grass.length; k++ ) {
				var s2 = state.grass[ k ];
				if ( ! env.reducedMotion ) s2.phase += 0.06 * dt;
				var sway = Math.sin( s2.phase + s2.x * 0.01 ) * 1.6;
				gg.circle( s2.x + sway, s2.y, s2.r )
					.fill( { color: s2.color, alpha: s2.alpha } );
			}

			var lg = state.leavesG;
			lg.clear();
			for ( var m = 0; m < state.leaves.length; m++ ) {
				var L = state.leaves[ m ];
				if ( ! env.reducedMotion ) {
					L.x += ( L.vx + wind * 0.4 ) * dt;
					L.y += L.vy * dt;
					L.phase += 0.1 * dt;
					if ( L.x > w + 20 ) L.x = w * 0.36;
					if ( L.y > hh + 20 ) { L.y = hh * 0.42; L.x = rand( w * 0.36, w * 0.72 ); }
				}
				var rot = Math.sin( L.phase ) * 0.8;
				var lx = L.x + px * 6, ly = L.y + py * 3;
				lg.ellipse( lx, ly, L.size * ( 0.6 + Math.cos( rot ) * 0.3 ), L.size * 0.55 )
					.fill( { color: L.color, alpha: 0.85 } );
			}
		},

		onRipple: function ( opts, state ) {
			state.pulse = Math.min( 1, state.pulse + ( ( opts && opts.intensity ) || 0.5 ) );
		},

		onAudio: function ( state, env ) {
			if ( ! env.audio || ! env.audio.enabled ) return;
			if ( env.audio.bass > 0.5 ) state.pulse = Math.min( 1, state.pulse + 0.12 );
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.prints = [];
			state.grass = [];
			state.leaves = [];
		},
	};
} )();
