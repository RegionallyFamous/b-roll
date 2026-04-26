/**
 * ODD scene: Cloud City — v1.2.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (assets/wallpapers/cloud-city.webp),
 * a pastel-sunrise floating-city gondola deck. Motion:
 *
 *   1. Three cloud parallax bands (back/mid/near) drift left.
 *   2. Small airship silhouettes at two depths cross slowly.
 *   3. Paper balloon-lanterns bob on gold threads in the mid-ground.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	var LANTERNS = 5;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/cloud-city.webp' + qs;
	}

	function makeCloudBand( w, hh, count, yFrac, rBase ) {
		var out = [];
		for ( var i = 0; i < count; i++ ) {
			out.push( {
				x: h.rand( -w * 0.2, w * 1.2 ),
				y: hh * yFrac + h.rand( -hh * 0.03, hh * 0.04 ),
				r: h.rand( rBase * 0.7, rBase * 1.4 ),
				puffs: 3 + ( Math.random() * 2 ) | 0,
				alpha: h.rand( 0.22, 0.5 ),
				speed: h.rand( 0.03, 0.08 ),
			} );
		}
		return out;
	}

	function makeAirships( w, hh, count, yFrac ) {
		var out = [];
		for ( var i = 0; i < count; i++ ) {
			out.push( {
				x: h.rand( -w * 0.3, w * 1.3 ),
				y: hh * yFrac + h.rand( -24, 24 ),
				len: h.rand( 40, 90 ),
				speed: h.rand( 0.12, 0.2 ) * ( Math.random() < 0.5 ? 1 : -1 ),
				alpha: h.rand( 0.22, 0.4 ),
			} );
		}
		return out;
	}

	function makeLanterns( w, hh ) {
		var out = [];
		for ( var i = 0; i < LANTERNS; i++ ) {
			out.push( {
				x: w * ( 0.18 + i * 0.14 ),
				y: hh * ( 0.52 + ( i % 2 ) * 0.05 ),
				r: h.rand( 10, 16 ),
				phase: Math.random() * h.tau,
				color: h.choose( [ 0xff9aa8, 0xffc56d, 0xfff2a8, 0xbde7ff, 0xffd4ff ] ),
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'cloud-city' ] = {
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

			var cloudsBack = new PIXI.Graphics(); app.stage.addChild( cloudsBack );
			var airshipsBack = new PIXI.Graphics(); app.stage.addChild( airshipsBack );
			var cloudsMid = new PIXI.Graphics(); app.stage.addChild( cloudsMid );
			var lanternsG = new PIXI.Graphics(); app.stage.addChild( lanternsG );
			var airshipsMid = new PIXI.Graphics(); app.stage.addChild( airshipsMid );
			var cloudsNear = new PIXI.Graphics(); app.stage.addChild( cloudsNear );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				cBackG: cloudsBack, cMidG: cloudsMid, cNearG: cloudsNear,
				shipBackG: airshipsBack, shipMidG: airshipsMid,
				lanternsG: lanternsG,
				cloudsBack: makeCloudBand( w, hh, 7, 0.22, 55 ),
				cloudsMid: makeCloudBand( w, hh, 5, 0.36, 75 ),
				cloudsNear: makeCloudBand( w, hh, 3, 0.52, 100 ),
				airshipsBack: makeAirships( w, hh, 2, 0.19 ),
				airshipsMid: makeAirships( w, hh, 2, 0.34 ),
				lanterns: makeLanterns( w, hh ),
				time: 0, pulse: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.cloudsBack = makeCloudBand( w, hh, 7, 0.22, 55 );
			state.cloudsMid = makeCloudBand( w, hh, 5, 0.36, 75 );
			state.cloudsNear = makeCloudBand( w, hh, 3, 0.52, 100 );
			state.airshipsBack = makeAirships( w, hh, 2, 0.19 );
			state.airshipsMid = makeAirships( w, hh, 2, 0.34 );
			state.lanterns = makeLanterns( w, hh );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.pulse *= 0.92;

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			function drawCloudBand( g, list, scroll, alphaMul ) {
				g.clear();
				for ( var i = 0; i < list.length; i++ ) {
					var c = list[ i ];
					if ( ! env.reducedMotion ) c.x -= c.speed * dt;
					if ( c.x < -c.r * 4 ) c.x = w + c.r * 3;
					var cx = c.x + scroll;
					for ( var p = 0; p < c.puffs; p++ ) {
						var dx = ( p - ( c.puffs - 1 ) / 2 ) * c.r * 0.7;
						var dy = Math.sin( p + i ) * c.r * 0.1;
						var rr = c.r * ( 0.8 + Math.abs( Math.sin( p * 0.7 + i ) ) * 0.35 );
						g.circle( cx + dx, c.y + dy, rr ).fill( { color: 0xffffff, alpha: c.alpha * alphaMul } );
					}
				}
			}
			drawCloudBand( state.cBackG, state.cloudsBack, px * 4, 0.8 );
			drawCloudBand( state.cMidG, state.cloudsMid, px * 8, 1.0 );
			drawCloudBand( state.cNearG, state.cloudsNear, px * 14, 1.1 );

			function drawAirships( g, list, scroll, alphaMul ) {
				g.clear();
				for ( var i = 0; i < list.length; i++ ) {
					var a = list[ i ];
					if ( ! env.reducedMotion ) a.x += a.speed * dt;
					if ( a.speed > 0 && a.x > w + a.len * 2 ) a.x = -a.len * 2;
					if ( a.speed < 0 && a.x < -a.len * 2 ) a.x = w + a.len * 2;
					var ax = a.x + scroll;
					g.ellipse( ax, a.y, a.len, a.len * 0.32 ).fill( { color: 0x3a2440, alpha: a.alpha * alphaMul } );
					g.rect( ax - a.len * 0.3, a.y + a.len * 0.22, a.len * 0.6, a.len * 0.12 )
						.fill( { color: 0x2a1830, alpha: a.alpha * alphaMul } );
				}
			}
			drawAirships( state.shipBackG, state.airshipsBack, px * 6, 0.9 );
			drawAirships( state.shipMidG, state.airshipsMid, px * 12, 1.0 );

			var lg = state.lanternsG;
			lg.clear();
			for ( var i = 0; i < state.lanterns.length; i++ ) {
				var L = state.lanterns[ i ];
				if ( ! env.reducedMotion ) L.phase += 0.01 * dt;
				var bob = Math.sin( L.phase ) * 8;
				var lx = L.x + px * 10;
				var ly = L.y + bob + py * 4;
				lg.moveTo( lx, ly - L.r - 40 )
					.lineTo( lx, ly - L.r )
					.stroke( { color: 0x8a6a2a, width: 1, alpha: 0.6 } );
				lg.circle( lx, ly, L.r + 4 ).fill( { color: L.color, alpha: 0.25 } );
				lg.circle( lx, ly, L.r ).fill( { color: L.color, alpha: 0.95 } );
				lg.circle( lx - 1, ly - 1, L.r * 0.35 ).fill( { color: 0xffffff, alpha: 0.35 + bass * 0.2 + state.pulse * 0.3 } );
			}

			if ( ! env.reducedMotion && env.parallax ) {
				state.backdrop.x += ( px * 10 - state.backdrop.x % 1 ) * 0.02;
				state.backdrop.y += ( py * 5 - state.backdrop.y % 1 ) * 0.02;
			}
		},

		onRipple: function ( opts, state ) {
			state.pulse = Math.min( 1, state.pulse + ( ( opts && opts.intensity ) || 0.5 ) );
		},

		onAudio: function ( state, env ) {
			if ( env.audio.bass > 0.55 ) state.pulse = Math.min( 1, state.pulse + 0.1 );
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.cloudsBack = []; state.cloudsMid = []; state.cloudsNear = [];
			state.airshipsBack = []; state.airshipsMid = [];
			state.lanterns = [];
		},
	};
} )();
