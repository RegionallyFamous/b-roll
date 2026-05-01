/**
 * ODD custom cursor runtime.
 * ---------------------------------------------------------------
 * Owns the active cursor stylesheet link for the current document.
 * PHP provides the active URL; this module makes sure that URL is
 * actually installed in the Desktop Mode shell, wp-admin, and any
 * same-origin ODD app frames that opt in through injectInto().
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' || typeof document === 'undefined' ) return;

	window.__odd = window.__odd || {};

	var LINK_ID = 'odd-cursors-css';
	var lastWarningHref = '';
	var semanticKinds = {
		default:       true,
		pointer:       true,
		text:          true,
		grab:          true,
		grabbing:      true,
		crosshair:     true,
		'not-allowed': true,
		wait:          true,
		help:          true,
		progress:      true,
	};
	var state = {
		slug:             '',
		href:             '',
		status:           'idle',
		error:            '',
		iframeInjections: [],
	};
	var bridged = [];

	function cfg() {
		return ( window.odd && typeof window.odd === 'object' ) ? window.odd : {};
	}

	function shellConfig() {
		return ( window.wpDesktopConfig && typeof window.wpDesktopConfig === 'object' ) ? window.wpDesktopConfig : {};
	}

	function configuredHref() {
		var c = cfg();
		var shell = shellConfig();
		if ( typeof c.cursorStylesheet === 'string' && c.cursorStylesheet ) return c.cursorStylesheet;
		if ( typeof shell.oddCursorStylesheet === 'string' && shell.oddCursorStylesheet ) return shell.oddCursorStylesheet;
		if ( typeof shell.cursorStylesheet === 'string' && shell.cursorStylesheet ) return shell.cursorStylesheet;
		return '';
	}

	function configuredSlug() {
		var c = cfg();
		var shell = shellConfig();
		if ( typeof c.cursorSet === 'string' ) return c.cursorSet;
		if ( typeof shell.oddCursorSet === 'string' ) return shell.oddCursorSet;
		return '';
	}

	function configuredTokens() {
		var shell = shellConfig();
		if ( shell.oddCursor && shell.oddCursor.tokens && typeof shell.oddCursor.tokens === 'object' ) {
			return shell.oddCursor.tokens;
		}
		return {};
	}

	function activeSet() {
		var slug = state.slug || configuredSlug();
		var sets = cfg().cursorSets;
		if ( ! slug || ! Array.isArray( sets ) ) return null;
		for ( var i = 0; i < sets.length; i++ ) {
			if ( sets[ i ] && sets[ i ].slug === slug ) return sets[ i ];
		}
		return null;
	}

	function cursorValue( kind ) {
		var set = activeSet();
		var cursors = set && set.cursors;
		var spec = cursors && ( cursors[ kind ] || cursors.default );
		if ( ! spec || ! spec.url ) {
			var tokens = configuredTokens();
			return typeof tokens[ kind ] === 'string' ? tokens[ kind ] : '';
		}
		var hotspot = Array.isArray( spec.hotspot ) ? spec.hotspot : [ 0, 0 ];
		var x = parseInt( hotspot[ 0 ], 10 );
		var y = parseInt( hotspot[ 1 ], 10 );
		if ( isNaN( x ) ) x = 0;
		if ( isNaN( y ) ) y = 0;
		return 'url("' + spec.url + '") ' + x + ' ' + y + ', ' + kind;
	}

	function headFor( doc ) {
		if ( ! doc ) return null;
		return doc.head || doc.getElementsByTagName( 'head' )[ 0 ] || doc.documentElement || null;
	}

	function linkFor( doc, create ) {
		doc = doc || document;
		var link = doc.getElementById ? doc.getElementById( LINK_ID ) : null;
		if ( ! link && create ) {
			var head = headFor( doc );
			if ( ! head || ! doc.createElement ) return null;
			link = doc.createElement( 'link' );
			link.id = LINK_ID;
			link.rel = 'stylesheet';
			link.setAttribute( 'data-odd-cursors', '1' );
			head.appendChild( link );
		}
		return link;
	}

	function removeLink( doc ) {
		var link = linkFor( doc || document, false );
		if ( link && link.parentNode ) link.parentNode.removeChild( link );
	}

	function bindLinkEvents( link, href ) {
		if ( ! link || link.__oddCursorHref === href ) return;
		link.__oddCursorHref = href;
		link.onload = function () {
			state.status = 'loaded';
			state.error = '';
		};
		link.onerror = function () {
			state.status = 'error';
			state.error = 'Stylesheet failed to load';
			if ( href && lastWarningHref !== href ) {
				lastWarningHref = href;
				try { window.console.warn( '[ODD] Cursor stylesheet failed to load:', href ); } catch ( e ) {}
			}
		};
	}

	function shouldClear( href, slug ) {
		return ! href || slug === '' || slug === 'none';
	}

	function setConfig( href, slug ) {
		if ( window.odd && typeof window.odd === 'object' ) {
			window.odd.cursorStylesheet = href || '';
			if ( typeof slug === 'string' ) window.odd.cursorSet = slug === 'none' ? '' : slug;
		}
	}

	function rememberBridge( node ) {
		if ( ! node || node.__oddCursorBridged ) return;
		node.__oddCursorBridged = true;
		node.__oddCursorOriginal = node.style ? node.style.cursor || '' : '';
		bridged.push( node );
	}

	function clearBridged() {
		for ( var i = 0; i < bridged.length; i++ ) {
			var node = bridged[ i ];
			if ( ! node || ! node.style ) continue;
			node.style.cursor = node.__oddCursorOriginal || '';
			try {
				delete node.__oddCursorBridged;
				delete node.__oddCursorOriginal;
			} catch ( e ) {
				node.__oddCursorBridged = false;
				node.__oddCursorOriginal = '';
			}
		}
		bridged = [];
	}

	function mark( node, kind ) {
		if ( ! node || node.nodeType !== 1 ) return node;
		kind = semanticKinds[ kind ] ? kind : 'default';
		try {
			node.setAttribute( 'data-odd-cursor', kind );
		} catch ( e ) {}
		return node;
	}

	function markRoot( node ) {
		if ( ! node || node.nodeType !== 1 ) return node;
		try {
			node.setAttribute( 'data-odd-cursor-root', 'true' );
		} catch ( e ) {}
		return node;
	}

	function markInteractiveDescendants( root ) {
		if ( ! root || ! root.querySelectorAll ) return 0;
		var count = 0;
		var selectors = [
			'a[href]',
			'button',
			'[role="button"]',
			'[tabindex]:not([tabindex="-1"])',
			'summary',
			'label[for]',
			'select',
			'input[type="button"]',
			'input[type="submit"]',
			'input[type="reset"]',
			'input:not([type])',
			'input[type="text"]',
			'input[type="search"]',
			'input[type="email"]',
			'input[type="url"]',
			'input[type="password"]',
			'textarea',
			'[contenteditable="true"]',
			'[contenteditable=""]',
			'[draggable="true"]',
			'[data-drag]',
			'[data-drag-handle]',
			'[aria-disabled="true"]',
			'[disabled]',
			'[aria-busy="true"]',
		].join( ',' );
		var nodes = root.querySelectorAll( selectors );
		for ( var i = 0; i < nodes.length; i++ ) {
			var n = nodes[ i ];
			if ( n.hasAttribute && n.hasAttribute( 'data-odd-cursor' ) ) continue;
			if ( n.matches && n.matches( 'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="password"], textarea, [contenteditable="true"], [contenteditable=""]' ) ) {
				mark( n, 'text' );
			} else if ( n.matches && n.matches( '[draggable="true"], [data-drag], [data-drag-handle]' ) ) {
				mark( n, 'grab' );
			} else if ( n.matches && n.matches( '[disabled], [aria-disabled="true"]' ) ) {
				mark( n, 'not-allowed' );
			} else if ( n.matches && n.matches( '[aria-busy="true"]' ) ) {
				mark( n, 'progress' );
			} else {
				mark( n, 'pointer' );
			}
			count++;
		}
		return count;
	}

	function apply( href, slug, doc ) {
		doc = doc || document;
		href = typeof href === 'string' ? href : configuredHref();
		slug = typeof slug === 'string' ? slug : configuredSlug();

		if ( shouldClear( href, slug ) ) {
			removeLink( doc );
			if ( doc === document ) clearBridged();
			state.slug = slug === 'none' ? '' : slug;
			state.href = '';
			state.status = 'idle';
			state.error = '';
			if ( doc === document ) setConfig( '', state.slug );
			return null;
		}

		var link = linkFor( doc, true );
		if ( ! link ) return null;
		bindLinkEvents( link, href );
		if ( link.getAttribute( 'href' ) !== href ) {
			state.status = 'loading';
			state.error = '';
			link.setAttribute( 'href', href );
		}
		state.slug = slug;
		state.href = href;
		if ( doc === document ) {
			clearBridged();
			setConfig( href, slug );
		}
		return link;
	}

	function clear( doc ) {
		return apply( '', 'none', doc || document );
	}

	function injectInto( doc, href ) {
		if ( ! doc ) return null;
		href = typeof href === 'string' ? href : ( state.href || configuredHref() );
		var slug = state.slug || configuredSlug();
		var link = apply( href, slug, doc );
		if ( doc !== document ) {
			state.iframeInjections.push( {
				time: Date.now ? Date.now() : 0,
				href: link ? link.getAttribute( 'href' ) || '' : '',
				ok:   !! link,
			} );
			if ( state.iframeInjections.length > 20 ) state.iframeInjections.shift();
		}
		return link;
	}

	function sampleCursor( selector ) {
		try {
			var node = document.querySelector( selector );
			return node ? window.getComputedStyle( node ).cursor : '';
		} catch ( e ) {
			return '';
		}
	}

	function nativeKind( cursor ) {
		cursor = typeof cursor === 'string' ? cursor : '';
		if ( cursor.indexOf( 'url(' ) !== -1 ) return '';
		if ( cursor === 'pointer' ) return 'pointer';
		if ( cursor === 'text' || cursor === 'vertical-text' ) return 'text';
		if ( cursor === 'grab' || cursor === 'move' ) return 'grab';
		if ( cursor === 'grabbing' ) return 'grabbing';
		if ( cursor === 'crosshair' ) return 'crosshair';
		if ( cursor === 'not-allowed' || cursor === 'no-drop' ) return 'not-allowed';
		if ( cursor === 'wait' ) return 'wait';
		if ( cursor === 'progress' ) return 'progress';
		if ( cursor === 'help' ) return 'help';
		return '';
	}

	function bridgeNativeCursor( event ) {
		bridgeTarget( event && event.target );
	}

	function bridgeTarget( node ) {
		if ( ! state.href || ! node ) return;
		var limit = document.body;
		while ( node && node !== document && node.nodeType === 1 ) {
			if ( node.closest && node.closest( '[data-odd-cursor], [data-odd-cursor-root], .desktop-mode, .desktop-mode-shell, .wp-desktop, .wp-desktop-root' ) ) {
				return;
			}
			var computed = '';
			try { computed = window.getComputedStyle( node ).cursor; } catch ( e ) {}
			var kind = nativeKind( computed );
			if ( kind ) {
				var value = cursorValue( kind );
				if ( value && node.style && node.style.cursor !== value ) {
					rememberBridge( node );
					node.style.cursor = value;
				}
				return;
			}
			if ( node === limit ) return;
			node = node.parentNode;
		}
	}

	function iframeStatuses() {
		var out = [];
		var frames = document.querySelectorAll ? document.querySelectorAll( 'iframe.odd-app-frame' ) : [];
		for ( var i = 0; i < frames.length; i++ ) {
			var doc = null;
			try { doc = frames[ i ].contentDocument; } catch ( e ) {}
			var link = doc ? linkFor( doc, false ) : null;
			out.push( {
				index: i,
				link:  !! link,
				href:  link ? link.getAttribute( 'href' ) || '' : '',
			} );
		}
		return out;
	}

	function semanticCoverage() {
		var out = {};
		if ( ! document.querySelectorAll ) return out;
		Object.keys( semanticKinds ).forEach( function ( kind ) {
			out[ kind ] = document.querySelectorAll( '[data-odd-cursor="' + kind + '"]' ).length;
		} );
		out.roots = document.querySelectorAll( '[data-odd-cursor-root]' ).length;
		return out;
	}

	function windowCoverage() {
		if ( ! document.querySelectorAll ) return { roots: 0, iframes: 0 };
		return {
			roots: document.querySelectorAll( '[data-window-id][data-odd-cursor-root], [data-windowid][data-odd-cursor-root], [data-wp-desktop-window-id][data-odd-cursor-root], [data-desktop-window-id][data-odd-cursor-root], [data-native-window-id][data-odd-cursor-root]' ).length,
			iframes: iframeStatuses().filter( function ( row ) { return row.link; } ).length,
		};
	}

	function status() {
		var link = linkFor( document, false );
		return {
			activeSlug:     state.slug || configuredSlug(),
			configuredHref: configuredHref(),
			href:           state.href,
			link:           !! link,
			linkHref:        link ? link.getAttribute( 'href' ) || '' : '',
			status:         state.status,
			error:          state.error,
			iframes:        iframeStatuses(),
			iframeInjections: state.iframeInjections.slice(),
			bridged:        bridged.length,
			semantics:      semanticCoverage(),
			windows:        windowCoverage(),
			tokens:         configuredTokens(),
			samples:        {
				body:   sampleCursor( 'body' ),
				button: sampleCursor( 'button, a, [role="button"]' ),
				input:  sampleCursor( 'input, textarea, [contenteditable="true"]' ),
				card:   sampleCursor( '.odd-shop__card, .odd-catalog-row' ),
			},
		};
	}

	function boot() {
		apply( configuredHref(), configuredSlug(), document );
		markInteractiveDescendants( document );
		if ( document.addEventListener && ! document.__oddCursorBridge ) {
			document.__oddCursorBridge = true;
			document.addEventListener( 'pointerover', bridgeNativeCursor, true );
			document.addEventListener( 'mouseover', bridgeNativeCursor, true );
		}
	}

	window.__odd.cursors = {
		apply:      apply,
		bridgeTarget: bridgeTarget,
		clear:      clear,
		injectInto: injectInto,
		mark:       mark,
		markRoot:   markRoot,
		markInteractiveDescendants: markInteractiveDescendants,
		status:     status,
	};

	if ( window.__odd.debug && typeof window.__odd.debug === 'object' ) {
		window.__odd.debug.cursors = status;
	}

	if ( window.wp && window.wp.hooks && typeof window.wp.hooks.addAction === 'function' ) {
		try {
			window.wp.hooks.addAction( 'odd.cursorSet', 'odd.cursors', function ( slug, href ) {
				if ( slug === 'none' || slug === '' ) clear();
				else apply( href || configuredHref(), slug );
			} );
		} catch ( e ) {}
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot, { once: true } );
	} else {
		boot();
	}
} )();
