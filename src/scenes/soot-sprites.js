/**
 * B-Roll scene: Soot Sprites (Studio Ghibli) — v0.5
 * ---------------------------------------------------------------
 * Painted backdrop (assets/wallpapers/soot-sprites.webp — pastel
 * lavender-pink dusk sky, distant misty hills, painterly trees
 * and drifting cherry-blossom petals) loaded as a Sprite. On top:
 * fluffy soot-sprite blobs of varied size that bob with squash-
 * and-stretch (compressing vertically at the bottom of each arc,
 * stretching upward as they rise), trail faint dust particles,
 * and sway together on a gentle shared wind cycle.
 *
 * Candy star-shapes occasionally fall. The nearest sprites sense
 * them and drift toward them to huddle; their eyes stay open and
 * track the candy (glance offset in x/y) while it's nearby. Idle
 * sprites still blink open for brief intervals at per-sprite
 * random cadences.
 *
 * The v0.4 sky gradient is now baked into the painting.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};
	var h = window.__bRoll.helpers;

	function backdropUrl() {
		var cfg = window.bRoll || {};
		var qs = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
		return ( cfg.pluginUrl || '' ) + '/assets/wallpapers/soot-sprites.webp' + qs;
	}

	window.__bRoll.scenes[ 'soot-sprites' ] = {
		setup: async function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			var tex = await PIXI.Assets.load( backdropUrl() );
			var backdrop = new PIXI.Sprite( tex );
			app.stage.addChild( backdrop );
			function fitBackdrop() {
				var s = Math.max(
					app.renderer.width  / tex.width,
					app.renderer.height / tex.height
				);
				backdrop.scale.set( s );
				backdrop.x = ( app.renderer.width  - tex.width  * s ) / 2;
				backdrop.y = ( app.renderer.height - tex.height * s ) / 2;
			}
			fitBackdrop();

			var dustLayer = new PIXI.Graphics();
			app.stage.addChild( dustLayer );

			var spriteLayer = new PIXI.Container();
			app.stage.addChild( spriteLayer );

			function makeSoot( scaleHint ) {
				var c = new PIXI.Container();
				var base = new PIXI.Graphics();
				base.circle( 0, 0, 18 ).fill( 0x161616 );
				for ( var k = 0; k < 18; k++ ) {
					var a = ( k / 18 ) * h.tau + h.rand( -0.1, 0.1 );
					var rr = 18 + h.rand( 2, 8 );
					base.circle( Math.cos( a ) * rr, Math.sin( a ) * rr, h.rand( 2, 5 ) ).fill( 0x161616 );
				}
				var shadow = new PIXI.Graphics();
				shadow.ellipse( 0, 22, 18, 4 ).fill( { color: 0x000000, alpha: 0.15 } );
				c.addChild( shadow );
				c.addChild( base );
				var leye = new PIXI.Graphics(); leye.circle( 0, 0, 2.4 ).fill( 0xffffff );
				var reye = new PIXI.Graphics(); reye.circle( 0, 0, 2.4 ).fill( 0xffffff );
				leye.x = -5; leye.y = -2;
				reye.x =  5; reye.y = -2;
				leye.visible = reye.visible = false;
				c.addChild( leye ); c.addChild( reye );
				c.scale.set( scaleHint );
				return { node: c, leye: leye, reye: reye, baseScale: scaleHint };
			}

			var sprites = [];
			for ( var i = 0; i < 26; i++ ) {
				var s = makeSoot( h.rand( 0.5, 1.35 ) );
				s.node.x = h.rand( 0, app.renderer.width );
				s.node.y = h.rand( 0, app.renderer.height );
				spriteLayer.addChild( s.node );
				sprites.push( Object.assign( s, {
					baseY: s.node.y, phase: Math.random() * h.tau,
					amp: h.rand( 8, 35 ),
					bobFreq: h.rand( 0.018, 0.028 ),
					vx: h.rand( -0.3, 0.3 ),
					swayAmp: h.rand( 2, 6 ), swayPhase: Math.random() * h.tau,
					blinkCD: h.rand( 60 * 3, 60 * 14 ), blinkT: 0,
					attractTo: null,
					lastX: s.node.x, lastY: s.node.y,
					dustCD: h.rand( 6, 18 ),
				} ) );
			}

			var candies = [];
			function makeCandy( x, y ) {
				var g = new PIXI.Graphics();
				var r1 = 6, r2 = 2.5;
				var pts = [];
				for ( var i = 0; i < 10; i++ ) {
					var a = ( i / 10 ) * h.tau - Math.PI / 2;
					var r = i % 2 === 0 ? r1 : r2;
					pts.push( Math.cos( a ) * r, Math.sin( a ) * r );
				}
				g.poly( pts ).fill( h.choose( [ 0xffe04a, 0xff8cc6, 0x8ae0ff, 0x9fff9a ] ) );
				g.x = x; g.y = y;
				app.stage.addChild( g );
				return { node: g, vy: 0.3, spin: h.rand( -0.02, 0.02 ), life: 1 };
			}

			var fg = new PIXI.Container();
			app.stage.addChild( fg );
			var drifters = await h.mountCutouts( app, PIXI, 'soot-sprites', fg );

			return {
				backdrop: backdrop, fitBackdrop: fitBackdrop,
				dustLayer: dustLayer, sprites: sprites,
				candies: candies, makeCandy: makeCandy,
				dust: [],
				candyT: h.rand( 60 * 15, 60 * 40 ),
				time: 0, windPhase: 0,
				fg: fg, drifters: drifters,
			};
		},

		onResize: function ( state ) {
			state.fitBackdrop();
		},

		onEgg: function ( name, state, env ) {
			if ( name === 'festival' ) {
				// Totoro emphasized + extra candy storm.
				for ( var i = 0; i < 5; i++ ) {
					state.candies.push( state.makeCandy(
						h.rand( 60, env.app.renderer.width - 60 ), h.rand( -200, -10 )
					) );
				}
			} else if ( name === 'reveal' ) {
				// Type 'ghibli' → 20+ konpeito candy rain.
				for ( var k = 0; k < 24; k++ ) {
					state.candies.push( state.makeCandy(
						h.rand( 30, env.app.renderer.width - 30 ),
						h.rand( -400, -10 )
					) );
				}
			} else if ( name === 'peek' ) {
				// Bring jiji in close for a few seconds.
				h.showEggDrifter( state.drifters, 'jiji.webp', { scaleMul: 1.8, resetT: true } );
				setTimeout( function () { h.hideEggDrifter( state.drifters, 'jiji.webp' ); }, 4500 );
			}
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var w = env.app.renderer.width, hh = env.app.renderer.height;
			state.time += dt;
			state.windPhase += 0.01 * dt;
			h.tickDrifters( state.drifters, env );
			var windOffset = Math.sin( state.windPhase ) * 2.2;

			// --- Candy spawn/fall --------------------------------- //
			state.candyT -= dt;
			if ( state.candyT <= 0 ) {
				state.candyT = h.rand( 60 * 25, 60 * 60 );
				state.candies.push( state.makeCandy( h.rand( 60, w - 60 ), -10 ) );
			}
			for ( var cI = state.candies.length - 1; cI >= 0; cI-- ) {
				var cc = state.candies[ cI ];
				cc.node.y += cc.vy * dt;
				cc.node.rotation += cc.spin * dt;
				if ( cc.node.y > hh * 0.75 ) {
					cc.life -= 0.005 * dt;
					if ( cc.life <= 0 ) { cc.node.destroy(); state.candies.splice( cI, 1 ); continue; }
				}
				cc.node.alpha = cc.life;
			}

			// --- Sprites ------------------------------------------ //
			for ( var i = 0; i < state.sprites.length; i++ ) {
				var s = state.sprites[ i ];
				s.lastX = s.node.x;
				s.lastY = s.node.y;

				// Find nearest candy within attraction radius.
				s.attractTo = null;
				var closest = Infinity;
				for ( var cI2 = 0; cI2 < state.candies.length; cI2++ ) {
					var ca = state.candies[ cI2 ];
					var dx = ca.node.x - s.node.x, dy = ca.node.y - s.node.y;
					var d2 = dx * dx + dy * dy;
					if ( d2 < 24000 && d2 < closest ) { closest = d2; s.attractTo = ca; }
				}

				s.phase += s.bobFreq * dt;
				if ( s.attractTo ) {
					var dxa = s.attractTo.node.x - s.node.x;
					var dya = s.attractTo.node.y - s.node.y;
					s.node.x += dxa * 0.015 * dt;
					s.node.y += dya * 0.015 * dt;
				} else {
					// Idle bob with shared wind sway.
					s.node.y = s.baseY + Math.sin( s.phase ) * s.amp;
					s.node.x += s.vx * dt
						+ Math.sin( state.windPhase + s.swayPhase ) * s.swayAmp * 0.02 * dt
						+ windOffset * 0.01 * dt;
					if ( s.node.x < -40 ) s.node.x = w + 40;
					if ( s.node.x > w + 40 ) s.node.x = -40;
				}

				// Squash / stretch: velocity-based vertical scale.
				var vyEst = s.node.y - s.lastY;
				// Rising = stretch vertical, bottom of arc = squash.
				// Use cos( phase ) so peak stretch aligns with mid-rise.
				var sq = 1 - 0.18 * Math.sin( s.phase );
				var st = 1 + 0.18 * Math.sin( s.phase );
				// Blend with instantaneous velocity for landing impact.
				st += Math.max( 0, -vyEst ) * 0.02;
				sq -= Math.max( 0, -vyEst ) * 0.02;
				s.node.scale.x = s.baseScale * sq;
				s.node.scale.y = s.baseScale * st;

				// Eye visibility + glance toward candy.
				if ( s.attractTo ) {
					s.leye.visible = s.reye.visible = true;
					var ex = s.attractTo.node.x - s.node.x;
					var ey = s.attractTo.node.y - s.node.y;
					var edist = Math.sqrt( ex * ex + ey * ey ) || 1;
					var gx = ( ex / edist ) * 1.2;
					var gy = ( ey / edist ) * 1.2;
					s.leye.x = -5 + gx; s.leye.y = -2 + gy;
					s.reye.x =  5 + gx; s.reye.y = -2 + gy;
				} else {
					// Idle eye blink loop.
					s.leye.x = -5; s.leye.y = -2;
					s.reye.x =  5; s.reye.y = -2;
					s.blinkCD -= dt;
					if ( s.blinkCD <= 0 && s.blinkT === 0 ) {
						s.blinkT = 14;
						s.leye.visible = s.reye.visible = true;
					}
					if ( s.blinkT > 0 ) {
						s.blinkT -= dt;
						if ( s.blinkT <= 0 ) {
							s.leye.visible = s.reye.visible = false;
							s.blinkCD = h.rand( 60 * 4, 60 * 16 );
						}
					}
				}

				// Dust trail: spawn a small faint puff if the sprite
				// actually moved this frame.
				var mvx = s.node.x - s.lastX;
				var mvy = s.node.y - s.lastY;
				var mvd = Math.sqrt( mvx * mvx + mvy * mvy );
				if ( mvd > 0.25 ) {
					s.dustCD -= dt;
					if ( s.dustCD <= 0 ) {
						s.dustCD = h.rand( 8, 22 );
						state.dust.push( {
							x: s.node.x + h.rand( -6, 6 ),
							y: s.node.y + 18 * s.baseScale,
							r: h.rand( 1.5, 3.2 ) * s.baseScale,
							life: 1,
							decay: h.rand( 0.015, 0.03 ),
						} );
					}
				}
			}

			// --- Dust draw / decay ------------------------------- //
			state.dustLayer.clear();
			for ( var di = state.dust.length - 1; di >= 0; di-- ) {
				var d = state.dust[ di ];
				d.life -= d.decay * dt;
				d.y -= 0.25 * dt;
				d.x += windOffset * 0.08 * dt;
				if ( d.life <= 0 ) { state.dust.splice( di, 1 ); continue; }
				state.dustLayer.circle( d.x, d.y, d.r )
					.fill( { color: 0x2a2028, alpha: d.life * 0.35 } );
			}
		},
	};
} )();
