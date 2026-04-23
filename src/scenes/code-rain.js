/**
 * B-Roll scene: Code Rain (The Matrix) — v0.4
 * ---------------------------------------------------------------
 * Three parallax depth buckets (far / mid / near) of falling green
 * glyph columns. Per-column phosphor wobble, ±1px head-glyph
 * micro-jitter, occasional bright-white flashes, and rare phrase
 * cascades that lock 6 adjacent columns so a short word like
 * MATRIX or UNPLUG drops through them in sync. CRT vignette and
 * film grain finish the look.
 */
( function () {
	'use strict';
	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};

	var h = window.__bRoll.helpers;

	var GLYPHS = (
		'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ' +
		'0123456789WWWWWW@#$%&*+='
	).split( '' );

	// Phrases chosen to fit in ≤ 6 columns (each column = one letter).
	var PHRASES = [
		'MATRIX', 'FOLLOW', 'SYSTEM', 'AGENT', 'UNPLUG',
		'ZION', 'NEO', 'DODGE', 'TRACE', 'REBOOT',
	];

	// Parallax depth buckets. Weights sum to 1.0 and drive the draw of each
	// column at setup time. Near columns are bigger, brighter, faster, and
	// rarer; far columns are tiny, dim, slow, and common.
	var BUCKETS = [
		{ fontSize: 10, alpha: 0.38, speedMul: 0.55, lenMin: 10, lenMax: 20, weight: 0.50, bloomHeads: 2 },
		{ fontSize: 14, alpha: 0.75, speedMul: 1.00, lenMin: 14, lenMax: 28, weight: 0.35, bloomHeads: 5 },
		{ fontSize: 20, alpha: 1.00, speedMul: 1.40, lenMin: 18, lenMax: 34, weight: 0.15, bloomHeads: 7 },
	];

	function pickBucket() {
		var r = Math.random(), acc = 0;
		for ( var i = 0; i < BUCKETS.length; i++ ) {
			acc += BUCKETS[ i ].weight;
			if ( r < acc ) return i;
		}
		return 0;
	}

	window.__bRoll.scenes[ 'code-rain' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			// Layer stack (back→front):
			//   bg       gradient background
			//   bloom    additive blurred glow for heads + bloom tail
			//   crisp    all tail glyphs + heads
			//   scan     static scanline multiply overlay
			//   grain    per-frame-stepped film grain
			//   vignette radial corner darkening
			var bg = new PIXI.Graphics();
			app.stage.addChild( bg );
			function paintBg() {
				h.paintVGradient( bg, app.renderer.width, app.renderer.height, 0x02110a, 0x000604, 12 );
			}
			paintBg();

			var bloom = h.makeBloomLayer( PIXI, 7 );
			app.stage.addChild( bloom );
			var bloomContainer = new PIXI.Container();
			bloom.addChild( bloomContainer );

			var crisp = new PIXI.Container();
			app.stage.addChild( crisp );

			var scan = new PIXI.Graphics();
			scan.alpha = 0.08;
			app.stage.addChild( scan );
			function drawScan() {
				var w = app.renderer.width, hh = app.renderer.height;
				scan.clear();
				for ( var y = 0; y < hh; y += 2 ) scan.rect( 0, y, w, 1 ).fill( 0x000000 );
			}
			drawScan();

			var grain = new PIXI.Graphics();
			grain.alpha = 0.13;
			app.stage.addChild( grain );

			var vignette = new PIXI.Graphics();
			app.stage.addChild( vignette );
			function drawVignette() {
				var w = app.renderer.width, hh = app.renderer.height;
				vignette.clear();
				// Approximate a radial vignette by stacking transparent-to-black
				// concentric ring strokes from the center outward. Only drawn on
				// setup/resize so cost is amortized.
				var cx = w / 2, cy = hh / 2;
				var maxR = Math.sqrt( cx * cx + cy * cy );
				var rings = 22;
				for ( var i = 0; i < rings; i++ ) {
					var t = i / ( rings - 1 );
					var r = maxR * ( 0.50 + t * 0.55 );
					var a = Math.pow( t, 2.4 ) * 0.95;
					vignette.circle( cx, cy, r ).stroke( {
						width: maxR * 0.08 / rings,
						color: 0x000000,
						alpha: a,
					} );
				}
			}
			drawVignette();

			function makeCol( x, bucketIdx ) {
				var B = BUCKETS[ bucketIdx ];
				var col = {
					xBase: x,
					x: x,
					y: h.rand( -600, 0 ),
					speed: h.rand( 0.8, 2.4 ) * B.speedMul,
					length: h.irand( B.lenMin, B.lenMax ),
					fontSize: B.fontSize,
					bucket: bucketIdx,
					chars: [],
					bloomChars: [],
					interval: h.irand( 3, 10 ),
					tick: 0,
					flash: 0,
					wobAmp: h.rand( 0.4, 1.4 ),
					wobFreq: h.rand( 0.012, 0.035 ),
					wobPhase: h.rand( 0, h.tau ),
					headJitter: 0,
					forcedHead: null, // set during phrase cascade
				};
				col.head = new PIXI.Text( {
					text: h.choose( GLYPHS ),
					style: { fontFamily: 'ui-monospace,monospace', fontSize: B.fontSize, fill: 0xffffff },
				} );
				col.head.alpha = B.alpha;
				col.headBloom = new PIXI.Text( {
					text: col.head.text,
					style: { fontFamily: 'ui-monospace,monospace', fontSize: B.fontSize, fill: 0xb0ffc8 },
				} );
				col.headBloom.alpha = B.alpha * 0.85;
				crisp.addChild( col.head );
				bloomContainer.addChild( col.headBloom );
				for ( var i = 0; i < col.length; i++ ) {
					var tailT = i / col.length;
					var shade = h.lerpColor( 0x00ff66, 0x002a0e, Math.min( 1, tailT * 1.3 ) );
					var t = new PIXI.Text( {
						text: h.choose( GLYPHS ),
						style: { fontFamily: 'ui-monospace,monospace', fontSize: B.fontSize, fill: shade },
					} );
					t.alpha = Math.pow( 1 - tailT, 1.25 ) * B.alpha;
					col.chars.push( t );
					crisp.addChild( t );
					if ( i < B.bloomHeads ) {
						var b = new PIXI.Text( {
							text: t.text,
							style: { fontFamily: 'ui-monospace,monospace', fontSize: B.fontSize, fill: 0x2bff80 },
						} );
						b.alpha = Math.pow( 1 - tailT, 1.3 ) * 0.7 * B.alpha;
						col.bloomChars.push( b );
						bloomContainer.addChild( b );
					} else {
						col.bloomChars.push( null );
					}
				}
				return col;
			}

			var cols = [];
			function layout() {
				for ( var i = 0; i < cols.length; i++ ) {
					var c = cols[ i ];
					c.head.destroy(); c.headBloom.destroy();
					for ( var ci = 0; ci < c.chars.length; ci++ ) {
						c.chars[ ci ].destroy();
						if ( c.bloomChars[ ci ] ) c.bloomChars[ ci ].destroy();
					}
				}
				cols = [];
				// Column spacing is anchored to the mid-bucket font size so near/far
				// columns interleave cleanly across the same pitch.
				var spacing = BUCKETS[ 1 ].fontSize * 0.78;
				var count = Math.ceil( app.renderer.width / spacing ) + 2;
				for ( var k = 0; k < count; k++ ) cols.push( makeCol( k * spacing, pickBucket() ) );
				state.cols = cols;
			}

			var state = {
				bg: bg, scan: scan, grain: grain, vignette: vignette,
				paintBg: paintBg, drawScan: drawScan, drawVignette: drawVignette,
				cols: cols, layout: layout,
				time: 0,
				grainTick: 0,
				cascadeCooldown: h.irand( 300, 1200 ), // frames (5–20s at 60fps)
				cascade: null,
			};
			layout();
			return state;
		},

		onResize: function ( state, env ) {
			state.paintBg();
			state.drawScan();
			state.drawVignette();
			state.layout();
		},

		tick: function ( state, env ) {
			var dt = env.dt;
			var hh = env.app.renderer.height;
			state.time += dt;
			state.grainTick += dt;

			// --- Phrase cascade controller --------------------------- //
			if ( state.cascade ) {
				state.cascade.elapsed += dt;
				if ( state.cascade.elapsed >= state.cascade.duration ) {
					for ( var cj = 0; cj < state.cascade.width; cj++ ) {
						var col = state.cols[ state.cascade.startCol + cj ];
						if ( col ) col.forcedHead = null;
					}
					state.cascade = null;
					state.cascadeCooldown = h.irand( 600, 2400 ); // 10–40s at 60fps
				}
			} else {
				state.cascadeCooldown -= dt;
				if ( state.cascadeCooldown <= 0 && state.cols.length > 8 ) {
					var phrase = h.choose( PHRASES );
					var w = Math.min( phrase.length, 6 );
					var start = h.irand( 0, state.cols.length - w );
					for ( var pj = 0; pj < w; pj++ ) {
						var pc = state.cols[ start + pj ];
						if ( pc ) pc.forcedHead = phrase.charAt( pj );
					}
					// Cascade runs long enough for the locked letters to propagate
					// visibly down each column's tail (~2s).
					state.cascade = { startCol: start, width: w, duration: 120, elapsed: 0 };
				}
			}

			// --- Columns --------------------------------------------- //
			for ( var i = 0; i < state.cols.length; i++ ) {
				var c = state.cols[ i ];

				// Phosphor wobble: whole-column horizontal sub-pixel sine.
				c.x = c.xBase + Math.sin( state.time * c.wobFreq + c.wobPhase ) * c.wobAmp;

				// Head micro-jitter: additional ±1px shiver on the lead glyph only.
				c.headJitter = ( Math.random() - 0.5 ) * 2;

				c.y += c.speed * dt * 3;
				c.tick += dt;

				if ( c.tick >= c.interval ) {
					c.tick = 0;
					// Shift tail down one position.
					for ( var k = c.chars.length - 1; k > 0; k-- ) {
						c.chars[ k ].text = c.chars[ k - 1 ].text;
						if ( c.bloomChars[ k ] ) c.bloomChars[ k ].text = c.chars[ k - 1 ].text;
					}
					c.chars[ 0 ].text = c.head.text;
					if ( c.bloomChars[ 0 ] ) c.bloomChars[ 0 ].text = c.head.text;
					// New head glyph — forced phrase letter if locked, otherwise random.
					c.head.text = c.forcedHead || h.choose( GLYPHS );
					c.headBloom.text = c.head.text;
				}

				// Occasional white-flash cascade down a single column.
				if ( c.flash > 0 ) {
					c.flash = Math.max( 0, c.flash - 0.03 * dt );
					var flashColor = h.lerpColor( 0x00ff66, 0xffffff, c.flash );
					for ( var fk = 0; fk < Math.min( 4, c.chars.length ); fk++ ) {
						c.chars[ fk ].style.fill = flashColor;
					}
				}
				if ( Math.random() < 0.0003 * dt ) c.flash = 1;

				// Position: head uses jitter, tail uses wobble only.
				c.head.x = c.x + c.headJitter;
				c.headBloom.x = c.x + c.headJitter;
				c.head.y = c.y;
				c.headBloom.y = c.y;
				for ( var kk = 0; kk < c.chars.length; kk++ ) {
					var yy = c.y - ( kk + 1 ) * c.fontSize;
					c.chars[ kk ].x = c.x;
					c.chars[ kk ].y = yy;
					if ( c.bloomChars[ kk ] ) {
						c.bloomChars[ kk ].x = c.x;
						c.bloomChars[ kk ].y = yy;
					}
				}

				// Wrap column back above the screen once tail exits the bottom.
				if ( c.y - c.chars.length * c.fontSize > hh + 40 ) {
					c.y = h.rand( -300, -20 );
					c.speed = h.rand( 0.8, 2.4 ) * BUCKETS[ c.bucket ].speedMul;
				}
			}

			// --- Film grain (redrawn every ~6 frames) ---------------- //
			if ( state.grainTick >= 6 ) {
				state.grainTick = 0;
				var gw = env.app.renderer.width, gh = env.app.renderer.height;
				state.grain.clear();
				var count = Math.min( 450, Math.floor( gw * gh / 7200 ) );
				for ( var g2 = 0; g2 < count; g2++ ) {
					var gx = Math.random() * gw;
					var gy = Math.random() * gh;
					var ga = 0.4 + Math.random() * 0.6;
					state.grain.rect( gx, gy, 1, 1 ).fill( { color: 0x000000, alpha: ga } );
				}
			}
		},
	};
} )();
