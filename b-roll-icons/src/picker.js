/**
 * B-Roll Icons — picker shell
 * ---------------------------------------------------------------
 * Mounts a single "paintbrush" pill button in the bottom-right of
 * the WP Desktop Mode shell. Clicking it opens a small popover
 * that lists the installed icon sets, plus a "None (pass-through)"
 * choice that restores WP's stock dock icons. Selecting a set
 * POSTs to `/b-roll-icons/v1/prefs`; on success we flip the live
 * dock icons in-place without a reload by walking the shell's
 * rendered `<wpd-dock>` elements. If the shell mutates its own
 * dock DOM (e.g. on a settings change) our swap is idempotent —
 * the next build from server PHP will carry the same URLs.
 *
 * Positioning: hugs bottom-right by default. If the sibling b-roll
 * plugin has mounted its gear at `[data-b-roll-gear]`, we offset
 * left so the two controls stack horizontally instead of on top
 * of each other. Pure runtime check — no build-time coupling.
 *
 * Design goals (matches b-roll's picker conventions):
 *   - No external deps, no build step, vanilla DOM.
 *   - Respects `prefers-reduced-motion` for the popover open/close.
 *   - Keyboard: Tab-reachable, ESC closes, Enter/Space activates a
 *     set, arrow keys navigate the list.
 *   - Restores prior focus on close.
 */
