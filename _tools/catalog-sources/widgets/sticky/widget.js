( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	var wpI18nW = window.wp && window.wp.i18n;
	function __( s ) {
		return ( wpI18nW && typeof wpI18nW.__ === 'function' ) ? wpI18nW.__( s, 'odd' ) : s;
	}

	function ready( cb ) {
		if ( window.wp && window.wp.desktop && typeof window.wp.desktop.ready === 'function' ) {
			window.wp.desktop.ready( cb );
		} else if ( document.readyState === 'loading' ) {
			document.addEventListener( 'DOMContentLoaded', cb, { once: true } );
		} else {
			cb();
		}
	}

	function el( tag, attrs, children ) {
		var n = document.createElement( tag );
		if ( attrs ) {
			for ( var k in attrs ) {
				if ( ! Object.prototype.hasOwnProperty.call( attrs, k ) ) continue;
				if ( k === 'class' ) n.className = attrs[ k ];
				else if ( k === 'style' ) n.setAttribute( 'style', attrs[ k ] );
				else n.setAttribute( k, attrs[ k ] );
			}
		}
		if ( children ) {
			if ( ! Array.isArray( children ) ) children = [ children ];
			children.forEach( function ( c ) {
				if ( c == null ) return;
				n.appendChild( typeof c === 'string' ? document.createTextNode( c ) : c );
			} );
		}
		return n;
	}

	function reducedMotion() {
		try {
			return window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
		} catch ( e ) { return false; }
	}

	function safeMount( fn, source ) {
		return function ( node, ctx ) {
			try {
				return fn( node, ctx );
			} catch ( err ) {
				if ( window.__odd && window.__odd.events ) {
					try {
						window.__odd.events.emit( 'odd.error', {
							source:   source,
							err:      err,
							severity: 'error',
							message:  err && err.message,
							stack:    err && err.stack,
						} );
					} catch ( e2 ) {}
				}
				if ( window.console ) { try { window.console.error( '[ODD ' + source + ']', err ); } catch ( e3 ) {} }
				return function () {};
			}
		};
	}

	var STICKY_KEY      = 'odd:sticky';
		var STICKY_TILT_KEY = 'odd:sticky:tilt';
		var STICKY_MAX      = 2000;
	
		function readStickyTilt() {
			try {
				var raw = window.localStorage.getItem( STICKY_TILT_KEY );
				if ( raw == null ) return null;
				var n = parseFloat( raw );
				if ( ! isFinite( n ) ) return null;
				return Math.max( -3, Math.min( 3, n ) );
			} catch ( e ) { return null; }
		}
		function writeStickyTilt( n ) {
			try { window.localStorage.setItem( STICKY_TILT_KEY, String( n ) ); } catch ( e ) {}
		}
	
		function mountSticky( container ) {
			container.classList.add( 'odd-widget', 'odd-widget--sticky' );
	
			var tilt = readStickyTilt();
			if ( tilt == null ) {
				tilt = ( Math.random() * 4 - 2 ); // -2..+2
				writeStickyTilt( tilt );
			}
			if ( reducedMotion() ) tilt = 0;
	
			var paper = el( 'div', { class: 'odd-sticky__paper', style: 'transform:rotate(' + tilt.toFixed( 2 ) + 'deg)' } );
			var peel  = el( 'div', { class: 'odd-sticky__peel', 'aria-hidden': 'true' } );
			var ta    = el( 'textarea', {
				class:       'odd-sticky__text',
				maxlength:   String( STICKY_MAX ),
				placeholder: __( 'Scribble something…' ),
				spellcheck:  'true',
				'aria-label': __( 'Sticky note' ),
			} );
			var meta  = el( 'div', { class: 'odd-sticky__meta', 'aria-hidden': 'true' } );
	
			paper.appendChild( ta );
			paper.appendChild( peel );
			paper.appendChild( meta );
			container.appendChild( paper );
	
			try { ta.value = window.localStorage.getItem( STICKY_KEY ) || ''; } catch ( e ) {}
	
			function renderMeta() {
				meta.textContent = ta.value.length + ' / ' + STICKY_MAX;
			}
			renderMeta();
	
			var saveTimer = 0;
			function scheduleSave() {
				if ( saveTimer ) window.clearTimeout( saveTimer );
				saveTimer = window.setTimeout( function () {
					saveTimer = 0;
					try { window.localStorage.setItem( STICKY_KEY, ta.value ); } catch ( e ) {}
				}, 400 );
			}
	
			function onInput() {
				renderMeta();
				scheduleSave();
			}
			ta.addEventListener( 'input', onInput );
	
			return function () {
				if ( saveTimer ) {
					window.clearTimeout( saveTimer );
					try { window.localStorage.setItem( STICKY_KEY, ta.value ); } catch ( e ) {}
				}
				ta.removeEventListener( 'input', onInput );
				container.classList.remove( 'odd-widget', 'odd-widget--sticky' );
			};
		}

	ready( function () {
		if ( ! window.wp || ! window.wp.desktop || typeof window.wp.desktop.registerWidget !== 'function' ) return;
		window.wp.desktop.registerWidget( {
			id:            'odd/sticky',
			label:         __( 'ODD · Sticky Note' ),
			description:   __( 'A tilted handwritten note that auto-saves as you type.' ),
			icon:          'dashicons-welcome-write-blog',
			movable:       true,
			resizable:     true,
			minWidth:      220,
			minHeight:     160,
			defaultWidth:  260,
			defaultHeight: 200,
			mount:         safeMount( mountSticky, 'widget.sticky' ),
		} );
	} );
} )();
