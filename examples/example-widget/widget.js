/**
 * ODD example widget — says hello.
 *
 * Reference implementation of a widget bundle. The host loads
 * widget.js + widget.css, then your IIFE calls registerWidget() with
 * a mount callback that populates a DOM node in the desktop.
 */
( function () {
	'use strict';
	var api = window.__odd && window.__odd.api;
	if ( ! api || typeof api.registerWidget !== 'function' ) {
		return;
	}
	api.registerWidget( {
		id:    'odd/example-hello',
		label: 'Hello',
		mount: function ( root ) {
			var h = document.createElement( 'div' );
			h.className = 'odd-example-hello';
			h.textContent = 'Hello from example-hello 👋';
			root.appendChild( h );
			return function unmount() { root.removeChild( h ); };
		},
	} );
} )();
