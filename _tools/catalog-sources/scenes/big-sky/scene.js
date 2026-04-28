/**
 * ODD scene: Big Sky — v1.2.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (assets/wallpapers/big-sky.webp) with
 * prairie motion over a towering cumulus sky:
 *
 *   1. Two soft cloud parallax layers drift slowly rightward.
 *   2. Wheat tips ripple in a pixel-accurate grass band along the
 *      bottom quarter.
 *   3. A hawk silhouette makes a slow arc across the sky every
 *      45-120 seconds.
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
				timer: 45 + Math.random() * 50,
				life: 0,
			};
			s.birds = []; for ( var bi = 0; bi < 5; bi++ ) s.birds.push( { offset: bi * 0.16 } );
			app.stage.addChild( s.layer );
		}
		if ( s.life <= 0 ) {
			s.timer -= dt / 60;
			if ( s.timer > 0 ) { s.layer.clear(); return; }
			s.life = 1;
			s.timer = 45 + Math.random() * 50;
			s.leadX = -60; s.leadY = app.renderer.height * 0.18 + Math.random() * 20;
		}
		s.life = Math.max( 0, s.life - dt * 0.0008 );

		            s.leadX += dt * 1.1;
		            s.layer.clear();
		            var a = s.life * 0.9;
		            for ( var bi = 0; bi < s.birds.length; bi++ ) {
		                var b = s.birds[ bi ];
		                var bx = s.leadX - bi * 26;
		                var by = s.leadY + bi * 14 + Math.sin( s.leadX * 0.02 + b.offset ) * 2;
		                s.layer
		                    .moveTo( bx - 10, by )
		                    .quadraticCurveTo( bx - 5, by - 4, bx, by )
		                    .quadraticCurveTo( bx + 5, by - 4, bx + 10, by )
		                    .stroke( { color: 0x1a1a2a, width: 2.2, alpha: a } );
		            }
		            if ( s.leadX > app.renderer.width + 120 ) s.life = 0;
	}

	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	var CLOUD_COUNT_FAR = 6, CLOUD_COUNT_NEAR = 4;
	var GRASS_BLADES = 220;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'big-sky' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/big-sky.webp' + qs;
	}

	function makeClouds( w, hh, count, yBand ) {
		var out = [];
		for ( var i = 0; i < count; i++ ) {
			out.push( {
				x: h.rand( -w * 0.1, w * 1.1 ),
				y: hh * yBand + h.rand( -hh * 0.05, hh * 0.08 ),
				r: h.rand( 40, 120 ),
				speed: h.rand( 0.02, 0.06 ),
				puffs: 3 + ( Math.random() * 3 ) | 0,
				alpha: h.rand( 0.1, 0.26 ),
			} );
		}
		return out;
	}

	function makeGrass( w, hh ) {
		var out = [];
		for ( var i = 0; i < GRASS_BLADES; i++ ) {
			var x = ( i / GRASS_BLADES ) * w + h.rand( -4, 4 );
			out.push( {
				x: x,
				base: hh - h.rand( 4, 40 ),
				height: h.rand( 6, 22 ),
				sway: h.rand( 2, 6 ),
				phase: Math.random() * h.tau,
				hue: h.choose( [ 0xc6a14a, 0xb08d34, 0xd8b850, 0x9a7d2e ] ),
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'big-sky' ] = {
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

			var cloudsFar = new PIXI.Graphics();
			app.stage.addChild( cloudsFar );
			var cloudsNear = new PIXI.Graphics();
			app.stage.addChild( cloudsNear );
			var grass = new PIXI.Graphics();
			app.stage.addChild( grass );
			var hawk = new PIXI.Graphics();
			app.stage.addChild( hawk );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				cloudsFarG: cloudsFar, cloudsNearG: cloudsNear,
				grassG: grass, hawkG: hawk,
				cloudsFar: makeClouds( w, hh, CLOUD_COUNT_FAR, 0.18 ),
				cloudsNear: makeClouds( w, hh, CLOUD_COUNT_NEAR, 0.3 ),
				grass: makeGrass( w, hh ),
				time: 0, pulse: 0,
				hawkT: -1, hawkNext: 15,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.cloudsFar = makeClouds( w, hh, CLOUD_COUNT_FAR, 0.18 );
			state.cloudsNear = makeClouds( w, hh, CLOUD_COUNT_NEAR, 0.3 );
			state.grass = makeGrass( w, hh );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.pulse *= 0.92;

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			function drawCloud( g, c, scrollX, alphaMul ) {
				var cx = c.x + scrollX;
				if ( cx < -c.r * 3 ) c.x += w + c.r * 4;
				if ( cx > w + c.r * 3 ) c.x -= w + c.r * 4;
				cx = c.x + scrollX;
				for ( var p = 0; p < c.puffs; p++ ) {
					var dx = ( p - ( c.puffs - 1 ) / 2 ) * c.r * 0.7;
					var dy = Math.sin( p * 0.9 + c.puffs ) * c.r * 0.15;
					var rr = c.r * ( 0.8 + Math.abs( Math.sin( p ) ) * 0.4 );
					g.circle( cx + dx, c.y + dy, rr ).fill( { color: 0xffffff, alpha: c.alpha * alphaMul } );
				}
			}

			var fg = state.cloudsFarG;
			fg.clear();
			for ( var i = 0; i < state.cloudsFar.length; i++ ) {
				var c = state.cloudsFar[ i ];
				if ( ! env.reducedMotion ) c.x += c.speed * dt;
				drawCloud( fg, c, px * 8, 0.9 );
			}

			var ng = state.cloudsNearG;
			ng.clear();
			for ( var j = 0; j < state.cloudsNear.length; j++ ) {
				var c2 = state.cloudsNear[ j ];
				if ( ! env.reducedMotion ) c2.x += c2.speed * 1.5 * dt;
				drawCloud( ng, c2, px * 16, 1.1 );
			}

			var gg = state.grassG;
			gg.clear();
			for ( var k = 0; k < state.grass.length; k++ ) {
				var b = state.grass[ k ];
				if ( ! env.reducedMotion ) b.phase += 0.04 * dt;
				var sway = Math.sin( b.phase + b.x * 0.01 ) * b.sway * ( 1 + bass * 0.5 + state.pulse * 0.8 );
				var tipX = b.x + sway;
				gg.moveTo( b.x, b.base )
					.quadraticCurveTo( b.x + sway * 0.5, b.base - b.height * 0.5, tipX, b.base - b.height )
					.stroke( { color: b.hue, width: 1.3, alpha: 0.85, cap: 'round' } );
			}

			var hg = state.hawkG;
			hg.clear();
			if ( ! env.reducedMotion ) {
				if ( state.hawkT < 0 ) {
					state.hawkNext -= dt / 60;
					if ( state.hawkNext <= 0 ) { state.hawkT = 0; state.hawkNext = h.rand( 45, 120 ); }
				} else {
					state.hawkT += dt / 600;
					if ( state.hawkT >= 1 ) state.hawkT = -1;
				}
			}
			if ( state.hawkT >= 0 ) {
				var t = state.hawkT;
				var hx = w * ( 0.08 + 0.84 * t );
				var hy = hh * ( 0.25 - Math.sin( t * Math.PI ) * 0.12 );
				var flap = Math.sin( state.time * 0.25 ) * 2;
				hg.moveTo( hx - 14, hy + flap )
					.quadraticCurveTo( hx - 6, hy - 3, hx, hy )
					.quadraticCurveTo( hx + 6, hy - 3, hx + 14, hy + flap )
					.stroke( { color: 0x2a1c10, width: 2.2, alpha: 0.85, cap: 'round' } );
			}

		
			signatureTick( state, env );
		},

		onRipple: function ( opts, state ) {
			state.pulse = Math.min( 1, state.pulse + ( ( opts && opts.intensity ) || 0.5 ) );
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.cloudsFar = [];
			state.cloudsNear = [];
			state.grass = [];
		},
	};
} )();
