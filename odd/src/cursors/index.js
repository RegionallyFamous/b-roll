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
	var state = {
		slug:   '',
		href:   '',
		status: 'idle',
		error:  '',
	};

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

	function apply( href, slug, doc ) {
		doc = doc || document;
		href = typeof href === 'string' ? href : configuredHref();
		slug = typeof slug === 'string' ? slug : configuredSlug();

		if ( shouldClear( href, slug ) ) {
			removeLink( doc );
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
		if ( doc === document ) setConfig( href, slug );
		return link;
	}

	function clear( doc ) {
		return apply( '', 'none', doc || document );
	}

	function injectInto( doc, href ) {
		if ( ! doc ) return null;
		href = typeof href === 'string' ? href : ( state.href || configuredHref() );
		var slug = state.slug || configuredSlug();
		return apply( href, slug, doc );
	}

	function sampleCursor( selector ) {
		try {
			var node = document.querySelector( selector );
			return node ? window.getComputedStyle( node ).cursor : '';
		} catch ( e ) {
			return '';
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
	}

	window.__odd.cursors = {
		apply:      apply,
		clear:      clear,
		injectInto: injectInto,
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
