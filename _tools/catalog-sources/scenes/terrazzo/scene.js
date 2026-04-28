/**
 * ODD scene: Terrazzo — v1.2.0
 * ---------------------------------------------------------------
 * GPT Image 2 painted backdrop (assets/wallpapers/terrazzo.webp), a
 * flat overhead terrazzo floor. Motion layer is deliberately quiet:
 *
 *   1. A soft warm sun patch (large soft ellipse) traverses the floor
 *      across the time-of-day cycle.
 *   2. Fine dust motes drift within the sun patch.
 *   3. A faint sparkle layer on the glossy chips tied to audio highs.
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
				timer: 12 + Math.random() * 16,
				life: 0,
			};
			s.rot = 0;
			app.stage.addChild( s.layer );
		}
		if ( s.life <= 0 ) {
			s.timer -= dt / 60;
			if ( s.timer > 0 ) { s.layer.clear(); return; }
			s.life = 1;
			s.timer = 12 + Math.random() * 16;
			s.rot = ( s.rot || 0 );
		}
		s.life = Math.max( 0, s.life - dt * 0.0015 );

		            s.rot = ( s.rot || 0 ) + dt * 0.03;
		            var cx = app.renderer.width  * 0.72;
		            var cy = app.renderer.height * 0.5;
		            s.layer.clear();
		            var pts = [ [ -24, -16 ], [ 18, -22 ], [ 28, 6 ], [ 8, 22 ], [ -22, 12 ] ];
		            var first = true;
		            for ( var i = 0; i < pts.length; i++ ) {
		                var c = Math.cos( s.rot ), si = Math.sin( s.rot );
		                var rx = pts[ i ][ 0 ] * c - pts[ i ][ 1 ] * si;
		                var ry = pts[ i ][ 0 ] * si + pts[ i ][ 1 ] * c;
		                if ( first ) { s.layer.moveTo( cx + rx, cy + ry ); first = false; }
		                else s.layer.lineTo( cx + rx, cy + ry );
		            }
		            s.layer.closePath().fill( { color: 0xa1e07a, alpha: s.life * 0.9 } );
		            s.layer.closePath().stroke( { color: 0xffffff, width: 2, alpha: s.life * 0.65 } );
	}

	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers;

	var MOTE_COUNT = 80;
	var SPARKLE_COUNT = 50;

	function backdropUrl() {
		var cfg = window.odd || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'terrazzo' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/terrazzo.webp' + qs;
	}

	function makeMotes( w, hh ) {
		var out = [];
		for ( var i = 0; i < MOTE_COUNT; i++ ) {
			out.push( {
				x: h.rand( 0, w ), y: h.rand( 0, hh ),
				r: h.rand( 0.4, 1.4 ),
				phase: Math.random() * h.tau,
				speed: h.rand( 0.004, 0.012 ),
			} );
		}
		return out;
	}

	function makeSparkles( w, hh ) {
		var out = [];
		for ( var i = 0; i < SPARKLE_COUNT; i++ ) {
			out.push( {
				x: h.rand( 0, w ), y: h.rand( 0, hh ),
				r: h.rand( 0.6, 1.4 ),
				phase: Math.random() * h.tau,
				speed: h.rand( 0.02, 0.05 ),
			} );
		}
		return out;
	}

	window.__odd.scenes[ 'terrazzo' ] = {
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

			var sun = new PIXI.Graphics();
			sun.blendMode = 'add';
			app.stage.addChild( sun );

			var motes = new PIXI.Graphics();
			motes.blendMode = 'add';
			app.stage.addChild( motes );

			var sparkles = new PIXI.Graphics();
			sparkles.blendMode = 'add';
			app.stage.addChild( sparkles );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				sun: sun, motes: motes, sparkles: sparkles,
				moteList: makeMotes( app.renderer.width, app.renderer.height ),
				sparkleList: makeSparkles( app.renderer.width, app.renderer.height ),
				time: 0, pulse: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.moteList = makeMotes( w, hh );
			state.sparkleList = makeSparkles( w, hh );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.pulse *= 0.92;

			var high = ( env.audio && env.audio.enabled ) ? env.audio.high : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;

			var todT = ( env.tod != null ) ? env.tod : 0.5;
			var sunX = w * ( 0.08 + todT * 0.84 );
			var sunY = hh * ( 0.2 + Math.sin( todT * Math.PI ) * -0.08 + 0.2 );
			var sunR = Math.min( w, hh ) * 0.55;

			var sg = state.sun;
			sg.clear();
			for ( var ring = 4; ring >= 0; ring-- ) {
				var rr = sunR * ( 1 + ring * 0.25 );
				var a = 0.04 - ring * 0.006;
				sg.circle( sunX + px * 4, sunY + py * 2, rr )
					.fill( { color: 0xffe6ad, alpha: a * ( 1 + state.pulse * 0.5 ) } );
			}

			var mg = state.motes;
			mg.clear();
			for ( var i = 0; i < state.moteList.length; i++ ) {
				var p = state.moteList[ i ];
				if ( ! env.reducedMotion ) p.phase += p.speed * dt;
				var dx = Math.sin( p.phase * 0.9 ) * 8;
				var dy = Math.cos( p.phase ) * 6;
				var inSun = Math.hypot( p.x - sunX, p.y - sunY ) < sunR * 0.9;
				if ( ! inSun ) continue;
				mg.circle( p.x + dx, p.y + dy, p.r )
					.fill( { color: 0xfff3c9, alpha: 0.28 * ( 0.7 + high * 0.4 ) } );
			}

			var sp = state.sparkles;
			sp.clear();
			for ( var j = 0; j < state.sparkleList.length; j++ ) {
				var s2 = state.sparkleList[ j ];
				if ( ! env.reducedMotion ) s2.phase += s2.speed * dt;
				var a2 = Math.pow( Math.abs( Math.sin( s2.phase ) ), 4 ) * 0.4 * ( 0.7 + high * 0.5 );
				sp.circle( s2.x, s2.y, s2.r ).fill( { color: 0xffffff, alpha: a2 } );
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
			state.moteList = [];
			state.sparkleList = [];
		},
	};
} )();
