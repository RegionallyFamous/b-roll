/**
 * ODD scene: Cloud City.
 *
 * Open-deck sunrise backdrop with calm sky-only motion: high cloud
 * wisps, tiny airships, and a few kite-side lantern glints.
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

	function choose( list ) {
		return h.choose ? h.choose( list ) : list[ ( Math.random() * list.length ) | 0 ];
	}

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'cloud-city' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function countFor( env, normal, low ) {
		return env.perfTier === 'low' ? low : normal;
	}

	function makeWisps( w, hh, count, y0, y1, size ) {
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			arr.push( {
				x: rand( -w * 0.12, w * 1.18 ),
				y: rand( hh * y0, hh * y1 ),
				r: rand( size * 0.7, size * 1.35 ),
				speed: rand( 0.012, 0.038 ),
				puffs: 3 + ( Math.random() * 3 ) | 0,
				alpha: rand( 0.08, 0.22 ),
				phase: Math.random() * TAU,
			} );
		}
		return arr;
	}

	function makeAirships( w, hh, count ) {
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			arr.push( {
				x: rand( -w * 0.2, w * 1.2 ),
				y: rand( hh * 0.16, hh * 0.43 ),
				len: rand( 28, 62 ),
				speed: rand( 0.028, 0.065 ) * ( Math.random() > 0.5 ? 1 : -1 ),
				alpha: rand( 0.18, 0.34 ),
			} );
		}
		return arr;
	}

	function makeLanterns( w, hh, count ) {
		var arr = [];
		for ( var i = 0; i < count; i++ ) {
			arr.push( {
				x: rand( w * 0.61, w * 0.86 ),
				y: rand( hh * 0.37, hh * 0.62 ),
				r: rand( 7, 13 ),
				phase: Math.random() * TAU,
				color: choose( [ 0xff9aa8, 0xffc56d, 0xfff2a8, 0xbde7ff, 0xffd4ff ] ),
			} );
		}
		return arr;
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

			var backWisps = new PIXI.Graphics();
			app.stage.addChild( backWisps );
			var ships = new PIXI.Graphics();
			app.stage.addChild( ships );
			var nearWisps = new PIXI.Graphics();
			app.stage.addChild( nearWisps );
			var lanterns = new PIXI.Graphics();
			lanterns.blendMode = 'add';
			app.stage.addChild( lanterns );

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop,
				fitBackdrop: fitBackdrop,
				backWispsG: backWisps,
				nearWispsG: nearWisps,
				shipsG: ships,
				lanternsG: lanterns,
				backWisps: makeWisps( w, hh, countFor( env, 8, 4 ), 0.09, 0.34, 38 ),
				nearWisps: makeWisps( w, hh, countFor( env, 5, 2 ), 0.44, 0.58, 70 ),
				airships: makeAirships( w, hh, countFor( env, 4, 2 ) ),
				lanterns: makeLanterns( w, hh, countFor( env, 4, 2 ) ),
				time: 0,
				pulse: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.backWisps = makeWisps( w, hh, countFor( env, 8, 4 ), 0.09, 0.34, 38 );
			state.nearWisps = makeWisps( w, hh, countFor( env, 5, 2 ), 0.44, 0.58, 70 );
			state.airships = makeAirships( w, hh, countFor( env, 4, 2 ) );
			state.lanterns = makeLanterns( w, hh, countFor( env, 4, 2 ) );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.pulse *= 0.92;
			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			function drawWisps( g, list, scroll, alphaMul ) {
				g.clear();
				for ( var i = 0; i < list.length; i++ ) {
					var c = list[ i ];
					if ( ! env.reducedMotion ) c.x -= c.speed * dt;
					if ( c.x < -c.r * 4 ) c.x = w + c.r * 3;
					var cx = c.x + scroll;
					for ( var p = 0; p < c.puffs; p++ ) {
						var dx = ( p - ( c.puffs - 1 ) / 2 ) * c.r * 0.62;
						var dy = Math.sin( c.phase + p * 1.3 ) * c.r * 0.1;
						g.ellipse( cx + dx, c.y + dy, c.r, c.r * 0.38 )
							.fill( { color: 0xffffff, alpha: c.alpha * alphaMul } );
					}
				}
			}
			drawWisps( state.backWispsG, state.backWisps, px * 4, 0.85 );
			drawWisps( state.nearWispsG, state.nearWisps, px * 8, 0.55 );

			var sg = state.shipsG;
			sg.clear();
			for ( var i = 0; i < state.airships.length; i++ ) {
				var ship = state.airships[ i ];
				if ( ! env.reducedMotion ) ship.x += ship.speed * dt;
				if ( ship.speed > 0 && ship.x > w + ship.len * 2 ) ship.x = -ship.len * 2;
				if ( ship.speed < 0 && ship.x < -ship.len * 2 ) ship.x = w + ship.len * 2;
				var sx = ship.x + px * 7;
				sg.ellipse( sx, ship.y, ship.len, ship.len * 0.28 )
					.fill( { color: 0x805a6c, alpha: ship.alpha } );
				sg.rect( sx - ship.len * 0.24, ship.y + ship.len * 0.2, ship.len * 0.48, ship.len * 0.11 )
					.fill( { color: 0x5f3e51, alpha: ship.alpha * 0.85 } );
			}

			var lg = state.lanternsG;
			lg.clear();
			for ( var j = 0; j < state.lanterns.length; j++ ) {
				var l = state.lanterns[ j ];
				if ( ! env.reducedMotion ) l.phase += 0.0045 * dt;
				var bob = Math.sin( l.phase ) * 5;
				var lx = l.x + px * 9;
				var ly = l.y + bob + py * 5;
				lg.circle( lx, ly, l.r * 2.1 )
					.fill( { color: l.color, alpha: 0.08 + state.pulse * 0.04 } );
				lg.circle( lx, ly, l.r )
					.fill( { color: l.color, alpha: 0.34 + bass * 0.08 + state.pulse * 0.12 } );
				lg.circle( lx - 1, ly - 1, l.r * 0.34 )
					.fill( { color: 0xffffff, alpha: 0.22 } );
			}
		},

		onRipple: function ( opts, state ) {
			state.pulse = Math.min( 1, state.pulse + ( ( opts && opts.intensity ) || 0.45 ) );
		},

		onAudio: function ( state, env ) {
			if ( env.audio && env.audio.enabled && env.audio.bass > 0.58 ) {
				state.pulse = Math.min( 1, state.pulse + 0.08 );
			}
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.backWisps = [];
			state.nearWisps = [];
			state.airships = [];
			state.lanterns = [];
		},
	};
} )();
