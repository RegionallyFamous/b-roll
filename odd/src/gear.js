/**
 * ODD — floating gear pill.
 * ---------------------------------------------------------------
 * Mounts a single circular gear button in the bottom-left corner
 * of the WP Desktop Mode shell — the bottom-right is reserved for
 * WP Desktop's widget tray. Clicking it opens the ODD Control
 * Panel native window — one control surface for wallpaper + icons.
 *
 * The click handler routes through `wp.desktop.registerWindow()`
 * which focuses an existing instance (single-instance by matching
 * baseId) or opens a fresh one. The server-side
 * `wp_register_desktop_window( 'odd', ... )` has already loaded
 * the panel's template + script via the shell's native-window
 * sync, so the render callback on
 * `window.wpDesktopNativeWindows.odd` is ready by boot.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' || typeof document === 'undefined' ) return;

	var cfg = window.odd || {};

	function openPanel() {
		try {
			if ( window.wp && window.wp.desktop && typeof window.wp.desktop.registerWindow === 'function' ) {
				window.wp.desktop.registerWindow( {
					id:     'odd',
					baseId: 'odd',
					title:  'ODD Control Panel',
					icon:   'dashicons-admin-generic',
					width:  820,
					height: 560,
					render: function ( body ) {
						var reg = window.wpDesktopNativeWindows;
						if ( reg && typeof reg.odd === 'function' ) {
							reg.odd( body );
						}
					},
				} );
				return;
			}
		} catch ( e ) { /* fall through to manager.open */ }

		try {
			if ( window.wp && window.wp.desktop && window.wp.desktop.windowManager ) {
				window.wp.desktop.windowManager.open( {
					id: 'odd',
					baseId: 'odd',
					native: true,
					url: '#odd',
					title: 'ODD Control Panel',
					width: 820,
					height: 560,
					render: function ( body ) {
						var reg = window.wpDesktopNativeWindows;
						if ( reg && typeof reg.odd === 'function' ) {
							reg.odd( body );
						}
					},
				} );
			}
		} catch ( e ) { /* ignore */ }
	}

	function mountGear() {
		if ( document.querySelector( '[data-odd-gear]' ) ) return;

		var btn = document.createElement( 'button' );
		btn.type = 'button';
		btn.setAttribute( 'data-odd-gear', '1' );
		btn.setAttribute( 'aria-label', 'Open ODD Control Panel' );
		btn.title = 'ODD';
		btn.innerHTML = (
			'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
			'<path fill="currentColor" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm9 3.5a9.3 9.3 0 0 0-.2-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.4a.5.5 0 0 0-.6-.2l-2.5 1a7 7 0 0 0-1.7-1L15.8 1a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7 7 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.4a.5.5 0 0 0 .1.6L5.2 10a9.3 9.3 0 0 0 0 4L3.1 15.6a.5.5 0 0 0-.1.6l2 3.4a.5.5 0 0 0 .6.2l2.5-1c.5.4 1 .8 1.7 1l.4 2.6a.5.5 0 0 0 .5.4h4a.5.5 0 0 0 .5-.4l.4-2.6a7 7 0 0 0 1.7-1l2.5 1a.5.5 0 0 0 .6-.2l2-3.4a.5.5 0 0 0-.1-.6L20.8 14c.1-.7.2-1.3.2-2z"/>' +
			'</svg>'
		);
		btn.style.cssText = [
			'position:fixed',
			'left:12px',
			'bottom:12px',
			'width:40px',
			'height:40px',
			'border-radius:50%',
			'border:1px solid rgba(255,255,255,.18)',
			'background:rgba(20,22,28,.72)',
			'color:#fff',
			'display:inline-flex',
			'align-items:center',
			'justify-content:center',
			'cursor:pointer',
			'z-index:2147483646',
			'backdrop-filter:blur(10px)',
			'-webkit-backdrop-filter:blur(10px)',
			'box-shadow:0 6px 18px rgba(0,0,0,.35)',
			'transition:transform .16s ease, background .16s ease',
		].join( ';' );

		btn.addEventListener( 'mouseenter', function () {
			btn.style.transform = 'scale(1.06)';
			btn.style.background = 'rgba(30,34,44,.86)';
		} );
		btn.addEventListener( 'mouseleave', function () {
			btn.style.transform = '';
			btn.style.background = 'rgba(20,22,28,.72)';
		} );
		btn.addEventListener( 'click', openPanel );

		document.body.appendChild( btn );
	}

	function boot() {
		mountGear();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}

	// Tiny dev API for manual tests / e2e.
	window.__odd = window.__odd || {};
	window.__odd.openPanel = openPanel;
	window.__odd.version   = cfg.version || '';
} )();
