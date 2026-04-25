/**
 * ODD wallpaper runtime for WP Desktop Mode
 * ---------------------------------------------------------------
 * One Pixi app, swap scenes in place. The scene catalog arrives
 * through `wp_localize_script('odd-api', 'odd', … )`; the engine
 * lazy-loads each scene's JS the first time it's picked.
 *
 * Lean-runtime rewrite (v0.13.4):
 *   - Scene / audio / drifters modules live under `src/wallpaper/`,
 *     so the loaders prefix paths with `src/wallpaper/` (matching
 *     the on-disk + zip layout). The previous runtime looked at
 *     `src/scenes/…` which has been 404ing since the reboot.
 *   - The legacy in-canvas picker gear, tooltip, and `?` shortcut
 *     are gone — the native ODD Control Panel window is the single
 *     picker surface.
 *   - The unused cut-out / atlas / chaos-drifter / easter-egg
 *     pipelines are removed; none of the three reboot scenes ship
 *     cutouts or onEgg handlers, and the shared drifter library
 *     is empty.
 *
 * Scenes get a small, stable contract:
 *   env = { app, PIXI, ctx, helpers, dt, parallax, reducedMotion,
 *           tod, todPhase, season, audio, perfTier }
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	window.__odd = window.__odd || {};
	window.__odd.scenes = window.__odd.scenes || {};

	// Foundation module handles. All six install on window.__odd before
	// this script's <script> tag emits (see odd/includes/enqueue.php for
	// the dependency chain). Each of them falls back gracefully when a
	// consumer runs outside the full ODD context (tests, partial boots).
	var _events    = window.__odd.events    || null;
	var _lifecycle = window.__odd.lifecycle || null;
	var _safeCall  = window.__odd.safeCall  || function ( fn ) { try { return fn(); } catch ( e ) {} };

	function emitBus( name, payload ) {
		if ( _events ) { try { _events.emit( name, payload ); } catch ( e ) {} }
	}

	// Wrap an impl method in safeCall without losing its `this`. Each
	// scene's setup/tick/etc. runs as `impl.method(state, env)` so a
	// throw there would have crashed the entire Pixi app pre-Cut 1.
	function safeImpl( impl, method, source, args ) {
		if ( ! impl || typeof impl[ method ] !== 'function' ) return undefined;
		try {
			return impl[ method ].apply( impl, args || [] );
		} catch ( err ) {
			emitBus( 'odd.error', {
				source:   source,
				err:      err,
				severity: 'error',
				message:  err && err.message,
				stack:    err && err.stack,
			} );
			if ( window.console ) { try { window.console.error( '[ODD ' + source + ']', err ); } catch ( e2 ) {} }
			return undefined;
		}
	}

	// ============================================================ //
	// Shared helpers — exposed on env.helpers for scenes.
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
		if ( m === 10 && d >= 25 ) return 'halloween';
		if ( ( m === 12 && d >= 28 ) || ( m === 1 && d <= 2 ) ) return 'newYear';
		if ( m >= 3 && m <= 5  ) return 'spring';
		if ( m >= 6 && m <= 8  ) return 'summer';
		if ( m >= 9 && m <= 11 ) return 'autumn';
		return 'winter';
	}

	window.__odd.helpers = {
		rand: rand, irand: irand, choose: choose, clamp: clamp, tau: tau,
		lerpColor: lerpColor, paintVGradient: paintVGradient,
		makeBloomLayer: makeBloomLayer,
		computeTod: computeTod, computeSeason: computeSeason,
	};

	// ============================================================ //
	// Hydrated config.
	// ============================================================ //

	var cfg        = window.odd || {};
	var PLUGIN_URL = cfg.pluginUrl || '';
	var VERSION    = cfg.version   || '0';
	var VER_QS     = VERSION ? '?v=' + encodeURIComponent( VERSION ) : '';
	var SCENES     = Array.isArray( cfg.scenes ) ? cfg.scenes : [];
	var SCENE_MAP  = {};
	for ( var si = 0; si < SCENES.length; si++ ) {
		SCENE_MAP[ SCENES[ si ].slug ] = SCENES[ si ];
	}

	function assetUrl( rel ) {
		return PLUGIN_URL + '/' + rel.replace( /^\/+/, '' ) + VER_QS;
	}

	function defaultScene() {
		if ( SCENE_MAP.flux ) return 'flux';
		return SCENES.length ? SCENES[ 0 ].slug : '';
	}

	function previewBg( slug ) {
		var s = SCENE_MAP[ slug ] || {};
		var url = assetUrl( 'assets/previews/' + slug + '.webp' );
		return "url(\"" + url + "\") center/cover no-repeat, " + ( s.fallbackColor || '#111' );
	}

	window.__odd.config = {
		pluginUrl: PLUGIN_URL,
		version:   VERSION,
		assetUrl:  assetUrl,
		previewBg: previewBg,
		scenes:    SCENES,
		sceneMap:  SCENE_MAP,
	};

	// ============================================================ //
	// Lazy loaders.
	//
	// Scene files, the audio module, and any future companion JS
	// all live under `src/wallpaper/` on disk (matches the build-zip
	// layout). Loader URLs MUST match or the engine 404s and the
	// wallpaper renders as a static JPG — which is what happened in
	// 0.13.0…0.13.3 when these loaders still pointed at `src/`.
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
		return loadScript( assetUrl( 'src/wallpaper/scenes/' + slug + '.js' ) ).then( function () {
			if ( ! window.__odd.scenes[ slug ] ) {
				throw new Error( 'Scene did not self-register: ' + slug );
			}
		} );
	}

	function loadAudio() {
		if ( window.__odd.audio && window.__odd.audio._installed ) {
			return Promise.resolve( window.__odd.audio );
		}
		return loadScript( assetUrl( 'src/wallpaper/audio.js' ) ).then( function () {
			return window.__odd.audio;
		} );
	}

	// ============================================================ //
	// Prefs — REST round trip + localStorage offline mirror.
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
		scene:         cfg.scene || cfg.wallpaper || defaultScene(),
		favorites:     Array.isArray( cfg.favorites ) ? cfg.favorites.slice() : [],
		recents:       Array.isArray( cfg.recents )   ? cfg.recents.slice()   : [],
		shuffle:       coerceShuffle( cfg.shuffle ),
		audioReactive: !! cfg.audioReactive,
	};
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
		} catch ( e ) { /* quota / disabled — ignore */ }
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
				'X-WP-Nonce':   cfg.restNonce || '',
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

	window.__odd.prefs = {
		get: function () { return prefsState; },
		save: savePrefs,
		recordRecent: recordRecent,
	};

	// ============================================================ //
	// Mount — one Pixi app, swap scenes in place.
	// ============================================================ //

	function mountODD( container, ctx ) {
		return (async function () {
			// Instant first-paint backdrop (plain <div>), so even
			// before Pixi boots the user sees the painted wallpaper.
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

			if ( ! window.PIXI ) {
				throw new Error( 'ODD: PIXI global missing — the WP Desktop Mode shell should have provided it.' );
			}

			var PIXI = window.PIXI;
			var app  = new PIXI.Application();
			await app.init( {
				resizeTo:        container,
				backgroundAlpha: 0,
				antialias:       true,
				resolution:      Math.min( 2, window.devicePixelRatio || 1 ),
				autoDensity:     true,
			} );
			container.appendChild( app.canvas );
			app.canvas.style.position = 'absolute';
			app.canvas.style.inset = '0';
			app.canvas.style.width = '100%';
			app.canvas.style.height = '100%';

			// Polite ARIA live region so assistive tech hears scene swaps.
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

			var initTod = computeTod();
			var env = {
				app: app, PIXI: PIXI, ctx: ctx,
				helpers: window.__odd.helpers,
				parallax: { x: 0, y: 0 },
				reducedMotion: !! ctx.prefersReducedMotion,
				tod:      initTod.tod,
				todPhase: initTod.phase,
				season:   computeSeason(),
				audio:    { level: 0, bass: 0, mid: 0, high: 0, enabled: false },
				perfTier: 'high',
				dt:       1,
			};

			var parallaxTarget = { x: 0, y: 0 };
			function onPointerMove( ev ) {
				var r = container.getBoundingClientRect();
				if ( ! r.width || ! r.height ) return;
				parallaxTarget.x = ( ( ev.clientX - r.left ) / r.width  - 0.5 ) * 2;
				parallaxTarget.y = ( ( ev.clientY - r.top )  / r.height - 0.5 ) * 2;
			}
			window.addEventListener( 'pointermove', onPointerMove, { passive: true } );

			var currentSlug  = null;
			var currentImpl  = null;
			var currentState = null;
			var currentTick  = null;
			var swapping     = false;

			// Latest-wins coalescing for hover previews fired faster
			// than scenes can load.
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
			var frameTimes = [];
			var FRAME_BUF  = 120;
			var slowSince  = 0;
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
					env.parallax.x += ( parallaxTarget.x - env.parallax.x ) * 0.12;
					env.parallax.y += ( parallaxTarget.y - env.parallax.y ) * 0.12;

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

					if ( window.__odd.audio && window.__odd.audio.sample ) {
						window.__odd.audio.sample( env.audio );
					}
					if ( impl.onAudio && env.audio && env.audio.enabled ) {
						safeImpl( impl, 'onAudio', 'wallpaper.onAudio:' + currentSlug, [ state, env ] );
					}

					if ( impl.tick ) safeImpl( impl, 'tick', 'wallpaper.tick:' + currentSlug, [ state, env ] );
				};
			}

			function onResize() {
				if ( currentImpl && currentImpl.onResize ) {
					safeImpl( currentImpl, 'onResize', 'wallpaper.onResize:' + currentSlug, [ currentState, env ] );
				}
			}
			app.renderer.on( 'resize', onResize );

			// Color-aware OS accent — sample each backdrop once and
			// push the dominant saturated hue into `--wp-admin-theme-color`
			// so the Dock + Admin Bar tint to match.
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
								var w = sat * ( 0.35 + bri * 0.65 );
								if ( w <= 0 ) continue;
								sumR += r * w; sumG += gg * w; sumB += b * w;
								totalW += w;
							}
							if ( totalW <= 0 ) { resolve( null ); return; }
							var R = Math.round( sumR / totalW );
							var G = Math.round( sumG / totalW );
							var B = Math.round( sumB / totalW );
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
					document.documentElement.style.setProperty( '--odd-accent', css );
					document.documentElement.style.setProperty( '--wp-admin-theme-color', css );
				} );
			}

			// Cross-fade snapshot so the still-live frame covers the
			// seam while the next scene's setup runs. Respects
			// prefers-reduced-motion.
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
				} catch ( e ) { return null; }
			}
			function fadeAndRemove( node ) {
				if ( ! node ) return;
				window.requestAnimationFrame( function () {
					window.requestAnimationFrame( function () {
						node.style.opacity = '0';
						setTimeout( function () {
							if ( node.parentNode ) node.parentNode.removeChild( node );
						}, 420 );
					} );
				} );
			}

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
					pendingSlug = nextSlug;
					return { ok: false, error: new Error( 'queued' ) };
				}
				if ( nextSlug === currentSlug ) return { ok: true };
				if ( ! SCENE_MAP[ nextSlug ] ) {
					return { ok: false, error: new Error( 'unknown scene: ' + nextSlug ) };
				}
				swapping = true;
				var swapStart = ( window.performance && window.performance.now ) ? window.performance.now() : Date.now();
				var prev = {
					slug: currentSlug, impl: currentImpl, state: currentState, tick: currentTick,
				};
				emitBus( 'odd.scene-swap-started', { from: prev.slug, to: nextSlug } );
				var crossfadeNode = null;
				try {
					await loadScene( nextSlug );
					var impl = window.__odd.scenes[ nextSlug ];
					if ( ! impl || typeof impl.setup !== 'function' ) {
						throw new Error( 'Scene impl missing: ' + nextSlug );
					}

					await runTransitionOut( prev );

					if ( prev.impl ) crossfadeNode = snapshotOverlay();

					setFirstPaint( nextSlug );
					applyAccent( nextSlug );

					if ( prev.impl ) {
						if ( prev.tick ) app.ticker.remove( prev.tick );
						if ( prev.impl.cleanup ) {
							safeImpl( prev.impl, 'cleanup', 'wallpaper.cleanup:' + prev.slug, [ prev.state, env ] );
						}
					}
					app.stage.removeChildren();
					frameTimes = [];
					slowSince  = 0;

					// Setup can be sync or async (Promise). safeImpl can't
					// await for us — keep the existing await on the impl
					// method but guard the throw path manually so one bad
					// scene can't take the entire Pixi app down.
					var state;
					try {
						state = await impl.setup( env );
					} catch ( setupErr ) {
						emitBus( 'odd.error', {
							source:   'wallpaper.setup:' + nextSlug,
							err:      setupErr,
							severity: 'error',
							message:  setupErr && setupErr.message,
							stack:    setupErr && setupErr.stack,
						} );
						throw setupErr;
					}
					var tick  = stepFactory( impl, state );
					currentImpl  = impl;
					currentState = state;
					currentTick  = tick;
					currentSlug  = nextSlug;

					window.__odd = window.__odd || {};
					window.__odd.runtime = window.__odd.runtime || {};
					window.__odd.runtime.activeScene = {
						slug:  nextSlug,
						scene: impl,
						state: state,
						env:   env,
					};

					if ( ! env.reducedMotion && typeof impl.transitionIn === 'function' ) {
						safeImpl( impl, 'transitionIn', 'wallpaper.transitionIn:' + nextSlug, [ state, env ] );
					}

					if ( ctx.prefersReducedMotion ) {
						env.dt = 0;
						if ( typeof impl.stillFrame === 'function' ) {
							safeImpl( impl, 'stillFrame', 'wallpaper.stillFrame:' + nextSlug, [ state, env ] );
						} else if ( impl.tick ) {
							safeImpl( impl, 'tick', 'wallpaper.tick:' + nextSlug, [ state, env ] );
						}
						app.ticker.stop();
					} else {
						app.ticker.add( tick );
						app.ticker.start();
					}

					swapping = false;
					fadeAndRemove( crossfadeNode );
					announce( nextSlug );
					var swapMs = ( ( window.performance && window.performance.now ) ? window.performance.now() : Date.now() ) - swapStart;
					emitBus( 'odd.scene-swap-completed', { from: prev.slug, to: nextSlug, ms: Math.round( swapMs ) } );
					emitBus( 'odd.scene-changed', { from: prev.slug, to: nextSlug } );
					drainPending();
					return { ok: true };
				} catch ( err ) {
					if ( window.console ) window.console.error( 'ODD: swap failed', nextSlug, err );
					emitBus( 'odd.scene-mount-failed', { slug: nextSlug, err: err, message: err && err.message } );
					if ( crossfadeNode && crossfadeNode.parentNode ) {
						crossfadeNode.parentNode.removeChild( crossfadeNode );
					}
					swapping = false;
					drainPending();
					return { ok: false, error: err };
				}
			}

			// ---------- Legacy-node sweep ---------------------------- //
			//
			// Older ODD builds (≤ 0.13.3) injected a floating gear,
			// tooltip, save-frame camera, flash overlay, and toast
			// pill onto <body>. They're gone in 0.13.4 — the Control
			// Panel is the single picker surface — but proactively
			// strip any stale nodes left over from upgrades so a
			// returning user never sees a frozen pill.
			var legacyKill = [
				'[data-odd-scene-gear]',
				'[data-odd-tooltip]',
				'[data-odd-cam]',
				'[data-odd-flash]',
				'[data-odd-toast]',
			];
			for ( var li = 0; li < legacyKill.length; li++ ) {
				var prev = document.querySelector( legacyKill[ li ] );
				if ( prev && prev.parentNode ) prev.parentNode.removeChild( prev );
			}

			// ---------- Shuffle scheduler ---------------------------- //

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
						if ( res && res.ok ) savePrefs( { wallpaper: next } );
					} );
				}, ms );
			}

			// ---------- Audio bootstrap ------------------------------ //
			//
			// If the user previously opted in, probe mic state
			// without re-prompting. getUserMedia resolves silently
			// when the origin already has a persistent grant.
			function bootstrapAudio() {
				if ( ! prefsState.audioReactive ) return;
				loadAudio().then( function ( a ) {
					if ( a && a.enable ) a.enable();
				} ).catch( function () { /* non-fatal */ } );
			}

			// ---------- Visibility + wp.hooks bridge ---------------- //

			var visHook = 'odd/visibility';
			function onVis( detail ) {
				if ( ! detail || detail.id !== ctx.id ) return;
				if ( detail.state === 'hidden' ) app.ticker.stop();
				else if ( ! ctx.prefersReducedMotion ) app.ticker.start();
				emitBus( 'odd.visibility-changed', { state: detail.state } );
			}
			if ( window.wp && window.wp.hooks ) {
				window.wp.hooks.addAction( 'wp-desktop.wallpaper.visibility', visHook, onVis );

				// Panel / widgets / slash commands all fire this action
				// to swap the live scene without waiting on REST. The
				// caller still persists via POST /odd/v1/prefs.
				window.wp.hooks.addAction( 'odd.pickScene', 'odd/wallpaper', function ( slug ) {
					if ( ! slug || slug === currentSlug ) return;
					swap( slug ).then( function ( res ) {
						if ( res && res.ok ) recordRecent( slug );
					} );
				} );
			}

			function onDocVis() {
				if ( document.hidden ) app.ticker.stop();
				else if ( ! ctx.prefersReducedMotion ) app.ticker.start();
			}
			document.addEventListener( 'visibilitychange', onDocVis );

			applyShuffle();
			bootstrapAudio();

			var initial = prefsState.scene || defaultScene();
			setFirstPaint( initial );
			var first = await swap( initial );
			if ( ! first.ok && initial !== defaultScene() ) {
				savePrefs( { wallpaper: '' } );
				setFirstPaint( defaultScene() );
				await swap( defaultScene() );
			}

			// Lifecycle: first scene painted. Advance to `mounted` so
			// anything awaiting that phase (widgets, commands) can fire
			// their own init. `ready` follows on the next frame so every
			// enqueued subsystem has a chance to install before it's
			// emitted.
			if ( _lifecycle ) {
				try { _lifecycle.advance( 'mounted' ); } catch ( e ) {}
				window.requestAnimationFrame( function () {
					try { _lifecycle.advance( 'ready' ); } catch ( e ) {}
				} );
			}

			return function teardown() {
				if ( shuffleTimer ) { clearInterval( shuffleTimer ); shuffleTimer = null; }
				if ( window.__odd.audio && window.__odd.audio.disable ) {
					try { window.__odd.audio.disable(); } catch ( e ) { /* ignore */ }
				}
				if ( window.wp && window.wp.hooks ) {
					window.wp.hooks.removeAction( 'wp-desktop.wallpaper.visibility', visHook );
					window.wp.hooks.removeAction( 'odd.pickScene', 'odd/wallpaper' );
				}
				document.removeEventListener( 'visibilitychange', onDocVis );
				window.removeEventListener( 'pointermove', onPointerMove );
				if ( live.parentNode ) live.parentNode.removeChild( live );
				if ( firstPaint.parentNode ) firstPaint.parentNode.removeChild( firstPaint );
				if ( originalAccent ) {
					document.documentElement.style.setProperty( '--wp-admin-theme-color', originalAccent );
				} else {
					document.documentElement.style.removeProperty( '--wp-admin-theme-color' );
				}
				document.documentElement.style.removeProperty( '--odd-accent' );
				app.renderer.off( 'resize', onResize );
				if ( currentTick ) app.ticker.remove( currentTick );
				if ( currentImpl && currentImpl.cleanup ) {
					safeImpl( currentImpl, 'cleanup', 'wallpaper.cleanup:' + currentSlug, [ currentState, env ] );
				}
				if ( window.__odd && window.__odd.runtime ) {
					window.__odd.runtime.activeScene = null;
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
				preview: previewBg( defaultScene() ),
				needs:   [ 'pixijs' ],
				mount:   mountODD,
			} );
		} catch ( e ) {
			if ( window.console ) window.console.warn( 'ODD: registerWallpaper failed', e );
		}
	}

	function boot() {
		if ( ! window.wp || ! window.wp.hooks ) {
			// Polyfill-free fallback — WP Desktop Mode always provides
			// @wordpress/hooks, so if it's absent the admin page almost
			// certainly doesn't have the shell loaded and we can bail.
			return;
		}
		if ( window.wp.desktop && typeof window.wp.desktop.ready === 'function' ) {
			window.wp.desktop.ready( registerAll );
		} else {
			registerAll();
		}
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot, { once: true } );
	} else {
		boot();
	}
} )();
