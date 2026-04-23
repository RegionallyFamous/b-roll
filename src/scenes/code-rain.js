/**
 * B-Roll scene: Code Rain (The Matrix)
 * ---------------------------------------------------------------
 * Dense columns of falling green glyphs. Each column has a bright
 * white lead-glyph backed by an additive-blended green bloom,
 * a tail fading from bright to dark green, and an occasional
 * rare white-flash cascade. Subtle CRT scanline overlay.
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
	var FONT_SIZE = 16;

	window.__bRoll.scenes[ 'code-rain' ] = {
		setup: function ( env ) {
			var PIXI = env.PIXI, app = env.app;

			var bg = new PIXI.Graphics();
			app.stage.addChild( bg );
			h.paintVGradient( bg, app.renderer.width, app.renderer.height, 0x000100, 0x011209, 8 );

			var scan = new PIXI.Graphics();
			scan.alpha = 0.06;
			app.stage.addChild( scan );
			function drawScan() {
				var w = app.renderer.width, hh = app.renderer.height;
				scan.clear();
				for ( var y = 0; y < hh; y += 2 ) scan.rect( 0, y, w, 1 ).fill( 0x000000 );
			}
			drawScan();

			var bloom = h.makeBloomLayer( PIXI, 6 );
			app.stage.addChild( bloom );
			var bloomContainer = new PIXI.Container();
			bloom.addChild( bloomContainer );

			var crisp = new PIXI.Container();
			app.stage.addChild( crisp );

			function makeCol( x ) {
				var col = {
					x: x,
					y: h.rand( -600, 0 ),
					speed: h.rand( 0.8, 2.4 ),
					length: h.irand( 14, 34 ),
					chars: [], bloomChars: [],
					interval: h.irand( 3, 10 ),
					tick: 0,
					flash: 0,
				};
				col.head = new PIXI.Text( {
					text: h.choose( GLYPHS ),
					style: { fontFamily: 'ui-monospace,monospace', fontSize: FONT_SIZE, fill: 0xffffff },
				} );
				col.headBloom = new PIXI.Text( {
					text: col.head.text,
					style: { fontFamily: 'ui-monospace,monospace', fontSize: FONT_SIZE, fill: 0xb0ffc8 },
				} );
				col.head.x = col.headBloom.x = x;
				crisp.addChild( col.head );
				bloomContainer.addChild( col.headBloom );
				for ( var i = 0; i < col.length; i++ ) {
					var alpha = Math.pow( 1 - i / col.length, 1.3 );
					var shade = h.lerpColor( 0x00ff66, 0x002a0e, Math.min( 1, i / col.length * 1.3 ) );
					var t = new PIXI.Text( {
						text: h.choose( GLYPHS ),
						style: { fontFamily: 'ui-monospace,monospace', fontSize: FONT_SIZE, fill: shade },
					} );
					t.x = x; t.alpha = alpha;
					col.chars.push( t );
					crisp.addChild( t );
					if ( i < 6 ) {
						var b = new PIXI.Text( {
							text: t.text,
							style: { fontFamily: 'ui-monospace,monospace', fontSize: FONT_SIZE, fill: 0x2bff80 },
						} );
						b.x = x; b.alpha = alpha * 0.7;
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
					c.chars.forEach( function ( t ) { t.destroy(); } );
					c.bloomChars.forEach( function ( t ) { if ( t ) t.destroy(); } );
				}
				cols = [];
				var spacing = FONT_SIZE * 0.78;
				var count = Math.ceil( app.renderer.width / spacing ) + 2;
				for ( var k = 0; k < count; k++ ) cols.push( makeCol( k * spacing ) );
			}
			layout();

			return { bg: bg, scan: scan, drawScan: drawScan, cols: cols, layout: layout };
		},
		onResize: function ( state, env ) {
			h.paintVGradient( state.bg, env.app.renderer.width, env.app.renderer.height, 0x000100, 0x011209, 8 );
			state.drawScan();
			state.layout();
		},
		tick: function ( state, env ) {
			var hh = env.app.renderer.height;
			for ( var i = 0; i < state.cols.length; i++ ) {
				var c = state.cols[ i ];
				c.y += c.speed * env.dt * 3;
				c.tick++;
				if ( c.tick >= c.interval ) {
					c.tick = 0;
					for ( var j = c.chars.length - 1; j > 0; j-- ) {
						c.chars[ j ].text = c.chars[ j - 1 ].text;
						if ( c.bloomChars[ j ] ) c.bloomChars[ j ].text = c.chars[ j - 1 ].text;
					}
					c.chars[ 0 ].text = c.head.text;
					if ( c.bloomChars[ 0 ] ) c.bloomChars[ 0 ].text = c.head.text;
					c.head.text = h.choose( GLYPHS );
					c.headBloom.text = c.head.text;
				}
				if ( c.flash > 0 ) {
					c.flash = Math.max( 0, c.flash - 0.03 * env.dt );
					var flashColor = h.lerpColor( 0x00ff66, 0xffffff, c.flash );
					for ( var k2 = 0; k2 < 4; k2++ ) c.chars[ k2 ].style.fill = flashColor;
				}
				if ( Math.random() < 0.0003 * env.dt ) c.flash = 1;
				c.head.y = c.headBloom.y = c.y;
				for ( var kk = 0; kk < c.chars.length; kk++ ) {
					var yy = c.y - ( kk + 1 ) * FONT_SIZE;
					c.chars[ kk ].y = yy;
					if ( c.bloomChars[ kk ] ) c.bloomChars[ kk ].y = yy;
				}
				if ( c.y - c.chars.length * FONT_SIZE > hh + 40 ) {
					c.y = h.rand( -300, -20 );
					c.speed = h.rand( 0.8, 2.4 );
				}
			}
		},
	};
} )();
