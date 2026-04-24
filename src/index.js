/**
 * B-Roll for WP Desktop Mode — v0.6 registrar
 * ---------------------------------------------------------------
 * Scaling pillars:
 *
 *   1. Manifest-driven. The scene list lives in src/scenes.json and
 *      is hydrated into this page via wp_localize_script as
 *      window.bRoll.scenes. Adding a scene never edits this file.
 *
 *   2. Lazy at every layer. Boot only fetches this one file. The
 *      in-canvas picker UI, each scene's Pixi implementation, its
 *      painted backdrop JPG, and the preview thumbnails are all
 *      fetched on demand. Cold start stays O(1) in scene count.
 *
 *   3. Single shell card. We register exactly one 'b-roll' wallpaper
 *      with the WP Desktop shell. Scene selection happens inside the
 *      canvas via a gear button that opens a searchable, tag-filtered
 *      picker. Per-user pick is persisted through POST /b-roll/v1/prefs.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	window.__bRoll = window.__bRoll || {};
	window.__bRoll.scenes = window.__bRoll.scenes || {};

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
		return ( ( ar + ( br - ar ) * t ) | 0 ) << 16
		     | ( ( ag + ( bg - ag ) * t ) | 0 ) << 8
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
	// Each scene ships a few transparent-PNG cut-outs at
	// assets/cutouts/<slug>/*.png. Scenes declare them in
	// scenes.json with a motion profile; mountCutouts() loads
	// textures and returns a drifters[] array, and tickDrifters()
	// advances them every frame.
	// ============================================================ //

	function cutoutUrl( slug, file ) {
		var base = window.__bRoll.config ? window.__bRoll.config.pluginUrl : '';
		var ver  = window.__bRoll.config ? window.__bRoll.config.version   : '';
		var qs = ver ? '?v=' + encodeURIComponent( ver ) : '';
		return base + '/assets/cutouts/' + slug + '/' + file + qs;
	}

	function resolveCutoutDefs( slug ) {
		var map = ( window.__bRoll.config && window.__bRoll.config.sceneMap ) || {};
		var s = map[ slug ];
		return ( s && Array.isArray( s.cutouts ) ) ? s.cutouts : [];
	}

	function mountCutouts( app, PIXI, slug, fg ) {
		var defs = resolveCutoutDefs( slug );
		if ( ! defs.length ) return Promise.resolve( [] );

		var far  = new PIXI.Container(); fg.addChild( far );
		var mid  = new PIXI.Container(); fg.addChild( mid );
		var near = new PIXI.Container(); fg.addChild( near );
		var bins = { far: far, mid: mid, near: near };

		var drifters = [];
		var jobs = defs.map( function ( def ) {
			var url = cutoutUrl( slug, def.file );
			return PIXI.Assets.load( url ).then( function ( tex ) {
				var sprite = new PIXI.Sprite( tex );
				sprite.anchor.set( 0.5 );
				( bins[ def.z || 'mid' ] || mid ).addChild( sprite );

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
			} ).catch( function ( err ) {
				if ( window.console ) window.console.warn( 'B-Roll: cutout failed', url, err );
				return null;
			} );
		} );

		return Promise.all( jobs ).then( function () { return drifters; } );
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
				var laneX = ( def.xMin != null ? def.xMin : 0.1 )
				          + d.lane * ( ( def.xMax != null ? def.xMax : 0.9 ) - ( def.xMin != null ? def.xMin : 0.1 ) );
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
		for ( var i = 0; i < drifters.length; i++ ) {
			var d = drifters[ i ];
			if ( d.hidden ) { d.sprite.visible = false; continue; }
			d.sprite.visible = true;
			motionUpdate( d, env );
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

	window.__bRoll.helpers = {
		rand: rand, irand: irand, choose: choose, clamp: clamp, tau: tau,
		lerpColor: lerpColor, paintVGradient: paintVGradient, makeBloomLayer: makeBloomLayer,
		mountCutouts: mountCutouts, tickDrifters: tickDrifters,
		showEggDrifter: showEggDrifter, hideEggDrifter: hideEggDrifter,
	};

	// ============================================================ //
	// Hydrated config from wp_localize_script.
	// ============================================================ //

	var cfg = window.bRoll || {};
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
		if ( SCENE_MAP[ 'rainbow-road' ] ) return 'rainbow-road';
		return SCENES.length ? SCENES[ 0 ].slug : '';
	}

	function previewBg( slug ) {
		var s = SCENE_MAP[ slug ] || {};
		var url = assetUrl( 'assets/previews/' + slug + '.jpg' );
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
		if ( window.__bRoll.scenes[ slug ] ) return Promise.resolve();
		return loadScript( assetUrl( 'src/scenes/' + slug + '.js' ) ).then( function () {
			if ( ! window.__bRoll.scenes[ slug ] ) {
				throw new Error( 'Scene did not self-register: ' + slug );
			}
		} );
	}

	function loadPicker() {
		if ( window.__bRoll.picker && typeof window.__bRoll.picker.open === 'function' ) {
			return Promise.resolve( window.__bRoll.picker );
		}
		return loadScript( assetUrl( 'src/picker.js' ) ).then( function () {
			if ( ! window.__bRoll.picker || typeof window.__bRoll.picker.open !== 'function' ) {
				throw new Error( 'Picker did not self-register' );
			}
			return window.__bRoll.picker;
		} );
	}

	function loadEasterEggs() {
		if ( window.__bRoll.eggs && window.__bRoll.eggs._installed ) {
			return Promise.resolve( window.__bRoll.eggs );
		}
		return loadScript( assetUrl( 'src/easter-eggs.js' ) ).then( function () {
			return window.__bRoll.eggs;
		} );
	}

	// ============================================================ //
	// Prefs — one REST round trip per patch; localStorage fallback.
	// ============================================================ //

	var LS_KEY = 'b-roll:prefs:v1';
	var prefsState = {
		scene: cfg.scene || defaultScene(),
		favorites: Array.isArray( cfg.favorites ) ? cfg.favorites.slice() : [],
		recents: Array.isArray( cfg.recents ) ? cfg.recents.slice() : [],
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
			if ( window.console ) window.console.warn( 'B-Roll: prefs save deferred to localStorage', err );
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

	window.__bRoll.prefs = {
		get: function () { return prefsState; },
		save: savePrefs,
		recordRecent: recordRecent,
		toggleFavorite: toggleFavorite,
	};

	window.__bRoll.config = {
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

	function mountBRoll( container, ctx ) {
		return (async function () {
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

			var env = { app: app, PIXI: PIXI, ctx: ctx, helpers: window.__bRoll.helpers };
			var currentSlug = null;
			var currentImpl = null;
			var currentState = null;
			var currentTick = null;
			var swapping = false;

			function stepFactory( impl, state ) {
				return function ( ticker ) {
					env.dt = Math.min( 2.5, ticker.deltaTime );
					if ( impl.tick ) impl.tick( state, env );
				};
			}
			function onResize() {
				if ( currentImpl && currentImpl.onResize ) {
					currentImpl.onResize( currentState, env );
				}
			}
			app.renderer.on( 'resize', onResize );

			async function swap( nextSlug ) {
				if ( swapping ) return { ok: false, error: new Error( 'swap in progress' ) };
				if ( nextSlug === currentSlug ) return { ok: true };
				if ( ! SCENE_MAP[ nextSlug ] ) return { ok: false, error: new Error( 'unknown scene: ' + nextSlug ) };
				swapping = true;
				var prev = {
					slug: currentSlug, impl: currentImpl, state: currentState, tick: currentTick,
				};
				try {
					await loadScene( nextSlug );
					var impl = window.__bRoll.scenes[ nextSlug ];
					if ( ! impl || typeof impl.setup !== 'function' ) {
						throw new Error( 'Scene impl missing: ' + nextSlug );
					}
					// Tear down previous scene cleanly.
					if ( prev.impl ) {
						if ( prev.tick ) app.ticker.remove( prev.tick );
						try {
							if ( prev.impl.cleanup ) prev.impl.cleanup( prev.state, env );
						} catch ( e ) {
							if ( window.console ) window.console.warn( 'B-Roll: cleanup threw', e );
						}
					}
					app.stage.removeChildren();

					var state = await impl.setup( env );
					var tick = stepFactory( impl, state );
					currentImpl = impl;
					currentState = state;
					currentTick = tick;
					currentSlug = nextSlug;

					if ( ctx.prefersReducedMotion ) {
						env.dt = 0;
						if ( impl.tick ) impl.tick( state, env );
						app.ticker.stop();
					} else {
						app.ticker.add( tick );
						app.ticker.start();
					}
					if ( window.__bRoll.eggs && window.__bRoll.eggs.setActive ) {
						window.__bRoll.eggs.setActive( nextSlug, state, env, container );
					}
					swapping = false;
					return { ok: true };
				} catch ( err ) {
					if ( window.console ) window.console.error( 'B-Roll: swap failed', nextSlug, err );
					// Leave previous scene running (it was never torn down if setup fell first;
					// if we got past cleanup, the canvas will be empty but the app is alive).
					swapping = false;
					return { ok: false, error: err };
				}
			}

			// ---------- Gear button ---------- //

			// Inject a one-time stylesheet for the gear's pulse + hover.
			if ( ! document.getElementById( 'b-roll-gear-style' ) ) {
				var gearStyle = document.createElement( 'style' );
				gearStyle.id = 'b-roll-gear-style';
				gearStyle.textContent =
					'@keyframes bRollGearPulse{' +
						'0%{box-shadow:0 8px 24px rgba(0,0,0,.45),0 0 0 0 rgba(255,255,255,.55)}' +
						'70%{box-shadow:0 8px 24px rgba(0,0,0,.45),0 0 0 18px rgba(255,255,255,0)}' +
						'100%{box-shadow:0 8px 24px rgba(0,0,0,.45),0 0 0 0 rgba(255,255,255,0)}' +
					'}' +
					'[data-b-roll-gear]{' +
						'transition:transform .18s ease,background .18s ease,box-shadow .18s ease;' +
					'}' +
					'[data-b-roll-gear]:hover{' +
						'transform:scale(1.06);' +
						'background:rgba(28,28,34,.85)!important;' +
					'}' +
					'[data-b-roll-gear]:active{transform:scale(.96)}' +
					'[data-b-roll-gear].is-pulsing{animation:bRollGearPulse 1.6s ease-out 3}' +
					'[data-b-roll-gear] svg{transition:transform 1.2s ease}' +
					'[data-b-roll-gear]:hover svg{transform:rotate(60deg)}' +
					'[data-b-roll-hint]{' +
						'transition:opacity .35s ease,transform .35s ease;' +
					'}';
				document.head.appendChild( gearStyle );
			}

			var gear = document.createElement( 'button' );
			gear.type = 'button';
			gear.setAttribute( 'aria-label', 'Change B-Roll scene' );
			gear.setAttribute( 'title', 'Change scene' );
			gear.setAttribute( 'data-b-roll-gear', '' );
			gear.innerHTML =
				'<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
			var gearStyles = {
				position: 'absolute', right: '20px', bottom: '20px',
				width: '52px', height: '52px', borderRadius: '50%',
				border: '1.5px solid rgba(255,255,255,.55)',
				background: 'rgba(18,18,22,.78)', color: '#fff',
				backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
				display: 'flex', alignItems: 'center', justifyContent: 'center',
				cursor: 'pointer', zIndex: '2147483646', padding: '0', outline: 'none',
				opacity: '1',
				boxShadow: '0 8px 24px rgba(0,0,0,.45)',
			};
			Object.keys( gearStyles ).forEach( function ( k ) { gear.style[ k ] = gearStyles[ k ]; } );
			container.appendChild( gear );

			// First-load hint pill that points at the gear. Auto-hides after
			// ~7s, or immediately on first click. Dismissed forever once seen.
			var HINT_KEY = 'bRollGearHintSeen';
			var hint = null;
			var hintTimer = null;
			function dismissHint() {
				if ( ! hint ) return;
				hint.style.opacity = '0';
				hint.style.transform = 'translateY(6px)';
				if ( hintTimer ) { clearTimeout( hintTimer ); hintTimer = null; }
				setTimeout( function () {
					if ( hint && hint.parentNode ) hint.parentNode.removeChild( hint );
					hint = null;
				}, 400 );
				try { window.localStorage.setItem( HINT_KEY, '1' ); } catch ( e ) { /* ignore */ }
			}
			var hintAlreadySeen = false;
			try { hintAlreadySeen = window.localStorage.getItem( HINT_KEY ) === '1'; } catch ( e ) { /* ignore */ }
			if ( ! hintAlreadySeen ) {
				hint = document.createElement( 'div' );
				hint.setAttribute( 'data-b-roll-hint', '' );
				hint.textContent = 'Click to change scene';
				var hintStyles = {
					position: 'absolute', right: '82px', bottom: '30px',
					padding: '8px 12px', borderRadius: '8px',
					background: 'rgba(18,18,22,.85)', color: '#fff',
					font: '500 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
					letterSpacing: '.2px', whiteSpace: 'nowrap',
					border: '1px solid rgba(255,255,255,.18)',
					boxShadow: '0 6px 18px rgba(0,0,0,.35)',
					zIndex: '2147483646', pointerEvents: 'none',
					opacity: '0', transform: 'translateY(6px)',
				};
				Object.keys( hintStyles ).forEach( function ( k ) { hint.style[ k ] = hintStyles[ k ]; } );
				container.appendChild( hint );
				// Fade in after a beat so it reads as deliberate, not flashed.
				setTimeout( function () {
					if ( ! hint ) return;
					hint.style.opacity = '1';
					hint.style.transform = 'translateY(0)';
				}, 600 );
				hintTimer = setTimeout( dismissHint, 7000 );
			}
			// Pulse the gear on first load too (CSS animation runs 3 times).
			if ( ! ctx.prefersReducedMotion ) {
				gear.classList.add( 'is-pulsing' );
				setTimeout( function () { gear.classList.remove( 'is-pulsing' ); }, 5200 );
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
						onSelect: function ( slug ) {
							swap( slug ).then( function ( res ) {
								if ( ! res.ok ) return;
								savePrefs( { scene: slug } );
								recordRecent( slug );
							} );
						},
						onClose: function () { pickerOpen = false; gear.focus(); },
					} );
				} catch ( err ) {
					pickerOpen = false;
					if ( window.console ) window.console.error( 'B-Roll: picker failed to load', err );
				}
			}
			gear.addEventListener( 'click', function () {
				dismissHint();
				gear.classList.remove( 'is-pulsing' );
				openPicker();
			} );

			// ---------- Visibility + kickoff ---------- //

			var visHook = 'b-roll/visibility';
			function onVis( detail ) {
				if ( ! detail || detail.id !== ctx.id ) return;
				if ( detail.state === 'hidden' ) app.ticker.stop();
				else if ( ! ctx.prefersReducedMotion ) app.ticker.start();
			}
			if ( window.wp && window.wp.hooks ) {
				window.wp.hooks.addAction( 'wp-desktop.wallpaper.visibility', visHook, onVis );
			}

			loadEasterEggs().catch( function ( e ) {
				if ( window.console ) window.console.warn( 'B-Roll: eggs failed to load', e );
			} );

			var initial = prefsState.scene || defaultScene();
			var first = await swap( initial );
			if ( ! first.ok && initial !== defaultScene() ) {
				// Retired or broken scene — reset and try default.
				savePrefs( { scene: '' } );
				await swap( defaultScene() );
			}

			return function teardown() {
				if ( window.wp && window.wp.hooks ) {
					window.wp.hooks.removeAction( 'wp-desktop.wallpaper.visibility', visHook );
				}
				if ( pickerOpen && window.__bRoll.picker && window.__bRoll.picker.close ) {
					try { window.__bRoll.picker.close(); } catch ( e ) { /* ignore */ }
				}
				if ( hintTimer ) clearTimeout( hintTimer );
				if ( hint && hint.parentNode ) hint.parentNode.removeChild( hint );
				if ( gear.parentNode ) gear.parentNode.removeChild( gear );
				app.renderer.off( 'resize', onResize );
				if ( currentTick ) app.ticker.remove( currentTick );
				if ( currentImpl && currentImpl.cleanup ) {
					try { currentImpl.cleanup( currentState, env ); } catch ( e ) { /* ignore */ }
				}
				app.destroy( true, { children: true, texture: true } );
			};
		})().catch( function ( err ) {
			if ( window.console ) window.console.error( 'B-Roll: mount failed', err );
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
				id:      'b-roll',
				label:   'B-Roll',
				type:    'canvas',
				preview: previewBg( 'b-roll' ),
				needs:   [ 'pixijs' ],
				mount:   mountBRoll,
			} );
		} catch ( e ) {
			if ( window.console ) window.console.warn( 'B-Roll: registerWallpaper failed', e );
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
