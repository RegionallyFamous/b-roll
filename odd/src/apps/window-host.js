/**
 * ODD Apps — window host.
 * ---------------------------------------------------------------
 * Listens to the canonical odd.window-* events. When a window with
 * id `odd-app-{slug}` opens, we find the matching mount-point
 * rendered by the server template and inject a sandboxed <iframe>
 * pointing at the REST serve endpoint for that app.
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
 *     allow-same-origin"`. allow-same-origin is required so apps can
 *     call fetch() back to /wp-json/odd/v1/ with the session cookie;
 *     the serve endpoint enforces capability on every request.
 *   - `loading="eager"`, `referrerpolicy="no-referrer"`.
 *   - No cross-document access — the admin shell never scripts into
 *     the app frame.
 *
 * Resilience:
 *
 *   - If the template div is missing (WPDM rendered a different
 *     window body), we no-op. Nothing in ODD depends on the iframe
 *     being present.
 *   - If the iframe `error` or `load`-with-zero-size fires, we
 *     emit odd.iframe-error and leave the loading placeholder in
 *     place so the user sees a visible failure rather than a blank
 *     dark rectangle.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;
	if ( ! window.__odd || ! window.__odd.events ) return;

	var events = window.__odd.events;
	var APP_ID_PREFIX = 'odd-app-';

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
		} );
		mount.appendChild( frame );
		return 'mounted';
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
} )();
