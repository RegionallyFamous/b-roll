/**
 * ODD for WP Desktop Mode — v0.6 registrar
 * ---------------------------------------------------------------
 * Scaling pillars:
 *
 *   1. Manifest-driven. The scene list lives in src/scenes.json and
 *      is hydrated into this page via wp_localize_script as
 *      window.odd.scenes. Adding a scene never edits this file.
 *
 *   2. Lazy at every layer. Boot only fetches this one file. The
 *      in-canvas picker UI, each scene's Pixi implementation, its
 *      painted backdrop JPG, and the preview thumbnails are all
 *      fetched on demand. Cold start stays O(1) in scene count.
 *
 *   3. Single shell card. We register exactly one 'odd' wallpaper
 *      with the WP Desktop shell. Scene selection happens inside the
 *      canvas via a gear button that opens a searchable, tag-filtered
 *      picker. Per-user pick is persisted through POST /odd/v1/prefs.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};

	// ============================================================ //
	// Shared helpers — scene files read these from env.helpers.
	// ============================================================ //

	var rand   = function ( a, b ) { return a + Math.random() * ( b - a ); };
	var irand  = function ( a, b ) { return ( a + Math.random() * ( b - a ) ) | 0; };
	var choose = function ( arr ) { return arr[ ( Math.random() * arr.length ) | 0 ]; };
	var clamp  = function ( v, a, b ) { return v < a ? a : v > b ? b : v; };
	var tau    = Math.PI * 2;

	function lerpColor( a, b, t ) {
		var ar = ( a >> 16 ) & 0xff, ag = ( a >> 8 ) & 0xff, ab = a & 0xff;
		var br = ( b >> 16 ) & 0xff, bg = ( b >> 8 ) & 0xff, bb = b & 0xff;
		return ( ( ( ar + ( br - ar ) * t ) | 0 ) << 16 )
			| ( ( ( ag + ( bg - ag ) * t ) | 0 ) << 8 )
			| ( ( ab + ( bb - ab ) * t ) | 0 );
	}

	function paintVGradient( g, w, h, c0, c1, steps ) {
		steps = steps || 24;
		g.clear();
		for ( var i = 0; i < steps; i++ ) {
			var t = i / ( steps - 1 );
			g.rect( 0, ( i * h ) / steps, w, h / steps + 1 ).fill( lerpColor( c0, c1, t ) );
		}
	}

	function makeBloomLayer( PIXI, strength ) {
		var c = new PIXI.Container();
		c.blendMode = 'add';
		c.filters = [ new PIXI.BlurFilter( { strength: strength || 8, quality: 2 } ) ];
		return c;
	}

	// ============================================================ //
	// Cut-out drifters — v0.7 foreground layer.
	//
	// Each scene ships a few transparent cut-outs (WebP since
	// v0.8.0, PNG before) at assets/cutouts/<slug>/*. Scenes declare them in
	// scenes.json with a motion profile; mountCutouts() loads
	// textures and returns a drifters[] array, and tickDrifters()
	// advances them every frame.
	// ============================================================ //

	function cutoutUrl( slug, file ) {
		var base = window.__odd.config ? window.__odd.config.pluginUrl : '';
		var ver  = window.__odd.config ? window.__odd.config.version   : '';
		var qs = ver ? '?v=' + encodeURIComponent( ver ) : '';
		return base + '/assets/cutouts/' + slug + '/' + file + qs;
	}

	function atlasUrl( slug ) {
		var base = window.__odd.config ? window.__odd.config.pluginUrl : '';
		var ver  = window.__odd.config ? window.__odd.config.version   : '';
		var qs = ver ? '?v=' + encodeURIComponent( ver ) : '';
		return base + '/assets/atlases/' + slug + '.json' + qs;
	}

	function resolveCutoutDefs( slug ) {
		var map = ( window.__odd.config && window.__odd.config.sceneMap ) || {};
		var s = map[ slug ];
		return ( s && Array.isArray( s.cutouts ) ) ? s.cutouts : [];
	}

	// Atlas probe cache. Scenes that don't ship an atlas will 404 the
	// JSON once; we then remember to skip the atlas path for that
	// slug and load each cut-out individually forever after.
	var _atlasMiss = {};

	function loadAtlas( PIXI, slug ) {
		if ( _atlasMiss[ slug ] ) return Promise.resolve( null );
		try {
			return PIXI.Assets.load( atlasUrl( slug ) ).then( function ( sheet ) {
				if ( ! sheet || ! sheet.textures ) {
					_atlasMiss[ slug ] = true;
					return null;
				}
				return sheet;
			} ).catch( function () {
				_atlasMiss[ slug ] = true;
				return null;
			} );
		} catch ( e ) {
			_atlasMiss[ slug ] = true;
			return Promise.resolve( null );
		}
	}

	function mountCutouts( app, PIXI, slug, fg ) {
		var defs = resolveCutoutDefs( slug );
		if ( ! defs.length ) return Promise.resolve( [] );

		var far  = new PIXI.Container(); fg.addChild( far );
		var mid  = new PIXI.Container(); fg.addChild( mid );
		var near = new PIXI.Container(); fg.addChild( near );
		var bins = { far: far, mid: mid, near: near };

		// Depth-of-field: `far` cut-outs get a gentle blur so they
		// read as atmospheric background, `mid` is sharp-ish, `near`
		// is crisp. Scenes can opt out per def with `def.blur = 0`.
		// BlurFilter only exists when the Pixi "filters" bundle is
		// loaded; guard so older bundles don't explode.
		var hasBlur = !! PIXI.BlurFilter;

		var drifters = [];
		function addSprite( def, tex ) {
			var sprite = new PIXI.Sprite( tex );
			sprite.anchor.set( 0.5 );
			( bins[ def.z || 'mid' ] || mid ).addChild( sprite );

			if ( hasBlur ) {
				var defaultBlur = def.z === 'far' ? 2.2 : def.z === 'near' ? 0 : 0.6;
				var bAmt = def.blur != null ? def.blur : defaultBlur;
				if ( bAmt > 0 ) {
					var blur = new PIXI.BlurFilter( { strength: bAmt, quality: 2 } );
					sprite.filters = [ blur ];
				}
			}

			var zAlpha = def.z === 'far' ? 0.55 : def.z === 'near' ? 0.95 : 0.80;
			var baseAlpha = def.alpha != null ? def.alpha : zAlpha;

			var d = {
				sprite: sprite,
				def: def,
				texWidth: tex.width,
				texHeight: tex.height,
				t: Math.random() * ( def.period || 30 ) * 60,
				prevPh: 0,
				lane: Math.random(),
				baseAlpha: baseAlpha,
				alphaMul: 1,
				scaleMul: 1,
				hidden: !! def.egg,
				egg: !! def.egg,
			};
			sprite.visible = ! d.hidden;
			drifters.push( d );
			return d;
		}

		// Atlas fast path: one HTTP round trip + one texture upload
		// for the whole scene's cut-out set. If the atlas is missing
		// a frame (scene JSON drifted) we transparently fall back to
		// the per-file path for that frame; if the whole atlas 404s
		// we fall back for every frame.
		return loadAtlas( PIXI, slug ).then( function ( sheet ) {
			var jobs = defs.map( function ( def ) {
				var tex = sheet && sheet.textures ? sheet.textures[ def.file ] : null;
				if ( tex ) {
					return Promise.resolve( addSprite( def, tex ) );
				}
				var url = cutoutUrl( slug, def.file );
				return PIXI.Assets.load( url ).then( function ( t ) {
					return addSprite( def, t );
				} ).catch( function ( err ) {
					if ( window.console ) window.console.warn( 'ODD: cutout failed', url, err );
					return null;
				} );
			} );
			return Promise.all( jobs ).then( function () { return drifters; } );
		} );
	}

	function motionUpdate( d, env ) {
		var app = env.app;
		var w = app.renderer.width, hh = app.renderer.height;
		var s = d.sprite;
		var def = d.def;
		d.t += env.dt;
		var T = ( def.period || 30 ) * 60;
		var ph = ( ( d.t % T ) + T ) % T / T;
		var baseScale = ( def.scale || 0.5 ) * d.scaleMul;

		switch ( def.motion ) {
			case 'cross': {
				var dir = def.dir || 'ltr';
				var yN = def.y != null ? def.y : 0.45;
				var fade = Math.sin( Math.min( 1, ph ) * Math.PI );
				if ( dir === 'rtl' ) {
					s.x = w + d.texWidth * baseScale * 0.6 - ph * ( w + d.texWidth * baseScale * 1.2 );
				} else {
					s.x = -d.texWidth * baseScale * 0.6 + ph * ( w + d.texWidth * baseScale * 1.2 );
				}
				s.y = yN * hh + Math.sin( ph * tau ) * ( def.bob || 18 );
				s.rotation = ( def.tilt || 0 ) + Math.sin( ph * tau ) * 0.04;
				s.scale.set( baseScale );
				s.alpha = fade * d.baseAlpha * d.alphaMul;
				break;
			}
			case 'drift': {
				var xN = def.x != null ? def.x : 0.5;
				var yN2 = def.y != null ? def.y : 0.4;
				var ax  = ( def.ax  != null ? def.ax  : 0.35 );
				var ay  = ( def.ay  != null ? def.ay  : 0.05 );
				s.x = w  * xN + Math.cos( ph * tau ) * w * ax;
				s.y = hh * yN2 + Math.sin( ph * tau * 0.7 ) * hh * ay;
				s.rotation = ( def.tilt || 0 ) + Math.sin( d.t * 0.004 ) * 0.03;
				s.scale.set( baseScale );
				s.alpha = d.baseAlpha * d.alphaMul;
				break;
			}
			case 'bob': {
				var bx = def.x != null ? def.x : 0.5;
				var by = def.y != null ? def.y : 0.55;
				s.x = w  * bx + Math.sin( ph * tau * 0.5 ) * ( def.sway || 6 );
				s.y = hh * by + Math.sin( ph * tau ) * ( def.bob || 20 );
				s.rotation = ( def.tilt || 0 ) + Math.sin( ph * tau ) * ( def.wobble || 0.07 );
				s.scale.set( baseScale );
				s.alpha = d.baseAlpha * d.alphaMul;
				break;
			}
			case 'tumble': {
				if ( ph < d.prevPh ) { d.lane = Math.random(); }
				d.prevPh = ph;
				var xLo = def.xMin != null ? def.xMin : 0.1;
				var xHi = def.xMax != null ? def.xMax : 0.9;
				var laneX = xLo + d.lane * ( xHi - xLo );
				s.x = w * laneX + Math.sin( ph * tau * 0.9 ) * ( def.sway || 40 );
				s.y = -d.texHeight * baseScale + ph * ( hh + d.texHeight * baseScale * 2 );
				s.rotation = d.t * ( def.spin || 0.03 );
				s.scale.set( baseScale );
				s.alpha = d.baseAlpha * d.alphaMul;
				break;
			}
			case 'orbit': {
				var cx = w  * ( def.cx != null ? def.cx : 0.5 );
				var cy = hh * ( def.cy != null ? def.cy : 0.5 );
				var rr = ( def.radius || 0.3 ) * Math.min( w, hh );
				var sq = def.squash != null ? def.squash : 0.45;
				s.x = cx + Math.cos( ph * tau ) * rr;
				s.y = cy + Math.sin( ph * tau ) * rr * sq;
				s.rotation = ph * tau * ( def.rotDir || 1 );
				s.scale.set( baseScale );
				s.alpha = d.baseAlpha * d.alphaMul;
				break;
			}
			default: {
				s.x = w * 0.5; s.y = hh * 0.5;
				s.scale.set( baseScale );
				s.alpha = d.baseAlpha * d.alphaMul;
			}
		}
	}

	function tickDrifters( drifters, env ) {
		if ( ! drifters || ! drifters.length ) return;
		var px = env.parallax ? env.parallax.x : 0;
		var py = env.parallax ? env.parallax.y : 0;
		for ( var i = 0; i < drifters.length; i++ ) {
			var d = drifters[ i ];
			if ( d.hidden ) { d.sprite.visible = false; continue; }
			d.sprite.visible = true;
			motionUpdate( d, env );
			// Cheap depth-weighted parallax. `far` barely moves,
			// `near` moves most. Scenes can override with def.parallax.
			var base = d.def.parallax != null
				? d.def.parallax
				: ( d.def.z === 'near' ? 24 : d.def.z === 'far' ? 6 : 14 );
			if ( base && ! env.reducedMotion ) {
				d.sprite.x += px * base;
				d.sprite.y += py * base * 0.5;
			}
		}
	}

	function showEggDrifter( drifters, file, opts ) {
		opts = opts || {};
		for ( var i = 0; i < drifters.length; i++ ) {
			var d = drifters[ i ];
			if ( d.def.file === file ) {
				d.hidden = false;
				d.alphaMul = opts.alphaMul != null ? opts.alphaMul : 1;
				d.scaleMul = opts.scaleMul != null ? opts.scaleMul : 1;
				d.t = opts.resetT ? 0 : d.t;
				return d;
			}
		}
		return null;
	}

	function hideEggDrifter( drifters, file ) {
		for ( var i = 0; i < drifters.length; i++ ) {
			var d = drifters[ i ];
			if ( d.def.file === file ) {
				d.hidden = true;
				d.alphaMul = 1;
				d.scaleMul = 1;
				d.sprite.visible = false;
				return;
			}
		}
	}

	// ============================================================ //
	// Shared drifter library — cutouts any scene can pull from.
	//
	// Today each scene declares its own cutouts in scenes.json under
	// assets/cutouts/<slug>/*. As the scene count grows, several
	// motifs recur (a falling leaf, a lone comet, a paper lantern, a
	// crow, a firefly swarm). The shared library lives in
	// src/drifters.json + assets/drifters/*, and any scene can
	// consume it via h.mountSharedDrifters(app, PIXI, [...], fg).
	// This also lets the seasonal overlay spawn drifters from a
	// single canonical source without duplicating per-scene.
	// ============================================================ //

	var SHARED_DRIFTERS = null;
	function sharedDriftersUrl() {
		var base = window.__odd.config ? window.__odd.config.pluginUrl : '';
		var ver  = window.__odd.config ? window.__odd.config.version   : '';
		var qs   = ver ? '?v=' + encodeURIComponent( ver ) : '';
		return base + '/src/drifters.json' + qs;
	}
	function loadSharedDrifters() {
		if ( SHARED_DRIFTERS ) return Promise.resolve( SHARED_DRIFTERS );
		return window.fetch( sharedDriftersUrl() )
			.then( function ( r ) { return r.ok ? r.json() : {}; } )
			.then( function ( data ) {
				SHARED_DRIFTERS = ( data && typeof data === 'object' ) ? data : {};
				return SHARED_DRIFTERS;
			} )
			.catch( function () { SHARED_DRIFTERS = {}; return SHARED_DRIFTERS; } );
	}
	function sharedDrifterUrl( file ) {
		var base = window.__odd.config ? window.__odd.config.pluginUrl : '';
		var ver  = window.__odd.config ? window.__odd.config.version   : '';
		var qs   = ver ? '?v=' + encodeURIComponent( ver ) : '';
		return base + '/assets/drifters/' + file + qs;
	}
	// Pick N drifters from the shared library that are tagged
	// `weird: true`. Returns an array of NAMES suitable for
	// mountSharedDrifters(). If you exclude(['x','y']) those names,
	// they'll be skipped — useful for scenes that have a thematic
	// reason to opt out.
	function pickWeird( count, exclude ) {
		return loadSharedDrifters().then( function ( lib ) {
			var skip = {};
			( exclude || [] ).forEach( function ( n ) { skip[ n ] = true; } );
			var pool = Object.keys( lib ).filter( function ( name ) {
				return lib[ name ] && lib[ name ].weird && ! skip[ name ];
			} );
			// Fisher-Yates partial shuffle, take first `count`.
			for ( var i = pool.length - 1; i > 0; i-- ) {
				var j = ( Math.random() * ( i + 1 ) ) | 0;
				var tmp = pool[ i ]; pool[ i ] = pool[ j ]; pool[ j ] = tmp;
			}
			return pool.slice( 0, Math.max( 0, count | 0 ) );
		} );
	}

	function mountSharedDrifters( app, PIXI, names, fg ) {
		return loadSharedDrifters().then( function ( lib ) {
			var defs = ( names || [] )
				.map( function ( n ) { return lib[ n ]; } )
				.filter( function ( d ) { return !! d; } );
			if ( ! defs.length ) return [];

			var far  = new PIXI.Container(); fg.addChild( far );
			var mid  = new PIXI.Container(); fg.addChild( mid );
			var near = new PIXI.Container(); fg.addChild( near );
			var bins = { far: far, mid: mid, near: near };
			var hasBlur = !! PIXI.BlurFilter;

			var drifters = [];
			var jobs = defs.map( function ( def ) {
				var url = sharedDrifterUrl( def.file );
				return PIXI.Assets.load( url ).then( function ( tex ) {
					var sprite = new PIXI.Sprite( tex );
					sprite.anchor.set( 0.5 );
					( bins[ def.z || 'mid' ] || mid ).addChild( sprite );
					if ( hasBlur ) {
						var defaultBlur = def.z === 'far' ? 2.2 : def.z === 'near' ? 0 : 0.6;
						var bAmt = def.blur != null ? def.blur : defaultBlur;
						if ( bAmt > 0 ) {
							sprite.filters = [ new PIXI.BlurFilter( { strength: bAmt, quality: 2 } ) ];
						}
					}
					var zAlpha = def.z === 'far' ? 0.55 : def.z === 'near' ? 0.95 : 0.80;
					var baseAlpha = def.alpha != null ? def.alpha : zAlpha;
					var d = {
						sprite: sprite,
						def: def,
						texWidth: tex.width,
						texHeight: tex.height,
						t: Math.random() * ( def.period || 30 ) * 60,
						prevPh: 0,
						lane: Math.random(),
						baseAlpha: baseAlpha,
						alphaMul: 1,
						scaleMul: 1,
						hidden: false,
						egg: false,
					};
					drifters.push( d );
					return d;
				} ).catch( function ( err ) {
					if ( window.console ) window.console.warn( 'ODD: shared drifter failed', url, err );
					return null;
				} );
			} );
			return Promise.all( jobs ).then( function () { return drifters; } );
		} );
	}

	// ============================================================ //
	// Environmental mechanics — time-of-day, season, perf tier.
	//
	// These are exposed on `env` every tick so scenes can opt in.
	// Scenes that don't read them are unaffected.
	// ============================================================ //

	function computeTod( date ) {
		date = date || new Date();
		var h = date.getHours() + date.getMinutes() / 60;
		var tod, phase;
		if ( h >= 5 && h < 7 )        { tod = 'dawn';  phase = ( h - 5  ) / 2;  }
		else if ( h >= 7 && h < 17 )  { tod = 'day';   phase = ( h - 7  ) / 10; }
		else if ( h >= 17 && h < 20 ) { tod = 'dusk';  phase = ( h - 17 ) / 3;  }
		else                          { tod = 'night'; phase = h < 5 ? ( h + 4 ) / 9 : ( h - 20 ) / 9; }
		return { tod: tod, phase: phase };
	}

	function computeSeason( date ) {
		date = date || new Date();
		var m = date.getMonth() + 1, d = date.getDate();
		// Hard-coded edge windows first so they win over the base season.
		if ( m === 10 && d >= 25 ) return 'halloween';
		if ( ( m === 12 && d >= 28 ) || ( m === 1 && d <= 2 ) ) return 'newYear';
		if ( m >= 3 && m <= 5  ) return 'spring';
		if ( m >= 6 && m <= 8  ) return 'summer';
		if ( m >= 9 && m <= 11 ) return 'autumn';
		return 'winter';
	}

	window.__odd.helpers = {
		rand: rand, irand: irand, choose: choose, clamp: clamp, tau: tau,
		lerpColor: lerpColor, paintVGradient: paintVGradient, makeBloomLayer: makeBloomLayer,
		mountCutouts: mountCutouts, tickDrifters: tickDrifters,
		showEggDrifter: showEggDrifter, hideEggDrifter: hideEggDrifter,
		mountSharedDrifters: mountSharedDrifters,
		pickWeird: pickWeird,
		computeTod: computeTod, computeSeason: computeSeason,
	};

	// ============================================================ //
	// Hydrated config from wp_localize_script.
	// ============================================================ //

	var cfg = window.odd || {};
	var PLUGIN_URL = cfg.pluginUrl || '';
	var VERSION    = cfg.version   || '0';
	var VER_QS     = VERSION ? '?v=' + encodeURIComponent( VERSION ) : '';
	var SCENES     = Array.isArray( cfg.scenes ) ? cfg.scenes : [];
	var SCENE_MAP  = {};
	for ( var si = 0; si < SCENES.length; si++ ) SCENE_MAP[ SCENES[ si ].slug ] = SCENES[ si ];

	function assetUrl( rel ) {
		return PLUGIN_URL + '/' + rel.replace( /^\/+/, '' ) + VER_QS;
	}

	function defaultScene() {
		if ( SCENE_MAP[ 'flux' ] ) return 'flux';
		return SCENES.length ? SCENES[ 0 ].slug : '';
	}

	function previewBg( slug ) {
		var s = SCENE_MAP[ slug ] || {};
		var url = assetUrl( 'assets/previews/' + slug + '.webp' );
		return "url(\"" + url + "\") center/cover no-repeat, " + ( s.fallbackColor || '#111' );
	}

	// ============================================================ //
	// loadScript — idempotent <script src> injection.
	// ============================================================ //

	var loading = {};
	function loadScript( url ) {
		if ( loading[ url ] ) return loading[ url ];
		loading[ url ] = new Promise( function ( resolve, reject ) {
			var s = document.createElement( 'script' );
			s.src = url;
			s.async = true;
			s.onload = function () { resolve(); };
			s.onerror = function () {
				delete loading[ url ];
				reject( new Error( 'Failed to load ' + url ) );
			};
			document.head.appendChild( s );
		} );
		return loading[ url ];
	}

	function loadScene( slug ) {
		if ( window.__odd.scenes[ slug ] ) return Promise.resolve();
		return loadScript( assetUrl( 'src/scenes/' + slug + '.js' ) ).then( function () {
			if ( ! window.__odd.scenes[ slug ] ) {
				throw new Error( 'Scene did not self-register: ' + slug );
			}
		} );
	}

	function loadPicker() {
		if ( window.__odd.picker && typeof window.__odd.picker.open === 'function' ) {
			return Promise.resolve( window.__odd.picker );
		}
		return loadScript( assetUrl( 'src/picker.js' ) ).then( function () {
			if ( ! window.__odd.picker || typeof window.__odd.picker.open !== 'function' ) {
				throw new Error( 'Picker did not self-register' );
			}
			return window.__odd.picker;
		} );
	}

	function loadEasterEggs() {
		if ( window.__odd.eggs && window.__odd.eggs._installed ) {
			return Promise.resolve( window.__odd.eggs );
		}
		return loadScript( assetUrl( 'src/easter-eggs.js' ) ).then( function () {
			return window.__odd.eggs;
		} );
	}

	function loadAudio() {
		if ( window.__odd.audio && window.__odd.audio._installed ) {
			return Promise.resolve( window.__odd.audio );
		}
		return loadScript( assetUrl( 'src/audio.js' ) ).then( function () {
			return window.__odd.audio;
		} );
	}

	// ============================================================ //
	// Prefs — one REST round trip per patch; localStorage fallback.
	// ============================================================ //

	var LS_KEY = 'odd:prefs:v1';
	function coerceShuffle( raw ) {
		raw = raw || {};
		var mins = parseInt( raw.minutes, 10 );
		if ( ! isFinite( mins ) || mins < 1 ) mins = 15;
		if ( mins > 240 ) mins = 240;
		return { enabled: !! raw.enabled, minutes: mins };
	}
	var prefsState = {
		scene: cfg.scene || defaultScene(),
		favorites: Array.isArray( cfg.favorites ) ? cfg.favorites.slice() : [],
		recents: Array.isArray( cfg.recents ) ? cfg.recents.slice() : [],
		// v0.10: shuffle cycles the wallpaper through favorites
		// every N minutes. Mirrored in odd_shuffle user meta.
		shuffle: coerceShuffle( cfg.shuffle ),
		// v0.10: whether audio-reactive mode is desired. The actual
		// mic permission prompt still runs on an explicit user
		// gesture in the picker — this is just the remembered intent.
		audioReactive: !! cfg.audioReactive,
	};
	// Hydrate from localStorage only if the server didn't give us anything useful.
	try {
		var lsRaw = window.localStorage && window.localStorage.getItem( LS_KEY );
		if ( lsRaw ) {
			var ls = JSON.parse( lsRaw );
			if ( ls && typeof ls === 'object' ) {
				if ( ! cfg.scene && typeof ls.scene === 'string' && SCENE_MAP[ ls.scene ] ) prefsState.scene = ls.scene;
				if ( ( ! Array.isArray( cfg.favorites ) || ! cfg.favorites.length ) && Array.isArray( ls.favorites ) ) prefsState.favorites = ls.favorites.filter( function ( s ) { return !! SCENE_MAP[ s ]; } );
				if ( ( ! Array.isArray( cfg.recents ) || ! cfg.recents.length ) && Array.isArray( ls.recents ) ) prefsState.recents = ls.recents.filter( function ( s ) { return !! SCENE_MAP[ s ]; } );
				if ( cfg.shuffle == null && ls.shuffle ) prefsState.shuffle = coerceShuffle( ls.shuffle );
				if ( cfg.audioReactive == null && typeof ls.audioReactive === 'boolean' ) prefsState.audioReactive = ls.audioReactive;
			}
		}
	} catch ( e ) { /* ignore */ }

	function mirrorToLS() {
		try {
			window.localStorage && window.localStorage.setItem( LS_KEY, JSON.stringify( prefsState ) );
		} catch ( e ) { /* storage full / disabled — ignore */ }
	}

	function savePrefs( patch ) {
		Object.keys( patch ).forEach( function ( k ) { prefsState[ k ] = patch[ k ]; } );
		mirrorToLS();
		if ( ! cfg.restUrl ) return Promise.resolve( prefsState );
		return fetch( cfg.restUrl, {
			method: 'POST',
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': cfg.restNonce || '',
			},
			body: JSON.stringify( patch ),
		} ).then( function ( r ) {
			if ( ! r.ok ) throw new Error( 'prefs save failed: ' + r.status );
			return r.json();
		} ).catch( function ( err ) {
			if ( window.console ) window.console.warn( 'ODD: prefs save deferred to localStorage', err );
			return prefsState;
		} );
	}

	function recordRecent( slug ) {
		var next = [ slug ].concat( prefsState.recents.filter( function ( s ) { return s !== slug; } ) );
		if ( next.length > 12 ) next = next.slice( 0, 12 );
		return savePrefs( { recents: next } );
	}

	function toggleFavorite( slug ) {
		var have = prefsState.favorites.indexOf( slug ) !== -1;
		var next = have ? prefsState.favorites.filter( function ( s ) { return s !== slug; } ) : prefsState.favorites.concat( [ slug ] );
		if ( next.length > 50 ) next = next.slice( 0, 50 );
		return savePrefs( { favorites: next } );
	}

	window.__odd.prefs = {
		get: function () { return prefsState; },
		save: savePrefs,
		recordRecent: recordRecent,
		toggleFavorite: toggleFavorite,
	};

	window.__odd.config = {
		pluginUrl: PLUGIN_URL,
		version:   VERSION,
		assetUrl:  assetUrl,
		previewBg: previewBg,
		scenes:    SCENES,
		sceneMap:  SCENE_MAP,
	};

	// ============================================================ //
	// Shared mount runner — one Pixi app, swap scenes in place.
	// ============================================================ //

	function mountODD( container, ctx ) {
		return (async function () {
			// ---------- Instant first-paint backdrop ---------- //
			// A plain DOM <img> under the Pixi canvas. Shows the
			// painted JPG immediately (usually <100 ms) so the user
			// never sees a blank frame while Pixi boots or while a
			// new scene's setup() is async-loading textures.
			var firstPaint = document.createElement( 'div' );
			firstPaint.setAttribute( 'data-odd-firstpaint', '' );
			firstPaint.style.cssText =
				'position:absolute;inset:0;background-size:cover;' +
				'background-position:center;background-repeat:no-repeat;' +
				'transition:opacity .4s ease;opacity:1;pointer-events:none;';
			container.appendChild( firstPaint );
			function setFirstPaint( slug ) {
				var url = assetUrl( 'assets/wallpapers/' + slug + '.webp' );
				firstPaint.style.backgroundImage = 'url("' + url + '")';
			}

			var PIXI = window.PIXI;
			var app  = new PIXI.Application();
			await app.init( {
				resizeTo: container,
				backgroundAlpha: 0,
				antialias: true,
				resolution: Math.min( 2, window.devicePixelRatio || 1 ),
				autoDensity: true,
			} );
			container.appendChild( app.canvas );
			app.canvas.style.position = 'absolute';
			app.canvas.style.inset = '0';
			app.canvas.style.width = '100%';
			app.canvas.style.height = '100%';

			// ARIA live region: a visually-hidden status node appended
			// to document.body so scene changes are announced by
			// assistive tech ("Now playing: Neon Rain"). Polite so it
			// never interrupts active reading.
			var live = document.createElement( 'div' );
			live.setAttribute( 'data-odd-live', '' );
			live.setAttribute( 'role', 'status' );
			live.setAttribute( 'aria-live', 'polite' );
			live.setAttribute( 'aria-atomic', 'true' );
			live.style.cssText =
				'position:absolute;width:1px;height:1px;margin:-1px;' +
				'padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);' +
				'clip-path:inset(50%);white-space:nowrap;';
			document.body.appendChild( live );
			function announce( slug ) {
				var s = SCENE_MAP[ slug ];
				if ( ! s ) return;
				live.textContent = 'Now playing: ' + ( s.label || slug );
			}

			// Env — the single object passed to every scene hook. New
			// optional fields (tod, season, audio, perfTier, shuffle)
			// are always populated so scenes can read them without
			// null-guards. Scenes that don't care are unaffected.
			var initTod = computeTod();
			var env = {
				app: app, PIXI: PIXI, ctx: ctx,
				helpers: window.__odd.helpers,
				// Normalized mouse offset from the center of the
				// canvas, -1..1 on each axis. Scenes read this via
				// h.tickDrifters() for cheap parallax. Listeners
				// live on window (canvas + container are pointer-
				// events: none in WP Desktop Mode).
				parallax: { x: 0, y: 0 },
				reducedMotion: !! ctx.prefersReducedMotion,
				// Time-of-day + season. `tod` is one of dawn/day/
				// dusk/night; `todPhase` is a 0..1 progress through
				// the current band. Refreshed in stepFactory.
				tod: initTod.tod,
				todPhase: initTod.phase,
				season: computeSeason(),
				// Audio-reactive analyser output. Zero until the
				// user grants mic access via the picker toggle.
				audio: { level: 0, bass: 0, mid: 0, high: 0, enabled: false },
				// Auto-dim tier: 'high' on fast machines, 'low' when
				// sustained framerate drops below ~40fps. Scenes may
				// halve particle counts / disable bloom at 'low'.
				perfTier: 'high',
			};
			// Smoothed target so rapid mouse movement doesn't jitter.
			var parallaxTarget = { x: 0, y: 0 };
			function onPointerMove( ev ) {
				var r = container.getBoundingClientRect();
				if ( ! r.width || ! r.height ) return;
				parallaxTarget.x = ( ( ev.clientX - r.left ) / r.width  - 0.5 ) * 2;
				parallaxTarget.y = ( ( ev.clientY - r.top )  / r.height - 0.5 ) * 2;
			}
			window.addEventListener( 'pointermove', onPointerMove, { passive: true } );

			var currentSlug = null;
			var currentImpl = null;
			var currentState = null;
			var currentTick = null;
			var swapping = false;
			// Chaos cast — a small handful of weird transparent drifters
			// (rubber chicken, flying toaster, cow abduction, etc.)
			// painted ABOVE the active scene's content. Sources from
			// the shared drifter library at src/drifters.json (entries
			// tagged `weird: true`). Two per swap by default; tweak
			// live with `__odd.setChaos(n)` from devtools.
			var chaosFg = null;
			var chaosDrifters = [];
			var chaosCount = 2;
			// If hover previews fire faster than scenes can load,
			// we keep the LATEST requested slug here and drain it
			// right after the current swap finishes. Only the last
			// target matters — intermediate hops are discarded.
			var pendingSlug = null;
			function drainPending() {
				if ( pendingSlug && pendingSlug !== currentSlug ) {
					var next = pendingSlug;
					pendingSlug = null;
					swap( next );
				} else {
					pendingSlug = null;
				}
			}

			// Rolling frame-time buffer for the perf auto-dim tier.
			// Separate from the ticker's internal EMA because we want
			// ~2s of sustained slowness before de-rating scenes, not
			// a jitter-sensitive instantaneous read.
			var frameTimes = [];
			var FRAME_BUF  = 120;
			var slowSince  = 0;
			// Time-of-day cache — only recompute once per minute.
			var todStamp   = 0;
			function refreshTod( now ) {
				if ( now - todStamp < 60000 ) return;
				todStamp = now;
				var t = computeTod();
				env.tod      = t.tod;
				env.todPhase = t.phase;
			}
			function stepFactory( impl, state ) {
				return function ( ticker ) {
					env.dt = Math.min( 2.5, ticker.deltaTime );
					// Ease parallax toward the target at ~12% / frame,
					// so tick consumers see a smoothed value.
					env.parallax.x += ( parallaxTarget.x - env.parallax.x ) * 0.12;
					env.parallax.y += ( parallaxTarget.y - env.parallax.y ) * 0.12;

					// --- Perf sampler ---------------------------- //
					var dms = ticker.deltaMS != null ? ticker.deltaMS : 16.7;
					frameTimes.push( dms );
					if ( frameTimes.length > FRAME_BUF ) frameTimes.shift();
					if ( frameTimes.length === FRAME_BUF ) {
						var sum = 0;
						for ( var fi = 0; fi < frameTimes.length; fi++ ) sum += frameTimes[ fi ];
						var avg = sum / frameTimes.length;
						var now = Date.now();
						if ( avg > 25 ) {
							if ( slowSince === 0 ) slowSince = now;
							if ( now - slowSince > 2000 ) env.perfTier = 'low';
						} else {
							slowSince = 0;
							env.perfTier = avg < 14 ? 'high' : 'normal';
						}
						refreshTod( now );
					}

					// --- Audio analyser (if enabled) ------------- //
					if ( window.__odd.audio && window.__odd.audio.sample ) {
						window.__odd.audio.sample( env.audio );
					}
					if ( impl.onAudio && env.audio && env.audio.enabled ) {
						try { impl.onAudio( state, env ); } catch ( e ) { /* ignore */ }
					}

					if ( impl.tick ) impl.tick( state, env );

					// Chaos drifters live above the scene and animate
					// off the same env.dt the scene already used, so
					// they share the smoothed parallax / reducedMotion
					// state without any extra plumbing.
					if ( chaosDrifters.length ) {
						tickDrifters( chaosDrifters, env );
					}
				};
			}
			function onResize() {
				if ( currentImpl && currentImpl.onResize ) {
					currentImpl.onResize( currentState, env );
				}
			}
			app.renderer.on( 'resize', onResize );

			// Color-aware OS accent. We sample the active backdrop
			// once per scene, produce a single vivid RGB, and push it
			// into `--wp-admin-theme-color` so the Dock / Admin Bar /
			// focus rings tint to match the wallpaper. Saturated
			// pixels are weighted more heavily so a painterly
			// backdrop with dark corners still yields a bright,
			// on-brand hue rather than a muddy average.
			var accentCache = {};
			var originalAccent = document.documentElement.style.getPropertyValue( '--wp-admin-theme-color' );
			function sampleAccent( slug ) {
				if ( accentCache[ slug ] ) return Promise.resolve( accentCache[ slug ] );
				var url = assetUrl( 'assets/wallpapers/' + slug + '.webp' );
				return new Promise( function ( resolve ) {
					var img = new window.Image();
					img.onload = function () {
						try {
							var W = 32, H = 32;
							var c = document.createElement( 'canvas' );
							c.width = W; c.height = H;
							var g = c.getContext( '2d' );
							if ( ! g ) { resolve( null ); return; }
							g.drawImage( img, 0, 0, W, H );
							var data = g.getImageData( 0, 0, W, H ).data;
							var sumR = 0, sumG = 0, sumB = 0, totalW = 0;
							for ( var i = 0; i < data.length; i += 4 ) {
								var r = data[ i ], gg = data[ i + 1 ], b = data[ i + 2 ];
								var mx = Math.max( r, gg, b ), mn = Math.min( r, gg, b );
								var sat = mx === 0 ? 0 : ( mx - mn ) / mx;
								var bri = mx / 255;
								// Favor vivid mid-bright pixels. Dark
								// corners and washed-out sky are both
								// suppressed.
								var w = sat * ( 0.35 + bri * 0.65 );
								if ( w <= 0 ) continue;
								sumR += r * w; sumG += gg * w; sumB += b * w;
								totalW += w;
							}
							if ( totalW <= 0 ) { resolve( null ); return; }
							var R = Math.round( sumR / totalW );
							var G = Math.round( sumG / totalW );
							var B = Math.round( sumB / totalW );
							// Clamp brightness into a usable range so
							// very dark or very pale hues still give a
							// readable accent color.
							var L = ( 0.299 * R + 0.587 * G + 0.114 * B ) / 255;
							var target = L < 0.35 ? 0.45 : L > 0.75 ? 0.60 : L;
							var k = target / Math.max( 0.05, L );
							R = Math.min( 255, Math.round( R * k ) );
							G = Math.min( 255, Math.round( G * k ) );
							B = Math.min( 255, Math.round( B * k ) );
							var css = 'rgb(' + R + ',' + G + ',' + B + ')';
							accentCache[ slug ] = css;
							resolve( css );
						} catch ( e ) { resolve( null ); }
					};
					img.onerror = function () { resolve( null ); };
					img.src = url;
				} );
			}
			function applyAccent( slug ) {
				sampleAccent( slug ).then( function ( css ) {
					if ( ! css ) return;
					// Push to both a public custom prop (for scenes /
					// picker to consume) and the WP Admin chrome var
					// so the Dock + Admin Bar tint to match.
					document.documentElement.style.setProperty( '--odd-accent', css );
					document.documentElement.style.setProperty( '--wp-admin-theme-color', css );
				} );
			}

			// Crossfade helper: take a pixel snapshot of the current
			// canvas, overlay it on top of the container, then let
			// the caller run teardown + setup underneath. Once the
			// new scene has rendered its first frame, the snapshot
			// fades out over ~350 ms and is removed. No scene code
			// changes needed. Respects prefersReducedMotion.
			function snapshotOverlay() {
				if ( env.reducedMotion ) return null;
				var src = app.canvas;
				if ( ! src || ! src.width || ! src.height ) return null;
				try {
					var snap = document.createElement( 'canvas' );
					snap.width  = src.width;
					snap.height = src.height;
					var g = snap.getContext( '2d' );
					if ( ! g ) return null;
					g.drawImage( src, 0, 0 );
					snap.style.cssText =
						'position:absolute;inset:0;width:100%;height:100%;' +
						'pointer-events:none;opacity:1;' +
						'transition:opacity .38s cubic-bezier(.2,.8,.2,1);';
					container.appendChild( snap );
					return snap;
				} catch ( e ) {
					return null;
				}
			}
			function fadeAndRemove( node ) {
				if ( ! node ) return;
				// Two rAFs so the new scene has time to paint a frame
				// before the snapshot starts fading.
				window.requestAnimationFrame( function () {
					window.requestAnimationFrame( function () {
						node.style.opacity = '0';
						setTimeout( function () {
							if ( node.parentNode ) node.parentNode.removeChild( node );
						}, 420 );
					} );
				} );
			}

			// Run an optional scene `transitionOut` hook against the
			// still-mounted outgoing Pixi stage. Resolves when the
			// scene calls `done` or after a hard timeout. Reduced-
			// motion skips outros entirely so switches stay snappy.
			function runTransitionOut( prev ) {
				if ( env.reducedMotion ) return Promise.resolve();
				if ( ! prev || ! prev.impl || typeof prev.impl.transitionOut !== 'function' ) {
					return Promise.resolve();
				}
				return new Promise( function ( resolve ) {
					var settled = false;
					var fallback = setTimeout( function () {
						if ( settled ) return;
						settled = true;
						resolve();
					}, 1100 );
					try {
						prev.impl.transitionOut( prev.state, env, function () {
							if ( settled ) return;
							settled = true;
							clearTimeout( fallback );
							resolve();
						} );
					} catch ( e ) {
						if ( settled ) return;
						settled = true;
						clearTimeout( fallback );
						resolve();
					}
				} );
			}

			async function swap( nextSlug ) {
				if ( swapping ) {
					// Latest requester wins; coalesce hover previews.
					pendingSlug = nextSlug;
					return { ok: false, error: new Error( 'queued' ) };
				}
				if ( nextSlug === currentSlug ) return { ok: true };
				if ( ! SCENE_MAP[ nextSlug ] ) return { ok: false, error: new Error( 'unknown scene: ' + nextSlug ) };
				swapping = true;
				var prev = {
					slug: currentSlug, impl: currentImpl, state: currentState, tick: currentTick,
				};
				var crossfadeNode = null;
				try {
					await loadScene( nextSlug );
					var impl = window.__odd.scenes[ nextSlug ];
					if ( ! impl || typeof impl.setup !== 'function' ) {
						throw new Error( 'Scene impl missing: ' + nextSlug );
					}

					// If the outgoing scene has a signature outro,
					// play it against the still-live stage before
					// we snapshot + teardown.
					await runTransitionOut( prev );

					// Snapshot BEFORE teardown so we cover the blank
					// window while the next scene's setup is running.
					if ( prev.impl ) crossfadeNode = snapshotOverlay();

					// Swap the first-paint JPG too, so if the new
					// scene's setup is very slow, the backdrop is at
					// least the correct one under the snapshot.
					setFirstPaint( nextSlug );
					// Fire-and-forget accent sampling. Cached per
					// slug so subsequent hover previews reuse the
					// same computed hue.
					applyAccent( nextSlug );

					if ( prev.impl ) {
						if ( prev.tick ) app.ticker.remove( prev.tick );
						try {
							if ( prev.impl.cleanup ) prev.impl.cleanup( prev.state, env );
						} catch ( e ) {
							if ( window.console ) window.console.warn( 'ODD: cleanup threw', e );
						}
					}
					app.stage.removeChildren();
					// removeChildren already disposed chaosFg; clear
					// the drifter list so the existing tick stops
					// poking destroyed sprites until a new cast is
					// asynchronously mounted below.
					chaosFg = null;
					chaosDrifters = [];
					// Reset the perf window so the new scene gets a
					// fair couple of seconds before we potentially
					// mark it low-perf from prior jank.
					frameTimes = [];
					slowSince = 0;

					var state = await impl.setup( env );
					var tick = stepFactory( impl, state );
					currentImpl = impl;
					currentState = state;
					currentTick = tick;
					currentSlug = nextSlug;

					// ---- Chaos cast (weird drifters above scene) ----
					// Mount AFTER setup so the new container sits on
					// top of every layer the scene added. Async — we
					// don't block the swap on it; the chaos just pops
					// in a frame later, which is fine.
					var skipChaos = (
						chaosCount <= 0 ||
						env.reducedMotion ||
						( impl && impl.skipChaos === true ) ||
						( state && state.skipChaos === true )
					);
					if ( ! skipChaos ) {
						var fg = new PIXI.Container();
						app.stage.addChild( fg );
						chaosFg = fg;
						( function ( forFg, forSlug ) {
							pickWeird( chaosCount ).then( function ( names ) {
								return mountSharedDrifters( app, PIXI, names, forFg );
							} ).then( function ( drifters ) {
								// Stale-mount guard: another swap may have
								// fired before the async mount resolved.
								if ( forFg !== chaosFg || forSlug !== currentSlug ) {
									if ( forFg && forFg.parent ) forFg.parent.removeChild( forFg );
									return;
								}
								chaosDrifters = ( drifters || [] ).filter( Boolean );
							} ).catch( function () { /* non-fatal */ } );
						} )( fg, nextSlug );
					}

					// Let the new scene play a signature intro.
					// Transitions are fire-and-forget; we don't
					// block the ticker on them.
					if ( ! env.reducedMotion && typeof impl.transitionIn === 'function' ) {
						try { impl.transitionIn( state, env ); } catch ( e ) { /* ignore */ }
					}

					if ( ctx.prefersReducedMotion ) {
						// Still-life: each scene can paint a
						// hand-picked beautiful moment rather than
						// the raw first-frame of its tick loop.
						env.dt = 0;
						if ( typeof impl.stillFrame === 'function' ) {
							try { impl.stillFrame( state, env ); } catch ( e ) { /* ignore */ }
						} else if ( impl.tick ) {
							impl.tick( state, env );
						}
						app.ticker.stop();
					} else {
						app.ticker.add( tick );
						app.ticker.start();
					}
					if ( window.__odd.eggs && window.__odd.eggs.setActive ) {
						window.__odd.eggs.setActive( nextSlug, state, env, container );
					}
					swapping = false;
					fadeAndRemove( crossfadeNode );
					announce( nextSlug );
					drainPending();
					return { ok: true };
				} catch ( err ) {
					if ( window.console ) window.console.error( 'ODD: swap failed', nextSlug, err );
					// Don't leave a stale snapshot on top of a working
					// scene if swap failed after we took one.
					if ( crossfadeNode && crossfadeNode.parentNode ) {
						crossfadeNode.parentNode.removeChild( crossfadeNode );
					}
					swapping = false;
					drainPending();
					return { ok: false, error: err };
				}
			}

			// ---------- Scene-picker trigger (DOM, not Pixi) ---------- //
			//
			// WP Desktop Mode applies `pointer-events: none` to the wallpaper
			// container (assets/css/desktop.css, .wp-desktop-wallpaper), so
			// anything rendered *inside* the Pixi canvas can never receive
			// clicks. The trigger therefore lives as a DOM element appended
			// to document.body with a max z-index, where it's guaranteed to
			// be above the OS chrome and clickable regardless of what the
			// wallpaper layer sets.
			//
			// Keyboard shortcut: `?` toggles the picker from anywhere.
			// Escape hatch:     `window.__odd.openPicker()` from devtools.

			if ( ! document.getElementById( 'odd-gear-style' ) ) {
				var gearStyle = document.createElement( 'style' );
				gearStyle.id = 'odd-gear-style';
				gearStyle.textContent =
					// In-canvas scene gear is hidden — the ODD Control
					// Panel (native window opened by the floating gear
					// pill in odd/src/gear.js) is the canonical scene
					// picker surface now. Phase 4 removes this mount
					// entirely once the panel owns the picker UI.
					'[data-odd-scene-gear]{display:none!important}' +
					'[data-odd-scene-gear],[data-odd-cam]{' +
						'position:fixed;bottom:24px;z-index:2147483647;' +
						'width:44px;height:44px;padding:0;border-radius:50%;' +
						'display:flex;align-items:center;justify-content:center;' +
						'cursor:pointer;outline:none;' +
						'color:#fff;' +
						'background:rgba(18,18,22,.72);' +
						'border:1px solid rgba(255,255,255,.35);' +
						'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
						'box-shadow:0 6px 18px rgba(0,0,0,.35);' +
						'opacity:.85;' +
						'transition:opacity .18s ease,transform .18s ease,background .18s ease;' +
					'}' +
					'[data-odd-scene-gear]{right:24px}' +
					'[data-odd-cam]{right:78px}' +
					'[data-odd-scene-gear]:hover,[data-odd-cam]:hover{' +
						'opacity:1;transform:translateY(-1px) scale(1.04);' +
						'background:rgba(28,28,34,.9);' +
					'}' +
					'[data-odd-scene-gear]:active,[data-odd-cam]:active{transform:scale(.96)}' +
					'[data-odd-scene-gear] svg{transition:transform 1.2s ease}' +
					'[data-odd-scene-gear]:hover svg{transform:rotate(60deg)}' +
					'[data-odd-cam] svg{transition:transform .3s ease}' +
					'[data-odd-cam]:active svg{transform:scale(.86)}' +
					'[data-odd-flash]{' +
						'position:fixed;inset:0;z-index:2147483646;' +
						'background:#fff;opacity:0;pointer-events:none;' +
						'transition:opacity .18s ease-out;' +
					'}' +
					'[data-odd-flash][data-on="1"]{opacity:.85;transition:opacity .04s ease-in}' +
					'[data-odd-toast]{' +
						'position:fixed;left:50%;bottom:96px;' +
						'transform:translate(-50%,8px);z-index:2147483647;' +
						'padding:10px 16px;border-radius:12px;' +
						'font:500 13px/1.3 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;' +
						'color:#fff;background:rgba(18,18,22,.92);' +
						'border:1px solid rgba(255,255,255,.18);' +
						'box-shadow:0 10px 30px rgba(0,0,0,.45);' +
						'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
						'pointer-events:none;opacity:0;white-space:nowrap;' +
						'transition:opacity .2s ease,transform .2s ease;' +
					'}' +
					'[data-odd-toast][data-show="1"]{opacity:1;transform:translate(-50%,0)}' +
					'[data-odd-tooltip]{' +
						'position:fixed;right:132px;bottom:32px;z-index:2147483647;' +
						'padding:8px 12px;border-radius:10px;' +
						'font:500 13px/1.3 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;' +
						'color:#fff;background:rgba(18,18,22,.92);' +
						'border:1px solid rgba(255,255,255,.18);' +
						'box-shadow:0 6px 18px rgba(0,0,0,.35);' +
						'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
						'pointer-events:none;white-space:nowrap;' +
						'opacity:0;transform:translateX(6px);' +
						'transition:opacity .25s ease,transform .25s ease;' +
					'}' +
					'[data-odd-tooltip][data-show="1"]{opacity:1;transform:translateX(0)}' +
					'[data-odd-tooltip] kbd{' +
						'display:inline-block;margin-left:6px;padding:1px 6px;' +
						'font:600 11px/1 ui-monospace,SFMono-Regular,monospace;' +
						'border-radius:5px;background:rgba(255,255,255,.12);' +
						'border:1px solid rgba(255,255,255,.22);' +
					'}';
				document.head.appendChild( gearStyle );
			}

			// Singleton — remove any previous trigger before mounting.
			var prevGear = document.querySelector( '[data-odd-scene-gear]' );
			if ( prevGear && prevGear.parentNode ) prevGear.parentNode.removeChild( prevGear );
			var prevCam = document.querySelector( '[data-odd-cam]' );
			if ( prevCam && prevCam.parentNode ) prevCam.parentNode.removeChild( prevCam );
			var prevToastEl = document.querySelector( '[data-odd-toast]' );
			if ( prevToastEl && prevToastEl.parentNode ) prevToastEl.parentNode.removeChild( prevToastEl );
			var prevFlashEl = document.querySelector( '[data-odd-flash]' );
			if ( prevFlashEl && prevFlashEl.parentNode ) prevFlashEl.parentNode.removeChild( prevFlashEl );

			var gear = document.createElement( 'button' );
			gear.type = 'button';
			gear.setAttribute( 'data-odd-scene-gear', '' );
			gear.setAttribute( 'aria-label', 'Change ODD scene' );
			gear.setAttribute( 'title', 'Change scene  (?)' );
			gear.innerHTML =
				'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none"' +
				' stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
				'<circle cx="12" cy="12" r="3"/>' +
				'<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3' +
				' 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1' +
				'a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1' +
				'a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3' +
				'H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1' +
				'a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1' +
				'a1.7 1.7 0 0 0-1.5 1z"/></svg>';
			document.body.appendChild( gear );

			// ---------- Take-a-frame (camera) button ------------- //
			//
			// A second floating pill, left of the gear, that saves
			// the user's current view as a PNG. Composites the
			// painted backdrop JPG + the Pixi cut-out / FX canvas at
			// their native (DPR-scaled) resolution, so the download
			// is a crisp full-fidelity screenshot even on retina.
			//
			// Shortcut: `s` (or `S`) from anywhere that isn't an
			// input. Dispatches the same saveFrame() path.
			var cam = document.createElement( 'button' );
			cam.type = 'button';
			cam.setAttribute( 'data-odd-cam', '' );
			cam.setAttribute( 'aria-label', 'Save current frame as PNG' );
			cam.setAttribute( 'title', 'Save frame  (S)' );
			cam.innerHTML =
				'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none"' +
				' stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
				'<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2.1l1.2-1.6A2 2 0 0 1 11.4 3.7h3.2c.62 0 1.2.28 1.6.77L17.4 6h2.1A2.5 2.5 0 0 1 22 8.5V17a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V10.5"/>' +
				'<circle cx="13" cy="13" r="4"/></svg>';
			document.body.appendChild( cam );

			// Toast + flash overlays (singletons, reused per save).
			var flash = document.createElement( 'div' );
			flash.setAttribute( 'data-odd-flash', '' );
			document.body.appendChild( flash );
			var toast = document.createElement( 'div' );
			toast.setAttribute( 'data-odd-toast', '' );
			toast.setAttribute( 'role', 'status' );
			toast.setAttribute( 'aria-live', 'polite' );
			document.body.appendChild( toast );
			var toastTimer = null;
			function showToast( msg, ms ) {
				toast.textContent = msg;
				toast.setAttribute( 'data-show', '1' );
				if ( toastTimer ) clearTimeout( toastTimer );
				toastTimer = setTimeout( function () {
					toast.setAttribute( 'data-show', '0' );
				}, ms || 1600 );
			}
			function doFlash() {
				if ( env.reducedMotion ) return;
				flash.setAttribute( 'data-on', '1' );
				setTimeout( function () { flash.setAttribute( 'data-on', '0' ); }, 40 );
			}

			var saving = false;
			function slugify( s ) {
				return String( s || '' ).toLowerCase()
					.replace( /[^a-z0-9]+/g, '-' )
					.replace( /(^-|-$)/g, '' ) || 'scene';
			}
			function saveFrame() {
				if ( saving ) return;
				if ( ! currentSlug ) { showToast( 'Nothing to save yet' ); return; }
				saving = true;
				doFlash();
				try {
					// extract.canvas(stage) sidesteps preserveDrawingBuffer=false;
					// it renders the stage into a fresh canvas we can read back.
					var pixiCanvas = null;
					try {
						if ( app.renderer && app.renderer.extract && app.renderer.extract.canvas ) {
							pixiCanvas = app.renderer.extract.canvas( app.stage );
						}
					} catch ( e ) { /* fall through */ }
					if ( ! pixiCanvas ) pixiCanvas = app.canvas;
					var W = pixiCanvas.width  || app.canvas.width;
					var H = pixiCanvas.height || app.canvas.height;
					if ( ! W || ! H ) { saving = false; showToast( 'Save failed' ); return; }

					var out = document.createElement( 'canvas' );
					out.width = W;
					out.height = H;
					var g = out.getContext( '2d' );
					if ( ! g ) { saving = false; showToast( 'Save failed' ); return; }

					function compositeAndSave( bgImg ) {
						try {
							if ( bgImg ) {
								// Cover-fit the backdrop into the canvas so
								// the crop matches what the user sees on a
								// widescreen monitor (background-size: cover).
								var ir = bgImg.width / bgImg.height;
								var or = W / H;
								var sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;
								if ( ir > or ) {
									sw = bgImg.height * or;
									sx = ( bgImg.width - sw ) / 2;
								} else {
									sh = bgImg.width / or;
									sy = ( bgImg.height - sh ) / 2;
								}
								g.drawImage( bgImg, sx, sy, sw, sh, 0, 0, W, H );
							} else {
								// No backdrop — paint the scene's fallback
								// color so the PNG isn't transparent.
								var sm = SCENE_MAP[ currentSlug ] || {};
								g.fillStyle = sm.fallbackColor || '#000';
								g.fillRect( 0, 0, W, H );
							}
							g.drawImage( pixiCanvas, 0, 0, W, H );
							out.toBlob( function ( blob ) {
								saving = false;
								if ( ! blob ) { showToast( 'Save failed' ); return; }
								var url = URL.createObjectURL( blob );
								var a = document.createElement( 'a' );
								a.href = url;
								var sm2 = SCENE_MAP[ currentSlug ] || {};
								var stamp = new Date().toISOString().replace( /[-:T]/g, '' ).slice( 0, 14 );
								a.download = 'odd-' + slugify( sm2.label || currentSlug ) + '-' + stamp + '.png';
								document.body.appendChild( a );
								a.click();
								if ( a.parentNode ) a.parentNode.removeChild( a );
								setTimeout( function () { URL.revokeObjectURL( url ); }, 1500 );
								showToast( 'Saved ' + a.download );
							}, 'image/png' );
						} catch ( err ) {
							saving = false;
							if ( window.console ) window.console.warn( 'ODD: saveFrame failed', err );
							showToast( 'Save failed' );
						}
					}

					var bg = new window.Image();
					bg.decoding = 'async';
					bg.onload = function () { compositeAndSave( bg ); };
					bg.onerror = function () { compositeAndSave( null ); };
					bg.src = assetUrl( 'assets/wallpapers/' + currentSlug + '.webp' );
				} catch ( err ) {
					saving = false;
					if ( window.console ) window.console.warn( 'ODD: saveFrame failed', err );
					showToast( 'Save failed' );
				}
			}
			cam.addEventListener( 'click', function () {
				dismissTooltip();
				saveFrame();
			} );
			window.__odd.saveFrame = saveFrame;

			// First-run onboarding tooltip: tells the user what the
			// gear does so they don't have to guess. Dismisses on
			// click/hover/open/close and on timeout. Only ever shown
			// once per browser via localStorage.
			var TOOLTIP_KEY = 'oddTooltipSeen';
			var tooltipSeen = false;
			try { tooltipSeen = window.localStorage.getItem( TOOLTIP_KEY ) === '1'; } catch ( e ) { /* ignore */ }
			var tooltip = null;
			function dismissTooltip() {
				if ( ! tooltip ) return;
				try { window.localStorage.setItem( TOOLTIP_KEY, '1' ); } catch ( e ) { /* ignore */ }
				tooltip.setAttribute( 'data-show', '0' );
				var t = tooltip; tooltip = null;
				setTimeout( function () {
					if ( t && t.parentNode ) t.parentNode.removeChild( t );
				}, 300 );
			}
			if ( ! tooltipSeen ) {
				tooltip = document.createElement( 'div' );
				tooltip.setAttribute( 'data-odd-tooltip', '' );
				tooltip.setAttribute( 'role', 'status' );
				tooltip.innerHTML = 'Change wallpaper <kbd>?</kbd>';
				document.body.appendChild( tooltip );
				// Delay a beat so the animated entrance actually plays.
				setTimeout( function () {
					if ( tooltip ) tooltip.setAttribute( 'data-show', '1' );
				}, 900 );
				setTimeout( dismissTooltip, 6000 );
				gear.addEventListener( 'pointerenter', dismissTooltip, { once: true } );
			}

			window.__odd.openPicker = function () { openPicker(); };
			window.__odd.setChaos = function ( n ) {
				var v = parseInt( n, 10 );
				chaosCount = isFinite( v ) && v >= 0 ? Math.min( 5, v ) : chaosCount;
				if ( chaosCount === 0 ) {
					if ( chaosFg && chaosFg.parent ) chaosFg.parent.removeChild( chaosFg );
					chaosFg = null;
					chaosDrifters = [];
				} else if ( currentSlug ) {
					// Reroll immediately so the new count takes effect
					// without waiting for the next scene swap.
					if ( chaosFg && chaosFg.parent ) chaosFg.parent.removeChild( chaosFg );
					chaosDrifters = [];
					var fg = new PIXI.Container();
					app.stage.addChild( fg );
					chaosFg = fg;
					( function ( forFg, forSlug ) {
						pickWeird( chaosCount ).then( function ( names ) {
							return mountSharedDrifters( app, PIXI, names, forFg );
						} ).then( function ( drifters ) {
							if ( forFg !== chaosFg || forSlug !== currentSlug ) {
								if ( forFg && forFg.parent ) forFg.parent.removeChild( forFg );
								return;
							}
							chaosDrifters = ( drifters || [] ).filter( Boolean );
						} ).catch( function () { /* non-fatal */ } );
					} )( fg, currentSlug );
				}
				return chaosCount;
			};
			function onKeydown( e ) {
				var t = e.target;
				if ( t && ( t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable ) ) return;
				if ( e.metaKey || e.ctrlKey || e.altKey ) return;
				if ( e.key === '?' ) {
					e.preventDefault();
					openPicker();
				} else if ( e.key === 's' || e.key === 'S' ) {
					e.preventDefault();
					saveFrame();
				}
			}
			window.addEventListener( 'keydown', onKeydown );

			// ---------- Shuffle scheduler ------------------------- //
			//
			// When `prefs.shuffle.enabled`, pick a different scene
			// from favorites every N minutes and route it through
			// swap(). If the user has no favorites we cycle the
			// full scene list so the feature still does something.
			// Visibility-paused: the scheduler does nothing while
			// the tab is hidden (handled by ticker stop + check at
			// fire time).
			var shuffleTimer = null;
			function shufflePool() {
				var favs = ( prefsState.favorites || [] ).filter( function ( s ) { return !! SCENE_MAP[ s ]; } );
				if ( favs.length >= 2 ) return favs;
				return SCENES.map( function ( s ) { return s.slug; } );
			}
			function pickShuffleNext() {
				var pool = shufflePool().filter( function ( s ) { return s !== currentSlug; } );
				if ( ! pool.length ) return null;
				return pool[ ( Math.random() * pool.length ) | 0 ];
			}
			function applyShuffle() {
				if ( shuffleTimer ) { clearInterval( shuffleTimer ); shuffleTimer = null; }
				var sh = prefsState.shuffle || { enabled: false, minutes: 15 };
				if ( ! sh.enabled || ctx.prefersReducedMotion ) return;
				var ms = Math.max( 60000, sh.minutes * 60000 );
				shuffleTimer = setInterval( function () {
					if ( document.hidden ) return;
					var next = pickShuffleNext();
					if ( ! next ) return;
					swap( next ).then( function ( res ) {
						if ( res && res.ok ) savePrefs( { scene: next } );
					} );
				}, ms );
			}

			// ---------- Audio bootstrapping ----------------------- //
			//
			// If the user previously opted into audio-reactive mode
			// we lazy-load the module and probe mic state WITHOUT
			// re-prompting — getUserMedia will resolve silently if
			// the origin already has a persistent grant, or reject
			// quietly if not. Explicit (re-)prompts only happen on
			// the picker toggle.
			function bootstrapAudio() {
				if ( ! prefsState.audioReactive ) return;
				loadAudio().then( function ( a ) {
					if ( a && a.enable ) a.enable();
				} ).catch( function () { /* non-fatal */ } );
			}

			var pickerOpen = false;
			async function openPicker() {
				if ( pickerOpen ) return;
				pickerOpen = true;
				try {
					var picker = await loadPicker();
					picker.open( {
						host: container,
						currentSlug: currentSlug,
						prefersReducedMotion: !! ctx.prefersReducedMotion,
						shuffle: prefsState.shuffle,
						audioReactive: prefsState.audioReactive,
						onSelect: function ( slug ) {
							swap( slug ).then( function ( res ) {
								if ( ! res.ok ) return;
								savePrefs( { scene: slug } );
								recordRecent( slug );
							} );
						},
						// Live preview: picker calls this when the
						// user dwells on a card for ~350 ms, and
						// again with the committed slug to revert on
						// leave/close. No prefs are saved so the
						// preview is ephemeral.
						onPreview: function ( slug ) {
							swap( slug );
						},
						onShuffleChange: function ( next ) {
							prefsState.shuffle = next;
							savePrefs( { shuffle: next } );
							applyShuffle();
						},
						onAudioToggle: function ( rerender ) {
							loadAudio().then( function ( a ) {
								if ( ! a ) return;
								var st = a.state();
								if ( st.enabled ) {
									a.disable();
									prefsState.audioReactive = false;
									savePrefs( { audioReactive: false } );
								} else {
									a.enable().then( function ( ok ) {
										prefsState.audioReactive = !! ok;
										savePrefs( { audioReactive: !! ok } );
										if ( typeof rerender === 'function' ) rerender();
									} );
								}
								if ( typeof rerender === 'function' ) rerender();
							} );
						},
						onClose: function () { pickerOpen = false; gear.focus(); },
					} );
				} catch ( err ) {
					pickerOpen = false;
					if ( window.console ) window.console.error( 'ODD: picker failed to load', err );
				}
			}
			gear.addEventListener( 'click', function () {
				dismissTooltip();
				openPicker();
			} );

			// ---------- Visibility + kickoff ---------- //

			var visHook = 'odd/visibility';
			function onVis( detail ) {
				if ( ! detail || detail.id !== ctx.id ) return;
				if ( detail.state === 'hidden' ) app.ticker.stop();
				else if ( ! ctx.prefersReducedMotion ) app.ticker.start();
			}
			if ( window.wp && window.wp.hooks ) {
				window.wp.hooks.addAction( 'wp-desktop.wallpaper.visibility', visHook, onVis );

				// Bridge from the ODD Control Panel: clicking a scene
				// card fires `odd/pickScene` so the engine swaps live
				// without waiting on the REST round-trip. The panel
				// still POSTs to /odd/v1/prefs for persistence.
				window.wp.hooks.addAction( 'odd/pickScene', 'odd/wallpaper', function ( slug ) {
					if ( ! slug || slug === currentSlug ) return;
					swap( slug ).then( function ( res ) {
						if ( res && res.ok ) recordRecent( slug );
					} );
				} );
			}

			// Also pause when the browser tab itself is hidden. WP
			// Desktop only fires the hook when the user navigates
			// wallpapers inside the app; `document.hidden` covers
			// minimize, tab switch, background workspace, etc., and
			// is free battery back when nothing is visible anyway.
			function onDocVis() {
				if ( document.hidden ) app.ticker.stop();
				else if ( ! ctx.prefersReducedMotion ) app.ticker.start();
			}
			document.addEventListener( 'visibilitychange', onDocVis );

			loadEasterEggs().catch( function ( e ) {
				if ( window.console ) window.console.warn( 'ODD: eggs failed to load', e );
			} );

			// Kick off shuffle scheduler + audio restore once we
			// have a mounted Pixi app. Both are inert if the user
			// never opted in.
			applyShuffle();
			bootstrapAudio();

			var initial = prefsState.scene || defaultScene();
			// Paint the first-paint backdrop BEFORE Pixi sets up the
			// scene so the user sees the right JPG instantly, not
			// whatever default image the renderer flashes.
			setFirstPaint( initial );
			var first = await swap( initial );
			if ( ! first.ok && initial !== defaultScene() ) {
				// Retired or broken scene — reset and try default.
				savePrefs( { scene: '' } );
				setFirstPaint( defaultScene() );
				await swap( defaultScene() );
			}

			// Warm the HTTP + Pixi texture cache for the user's likely
			// next picks (favorites + recents), so opening the picker
			// and clicking a card feels instant. The picker.js module
			// exposes a cheap prefetch helper that's a no-op on repeat
			// calls; load it once on idle.
			var ric = window.requestIdleCallback || function ( fn ) { return setTimeout( fn, 600 ); };
			ric( function () {
				loadPicker().then( function () {
					var pre = window.__odd.prefetchScene;
					if ( typeof pre !== 'function' ) return;
					var likely = {};
					( prefsState.favorites || [] ).forEach( function ( s ) { likely[ s ] = true; } );
					( prefsState.recents   || [] ).forEach( function ( s ) { likely[ s ] = true; } );
					Object.keys( likely ).forEach( pre );
				} ).catch( function () { /* non-fatal */ } );
			} );

			return function teardown() {
				if ( shuffleTimer ) { clearInterval( shuffleTimer ); shuffleTimer = null; }
				if ( window.__odd.audio && window.__odd.audio.disable ) {
					try { window.__odd.audio.disable(); } catch ( e ) { /* ignore */ }
				}
				if ( window.wp && window.wp.hooks ) {
					window.wp.hooks.removeAction( 'wp-desktop.wallpaper.visibility', visHook );
				}
				document.removeEventListener( 'visibilitychange', onDocVis );
				window.removeEventListener( 'pointermove', onPointerMove );
				window.removeEventListener( 'keydown', onKeydown );
				if ( pickerOpen && window.__odd.picker && window.__odd.picker.close ) {
					try { window.__odd.picker.close(); } catch ( e ) { /* ignore */ }
				}
				if ( gear.parentNode ) gear.parentNode.removeChild( gear );
				if ( cam.parentNode ) cam.parentNode.removeChild( cam );
				if ( flash.parentNode ) flash.parentNode.removeChild( flash );
				if ( toast.parentNode ) toast.parentNode.removeChild( toast );
				if ( tooltip && tooltip.parentNode ) tooltip.parentNode.removeChild( tooltip );
				if ( live.parentNode ) live.parentNode.removeChild( live );
				if ( firstPaint.parentNode ) firstPaint.parentNode.removeChild( firstPaint );
				try { delete window.__odd.saveFrame; } catch ( e ) { window.__odd.saveFrame = undefined; }
				// Restore the original WP accent so switching away
				// from ODD doesn't leave our tint behind.
				if ( originalAccent ) {
					document.documentElement.style.setProperty( '--wp-admin-theme-color', originalAccent );
				} else {
					document.documentElement.style.removeProperty( '--wp-admin-theme-color' );
				}
				document.documentElement.style.removeProperty( '--odd-accent' );
				app.renderer.off( 'resize', onResize );
				if ( currentTick ) app.ticker.remove( currentTick );
				if ( currentImpl && currentImpl.cleanup ) {
					try { currentImpl.cleanup( currentState, env ); } catch ( e ) { /* ignore */ }
				}
				app.destroy( true, { children: true, texture: true } );
			};
		})().catch( function ( err ) {
			if ( window.console ) window.console.error( 'ODD: mount failed', err );
			return function () {};
		} );
	}

	// ============================================================ //
	// Registration — one wallpaper card.
	// ============================================================ //

	var registered = false;
	function registerAll() {
		if ( registered ) return;
		if ( ! window.wp || ! window.wp.desktop ) return;
		if ( typeof window.wp.desktop.registerWallpaper !== 'function' ) return;
		registered = true;

		try {
			window.wp.desktop.registerWallpaper( {
				id:      'odd',
				label:   'ODD',
				type:    'canvas',
				preview: previewBg( 'odd' ),
				needs:   [ 'pixijs' ],
				mount:   mountODD,
			} );
		} catch ( e ) {
			if ( window.console ) window.console.warn( 'ODD: registerWallpaper failed', e );
		}
	}

	function boot() {
		if ( ! window.wp || ! window.wp.hooks ) return;
		window.wp.hooks.addAction( 'wp-desktop.init', 'odd/register', registerAll );
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
