/**
 * ODD scene: Flux.
 *
 * Regenerated marbled vortex backdrop with sparse orbiting ink flecks
 * and short ribbon strokes. Motion follows the painted ring and keeps
 * the dark left third calm for desktop icons.
 */
( function () {
	'use strict';
	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};
	var h = window.__odd.helpers || {};
	var scriptUrl = document.currentScript && document.currentScript.src;
	var TAU = h.tau || Math.PI * 2;
	var PALETTE = [ 0xffc78a, 0xff7a3c, 0xd83852, 0x2c9bb0, 0x67efe0 ];

	function rand( min, max ) {
		return h.rand ? h.rand( min, max ) : min + Math.random() * ( max - min );
	}

	function lerpColor( a, b, t ) {
		if ( h.lerpColor ) return h.lerpColor( a, b, t );
		var ar = ( a >> 16 ) & 255, ag = ( a >> 8 ) & 255, ab = a & 255;
		var br = ( b >> 16 ) & 255, bg = ( b >> 8 ) & 255, bb = b & 255;
		var rr = ar + ( br - ar ) * t;
		var rg = ag + ( bg - ag ) * t;
		var rb = ab + ( bb - ab ) * t;
		return ( rr << 16 ) | ( rg << 8 ) | rb;
	}

	function pickColor( lane ) {
		var f = lane * ( PALETTE.length - 1 );
		var i = Math.floor( f );
		return lerpColor( PALETTE[ i ], PALETTE[ Math.min( PALETTE.length - 1, i + 1 ) ], f - i );
	}

	function backdropUrl() {
		var cfg = window.odd || {};
		var sm = cfg.sceneMap || {};
		var desc = sm[ 'flux' ] || {};
		if ( desc.wallpaperUrl ) return desc.wallpaperUrl;
		return scriptUrl ? new URL( 'wallpaper.webp', scriptUrl ).toString() : '';
	}

	function countFor( env, normal, low ) {
		return env.perfTier === 'low' ? low : normal;
	}

	function spawnParticle( w, hh, large ) {
		var sideBias = Math.random();
		var angle = sideBias < 0.68 ? rand( -0.95, 1.55 ) : rand( 1.55, 4.8 );
		return {
			angle: angle,
			radius: rand( 0.52, 1.05 ),
			speed: rand( 0.00028, 0.0009 ) * ( large ? 0.55 : 1 ),
			lane: Math.random(),
			size: large ? rand( 2.4, 4.4 ) : rand( 0.7, 1.9 ),
			alpha: large ? rand( 0.32, 0.62 ) : rand( 0.12, 0.34 ),
			wobble: Math.random() * TAU,
			wobbleSpeed: rand( 0.001, 0.004 ),
			large: !! large,
			x: w * 0.58,
			y: hh * 0.48,
			oldX: w * 0.58,
			oldY: hh * 0.48,
		};
	}

	function makeParticles( w, hh, count, largeCount ) {
		var arr = [];
		for ( var i = 0; i < count; i++ ) arr.push( spawnParticle( w, hh, false ) );
		for ( var j = 0; j < largeCount; j++ ) arr.push( spawnParticle( w, hh, true ) );
		return arr;
	}

	window.__odd.scenes[ 'flux' ] = {
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

			var shade = new PIXI.Graphics();
			app.stage.addChild( shade );
			function paintShade() {
				var w = app.renderer.width, hh = app.renderer.height;
				shade.clear();
				shade.rect( 0, 0, w * 0.36, hh ).fill( { color: 0x000814, alpha: 0.10 } );
				shade.circle( w * 0.54, hh * 0.5, Math.min( w, hh ) * 0.25 )
					.fill( { color: 0x000814, alpha: 0.12 } );
			}
			paintShade();

			var w = app.renderer.width, hh = app.renderer.height;
			return {
				backdrop: backdrop,
				fitBackdrop: fitBackdrop,
				ribbons: ribbons,
				shade: shade,
				paintShade: paintShade,
				particles: makeParticles( w, hh, countFor( env, 210, 82 ), countFor( env, 5, 2 ) ),
				targetCount: countFor( env, 215, 84 ),
				time: 0,
				sparkBoost: 0,
			};
		},

		onResize: function ( state, env ) {
			state.fitBackdrop();
			state.paintShade();
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.particles = makeParticles( w, hh, countFor( env, 210, 82 ), countFor( env, 5, 2 ) );
		},

		tick: function ( state, env ) {
			var app = env.app, dt = env.dt;
			var w = app.renderer.width, hh = app.renderer.height;
			if ( ! env.reducedMotion ) state.time += dt;
			state.sparkBoost = Math.max( 0, state.sparkBoost - dt * 0.035 );

			var target = countFor( env, 215, 84 );
			if ( state.targetCount !== target ) {
				state.targetCount = target;
				state.particles = makeParticles( w, hh, countFor( env, 210, 82 ), countFor( env, 5, 2 ) );
			}

			var bass = ( env.audio && env.audio.enabled ) ? env.audio.bass : 0;
			var px = env.parallax ? env.parallax.x : 0;
			var py = env.parallax ? env.parallax.y : 0;
			var cx = w * 0.55 + px * 5;
			var cy = hh * 0.51 + py * 4;
			var rx = w * 0.34;
			var ry = hh * 0.32;

			var g = state.ribbons;
			g.clear();
			for ( var i = 0; i < state.particles.length; i++ ) {
				var p = state.particles[ i ];
				p.oldX = p.x;
				p.oldY = p.y;
				if ( ! env.reducedMotion ) {
					p.angle += p.speed * dt * ( 1 + bass * 0.45 );
					p.wobble += p.wobbleSpeed * dt;
				}
				var wob = Math.sin( p.wobble ) * 0.06;
				var r = p.radius + wob;
				p.x = cx + Math.cos( p.angle ) * rx * r + Math.cos( p.angle * 2.1 ) * w * 0.025;
				p.y = cy + Math.sin( p.angle ) * ry * r + Math.sin( p.angle * 1.7 ) * hh * 0.035;

				var leftQuiet = p.x < w * 0.34 && p.y > hh * 0.22;
				var a = p.alpha * ( leftQuiet ? 0.22 : 1 ) * ( 1 + state.sparkBoost * 0.45 );
				var color = pickColor( p.lane );
				if ( p.large ) {
					g.moveTo( p.oldX, p.oldY ).lineTo( p.x, p.y )
						.stroke( { color: color, width: p.size * 1.15, alpha: a * 0.65, cap: 'round' } );
					g.circle( p.x, p.y, p.size * 2.2 )
						.fill( { color: color, alpha: a * 0.13 } );
				} else {
					g.moveTo( p.oldX, p.oldY ).lineTo( p.x, p.y )
						.stroke( { color: color, width: p.size, alpha: a * 0.34, cap: 'round' } );
				}
				g.circle( p.x, p.y, p.size )
					.fill( { color: color, alpha: a } );
			}
		},

		onAudio: function ( state, env ) {
			if ( env.audio && env.audio.enabled && env.audio.high > 0.58 && state.sparkBoost < 0.45 ) {
				state.sparkBoost = 1;
			}
		},

		onRipple: function ( opts, state ) {
			state.sparkBoost = Math.min( 1, state.sparkBoost + ( ( opts && opts.intensity ) || 0.6 ) * 0.55 );
		},

		onGlitch: function ( opts, state ) {
			state.sparkBoost = Math.min( 1, state.sparkBoost + 0.8 );
		},

		stillFrame: function ( state, env ) {
			var saveDt = env.dt;
			env.dt = 1;
			this.tick( state, env );
			env.dt = saveDt;
		},

		cleanup: function ( state ) {
			state.particles = [];
		},
	};
} )();
