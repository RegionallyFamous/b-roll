( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;
	window.__odd = window.__odd || {};

	function run( root, opts ) {
		opts = opts || {};
		if ( ! root || ! root.appendChild ) return;
		if ( window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) return;
		try {
			var key = opts.chaos ? 'odd.shop.cast.chaos' : 'odd.shop.cast';
			if ( window.sessionStorage && window.sessionStorage.getItem( key ) ) return;
			if ( window.sessionStorage ) window.sessionStorage.setItem( key, '1' );
		} catch ( e ) {}

		var count = opts.chaos ? 5 : 2;
		var pluginUrl = opts.pluginUrl || ( window.odd && window.odd.pluginUrl ) || '';
		for ( var i = 0; i < count; i++ ) {
			var img = document.createElement( 'img' );
			img.className = 'odd-shop__cast-oddling';
			img.alt = '';
			img.src = pluginUrl + '/assets/shop/oddling-' + ( i % 2 ? 'b' : 'a' ) + '.svg';
			img.style.setProperty( '--odd-cast-y', ( 16 + Math.random() * 68 ).toFixed( 1 ) + '%' );
			img.style.setProperty( '--odd-cast-delay', ( i * 260 ).toFixed( 0 ) + 'ms' );
			img.style.setProperty( '--odd-cast-duration', ( opts.chaos ? 6600 : 4200 ) + 'ms' );
			root.appendChild( img );
			( function ( node ) {
				window.setTimeout( function () {
					if ( node && node.parentNode ) node.parentNode.removeChild( node );
				}, ( opts.chaos ? 7600 : 5200 ) + i * 260 );
			} )( img );
		}
	}

	window.__odd.shopCast = { run: run };
} )();