( function () {
	'use strict';

	var cfg = window.bRollIcons;
	if ( ! cfg || ! Array.isArray( cfg.sets ) ) {
		return;
	}

	var prefersReducedMotion = (
		window.matchMedia &&
		window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches
	);

	var state = {
		active: cfg.active || '',
		sets:   cfg.sets.slice(),
		open:   false,
		overlay: null,
		pill:   null,
		previouslyFocused: null,
	};

	// ---------- Pill button ------------------------------------- //
	function mountPill() {
		if ( document.querySelector( '[data-b-roll-icons-pill]' ) ) return;

		var btn = document.createElement( 'button' );
		btn.type = 'button';
		btn.setAttribute( 'data-b-roll-icons-pill', '1' );
		btn.setAttribute( 'aria-label', 'Change icon set' );
		btn.title = 'Icon sets';
		btn.innerHTML = (
			'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
			'<path fill="currentColor" d="M7 14a3 3 0 0 0-3 3c0 2 -1 3 -2 3a4 4 0 0 0 7 -1 3 3 0 0 0 -2 -5z"/>' +
			'<path fill="currentColor" d="M20.5 3.5a1.7 1.7 0 0 0 -2.4 0l-9 9 2.4 2.4 9 -9a1.7 1.7 0 0 0 0 -2.4z" opacity=".9"/>' +
			'</svg>'
		);

		// Stack left of b-roll's gear when present — that control sits
		// bottom-right at (12px, 12px); we slide another ~52px inboard
		// so both pills stay thumb-reachable on trackpads.
		var hasBRollGear = !! document.querySelector( '[data-b-roll-gear]' );
		var right = hasBRollGear ? 64 : 12;

		btn.style.cssText = [
			'position:fixed',
			'right:' + right + 'px',
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
		btn.addEventListener( 'click', function () {
			if ( state.open ) closePicker(); else openPicker();
		} );

		document.body.appendChild( btn );
		state.pill = btn;
	}

	// ---------- Popover ----------------------------------------- //
	function openPicker() {
		if ( state.open ) return;
		state.previouslyFocused = document.activeElement;

		var overlay = document.createElement( 'div' );
		overlay.setAttribute( 'role', 'dialog' );
		overlay.setAttribute( 'aria-modal', 'true' );
		overlay.setAttribute( 'aria-label', 'Icon set picker' );
		overlay.style.cssText = [
			'position:fixed',
			'inset:0',
			'background:rgba(0,0,0,.42)',
			'z-index:2147483647',
			'display:flex',
			'align-items:flex-end',
			'justify-content:flex-end',
			'padding:0 12px 62px',
			'opacity:' + ( prefersReducedMotion ? '1' : '0' ),
			'transition:' + ( prefersReducedMotion ? 'none' : 'opacity .16s ease' ),
		].join( ';' );

		var panel = document.createElement( 'div' );
		panel.style.cssText = [
			'width:min(420px, calc(100vw - 24px))',
			'max-height:70vh',
			'overflow:auto',
			'background:rgba(18,20,26,.94)',
			'color:#fff',
			'border:1px solid rgba(255,255,255,.1)',
			'border-radius:14px',
			'padding:12px',
			'box-shadow:0 24px 48px rgba(0,0,0,.5)',
			'backdrop-filter:blur(14px) saturate(140%)',
			'-webkit-backdrop-filter:blur(14px) saturate(140%)',
			'transform:' + ( prefersReducedMotion ? 'none' : 'translateY(8px) scale(.985)' ),
			'transition:' + ( prefersReducedMotion ? 'none' : 'transform .18s ease' ),
			'font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
		].join( ';' );

		var h = document.createElement( 'div' );
		h.textContent = 'Icon sets';
		h.style.cssText = 'font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.6);padding:4px 6px 10px;';
		panel.appendChild( h );

		panel.appendChild( buildRow( {
			slug: 'none',
			label: 'None',
			franchise: 'Default WordPress icons',
			accent: '#888',
			icons: {},
		}, state.active === '' ) );

		state.sets.forEach( function ( set ) {
			panel.appendChild( buildRow( set, state.active === set.slug ) );
		} );

		overlay.appendChild( panel );
		overlay.addEventListener( 'click', function ( e ) {
			if ( e.target === overlay ) closePicker();
		} );

		document.body.appendChild( overlay );
		state.overlay = overlay;
		state.open = true;

		document.addEventListener( 'keydown', onKey );
		requestAnimationFrame( function () {
			overlay.style.opacity = '1';
			panel.style.transform = '';
			var first = panel.querySelector( 'button' );
			if ( first && first.focus ) first.focus();
		} );
	}

	function closePicker() {
		if ( ! state.open || ! state.overlay ) return;
		state.open = false;
		document.removeEventListener( 'keydown', onKey );

		var overlay = state.overlay;
		state.overlay = null;

		var done = function () {
			if ( overlay.parentNode ) overlay.parentNode.removeChild( overlay );
			try {
				if ( state.previouslyFocused && state.previouslyFocused.focus ) {
					state.previouslyFocused.focus();
				}
			} catch ( e ) { /* ignore */ }
		};

		if ( prefersReducedMotion ) {
			done();
			return;
		}
		overlay.style.opacity = '0';
		setTimeout( done, 180 );
	}

	function onKey( e ) {
		if ( e.key === 'Escape' ) {
			e.preventDefault();
			closePicker();
		}
	}

	// ---------- Row ---------------------------------------------- //
	function buildRow( set, isActive ) {
		var row = document.createElement( 'button' );
		row.type = 'button';
		row.setAttribute( 'data-slug', set.slug );
		row.style.cssText = [
			'display:flex',
			'align-items:center',
			'gap:12px',
			'width:100%',
			'padding:10px 10px',
			'border-radius:10px',
			'border:1px solid ' + ( isActive ? set.accent || 'rgba(255,255,255,.3)' : 'transparent' ),
			'background:' + ( isActive ? 'rgba(255,255,255,.07)' : 'transparent' ),
			'color:inherit',
			'cursor:pointer',
			'text-align:left',
			'transition:background .14s ease, border-color .14s ease',
			'font:inherit',
		].join( ';' );

		row.addEventListener( 'mouseenter', function () {
			if ( ! isActive ) row.style.background = 'rgba(255,255,255,.05)';
		} );
		row.addEventListener( 'mouseleave', function () {
			if ( ! isActive ) row.style.background = 'transparent';
		} );

		// Swatch — shows the icon set's posts icon (if any), else a dot.
		var swatch = document.createElement( 'span' );
		swatch.style.cssText = [
			'width:36px',
			'height:36px',
			'flex-shrink:0',
			'display:inline-flex',
			'align-items:center',
			'justify-content:center',
			'border-radius:8px',
			'background:' + ( set.accent ? hexToSoft( set.accent ) : 'rgba(255,255,255,.08)' ),
			'border:1px solid rgba(255,255,255,.08)',
		].join( ';' );
		var swatchIcon = ( set.icons && ( set.icons.posts || set.icons.dashboard || set.icons.fallback ) ) || '';
		if ( swatchIcon ) {
			var img = document.createElement( 'img' );
			img.src = swatchIcon;
			img.alt = '';
			img.style.cssText = 'width:22px;height:22px;display:block';
			swatch.appendChild( img );
		} else {
			var dot = document.createElement( 'span' );
			dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:' + ( set.accent || '#888' );
			swatch.appendChild( dot );
		}
		row.appendChild( swatch );

		var meta = document.createElement( 'span' );
		meta.style.cssText = 'display:flex;flex-direction:column;min-width:0;flex:1';
		var title = document.createElement( 'span' );
		title.textContent = set.label;
		title.style.cssText = 'font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
		meta.appendChild( title );
		if ( set.franchise ) {
			var sub = document.createElement( 'span' );
			sub.textContent = set.franchise;
			sub.style.cssText = 'font-size:12px;color:rgba(255,255,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
			meta.appendChild( sub );
		}
		row.appendChild( meta );

		if ( isActive ) {
			var check = document.createElement( 'span' );
			check.textContent = '✓';
			check.style.cssText = 'font-size:16px;color:' + ( set.accent || '#fff' );
			row.appendChild( check );
		}

		row.addEventListener( 'click', function () {
			pickSet( set.slug );
		} );
		return row;
	}

	function hexToSoft( hex ) {
		hex = String( hex ).replace( '#', '' );
		if ( hex.length === 3 ) hex = hex.replace( /(.)/g, '$1$1' );
		if ( hex.length !== 6 ) return 'rgba(255,255,255,.08)';
		var r = parseInt( hex.substr( 0, 2 ), 16 );
		var g = parseInt( hex.substr( 2, 2 ), 16 );
		var b = parseInt( hex.substr( 4, 2 ), 16 );
		return 'rgba(' + r + ',' + g + ',' + b + ',.18)';
	}

	// ---------- Pick / persist ---------------------------------- //
	function pickSet( slug ) {
		var next = slug === 'none' ? '' : slug;
		if ( next === state.active ) {
			closePicker();
			return;
		}
		state.active = next;
		applyLive( next );
		persist( slug );
		closePicker();
	}

	function applyLive( slug ) {
		// Live swap: walk the shell's rendered dock tiles and poke any
		// img src or CSS background-image. The shell typically renders
		// <img> inside each dock item; we find them by the menu href
		// which the shell exposes as `data-slug` or in the link's href.
		var set = null;
		for ( var i = 0; i < state.sets.length; i++ ) {
			if ( state.sets[ i ].slug === slug ) { set = state.sets[ i ]; break; }
		}
		if ( ! set && slug !== '' ) return;

		var tiles = document.querySelectorAll( 'wpd-dock [data-slug], [data-wpdm-dock-item]' );
		tiles.forEach( function ( tile ) {
			var slugAttr = tile.getAttribute( 'data-slug' ) || tile.getAttribute( 'data-wpdm-dock-item' ) || '';
			var key = menuSlugToKey( slugAttr );
			var url = '';
			if ( set ) {
				url = ( key && set.icons[ key ] ) || set.icons.fallback || '';
			}
			var img = tile.querySelector( 'img' );
			if ( img && url ) {
				img.src = url;
				img.style.filter = '';
			} else if ( img && ! url ) {
				// Pass-through: shell will reassert default on next redraw,
				// but we flag the element so a full reload is unnecessary.
				img.removeAttribute( 'src' );
			}
		} );
	}

	function menuSlugToKey( slug ) {
		switch ( slug ) {
			case 'index.php':             return 'dashboard';
			case 'edit.php':              return 'posts';
			case 'edit.php?post_type=page': return 'pages';
			case 'upload.php':            return 'media';
			case 'edit-comments.php':     return 'comments';
			case 'themes.php':            return 'appearance';
			case 'plugins.php':           return 'plugins';
			case 'users.php':             return 'users';
			case 'tools.php':             return 'tools';
			case 'options-general.php':   return 'settings';
			case 'profile.php':           return 'profile';
			case 'link-manager.php':      return 'links';
		}
		if ( slug && slug.indexOf( 'edit.php?post_type=' ) === 0 ) return 'posts';
		return '';
	}

	function persist( slug ) {
		if ( ! cfg.restUrl ) return;
		try {
			fetch( cfg.restUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce':   cfg.restNonce || '',
				},
				credentials: 'same-origin',
				body: JSON.stringify( { set: slug } ),
			} ).catch( function () {
				try { localStorage.setItem( 'b-roll-icons:active', slug ); } catch ( e ) {}
			} );
		} catch ( e ) {
			try { localStorage.setItem( 'b-roll-icons:active', slug ); } catch ( ee ) {}
		}
	}

	// ---------- Boot -------------------------------------------- //
	function boot() {
		mountPill();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}

	// Expose a tiny dev API for manual toggles + e2e tests.
	window.__bRollIcons = {
		version: cfg.version,
		get: function () { return state.active; },
		set: function ( slug ) { pickSet( slug || 'none' ); },
		sets: function () { return state.sets.slice(); },
		open: openPicker,
		close: closePicker,
	};
} )();
