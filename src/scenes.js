/**
 * B-Roll for WP Desktop Mode
 * ---------------------------------------------------------------
 * A pack of pop-culture-themed PixiJS wallpapers.
 *
 * This file ships a thin scene framework (handles init, teardown,
 * reduced-motion, and the shell's visibility hook) plus ten scene
 * implementations. Each scene registers as `b-roll/<slug>`.
 *
 * Scenes:
 *   1. Code Rain      (The Matrix)
 *   2. Hyperspace     (Star Wars)
 *   3. Neon Rain      (Blade Runner)
 *   4. The Grid       (Tron)
 *   5. Couch Gag      (The Simpsons)
 *   6. Rainbow Road   (Mario Kart)
 *   7. Soot Sprites   (Studio Ghibli)
 *   8. Upside Down    (Stranger Things)
 *   9. Refinery       (Severance)
 *  10. Shimmer        (Arcane)
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	// ---------------------------------------------------------------- //
	// Shared helpers
	// ---------------------------------------------------------------- //

	var rand   = function ( a, b ) { return a + Math.random() * ( b - a ); };
	var irand  = function ( a, b ) { return ( a + Math.random() * ( b - a ) ) | 0; };
	var choose = function ( arr ) { return arr[ ( Math.random() * arr.length ) | 0 ]; };
	var clamp  = function ( v, a, b ) { return v < a ? a : v > b ? b : v; };
	var tau    = Math.PI * 2;

	function lerpColor( a, b, t ) {
		var ar = ( a >> 16 ) & 0xff, ag = ( a >> 8 ) & 0xff, ab = a & 0xff;
		var br = ( b >> 16 ) & 0xff, bg = ( b >> 8 ) & 0xff, bb = b & 0xff;
		return ( ( ar + ( br - ar ) * t ) | 0 ) << 16
		     | ( ( ag + ( bg - ag ) * t ) | 0 ) << 8
		     | ( ( ab + ( bb - ab ) * t ) | 0 );
	}

	function paintVGradient( g, w, h, c0, c1, steps ) {
		steps = steps || 24;
		g.clear();
		for ( var i = 0; i < steps; i++ ) {
			var t = i / ( steps - 1 );
			g.rect( 0, ( i * h ) / steps, w, h / steps + 1 )
				.fill( lerpColor( c0, c1, t ) );
		}
	}

	// ---------------------------------------------------------------- //
	// Scene framework: handles the plumbing so each scene only writes
	// setup() and tick(). Every scene returns a teardown from mount,
	// respects prefersReducedMotion, and subscribes to the shell's
	// visibility action.
	// ---------------------------------------------------------------- //

	function makeScene( def ) {
		return {
			id: 'b-roll/' + def.id,
			label: def.label,
			type: 'canvas',
			preview: def.preview,
			needs: def.needs || [ 'pixijs' ],
			mount: async function ( container, ctx ) {
				var PIXI = window.PIXI;
				var app = new PIXI.Application();
				await app.init( {
					resizeTo: container,
					backgroundAlpha: 0,
					antialias: true,
					resolution: Math.min( 2, window.devicePixelRatio || 1 ),
					autoDensity: true,
				} );
				container.appendChild( app.canvas );
				app.canvas.style.position = 'absolute';
				app.canvas.style.inset    = '0';
				app.canvas.style.width    = '100%';
				app.canvas.style.height   = '100%';

				var state = await def.setup( { app: app, PIXI: PIXI, ctx: ctx, helpers: helpers } );

				function step( ticker ) {
					var dt = Math.min( 2.5, ticker.deltaTime );
					if ( def.tick ) def.tick( state, { app: app, PIXI: PIXI, dt: dt, ctx: ctx, helpers: helpers } );
				}

				function onResize() {
					if ( def.onResize ) def.onResize( state, { app: app, PIXI: PIXI, ctx: ctx } );
				}
				app.renderer.on( 'resize', onResize );

				if ( ctx.prefersReducedMotion ) {
					// Render one still frame so lines/particles draw once.
					if ( def.tick ) def.tick( state, { app: app, PIXI: PIXI, dt: 0, ctx: ctx, helpers: helpers } );
					app.ticker.stop();
				} else {
					app.ticker.add( step );
				}

				var visHook = 'b-roll/' + def.id + '/visibility';
				function onVis( detail ) {
					if ( ! detail || detail.id !== ctx.id ) return;
					if ( detail.state === 'hidden' )       app.ticker.stop();
					else if ( ! ctx.prefersReducedMotion ) app.ticker.start();
				}
				if ( window.wp && window.wp.hooks ) {
					window.wp.hooks.addAction( 'wp-desktop.wallpaper.visibility', visHook, onVis );
				}

				return function teardown() {
					if ( window.wp && window.wp.hooks ) {
						window.wp.hooks.removeAction( 'wp-desktop.wallpaper.visibility', visHook );
					}
					app.renderer.off( 'resize', onResize );
					if ( def.cleanup ) def.cleanup( state, { app: app, PIXI: PIXI } );
					app.destroy( true, { children: true, texture: true } );
				};
			},
		};
	}

	var helpers = {
		rand: rand, irand: irand, choose: choose, clamp: clamp, tau: tau,
		lerpColor: lerpColor, paintVGradient: paintVGradient,
	};

	// ================================================================ //
	// 1. CODE RAIN — The Matrix
	// ================================================================ //
	// Falling columns of glowing green glyphs. Each column has its own
	// speed and a head that's brighter than the trail. Characters cycle
	// randomly from katakana + a sprinkling of "W" marks.

	function sceneCodeRain() {
		var GLYPHS = (
			'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ' +
			'0123456789WWWWWW' // W shows up more than random
		).split( '' );
		var FONT_SIZE = 16;

		return makeScene( {
			id: 'code-rain',
			label: 'Code Rain',
			preview: 'radial-gradient(100% 80% at 50% 30%, #063b1a 0%, #000 80%)',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, app.renderer.width, app.renderer.height, 0x000000, 0x021008, 8 );

				var container = new PIXI.Container();
				app.stage.addChild( container );

				var style = new PIXI.TextStyle( {
					fontFamily: 'ui-monospace, SFMono-Regular, Menlo, "Courier New", monospace',
					fontSize: FONT_SIZE,
					fill: 0x00ff66,
				} );
				var headStyle = new PIXI.TextStyle( Object.assign( {}, style, {
					fill: 0xd7ffe6,
				} ) );

				function makeColumn( x ) {
					var col = {
						x: x,
						y: rand( -400, 0 ),
						speed: rand( 0.6, 1.6 ),
						length: irand( 10, 28 ),
						chars: [],
						interval: irand( 4, 14 ),
						tick: 0,
						head: new PIXI.Text( { text: choose( GLYPHS ), style: headStyle } ),
					};
					col.head.x = x;
					container.addChild( col.head );
					for ( var i = 0; i < col.length; i++ ) {
						var t = new PIXI.Text( { text: choose( GLYPHS ), style: style } );
						t.x = x;
						t.alpha = 1 - i / col.length;
						col.chars.push( t );
						container.addChild( t );
					}
					return col;
				}

				var cols = [];
				function layoutColumns() {
					cols.forEach( function ( c ) {
						c.head.destroy();
						c.chars.forEach( function ( t ) { t.destroy(); } );
					} );
					cols = [];
					var spacing = FONT_SIZE * 0.95;
					var count = Math.ceil( app.renderer.width / spacing ) + 2;
					for ( var i = 0; i < count; i++ ) cols.push( makeColumn( i * spacing ) );
				}
				layoutColumns();

				return { cols: cols, bg: bg, container: container, layoutColumns: layoutColumns, style: style, headStyle: headStyle };
			},
			onResize: function ( state, env ) {
				paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x000000, 0x021008, 8 );
				state.layoutColumns();
			},
			tick: function ( state, env ) {
				var h = env.app.renderer.height;
				var cols = state.cols;
				for ( var i = 0; i < cols.length; i++ ) {
					var c = cols[ i ];
					c.y += c.speed * env.dt * 3;
					c.tick++;
					if ( c.tick >= c.interval ) {
						c.tick = 0;
						// shift the trail: each char takes the text of the one above
						for ( var j = c.chars.length - 1; j > 0; j-- ) {
							c.chars[ j ].text = c.chars[ j - 1 ].text;
						}
						c.chars[ 0 ].text = c.head.text;
						c.head.text = choose( GLYPHS );
					}
					// layout the trail positions
					c.head.y = c.y;
					for ( var k = 0; k < c.chars.length; k++ ) {
						c.chars[ k ].y = c.y - ( k + 1 ) * FONT_SIZE;
					}
					if ( c.y - c.chars.length * FONT_SIZE > h + 40 ) {
						c.y = rand( -200, 0 );
						c.speed = rand( 0.6, 1.6 );
					}
				}
			},
		} );
	}

	// ================================================================ //
	// 2. HYPERSPACE — Star Wars
	// ================================================================ //
	// Radial starlines stretching outward from centre. Rare warp flash.

	function sceneHyperspace() {
		return makeScene( {
			id: 'hyperspace',
			label: 'Hyperspace',
			preview: 'radial-gradient(60% 60% at 50% 50%, #0a1a3a 0%, #000010 60%, #000 100%)',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, app.renderer.width, app.renderer.height, 0x000010, 0x000000, 6 );

				var lines = new PIXI.Graphics();
				app.stage.addChild( lines );

				var flash = new PIXI.Graphics();
				flash.alpha = 0;
				app.stage.addChild( flash );

				var NUM_STARS = 260;
				var stars = [];
				function spawn( star ) {
					star.angle = Math.random() * tau;
					star.r = rand( 10, 40 );
					star.speed = rand( 0.2, 1.4 );
					star.hue = rand( 0.55, 0.75 );
				}
				for ( var i = 0; i < NUM_STARS; i++ ) {
					var s = {};
					spawn( s );
					s.r = rand( 10, Math.min( app.renderer.width, app.renderer.height ) * 0.6 );
					stars.push( s );
				}

				var timeToFlash = 60 * 30; // ~30s at 60fps
				return { bg: bg, lines: lines, flash: flash, stars: stars, spawn: spawn, timeToFlash: timeToFlash, tSinceFlash: 0 };
			},
			onResize: function ( state, env ) {
				paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x000010, 0x000000, 6 );
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;
				var cx = w / 2, cy = h / 2;
				var maxR = Math.sqrt( cx * cx + cy * cy );

				state.lines.clear();
				for ( var i = 0; i < state.stars.length; i++ ) {
					var s = state.stars[ i ];
					var prevR = s.r;
					s.r += ( 0.5 + s.speed * 6 ) * env.dt;
					if ( s.r > maxR ) { state.spawn( s ); continue; }
					var cos = Math.cos( s.angle ), sin = Math.sin( s.angle );
					var x0 = cx + cos * prevR, y0 = cy + sin * prevR;
					var x1 = cx + cos * s.r, y1 = cy + sin * s.r;
					var t = s.r / maxR;
					var alpha = 0.25 + t * 0.75;
					var width = 0.6 + t * 1.6;
					var color = lerpColor( 0x88ccff, 0xffffff, t );
					state.lines.moveTo( x0, y0 ).lineTo( x1, y1 ).stroke( { color: color, alpha: alpha, width: width } );
				}

				state.tSinceFlash += env.dt;
				if ( state.tSinceFlash >= state.timeToFlash ) {
					state.tSinceFlash = 0;
					state.timeToFlash = 60 * rand( 20, 40 );
					state.flash.clear().rect( 0, 0, w, h ).fill( 0xffffff );
					state.flash.alpha = 1;
				}
				if ( state.flash.alpha > 0 ) state.flash.alpha = Math.max( 0, state.flash.alpha - 0.06 * env.dt );
			},
		} );
	}

	// ================================================================ //
	// 3. NEON RAIN — Blade Runner 2049
	// ================================================================ //
	// Distant city silhouette, flickering neon signs, diagonal rain, and
	// the occasional spinner gliding overhead.

	function sceneNeonRain() {
		return makeScene( {
			id: 'neon-rain',
			label: 'Neon Rain',
			preview: 'linear-gradient(180deg, #23071a 0%, #0b0818 60%, #000 100%)',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;
				var w = app.renderer.width, h = app.renderer.height;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, w, h, 0x1a0420, 0x000000, 10 );

				var city = new PIXI.Graphics();
				app.stage.addChild( city );
				function drawCity() {
					city.clear();
					var base = h * 0.72;
					var x = 0;
					while ( x < w ) {
						var bw = rand( 35, 130 );
						var bh = rand( 60, 220 );
						city.rect( x, base - bh, bw, h ).fill( 0x050308 );
						// lit windows
						for ( var wy = base - bh + 10; wy < h - 6; wy += 12 ) {
							for ( var wx = x + 4; wx < x + bw - 6; wx += 8 ) {
								if ( Math.random() < 0.18 ) {
									city.rect( wx, wy, 3, 4 ).fill( { color: 0xffcc66, alpha: rand( 0.35, 0.9 ) } );
								}
							}
						}
						x += bw + rand( 2, 8 );
					}
				}
				drawCity();

				// Signs
				var signLayer = new PIXI.Container();
				app.stage.addChild( signLayer );
				var SIGN_TEXTS = [ 'ATARI', 'TYRELL', 'WALLACE', 'シティ', 'NEXUS', '強化', '2049' ];
				var signs = [];
				for ( var i = 0; i < 4; i++ ) {
					var t = new PIXI.Text( {
						text: choose( SIGN_TEXTS ),
						style: {
							fontFamily: 'Impact, "Helvetica Neue", sans-serif',
							fontSize: irand( 24, 46 ),
							fill: choose( [ 0xff4aa0, 0xff6a3d, 0x64d8ff, 0xfff14d ] ),
							letterSpacing: 2,
						},
					} );
					t.x = rand( 40, w - 160 );
					t.y = rand( 40, h * 0.55 );
					t.alpha = rand( 0.5, 0.9 );
					signLayer.addChild( t );
					signs.push( { node: t, flickerCD: rand( 60, 240 ) } );
				}

				// Rain
				var rain = new PIXI.Graphics();
				app.stage.addChild( rain );
				var DROPS = 220;
				var drops = [];
				for ( var d = 0; d < DROPS; d++ ) {
					drops.push( {
						x: rand( -w, w ),
						y: rand( -h, h ),
						len: rand( 8, 18 ),
						speed: rand( 6, 11 ),
						alpha: rand( 0.2, 0.7 ),
					} );
				}

				// Spinner — rare horizontal glide
				var spinner = new PIXI.Graphics();
				spinner.rect( 0, 0, 58, 12 ).fill( 0x1a1a2e );
				spinner.rect( 16, -6, 30, 6 ).fill( 0x1a1a2e );
				spinner.rect( 4, 4, 6, 4 ).fill( 0xff9640 );
				spinner.rect( 48, 4, 6, 4 ).fill( 0xff9640 );
				spinner.alpha = 0;
				spinner.pivot.set( 29, 3 );
				spinner.y = h * 0.28;
				spinner.x = -60;
				app.stage.addChild( spinner );

				return {
					bg: bg, city: city, drawCity: drawCity,
					signs: signs, rain: rain, drops: drops,
					spinner: spinner, spinnerT: rand( 60 * 15, 60 * 40 ),
				};
			},
			onResize: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;
				paintVGradient( state.bg, w, h, 0x1a0420, 0x000000, 10 );
				state.drawCity();
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;

				// Signs flicker
				for ( var i = 0; i < state.signs.length; i++ ) {
					var s = state.signs[ i ];
					s.flickerCD -= env.dt;
					if ( s.flickerCD <= 0 ) {
						s.node.alpha = Math.random() < 0.5 ? rand( 0.2, 0.55 ) : rand( 0.7, 1 );
						s.flickerCD = rand( 3, 60 );
					}
				}

				// Rain
				state.rain.clear();
				for ( var d = 0; d < state.drops.length; d++ ) {
					var dr = state.drops[ d ];
					dr.x += dr.speed * 0.35 * env.dt;
					dr.y += dr.speed * env.dt;
					if ( dr.y > h + 20 || dr.x > w + 20 ) {
						dr.y = rand( -h * 0.5, 0 );
						dr.x = rand( -w * 0.2, w );
					}
					state.rain.moveTo( dr.x, dr.y )
						.lineTo( dr.x - dr.len * 0.35, dr.y - dr.len )
						.stroke( { color: 0xa8c8ff, alpha: dr.alpha, width: 1 } );
				}

				// Spinner
				state.spinnerT -= env.dt;
				if ( state.spinnerT <= 0 && state.spinner.alpha === 0 ) {
					state.spinner.alpha = 1;
					state.spinner.x = -60;
					state.spinner.y = rand( h * 0.18, h * 0.34 );
				}
				if ( state.spinner.alpha > 0 ) {
					state.spinner.x += 3 * env.dt;
					if ( state.spinner.x > w + 80 ) {
						state.spinner.alpha = 0;
						state.spinnerT = rand( 60 * 15, 60 * 40 );
					}
				}
			},
		} );
	}

	// ================================================================ //
	// 4. THE GRID — Tron
	// ================================================================ //
	// An isometric neon grid recedes to a glowing horizon. Light cycles
	// race across the grid leaving fading trails.

	function sceneTronGrid() {
		return makeScene( {
			id: 'tron-grid',
			label: 'The Grid',
			preview: 'linear-gradient(180deg, #001626 0%, #000810 40%, #000 100%)',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, app.renderer.width, app.renderer.height, 0x001626, 0x000000, 16 );

				var grid = new PIXI.Graphics();
				app.stage.addChild( grid );

				var trails = new PIXI.Graphics();
				app.stage.addChild( trails );

				// A cycle rides along the grid in one of 4 cardinal directions,
				// turning randomly at intersections.
				var CELL = 40;
				function makeCycle( color ) {
					return {
						gx: irand( 4, 14 ),
						gy: irand( 4, 10 ),
						dir: irand( 0, 4 ),
						color: color,
						trail: [],
						stepT: 0,
					};
				}

				function drawGrid() {
					var w = app.renderer.width, h = app.renderer.height;
					grid.clear();
					// Glowing horizon band
					var horizon = h * 0.52;
					for ( var i = 0; i < 16; i++ ) {
						grid.rect( 0, horizon - i, w, 1 )
							.fill( { color: lerpColor( 0xff6d1f, 0x000000, i / 16 ), alpha: 1 - i / 16 } );
					}
					// Perspective grid floor
					var rows = 14;
					for ( var r = 0; r < rows; r++ ) {
						var t = r / ( rows - 1 );
						var y = horizon + Math.pow( t, 1.8 ) * ( h - horizon );
						grid.moveTo( 0, y ).lineTo( w, y )
							.stroke( { color: 0x00aaff, alpha: 0.2 + t * 0.5, width: 1 } );
					}
					// Verticals converging to vanishing point
					var vp = { x: w / 2, y: horizon };
					for ( var c = -10; c <= 10; c++ ) {
						var x0 = w / 2 + c * ( w / 22 );
						grid.moveTo( x0, h ).lineTo( vp.x + c * 6, vp.y )
							.stroke( { color: 0x00aaff, alpha: 0.25, width: 1 } );
					}
				}
				drawGrid();

				var cycles = [ makeCycle( 0x00eaff ), makeCycle( 0xff6d1f ) ];

				return { bg: bg, grid: grid, trails: trails, cycles: cycles, drawGrid: drawGrid, makeCycle: makeCycle, CELL: CELL };
			},
			onResize: function ( state, env ) {
				paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x001626, 0x000000, 16 );
				state.drawGrid();
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;
				var horizon = h * 0.52;
				var dirs = [ [ 1, 0 ], [ 0, 1 ], [ -1, 0 ], [ 0, -1 ] ];

				for ( var i = 0; i < state.cycles.length; i++ ) {
					var cy = state.cycles[ i ];
					cy.stepT += env.dt;
					if ( cy.stepT >= 10 ) {
						cy.stepT = 0;
						var d = dirs[ cy.dir ];
						cy.gx += d[ 0 ];
						cy.gy += d[ 1 ];
						if ( Math.random() < 0.18 ) cy.dir = ( cy.dir + ( Math.random() < 0.5 ? 1 : 3 ) ) % 4;
						// Project to screen
						var sx = w / 2 + ( cy.gx - 9 ) * ( w / 22 );
						var sy = horizon + Math.pow( cy.gy / 14, 1.8 ) * ( h - horizon );
						cy.trail.push( { x: sx, y: sy, life: 1 } );
						if ( cy.trail.length > 80 ) cy.trail.shift();
						// Respawn if off-grid
						if ( cy.gx < -4 || cy.gx > 20 || cy.gy < 0 || cy.gy > 14 ) {
							Object.assign( cy, state.makeCycle( cy.color ) );
						}
					}
				}

				state.trails.clear();
				for ( var c = 0; c < state.cycles.length; c++ ) {
					var cyc = state.cycles[ c ];
					for ( var t = cyc.trail.length - 1; t >= 1; t-- ) {
						var a = cyc.trail[ t - 1 ], b = cyc.trail[ t ];
						state.trails.moveTo( a.x, a.y ).lineTo( b.x, b.y )
							.stroke( { color: cyc.color, alpha: b.life * 0.9, width: 2 } );
						b.life = Math.max( 0, b.life - 0.012 * env.dt );
					}
					if ( cyc.trail.length ) {
						var head = cyc.trail[ cyc.trail.length - 1 ];
						state.trails.circle( head.x, head.y, 3 ).fill( { color: 0xffffff, alpha: 0.95 } );
						state.trails.circle( head.x, head.y, 6 ).fill( { color: cyc.color, alpha: 0.35 } );
					}
				}
			},
		} );
	}

	// ================================================================ //
	// 5. COUCH GAG — The Simpsons
	// ================================================================ //
	// Springfield-blue sky with drifting cartoon clouds. Once in a while
	// the iconic living-room couch silhouettes in for a beat.

	function sceneCouchGag() {
		return makeScene( {
			id: 'couch-gag',
			label: 'Couch Gag',
			preview: 'linear-gradient(180deg, #7ab9f0 0%, #c8e4fa 100%)',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, app.renderer.width, app.renderer.height, 0x7ab9f0, 0xdaefff, 12 );

				function makeCloud( x, y, s ) {
					var g = new PIXI.Graphics();
					var parts = [
						[ 0, 0, 40 ], [ 34, -8, 32 ], [ 66, -2, 36 ],
						[ 96, -10, 28 ], [ 22, 8, 30 ], [ 56, 10, 32 ],
					];
					for ( var p = 0; p < parts.length; p++ ) {
						g.circle( parts[ p ][ 0 ], parts[ p ][ 1 ], parts[ p ][ 2 ] ).fill( 0xffffff );
					}
					g.scale.set( s );
					g.x = x;
					g.y = y;
					g.alpha = 0.96;
					app.stage.addChild( g );
					return g;
				}

				var clouds = [];
				for ( var i = 0; i < 7; i++ ) {
					var s = rand( 0.55, 1.1 );
					clouds.push( {
						node: makeCloud( rand( 0, app.renderer.width ), rand( 40, app.renderer.height * 0.6 ), s ),
						speed: rand( 0.12, 0.3 ) * ( 1 / s ),
					} );
				}

				// Couch — drawn once, hidden until summoned.
				var couch = new PIXI.Graphics();
				// body
				couch.roundRect( 0, 20, 200, 60, 10 ).fill( 0xc36a1e );
				// cushions
				couch.roundRect( 12, 12, 54, 30, 6 ).fill( 0xe2894a );
				couch.roundRect( 73, 12, 54, 30, 6 ).fill( 0xe2894a );
				couch.roundRect( 134, 12, 54, 30, 6 ).fill( 0xe2894a );
				// armrests
				couch.roundRect( -8, 18, 18, 60, 6 ).fill( 0x8a4812 );
				couch.roundRect( 190, 18, 18, 60, 6 ).fill( 0x8a4812 );
				// legs
				couch.rect( 14, 80, 8, 14 ).fill( 0x3d1e08 );
				couch.rect( 178, 80, 8, 14 ).fill( 0x3d1e08 );
				couch.alpha = 0;
				couch.pivot.set( 100, 50 );
				app.stage.addChild( couch );

				return {
					bg: bg, clouds: clouds,
					couch: couch, couchT: rand( 60 * 20, 60 * 60 ), couchPhase: 'idle',
				};
			},
			onResize: function ( state, env ) {
				paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x7ab9f0, 0xdaefff, 12 );
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;

				for ( var i = 0; i < state.clouds.length; i++ ) {
					var c = state.clouds[ i ];
					c.node.x += c.speed * env.dt;
					if ( c.node.x > w + 140 ) c.node.x = -140;
				}

				// Couch appear timer
				state.couchT -= env.dt;
				if ( state.couchPhase === 'idle' && state.couchT <= 0 ) {
					state.couchPhase = 'in';
					state.couch.alpha = 0;
					state.couch.x = rand( w * 0.25, w * 0.75 );
					state.couch.y = rand( h * 0.5, h * 0.8 );
					state.couch.scale.set( rand( 0.85, 1.2 ) );
				}
				if ( state.couchPhase === 'in' ) {
					state.couch.alpha = Math.min( 1, state.couch.alpha + 0.08 * env.dt );
					if ( state.couch.alpha >= 1 ) { state.couchPhase = 'hold'; state.couchHold = 30; }
				} else if ( state.couchPhase === 'hold' ) {
					state.couchHold -= env.dt;
					if ( state.couchHold <= 0 ) state.couchPhase = 'out';
				} else if ( state.couchPhase === 'out' ) {
					state.couch.alpha = Math.max( 0, state.couch.alpha - 0.05 * env.dt );
					if ( state.couch.alpha <= 0 ) { state.couchPhase = 'idle'; state.couchT = rand( 60 * 30, 60 * 90 ); }
				}
			},
		} );
	}

	// ================================================================ //
	// 6. RAINBOW ROAD — Mario Kart
	// ================================================================ //
	// A scrolling neon-striped road in exaggerated perspective, twinkle
	// stars above, and a drifting ? item-box every so often.

	function sceneRainbowRoad() {
		var ROAD_COLORS = [ 0xff2d5a, 0xff993d, 0xffe84a, 0x31d16a, 0x3dc3ff, 0x8a5bff, 0xff2d5a ];
		return makeScene( {
			id: 'rainbow-road',
			label: 'Rainbow Road',
			preview: 'linear-gradient(180deg, #140024 0%, #020010 60%, #000 100%)',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, app.renderer.width, app.renderer.height, 0x0b0024, 0x000000, 12 );

				var stars = new PIXI.Graphics();
				app.stage.addChild( stars );
				var starData = [];
				for ( var i = 0; i < 140; i++ ) {
					starData.push( { x: rand( 0, app.renderer.width ), y: rand( 0, app.renderer.height * 0.5 ), r: rand( 0.6, 1.6 ), tw: Math.random() * tau } );
				}

				var road = new PIXI.Graphics();
				app.stage.addChild( road );

				var item = new PIXI.Graphics();
				item.roundRect( -18, -18, 36, 36, 6 ).fill( 0xff9e1a );
				item.roundRect( -16, -16, 32, 32, 5 ).fill( 0xffcc4a );
				var q = new PIXI.Text( { text: '?', style: { fontFamily: 'Impact, sans-serif', fontSize: 28, fill: 0xffffff, stroke: { color: 0x5b3300, width: 3 } } } );
				q.anchor.set( 0.5 );
				item.addChild( q );
				item.alpha = 0;
				app.stage.addChild( item );

				return {
					bg: bg, stars: stars, starData: starData, road: road,
					item: item, itemT: rand( 60 * 20, 60 * 60 ), itemPhase: 'idle',
					offset: 0,
				};
			},
			onResize: function ( state, env ) {
				paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x0b0024, 0x000000, 12 );
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;

				// Stars twinkle
				state.stars.clear();
				for ( var i = 0; i < state.starData.length; i++ ) {
					var st = state.starData[ i ];
					st.tw += 0.04 * env.dt;
					var a = 0.45 + 0.45 * Math.sin( st.tw );
					state.stars.circle( st.x, st.y, st.r ).fill( { color: 0xffffff, alpha: a } );
				}

				// Road: horizontal stripes in perspective, scrolling.
				state.offset += 0.05 * env.dt;
				state.road.clear();
				var horizon = h * 0.48;
				var vpX = w / 2;
				var STRIPES = 60;
				for ( var s = 0; s < STRIPES; s++ ) {
					var tNorm = ( s / STRIPES + state.offset ) % 1;
					var y = horizon + Math.pow( tNorm, 1.8 ) * ( h - horizon );
					var y2 = horizon + Math.pow( tNorm + 1 / STRIPES, 1.8 ) * ( h - horizon );
					var widthTop = ( y - horizon ) * 0.85;
					var widthBot = ( y2 - horizon ) * 0.85;
					var color = ROAD_COLORS[ s % ROAD_COLORS.length ];
					state.road.poly( [
						vpX - widthTop, y,
						vpX + widthTop, y,
						vpX + widthBot, y2,
						vpX - widthBot, y2,
					] ).fill( { color: color, alpha: 0.9 } );
				}
				// centre line glow
				state.road.rect( vpX - 2, horizon, 4, h - horizon ).fill( { color: 0xffffff, alpha: 0.35 } );

				// Item box
				state.itemT -= env.dt;
				if ( state.itemPhase === 'idle' && state.itemT <= 0 ) {
					state.itemPhase = 'fly';
					state.item.alpha = 1;
					state.item.x = -40;
					state.item.y = rand( h * 0.18, h * 0.42 );
					state.item.rotation = 0;
				}
				if ( state.itemPhase === 'fly' ) {
					state.item.x += 2.2 * env.dt;
					state.item.rotation += 0.02 * env.dt;
					if ( state.item.x > w + 40 ) {
						state.itemPhase = 'idle';
						state.item.alpha = 0;
						state.itemT = rand( 60 * 25, 60 * 70 );
					}
				}
			},
		} );
	}

	// ================================================================ //
	// 7. SOOT SPRITES — Studio Ghibli
	// ================================================================ //
	// Pastel sky with fluffy black sprite-blobs drifting up and down.
	// One blinks its eyes on every few seconds.

	function sceneSootSprites() {
		return makeScene( {
			id: 'soot-sprites',
			label: 'Soot Sprites',
			preview: 'linear-gradient(180deg, #ffd7ea 0%, #cce7ff 100%)',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, app.renderer.width, app.renderer.height, 0xffd7ea, 0xcce7ff, 18 );

				var sprites = [];
				for ( var i = 0; i < 22; i++ ) {
					var c = new PIXI.Container();
					var g = new PIXI.Graphics();
					// base blob
					g.circle( 0, 0, 18 ).fill( 0x1a1a1a );
					// fringe fuzz
					for ( var k = 0; k < 14; k++ ) {
						var a = ( k / 14 ) * tau;
						var rr = 18 + rand( 2, 6 );
						g.circle( Math.cos( a ) * rr, Math.sin( a ) * rr, rand( 2, 4 ) ).fill( 0x1a1a1a );
					}
					c.addChild( g );
					var leye = new PIXI.Graphics();
					leye.circle( -5, -2, 2.4 ).fill( 0xffffff );
					var reye = new PIXI.Graphics();
					reye.circle( 5, -2, 2.4 ).fill( 0xffffff );
					leye.visible = reye.visible = false;
					c.addChild( leye ); c.addChild( reye );
					c.x = rand( 0, app.renderer.width );
					c.y = rand( 0, app.renderer.height );
					c.scale.set( rand( 0.6, 1.35 ) );
					app.stage.addChild( c );
					sprites.push( {
						node: c, leye: leye, reye: reye,
						baseY: c.y, phase: Math.random() * tau,
						amp: rand( 8, 30 ), vx: rand( -0.25, 0.25 ),
						blinkCD: rand( 60 * 3, 60 * 14 ), blinkT: 0,
					} );
				}

				return { bg: bg, sprites: sprites };
			},
			onResize: function ( state, env ) {
				paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0xffd7ea, 0xcce7ff, 18 );
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width;
				for ( var i = 0; i < state.sprites.length; i++ ) {
					var s = state.sprites[ i ];
					s.phase += 0.018 * env.dt;
					s.node.y = s.baseY + Math.sin( s.phase ) * s.amp;
					s.node.x += s.vx * env.dt;
					if ( s.node.x < -40 ) s.node.x = w + 40;
					if ( s.node.x > w + 40 ) s.node.x = -40;

					s.blinkCD -= env.dt;
					if ( s.blinkCD <= 0 && s.blinkT === 0 ) {
						s.blinkT = 12;
						s.leye.visible = s.reye.visible = true;
					}
					if ( s.blinkT > 0 ) {
						s.blinkT -= env.dt;
						if ( s.blinkT <= 0 ) {
							s.leye.visible = s.reye.visible = false;
							s.blinkCD = rand( 60 * 5, 60 * 18 );
						}
					}
				}
			},
		} );
	}

	// ================================================================ //
	// 8. THE UPSIDE DOWN — Stranger Things
	// ================================================================ //
	// Red-violet murk, drifting spores, and an occasional glitchy
	// title-card flash.

	function sceneUpsideDown() {
		return makeScene( {
			id: 'upside-down',
			label: 'The Upside Down',
			preview: 'radial-gradient(70% 60% at 50% 50%, #4a0a20 0%, #1a0410 60%, #000 100%)',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;
				var w = app.renderer.width, h = app.renderer.height;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				function drawBg() {
					bg.clear();
					// radial-ish via concentric rects
					for ( var i = 0; i < 20; i++ ) {
						var t = i / 19;
						bg.rect( 0, ( i * h ) / 20, w, h / 20 + 1 )
							.fill( lerpColor( 0x4a0a20, 0x050007, Math.abs( t - 0.3 ) * 1.3 ) );
					}
				}
				drawBg();

				var fog = new PIXI.Graphics();
				fog.alpha = 0.6;
				app.stage.addChild( fog );

				var spores = [];
				var sporeLayer = new PIXI.Container();
				app.stage.addChild( sporeLayer );
				for ( var i = 0; i < 90; i++ ) {
					var g = new PIXI.Graphics();
					var size = rand( 1.2, 3.2 );
					g.circle( 0, 0, size ).fill( { color: 0xffccdd, alpha: 0.9 } );
					g.x = rand( 0, w );
					g.y = rand( 0, h );
					sporeLayer.addChild( g );
					spores.push( { node: g, vx: rand( -0.2, 0.2 ), vy: rand( -0.4, -0.05 ), phase: Math.random() * tau } );
				}

				// Title card (hidden until summoned)
				var card = new PIXI.Container();
				var cardBg = new PIXI.Graphics();
				cardBg.rect( -160, -26, 320, 52 ).fill( { color: 0x000000, alpha: 0.0 } );
				card.addChild( cardBg );
				var chapters = [ 'CHAPTER ONE', 'CHAPTER TWO', 'CHAPTER THREE', 'VECNA', 'HAWKINS' ];
				var titleText = new PIXI.Text( {
					text: choose( chapters ),
					style: {
						fontFamily: 'Georgia, "Times New Roman", serif',
						fontSize: 42,
						fill: 0xff2420,
						letterSpacing: 3,
					},
				} );
				titleText.anchor.set( 0.5 );
				card.addChild( titleText );
				card.x = w / 2;
				card.y = h * 0.45;
				card.alpha = 0;
				app.stage.addChild( card );

				return {
					bg: bg, drawBg: drawBg, fog: fog,
					spores: spores, card: card, titleText: titleText, chapters: chapters,
					cardT: rand( 60 * 25, 60 * 70 ), cardPhase: 'idle', cardHold: 0,
				};
			},
			onResize: function ( state, env ) {
				state.drawBg();
				state.card.x = env.app.renderer.width / 2;
				state.card.y = env.app.renderer.height * 0.45;
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;

				// Fog — faint drifting overlay of soft shapes
				state.fog.clear();
				for ( var i = 0; i < 6; i++ ) {
					var x = ( ( env.app.ticker.lastTime * 0.02 + i * 180 ) % ( w + 400 ) ) - 200;
					state.fog.circle( x, rand( 0, h ) * 0.5 + h * 0.3 + Math.sin( i + env.app.ticker.lastTime * 0.0005 ) * 40, 150 )
						.fill( { color: 0x2a0620, alpha: 0.05 } );
				}

				// Spores
				for ( var s = 0; s < state.spores.length; s++ ) {
					var sp = state.spores[ s ];
					sp.phase += 0.02 * env.dt;
					sp.node.x += ( sp.vx + Math.sin( sp.phase ) * 0.15 ) * env.dt;
					sp.node.y += sp.vy * env.dt;
					if ( sp.node.y < -10 ) { sp.node.y = h + 10; sp.node.x = rand( 0, w ); }
					if ( sp.node.x < -10 ) sp.node.x = w + 10;
					if ( sp.node.x > w + 10 ) sp.node.x = -10;
				}

				// Title-card flash
				state.cardT -= env.dt;
				if ( state.cardPhase === 'idle' && state.cardT <= 0 ) {
					state.cardPhase = 'in';
					state.titleText.text = choose( state.chapters );
				}
				if ( state.cardPhase === 'in' ) {
					state.card.alpha += 0.04 * env.dt;
					// glitch shake
					state.card.x = env.app.renderer.width / 2 + rand( -2, 2 );
					if ( state.card.alpha >= 1 ) { state.cardPhase = 'hold'; state.cardHold = 60; }
				} else if ( state.cardPhase === 'hold' ) {
					state.cardHold -= env.dt;
					state.card.x = env.app.renderer.width / 2 + ( Math.random() < 0.04 ? rand( -6, 6 ) : 0 );
					if ( state.cardHold <= 0 ) state.cardPhase = 'out';
				} else if ( state.cardPhase === 'out' ) {
					state.card.alpha -= 0.03 * env.dt;
					if ( state.card.alpha <= 0 ) { state.cardPhase = 'idle'; state.cardT = rand( 60 * 40, 60 * 120 ); }
				}
			},
		} );
	}

	// ================================================================ //
	// 9. REFINERY — Severance
	// ================================================================ //
	// Pale void with drifting numerals that cluster into subtly
	// ominous shapes, then disperse. A Lumon-ish mark pulses in corner.

	function sceneRefinery() {
		return makeScene( {
			id: 'refinery',
			label: 'Refinery',
			preview: 'linear-gradient(180deg, #e6f0ea 0%, #c9dbd2 100%)',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				paintVGradient( bg, app.renderer.width, app.renderer.height, 0xe6f0ea, 0xb8cec3, 10 );

				var numberLayer = new PIXI.Container();
				app.stage.addChild( numberLayer );

				var DIGITS = '0123456789'.split( '' );
				var style = new PIXI.TextStyle( {
					fontFamily: 'ui-monospace, "Courier New", monospace',
					fontSize: 16,
					fill: 0x0d2d4e,
				} );

				var particles = [];
				for ( var i = 0; i < 220; i++ ) {
					var t = new PIXI.Text( { text: choose( DIGITS ), style: style } );
					t.anchor.set( 0.5 );
					t.x = rand( 0, app.renderer.width );
					t.y = rand( 0, app.renderer.height );
					t.alpha = rand( 0.5, 0.9 );
					numberLayer.addChild( t );
					particles.push( {
						node: t, vx: rand( -0.3, 0.3 ), vy: rand( -0.3, 0.3 ),
						homeX: t.x, homeY: t.y,
					} );
				}

				// Lumon mark
				var mark = new PIXI.Graphics();
				mark.circle( 0, 0, 22 ).stroke( { color: 0x0d2d4e, width: 2 } );
				mark.circle( 0, 0, 14 ).stroke( { color: 0x0d2d4e, width: 1.5 } );
				mark.moveTo( -22, 0 ).lineTo( 22, 0 ).stroke( { color: 0x0d2d4e, width: 1 } );
				mark.moveTo( 0, -22 ).lineTo( 0, 22 ).stroke( { color: 0x0d2d4e, width: 1 } );
				var markText = new PIXI.Text( {
					text: 'LUMON',
					style: { fontFamily: 'Georgia, serif', fontSize: 11, fill: 0x0d2d4e, letterSpacing: 2 },
				} );
				markText.anchor.set( 0.5, 0 );
				markText.y = 28;
				mark.addChild( markText );
				mark.x = app.renderer.width - 60;
				mark.y = app.renderer.height - 60;
				mark.alpha = 0.45;
				app.stage.addChild( mark );

				return {
					bg: bg, particles: particles, style: style, mark: mark,
					clusterT: 60 * 8, clusterPhase: 'idle', clusterCenter: null,
				};
			},
			onResize: function ( state, env ) {
				paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0xe6f0ea, 0xb8cec3, 10 );
				state.mark.x = env.app.renderer.width - 60;
				state.mark.y = env.app.renderer.height - 60;
			},
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;

				state.clusterT -= env.dt;
				if ( state.clusterT <= 0 ) {
					if ( state.clusterPhase === 'idle' ) {
						state.clusterPhase = 'gather';
						state.clusterCenter = { x: rand( w * 0.2, w * 0.8 ), y: rand( h * 0.2, h * 0.8 ) };
						state.clusterT = 60 * 6;
					} else {
						state.clusterPhase = 'idle';
						state.clusterCenter = null;
						state.clusterT = 60 * rand( 10, 20 );
					}
				}

				for ( var i = 0; i < state.particles.length; i++ ) {
					var p = state.particles[ i ];
					var tx, ty;
					if ( state.clusterCenter ) {
						// Form a soft ring around the center.
						var idx = i / state.particles.length;
						var ang = idx * tau * 3;
						var r = 80 + Math.sin( ang * 2 + env.app.ticker.lastTime * 0.002 ) * 20;
						tx = state.clusterCenter.x + Math.cos( ang ) * r;
						ty = state.clusterCenter.y + Math.sin( ang ) * r;
					} else {
						tx = p.homeX + Math.sin( env.app.ticker.lastTime * 0.0004 + i * 0.3 ) * 40;
						ty = p.homeY + Math.cos( env.app.ticker.lastTime * 0.00035 + i * 0.3 ) * 40;
					}
					p.node.x += ( tx - p.node.x ) * 0.02 * env.dt;
					p.node.y += ( ty - p.node.y ) * 0.02 * env.dt;
					if ( Math.random() < 0.004 ) p.node.text = '0123456789'.charAt( irand( 0, 10 ) );
				}

				// Mark gently pulses
				state.mark.alpha = 0.35 + 0.12 * Math.sin( env.app.ticker.lastTime * 0.0018 );
			},
		} );
	}

	// ================================================================ //
	// 10. SHIMMER — Arcane
	// ================================================================ //
	// Rising magenta bioluminescent particles, occasional hex-grid flash,
	// gold glints across the top. Piltover above, Zaun below.

	function sceneShimmer() {
		return makeScene( {
			id: 'shimmer',
			label: 'Shimmer',
			preview: 'linear-gradient(180deg, #c29033 0%, #5a0e3a 60%, #16051a 100%)',
			setup: function ( env ) {
				var PIXI = env.PIXI, app = env.app;
				var w = app.renderer.width, h = app.renderer.height;

				var bg = new PIXI.Graphics();
				app.stage.addChild( bg );
				function drawBg() {
					bg.clear();
					var steps = 24;
					for ( var i = 0; i < steps; i++ ) {
						var t = i / ( steps - 1 );
						var c;
						if ( t < 0.25 ) c = lerpColor( 0xc29033, 0x8a2c5b, t / 0.25 );
						else            c = lerpColor( 0x8a2c5b, 0x16051a, ( t - 0.25 ) / 0.75 );
						bg.rect( 0, ( i * h ) / steps, w, h / steps + 1 ).fill( c );
					}
				}
				drawBg();

				// Zaun silhouette
				var zaun = new PIXI.Graphics();
				app.stage.addChild( zaun );
				function drawZaun() {
					zaun.clear();
					var base = h * 0.82;
					var x = 0;
					while ( x < w ) {
						var bw = rand( 20, 60 );
						var bh = rand( 28, 90 );
						zaun.rect( x, base - bh, bw, h ).fill( { color: 0x0a0210, alpha: 0.95 } );
						x += bw;
					}
					// pipe silhouettes
					for ( var p = 0; p < 6; p++ ) {
						var px = rand( 40, w - 60 );
						zaun.rect( px, base - 10, 8, h ).fill( { color: 0x190214, alpha: 0.9 } );
					}
				}
				drawZaun();

				// Hex grid (transient flash)
				var hex = new PIXI.Graphics();
				hex.alpha = 0;
				app.stage.addChild( hex );

				// Rising particles
				var particleLayer = new PIXI.Graphics();
				app.stage.addChild( particleLayer );
				var particles = [];
				for ( var i = 0; i < 140; i++ ) {
					particles.push( {
						x: rand( 0, w ), y: rand( 0, h ),
						r: rand( 0.8, 2.6 ), vy: -rand( 0.25, 0.8 ),
						phase: Math.random() * tau, amp: rand( 4, 16 ),
					} );
				}

				// Gold glints across the top
				var glintLayer = new PIXI.Graphics();
				app.stage.addChild( glintLayer );

				return {
					bg: bg, drawBg: drawBg, zaun: zaun, drawZaun: drawZaun,
					hex: hex, particles: particles, particleLayer: particleLayer, glintLayer: glintLayer,
					hexT: rand( 60 * 15, 60 * 40 ), hexAlpha: 0,
				};
			},
			onResize: function ( state, env ) { state.drawBg(); state.drawZaun(); },
			tick: function ( state, env ) {
				var w = env.app.renderer.width, h = env.app.renderer.height;

				// Particles
				state.particleLayer.clear();
				for ( var i = 0; i < state.particles.length; i++ ) {
					var p = state.particles[ i ];
					p.phase += 0.04 * env.dt;
					p.y += p.vy * env.dt;
					var px = p.x + Math.sin( p.phase ) * p.amp;
					if ( p.y < -10 ) { p.y = h + 20; p.x = rand( 0, w ); }
					var t = 1 - ( p.y / h );
					var color = lerpColor( 0xff4ab8, 0xffe08a, clamp( t - 0.4, 0, 1 ) * 1.4 );
					state.particleLayer.circle( px, p.y, p.r ).fill( { color: color, alpha: 0.35 + t * 0.55 } );
					state.particleLayer.circle( px, p.y, p.r * 3 ).fill( { color: color, alpha: 0.06 + t * 0.1 } );
				}

				// Gold glints near top
				state.glintLayer.clear();
				var glints = 18;
				for ( var g = 0; g < glints; g++ ) {
					var gx = ( g / glints ) * w + Math.sin( env.app.ticker.lastTime * 0.0005 + g ) * 20;
					var gy = h * 0.08 + Math.sin( env.app.ticker.lastTime * 0.0012 + g * 1.3 ) * 6;
					var ga = 0.3 + 0.3 * Math.sin( env.app.ticker.lastTime * 0.003 + g );
					state.glintLayer.circle( gx, gy, 1.3 ).fill( { color: 0xffe08a, alpha: ga } );
				}

				// Hex flash
				state.hexT -= env.dt;
				if ( state.hexT <= 0 ) {
					state.hexT = rand( 60 * 15, 60 * 40 );
					state.hex.clear();
					var HEX_R = 32, HEX_H = HEX_R * Math.sqrt( 3 );
					for ( var y = 0; y < h + HEX_H; y += HEX_H * 0.5 ) {
						for ( var x = 0; x < w + HEX_R * 2; x += HEX_R * 1.5 ) {
							var ox = ( Math.round( y / ( HEX_H * 0.5 ) ) % 2 ) * HEX_R * 0.75;
							state.hex.poly( [
								x - HEX_R + ox, y,
								x - HEX_R * 0.5 + ox, y - HEX_H * 0.5,
								x + HEX_R * 0.5 + ox, y - HEX_H * 0.5,
								x + HEX_R + ox, y,
								x + HEX_R * 0.5 + ox, y + HEX_H * 0.5,
								x - HEX_R * 0.5 + ox, y + HEX_H * 0.5,
							] ).stroke( { color: 0xff7ad0, alpha: 0.5, width: 1 } );
						}
					}
					state.hexAlpha = 0.85;
				}
				if ( state.hexAlpha > 0 ) state.hexAlpha = Math.max( 0, state.hexAlpha - 0.02 * env.dt );
				state.hex.alpha = state.hexAlpha;
			},
		} );
	}

	// ---------------------------------------------------------------- //
	// Registration
	// ---------------------------------------------------------------- //

	var SCENE_FACTORIES = [
		sceneCodeRain,
		sceneHyperspace,
		sceneNeonRain,
		sceneTronGrid,
		sceneCouchGag,
		sceneRainbowRoad,
		sceneSootSprites,
		sceneUpsideDown,
		sceneRefinery,
		sceneShimmer,
	];

	var registered = false;
	function registerAll() {
		if ( registered ) return;
		if ( ! window.wp || ! window.wp.desktop || typeof window.wp.desktop.registerWallpaper !== 'function' ) return;
		registered = true;
		for ( var i = 0; i < SCENE_FACTORIES.length; i++ ) {
			try {
				window.wp.desktop.registerWallpaper( SCENE_FACTORIES[ i ]() );
			} catch ( e ) {
				// Don't let one bad scene break the others.
				if ( window.console ) window.console.warn( 'B-Roll: scene registration failed', e );
			}
		}
	}

	function boot() {
		if ( ! window.wp || ! window.wp.hooks ) return;
		window.wp.hooks.addAction( 'wp-desktop.init', 'b-roll/register', registerAll );
		if ( window.wp.desktop && typeof window.wp.desktop.whenReady === 'function' ) {
			window.wp.desktop.whenReady( registerAll );
		}
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
} )();
