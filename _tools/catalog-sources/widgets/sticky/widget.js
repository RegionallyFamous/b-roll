( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	var wpI18nW = window.wp && window.wp.i18n;
	function __( s ) {
		return ( wpI18nW && typeof wpI18nW.__ === 'function' ) ? wpI18nW.__( s, 'odd' ) : s;
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

	function storageGet( ctx, key ) {
		try {
			if ( ctx && ctx.storage && typeof ctx.storage.get === 'function' ) {
				var stored = ctx.storage.get( key );
				return stored == null ? '' : String( stored );
			}
		} catch ( e ) {}
		return '';
	}

	function storageSet( ctx, key, value ) {
		try {
			if ( ctx && ctx.storage && typeof ctx.storage.set === 'function' ) {
				ctx.storage.set( key, value );
			}
		} catch ( e ) {}
	}

	var STICKY_MAX = 10000;

	function mountSticky( container, ctx ) {
		var card = null;
		if ( container && typeof container.closest === 'function' ) {
			card = container.closest( '[data-widget-id="odd/sticky"]' );
		}
		if ( card ) {
			card.classList.add( 'odd-widget-card--sticky' );
		}
		container.classList.add( 'odd-widget-host--sticky' );

		var root  = el( 'div', { class: 'odd-widget odd-widget--sticky' } );
		var paper = el( 'div', { class: 'odd-sticky__paper' } );
		var tape  = el( 'div', { class: 'odd-sticky__tape', 'aria-hidden': 'true' } );
		var peel  = el( 'div', { class: 'odd-sticky__peel', 'aria-hidden': 'true' } );
		var body  = el( 'div', { class: 'odd-sticky__body' } );
		var ta    = el( 'textarea', {
			class:       'odd-sticky__text',
			maxlength:   String( STICKY_MAX ),
			placeholder: __( 'Write it before it floats away...' ),
			spellcheck:  'true',
			'aria-label': __( 'Sticky note' ),
		} );
		var status  = el( 'p', { class: 'odd-sticky__status', 'aria-live': 'polite' }, __( 'Saved' ) );

		body.appendChild( ta );
		paper.appendChild( tape );
		paper.appendChild( body );
		paper.appendChild( peel );
		paper.appendChild( status );
		root.appendChild( paper );
		container.replaceChildren( root );

		ta.value = storageGet( ctx, 'text' );

		function setStatus( text ) {
			status.textContent = text;
		}

		var saveTimer = 0;
		function scheduleSave() {
			if ( saveTimer ) window.clearTimeout( saveTimer );
			setStatus( __( 'Saving...' ) );
			saveTimer = window.setTimeout( function () {
				saveTimer = 0;
				storageSet( ctx, 'text', ta.value );
				setStatus( __( 'Saved' ) );
			}, 400 );
		}

		function onInput() {
			scheduleSave();
		}
		ta.addEventListener( 'input', onInput );

		return function () {
			if ( saveTimer ) {
				window.clearTimeout( saveTimer );
				storageSet( ctx, 'text', ta.value );
			}
			ta.removeEventListener( 'input', onInput );
			if ( card ) {
				card.classList.remove( 'odd-widget-card--sticky' );
			}
			container.classList.remove( 'odd-widget-host--sticky' );
			if ( root.parentNode === container ) {
				root.remove();
			}
		};
	}

	window.desktopModeWidgets = window.desktopModeWidgets || {};
	window.desktopModeWidgets[ 'odd/sticky' ] = safeMount( mountSticky, 'widget.sticky' );
} )();
