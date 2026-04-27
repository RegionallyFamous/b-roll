/**
 * {{name}} widget.
 */
( function () {
	'use strict';
	var api = window.__odd && window.__odd.api;
	if ( ! api || typeof api.registerWidget !== 'function' ) {
		return;
	}
	api.registerWidget( {
		id:    'odd/{{slug}}',
		label: '{{name}}',
		mount: function ( root ) {
			var el = document.createElement( 'div' );
			el.className = 'odd-{{slug}}';
			el.textContent = 'Hello from {{name}}';
			root.appendChild( el );
			return function unmount() { root.removeChild( el ); };
		},
	} );
} )();
