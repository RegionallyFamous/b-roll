/**
 * ODD Apps — window host.
 * ---------------------------------------------------------------
 * Owns how an installed app's window body gets populated with a
 * sandboxed iframe. Supports two render paths, belt-and-suspenders:
 *
 *   1. Client-side hydration (PREFERRED) — for every installed app
 *      we register `window.wpDesktopNativeWindows[ 'odd-app-{slug}' ]`
 *      at boot. When WPDM opens the window, it invokes our callback
 *      directly on the body element; we build the mount div and
 *      iframe with no dependency on any server-rendered <template>.
 *      This mirrors the ODD Shop's working pattern and
 *      insulates us from template-emission failure modes (closure
 *      serialization, admin_footer skipped, mid-session install).
 *
 *   2. Server template + event (FALLBACK) — the window body may
 *      already contain a `.odd-app-host` div from the server-side
 *      `template` closure. We listen to `odd.window-opened` + a
 *      MutationObserver to catch any host that appears, install the
 *      iframe, and emit APP_OPENED exactly once per open.
 *
 * Event re-emission:
 *
 *   Host → ODD             Translation
 *   odd.window-opened      odd.app-opened   (when id starts `odd-app-`)
 *   odd.window-closed      odd.app-closed
 *   odd.window-focused     odd.app-focused
 *
 * This is the one place in ODD where we know an app has actually
 * opened. Muse voice lines (`appOpen.<slug>`), motion primitives
 * (wink on open), and analytics all subscribe to odd.app-opened
 * rather than listening to the raw window events.
 *
 * Security:
 *
 *   - The iframe is `sandbox="allow-scripts allow-forms allow-popups
 *     allow-same-origin allow-downloads"`. allow-same-origin is
 *     required so apps can call fetch() back to /wp-json/odd/v1/
 *     with the session cookie; the serve endpoint enforces
 *     capability on every request.
 *   - `loading="eager"`, `referrerpolicy="no-referrer"`.
 *   - No cross-document access — the admin shell never scripts into
 *     the app frame.
 *
 * Resilience:
 *
 *   - If the JS hydration path runs, we build the mount ourselves
 *     and the iframe always appears.
 *   - If the server template already painted, the MutationObserver
 *     path finds and hydrates it without double-firing APP_OPENED.
 *   - If `window.odd.appServeUrls` is missing for a slug, we render
 *     a visible error card inside the window body instead of leaving
 *     it blank — never pure white.
 *   - If the iframe `error` or `load`-with-zero-size fires, we
 *     emit odd.iframe-error and leave the loading placeholder in
 *     place so the user sees a visible failure rather than a blank
 *     dark rectangle.
 *   - After iframe `load`, we wait 1500ms and peek at the app's
 *     `#root` (or `body`) children. If still empty, we replace the
 *     loading placeholder with a diagnostic card explaining the
 *     most likely cause (app JS threw → bare `react` imports
 *     unresolvable). This is the Phase H5 fix from the v1.4.6
 *     "Still White" diagnostic — turns a silent failure into a
 *     user-visible, user-actionable one.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;
	if ( ! window.__odd || ! window.__odd.events ) return;

	var events = window.__odd.events;
	var APP_ID_PREFIX = 'odd-app-';

	function cfg() {
		return ( window.odd && typeof window.odd === 'object' ) ? window.odd : {};
	}
	function serveUrlFor( slug ) {
		var map = cfg().appServeUrls;
		if ( ! map || typeof map !== 'object' ) return '';
		return typeof map[ slug ] === 'string' ? map[ slug ] : '';
	}
	function installedSlugs() {
		var ua = cfg().userApps;
		if ( ! ua || ! Array.isArray( ua.installed ) ) return [];
		return ua.installed.slice();
	}
	function cursorStylesheetUrl() {
		return typeof cfg().cursorStylesheet === 'string' ? cfg().cursorStylesheet : '';
	}
	function injectCursorStylesheet( frame, href ) {
		href = href || cursorStylesheetUrl();
		if ( ! frame ) return;
		var doc;
		try { doc = frame.contentDocument; } catch ( e ) { return; }
		if ( ! doc || ! doc.head ) return;
		var runtime = window.__odd && window.__odd.cursors;
		if ( runtime && typeof runtime.injectInto === 'function' ) {
			if ( href ) runtime.injectInto( doc, href );
			else if ( typeof runtime.clear === 'function' ) runtime.clear( doc );
			return;
		}
		if ( ! href ) {
			var existing = doc.getElementById( 'odd-cursors-css' );
			if ( existing && existing.parentNode ) existing.parentNode.removeChild( existing );
			return;
		}
		var link = doc.getElementById( 'odd-cursors-css' );
		if ( ! link ) {
			link = doc.createElement( 'link' );
			link.id = 'odd-cursors-css';
			link.rel = 'stylesheet';
			doc.head.appendChild( link );
		}
		link.setAttribute( 'href', href );
	}
	function injectCursorStylesheetIntoOpenFrames( href ) {
		var frames = document.querySelectorAll( 'iframe.odd-app-frame' );
		for ( var i = 0; i < frames.length; i++ ) {
			injectCursorStylesheet( frames[ i ], href );
		}
	}

	function slugFromWindowId( id ) {
		if ( typeof id !== 'string' ) return '';
		if ( id.indexOf( APP_ID_PREFIX ) !== 0 ) return '';
		return id.slice( APP_ID_PREFIX.length );
	}

	function findMount( slug ) {
		var nodes = document.querySelectorAll( '.odd-app-host[data-odd-app-slug="' + slug + '"]' );
		if ( ! nodes.length ) return null;
		// Prefer the one inside a visible window (offsetParent !== null
		// under most layouts). Fall back to the last-rendered node.
		for ( var i = nodes.length - 1; i >= 0; i-- ) {
			if ( nodes[ i ].offsetParent !== null ) return nodes[ i ];
		}
		return nodes[ nodes.length - 1 ];
	}

	/**
	 * Ensure a mount has its iframe. Returns one of three strings so
	 * callers can decide whether to fire APP_OPENED or skip it:
	 *   - 'mounted'     : iframe was newly inserted.
	 *   - 'already'     : iframe was already present — no-op.
	 *   - 'skipped'     : mount was missing or lacked a src attr.
	 *
	 * This matters because both the WINDOW_OPENED handler and the
	 * defensive MutationObserver path call installFrame independently.
	 * Without the return code, the slower path re-emits APP_OPENED on
	 * an already-mounted frame — double-firing downstream subscribers
	 * (muse, motion, analytics).
	 */
	function installFrame( mount ) {
		if ( ! mount ) return 'skipped';
		if ( mount.querySelector( 'iframe.odd-app-frame' ) ) return 'already';
		var src = mount.getAttribute( 'data-odd-app-src' );
		if ( ! src ) {
			var fallbackSlug = mount.getAttribute( 'data-odd-app-slug' );
			src = fallbackSlug ? serveUrlFor( fallbackSlug ) : '';
			if ( src ) mount.setAttribute( 'data-odd-app-src', src );
		}
		if ( ! src ) return 'skipped';

		var frame = document.createElement( 'iframe' );
		frame.className = 'odd-app-frame';
		frame.src = src;
		frame.setAttribute( 'sandbox', 'allow-scripts allow-forms allow-popups allow-same-origin allow-downloads' );
		frame.setAttribute( 'loading', 'eager' );
		frame.setAttribute( 'referrerpolicy', 'no-referrer' );
		frame.setAttribute( 'allow', 'clipboard-read; clipboard-write; fullscreen' );
		frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#101014;';
		frame.addEventListener( 'error', function ( e ) {
			events.emit( events.NAMES.IFRAME_ERROR, { message: 'app frame error', err: e } );
		} );
		frame.addEventListener( 'load', function () {
			var loading = mount.querySelector( '.odd-app-host__loading' );
			if ( loading ) loading.style.display = 'none';
			injectCursorStylesheet( frame );
			// Empty-root watchdog. Most installed apps are Vite/React
			// bundles with a `<div id="root">` that React mounts into
			// on startup. If React never mounts (e.g. the importmap
			// runtime threw "React is unavailable"), `#root` stays
			// empty and the iframe paints pure white. We detect this
			// same-origin (our `allow-same-origin` sandbox permits
			// cross-frame DOM access within the same origin) and
			// surface a diagnostic card after a short grace period
			// so the user sees an actionable message instead of a
			// blank dark rectangle.
			window.setTimeout( function () {
				watchdogCheckEmpty( mount, frame );
			}, 1500 );
		} );
		mount.appendChild( frame );
		return 'mounted';
	}

	/**
	 * Post-load empty-root check. Silent no-op on cross-origin
	 * iframes (we can't peek into those), on iframes that already
	 * navigated away, and on iframes whose body clearly has content.
	 */
	function watchdogCheckEmpty( mount, frame ) {
		if ( ! frame || ! frame.isConnected ) return;
		var doc;
		try { doc = frame.contentDocument; } catch ( e ) { return; }
		if ( ! doc || ! doc.body ) return;

		// Prefer `#root` (the Vite/React convention every catalog
		// app uses). Fall back to `body` so this also covers apps
		// that mount directly onto the body.
		var mountTarget = doc.getElementById( 'root' ) || doc.body;
		if ( ! mountTarget ) return;
		if ( mountTarget.children.length > 0 ) return;
		if ( ( mountTarget.textContent || '' ).trim().length > 0 ) return;

		// Still empty. The ODD plugin now ships its own React 19
		// runtime under /odd-app-runtime/*.js, so the classic
		// `wp.element`-missing / bare-react-imports failure mode
		// from earlier releases is gone. If we reach this point
		// the most likely cause is a runtime exception thrown by
		// the app itself (e.g. an unhandled render error).
		var loading = mount.querySelector( '.odd-app-host__loading' );
		if ( ! loading ) return;
		loading.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;color:#eaeaf0;background:#1a1420;padding:24px;text-align:center;font:13px/1.5 -apple-system,system-ui,sans-serif;';
		var hint = 'The app loaded but did not render. Right-click inside the window → Inspect, switch the DevTools context to this frame, and check the Console for errors.';
		loading.innerHTML = '';
		var card = document.createElement( 'div' );
		card.style.cssText = 'max-width:460px;display:grid;gap:10px;';
		var title = document.createElement( 'div' );
		title.style.cssText = 'font-weight:600;font-size:14px;color:#ffd9a3;';
		title.textContent = 'App did not render';
		var body = document.createElement( 'div' );
		body.style.cssText = 'opacity:.88;';
		body.textContent = hint;
		card.appendChild( title );
		card.appendChild( body );
		loading.appendChild( card );
		loading.style.display = 'grid';

		events.emit( events.NAMES.IFRAME_ERROR, {
			message: 'odd-apps: iframe loaded but app root stayed empty',
		} );
	}

	/**
	 * Build a `.odd-app-host` mount div inside an arbitrary body
	 * element and install the iframe. Used by the JS hydration
	 * path (wpDesktopNativeWindows callback) so app windows render
	 * correctly even when the server-side `<template>` was never
	 * emitted or was dropped before reaching the DOM.
	 */
	function buildAndMount( body, slug ) {
		if ( ! body || ! slug ) return 'skipped';
		// Reuse any existing host the server may already have
		// painted (avoids double-mounts on session-restore paths).
		var existing = body.querySelector( '.odd-app-host[data-odd-app-slug="' + slug + '"]' );
		if ( existing ) {
			return installFrame( existing );
		}
		var src = serveUrlFor( slug );
		var host = document.createElement( 'div' );
		host.className = 'odd-app-host';
		host.setAttribute( 'data-odd-app', '' );
		host.setAttribute( 'data-odd-app-slug', slug );
		if ( src ) host.setAttribute( 'data-odd-app-src', src );
		host.style.cssText = 'position:absolute;inset:0;background:#101014;';

		var loading = document.createElement( 'div' );
		loading.className = 'odd-app-host__loading';
		loading.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;color:#d0d0e0;font:13px/1.4 -apple-system,system-ui,sans-serif;opacity:.8';
		loading.textContent = src
			? ( 'Loading ' + slug + '…' )
			: ( 'No serve URL registered for "' + slug + '". Reload the desktop to refresh the app list.' );
		host.appendChild( loading );

		body.appendChild( host );
		return installFrame( host );
	}

	function removeFrame( slug ) {
		var mount = findMount( slug );
		if ( ! mount ) return;
		var frame = mount.querySelector( 'iframe.odd-app-frame' );
		if ( frame ) frame.remove();
		var loading = mount.querySelector( '.odd-app-host__loading' );
		if ( loading ) loading.style.display = '';
	}

	/**
	 * WPDM can fire window-opened before our template is painted.
	 * A single rAF is usually enough, but some theme transitions
	 * (fade-in animations, lazy-rendered windows) defer the body
	 * render for several frames. We retry up to ~30 animation
	 * frames (~500ms at 60fps) and then give up silently — the
	 * loading placeholder stays visible if the mount never arrives.
	 */
	function waitForMount( slug, attemptsLeft, cb ) {
		var mount = findMount( slug );
		if ( mount ) { cb( mount ); return; }
		if ( attemptsLeft <= 0 ) { cb( null ); return; }
		window.requestAnimationFrame( function () {
			waitForMount( slug, attemptsLeft - 1, cb );
		} );
	}

	events.on( events.NAMES.WINDOW_OPENED, function ( payload ) {
		if ( ! payload || typeof payload !== 'object' ) return;
		var slug = slugFromWindowId( payload.id );
		if ( ! slug ) return;
		waitForMount( slug, 30, function ( mount ) {
			var result = installFrame( mount );
			// If the MutationObserver path already mounted the iframe
			// AND already emitted APP_OPENED, don't double-fire.
			if ( result === 'already' ) return;
			events.emit( events.NAMES.APP_OPENED, { slug: slug, windowId: payload.id } );
		} );
	} );

	events.on( events.NAMES.WINDOW_CLOSED, function ( payload ) {
		if ( ! payload || typeof payload !== 'object' ) return;
		var slug = slugFromWindowId( payload.id );
		if ( ! slug ) return;
		removeFrame( slug );
		events.emit( events.NAMES.APP_CLOSED, { slug: slug, windowId: payload.id } );
	} );

	events.on( events.NAMES.WINDOW_FOCUSED, function ( payload ) {
		if ( ! payload || typeof payload !== 'object' ) return;
		var slug = slugFromWindowId( payload.id );
		if ( ! slug ) return;
		events.emit( events.NAMES.APP_FOCUSED, { slug: slug, windowId: payload.id } );
	} );

	/**
	 * Defensive fallback. Not every WPDM build fires
	 * `wp-desktop.window.opened` for server-templated windows — e.g.
	 * a window that was restored from a persisted session at page
	 * load may just be dropped into the DOM with no hook call. To
	 * keep installed apps from appearing "dead", we also watch the
	 * DOM for any `.odd-app-host[data-odd-app]` node that lacks an
	 * iframe and install one as soon as it appears.
	 *
	 * This mirrors the event-driven path and dedupes on the
	 * iframe-already-present check inside installFrame, so a window
	 * that does fire the event won't end up with two frames.
	 */
	function scanAndMount( root ) {
		var scope = root && root.querySelectorAll ? root : document;
		var hosts = scope.querySelectorAll( '.odd-app-host[data-odd-app]' );
		for ( var i = 0; i < hosts.length; i++ ) {
			var host = hosts[ i ];
			if ( host.querySelector( 'iframe.odd-app-frame' ) ) continue;
			var slug = host.getAttribute( 'data-odd-app-slug' );
			if ( ! slug ) continue;
			var result = installFrame( host );
			// Only emit APP_OPENED on an actual new mount. Without the
			// guard, a stale host that already has an iframe would
			// re-emit every time the observer picks it up.
			if ( result !== 'mounted' ) continue;
			events.emit( events.NAMES.APP_OPENED, { slug: slug, windowId: APP_ID_PREFIX + slug } );
		}
	}

	function startObserver() {
		if ( ! window.MutationObserver || ! document.body ) return;
		scanAndMount( document );
		var mo = new MutationObserver( function ( mutations ) {
			for ( var i = 0; i < mutations.length; i++ ) {
				var m = mutations[ i ];
				if ( ! m.addedNodes || ! m.addedNodes.length ) continue;
				for ( var j = 0; j < m.addedNodes.length; j++ ) {
					var n = m.addedNodes[ j ];
					if ( n.nodeType !== 1 ) continue;
					if ( n.matches && n.matches( '.odd-app-host[data-odd-app]' ) ) {
						scanAndMount( n.parentNode || document );
					} else if ( n.querySelector && n.querySelector( '.odd-app-host[data-odd-app]' ) ) {
						scanAndMount( n );
					}
				}
			}
		} );
		mo.observe( document.body, { childList: true, subtree: true } );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', startObserver, { once: true } );
	} else {
		startObserver();
	}

	/**
	 * Client-side hydration — register a `wpDesktopNativeWindows`
	 * render callback for every installed app. WPDM's window
	 * manager prefers these callbacks over the server `<template>`
	 * clone path, so even if the template emission failed for any
	 * reason (closure serialization, admin_footer skipped, mid-
	 * session install without a page reload), the window body is
	 * still built correctly.
	 *
	 * The callback just delegates to buildAndMount(), which:
	 *   - dedupes against any pre-existing server-rendered host,
	 *   - builds a fresh `.odd-app-host` div + loading placeholder,
	 *   - installs the sandboxed iframe, and
	 *   - keeps the loading placeholder visible until the iframe
	 *     fires `load` (so the user always sees SOMETHING).
	 */
	function registerWpdmCallbacks() {
		var reg = window.wpDesktopNativeWindows = window.wpDesktopNativeWindows || {};
		var slugs = installedSlugs();
		for ( var i = 0; i < slugs.length; i++ ) {
			( function ( slug ) {
				var id = APP_ID_PREFIX + slug;
				if ( typeof reg[ id ] === 'function' ) return; // Respect any override.
				reg[ id ] = function ( body ) {
					var result = buildAndMount( body, slug );
					if ( result === 'mounted' ) {
						events.emit( events.NAMES.APP_OPENED, { slug: slug, windowId: id } );
					}
				};
			} )( slugs[ i ] );
		}
	}

	// Register eagerly so a session-restored window that opens
	// before DOMContentLoaded still finds its callback.
	registerWpdmCallbacks();

	if ( window.wp && window.wp.hooks && typeof window.wp.hooks.addAction === 'function' ) {
		window.wp.hooks.addAction( 'odd.cursorSet', 'odd.apps.cursors', function ( slug, href ) {
			if ( href ) cfg().cursorStylesheet = href;
			injectCursorStylesheetIntoOpenFrames( href || cursorStylesheetUrl() );
		} );
	}

	// Re-register after page load in case `window.odd` was
	// populated by a late inline <script> (some WPDM shell
	// orderings localize after ODD's scripts enqueue).
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', registerWpdmCallbacks, { once: true } );
	}

	// Expose for tests + debugging.
	window.__odd = window.__odd || {};
	window.__odd.apps = window.__odd.apps || {};
	window.__odd.apps.buildAndMount = buildAndMount;
	window.__odd.apps.installFrame = installFrame;
	window.__odd.apps.injectCursorStylesheet = injectCursorStylesheet;
	window.__odd.apps.registerWpdmCallbacks = registerWpdmCallbacks;
} )();
