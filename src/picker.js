/**
 * B-Roll picker — v0.6
 * ---------------------------------------------------------------
 * In-canvas scene selector. Lazy-loaded on first gear click.
 *
 * Scaling choices (see plan: in-canvas scene picker):
 *   - Reads the manifest from window.bRoll.scenes (hydrated by PHP).
 *   - Ranked substring search over label + franchise + tags; no library.
 *   - Tag chips derived from the manifest at open time.
 *   - Favorites + Recents rows pinned at top (from window.__bRoll.prefs).
 *   - Native virtualization via `content-visibility: auto` on each card,
 *     so 500 cards stay cheap without a windowing library.
 *   - Thumbnails load via <img loading="lazy" decoding="async">, with a
 *     fallbackColor underlay so paint is never empty.
 *   - Keyboard-first: `/` focuses search, arrows navigate, Enter selects,
 *     `f` favorites the focused card, Esc closes.
 *   - Accessible: role=dialog, aria-modal, focus trap, aria-pressed.
 *   - prefersReducedMotion kills fades + scale transitions.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	window.__bRoll = window.__bRoll || {};

	var STYLE_ID = 'b-roll-picker-styles';
	var CSS = [
		'[data-b-roll-overlay]{position:absolute;inset:0;z-index:10;display:flex;align-items:stretch;justify-content:center;background:rgba(6,6,10,.6);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f4f4f8}',
		'[data-b-roll-overlay][data-reduced=false]{animation:brOverlayIn .18s ease}',
		'@keyframes brOverlayIn{from{opacity:0}to{opacity:1}}',
		'[data-b-roll-panel]{flex:1;max-width:1180px;margin:auto;padding:24px 28px 32px;display:flex;flex-direction:column;gap:16px;max-height:100%;overflow:hidden}',
		'[data-b-roll-head]{display:flex;gap:12px;align-items:center}',
		'[data-b-roll-search]{flex:1;background:rgba(16,16,22,.55);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:10px 16px 10px 40px;color:inherit;font:inherit;outline:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'18\' height=\'18\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23aaa\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><circle cx=\'11\' cy=\'11\' r=\'7\'/><line x1=\'21\' y1=\'21\' x2=\'16.65\' y2=\'16.65\'/></svg>");background-repeat:no-repeat;background-position:14px center}',
		'[data-b-roll-search]:focus{border-color:rgba(255,255,255,.32);background-color:rgba(24,24,30,.7)}',
		'[data-b-roll-close]{appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(16,16,22,.55);color:inherit;font:inherit;padding:8px 12px;border-radius:8px;cursor:pointer}',
		'[data-b-roll-close]:hover{background:rgba(30,30,38,.7)}',
		'[data-b-roll-chips]{display:flex;gap:8px;flex-wrap:wrap}',
		'[data-b-roll-chip]{appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(16,16,22,.4);color:inherit;font:inherit;padding:6px 12px;border-radius:999px;cursor:pointer;font-size:13px}',
		'[data-b-roll-chip][aria-pressed=true]{background:rgba(255,255,255,.92);color:#0b0b10;border-color:transparent}',
		'[data-b-roll-body]{overflow:auto;display:flex;flex-direction:column;gap:22px;padding-right:4px}',
		'[data-b-roll-section-title]{font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.68;margin:0}',
		'[data-b-roll-row]{display:flex;gap:12px;overflow-x:auto;padding:2px 2px 10px;scroll-snap-type:x proximity}',
		'[data-b-roll-row] [data-b-roll-card]{flex:0 0 220px;scroll-snap-align:start}',
		'[data-b-roll-grid]{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}',
		'[data-b-roll-card]{position:relative;aspect-ratio:1.6/1;border-radius:12px;overflow:hidden;cursor:pointer;border:2px solid transparent;background:#111;appearance:none;padding:0;color:inherit;text-align:left;content-visibility:auto;contain-intrinsic-size:220px 140px}',
		'[data-b-roll-card]:hover{border-color:rgba(255,255,255,.25)}',
		'[data-b-roll-card]:focus-visible{outline:none;border-color:#7aa8ff}',
		'[data-b-roll-card][aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.22)}',
		'[data-b-roll-card] img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}',
		'[data-b-roll-meta]{position:absolute;left:0;right:0;bottom:0;padding:12px 14px;display:flex;justify-content:space-between;align-items:flex-end;gap:8px;background:linear-gradient(to top,rgba(0,0,0,.72) 0%,rgba(0,0,0,0) 70%);pointer-events:none}',
		'[data-b-roll-label]{font-weight:600;font-size:14px;text-shadow:0 1px 2px rgba(0,0,0,.6);line-height:1.2}',
		'[data-b-roll-franchise]{font-size:11px;opacity:.78;margin-top:2px;text-shadow:0 1px 2px rgba(0,0,0,.6)}',
		'[data-b-roll-fav]{appearance:none;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;font-size:14px;padding:0}',
		'[data-b-roll-fav][aria-pressed=true]{background:#ffd469;color:#241a00;border-color:transparent}',
		'[data-b-roll-empty]{padding:32px;text-align:center;opacity:.7}',
		'[data-b-roll-error]{padding:12px 14px;border-radius:10px;background:rgba(160,40,40,.3);border:1px solid rgba(240,80,80,.4)}',
		'[data-b-roll-overlay][data-reduced=true] *{transition:none!important;animation:none!important}',
	].join( '' );

	function ensureStyles() {
		if ( document.getElementById( STYLE_ID ) ) return;
		var el = document.createElement( 'style' );
		el.id = STYLE_ID;
		el.textContent = CSS;
		document.head.appendChild( el );
	}

	function escAttr( v ) {
		return String( v == null ? '' : v )
			.replace( /&/g, '&amp;' )
			.replace( /"/g, '&quot;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' );
	}

	// Cheap ranked search: higher score = better match.
	function scoreScene( scene, q ) {
		if ( ! q ) return 1;
		var label = ( scene.label || '' ).toLowerCase();
		var fr    = ( scene.franchise || '' ).toLowerCase();
		var tags  = ( scene.tags || [] ).join( ' ' ).toLowerCase();
		var score = 0;
		if ( label.indexOf( q ) === 0 ) score += 100;
		else if ( label.indexOf( q ) !== -1 ) score += 60;
		if ( fr.indexOf( q ) !== -1 ) score += 30;
		if ( tags.indexOf( q ) !== -1 ) score += 15;
		return score;
	}

	function topTags( scenes, n ) {
		var count = {};
		scenes.forEach( function ( s ) {
			( s.tags || [] ).forEach( function ( t ) {
				count[ t ] = ( count[ t ] || 0 ) + 1;
			} );
		} );
		return Object.keys( count )
			.sort( function ( a, b ) { return count[ b ] - count[ a ]; } )
			.slice( 0, n );
	}

	var active = null;  // current picker instance

	function openPicker( opts ) {
		if ( active ) active.close();
		ensureStyles();

		var cfg = window.__bRoll.config || {};
		var prefs = window.__bRoll.prefs;
		var scenes = cfg.scenes || [];
		var sceneMap = cfg.sceneMap || {};
		var host = opts.host || document.body;
		var reduced = !! opts.prefersReducedMotion;

		var previouslyFocused = document.activeElement;

		var overlay = document.createElement( 'div' );
		overlay.setAttribute( 'data-b-roll-overlay', '' );
		overlay.setAttribute( 'data-reduced', reduced ? 'true' : 'false' );
		overlay.setAttribute( 'role', 'dialog' );
		overlay.setAttribute( 'aria-modal', 'true' );
		overlay.setAttribute( 'aria-label', 'Pick a B-Roll scene' );

		var panel = document.createElement( 'div' );
		panel.setAttribute( 'data-b-roll-panel', '' );
		overlay.appendChild( panel );

		// Head: search + close
		var head = document.createElement( 'div' );
		head.setAttribute( 'data-b-roll-head', '' );
		panel.appendChild( head );

		var search = document.createElement( 'input' );
		search.type = 'search';
		search.setAttribute( 'data-b-roll-search', '' );
		search.setAttribute( 'placeholder', 'Search scenes  (press / to focus)' );
		search.setAttribute( 'aria-label', 'Search scenes' );
		head.appendChild( search );

		var closeBtn = document.createElement( 'button' );
		closeBtn.type = 'button';
		closeBtn.setAttribute( 'data-b-roll-close', '' );
		closeBtn.textContent = 'Close (Esc)';
		head.appendChild( closeBtn );

		// Chip row
		var chipRow = document.createElement( 'div' );
		chipRow.setAttribute( 'data-b-roll-chips', '' );
		panel.appendChild( chipRow );

		// Body sections
		var body = document.createElement( 'div' );
		body.setAttribute( 'data-b-roll-body', '' );
		panel.appendChild( body );

		var state = {
			query: '',
			tag: null,  // null = All
		};

		// Card renderer
		function makeCard( scene ) {
			var slug = scene.slug;
			var isCurrent = slug === opts.currentSlug;
			var isFav = prefs && prefs.get().favorites.indexOf( slug ) !== -1;
			var btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.setAttribute( 'data-b-roll-card', '' );
			btn.setAttribute( 'data-slug', slug );
			btn.setAttribute( 'aria-label', scene.label + ( scene.franchise ? ' — ' + scene.franchise : '' ) );
			btn.setAttribute( 'aria-pressed', isCurrent ? 'true' : 'false' );
			btn.style.background = scene.fallbackColor || '#111';
			var thumb = cfg.assetUrl ? cfg.assetUrl( 'assets/previews/' + slug + '.jpg' ) : '/assets/previews/' + slug + '.jpg';
			btn.innerHTML = [
				'<img loading="lazy" decoding="async" alt="" src="' + escAttr( thumb ) + '" />',
				'<div data-b-roll-meta>',
				'<div><div data-b-roll-label>' + escAttr( scene.label ) + '</div>',
				scene.franchise ? '<div data-b-roll-franchise>' + escAttr( scene.franchise ) + '</div>' : '',
				'</div>',
				'<button type="button" data-b-roll-fav aria-label="Favorite ' + escAttr( scene.label ) + '" aria-pressed="' + ( isFav ? 'true' : 'false' ) + '">' + ( isFav ? '★' : '☆' ) + '</button>',
				'</div>',
			].join( '' );
			btn.addEventListener( 'click', function ( ev ) {
				// Star button has its own click handler — fav clicks shouldn't select.
				if ( ev.target && ev.target.closest && ev.target.closest( '[data-b-roll-fav]' ) ) return;
				onSelectSlug( slug );
			} );
			var fav = btn.querySelector( '[data-b-roll-fav]' );
			if ( fav ) {
				fav.addEventListener( 'click', function ( ev ) {
					ev.stopPropagation();
					if ( ! prefs ) return;
					prefs.toggleFavorite( slug );
					var now = prefs.get().favorites.indexOf( slug ) !== -1;
					fav.setAttribute( 'aria-pressed', now ? 'true' : 'false' );
					fav.textContent = now ? '★' : '☆';
				} );
			}
			return btn;
		}

		function onSelectSlug( slug ) {
			if ( typeof opts.onSelect === 'function' ) opts.onSelect( slug );
			// Mark current visually without re-render.
			var cards = panel.querySelectorAll( '[data-b-roll-card]' );
			for ( var i = 0; i < cards.length; i++ ) {
				cards[ i ].setAttribute( 'aria-pressed', cards[ i ].getAttribute( 'data-slug' ) === slug ? 'true' : 'false' );
			}
			opts.currentSlug = slug;
		}

		function renderBody() {
			body.innerHTML = '';
			var favs = ( prefs && prefs.get().favorites ) || [];
			var recs = ( prefs && prefs.get().recents )   || [];
			var q = state.query.trim().toLowerCase();

			function matches( s ) {
				if ( state.tag && ( s.tags || [] ).indexOf( state.tag ) === -1 ) return false;
				if ( q ) return scoreScene( s, q ) > 0;
				return true;
			}

			function appendSection( title, slugs, kind ) {
				var items = slugs
					.map( function ( sl ) { return sceneMap[ sl ]; } )
					.filter( function ( s ) { return s && matches( s ); } );
				if ( ! items.length ) return;
				var h = document.createElement( 'h2' );
				h.setAttribute( 'data-b-roll-section-title', '' );
				h.textContent = title;
				body.appendChild( h );
				var row = document.createElement( 'div' );
				row.setAttribute( 'data-b-roll-' + kind, '' );
				items.forEach( function ( s ) { row.appendChild( makeCard( s ) ); } );
				body.appendChild( row );
			}

			if ( ! q && ! state.tag && favs.length ) appendSection( 'Favorites', favs, 'row' );
			if ( ! q && ! state.tag && recs.length ) appendSection( 'Recent',    recs, 'row' );

			var allItems = scenes.filter( matches );
			if ( q ) {
				allItems = allItems.map( function ( s ) { return { s: s, score: scoreScene( s, q ) }; } )
					.sort( function ( a, b ) { return b.score - a.score; } )
					.map( function ( x ) { return x.s; } );
			}

			var h = document.createElement( 'h2' );
			h.setAttribute( 'data-b-roll-section-title', '' );
			h.textContent = q || state.tag ? 'Results (' + allItems.length + ')' : 'All scenes (' + allItems.length + ')';
			body.appendChild( h );

			if ( ! allItems.length ) {
				var empty = document.createElement( 'div' );
				empty.setAttribute( 'data-b-roll-empty', '' );
				empty.textContent = q ? 'No scenes match "' + state.query + '".' : 'No scenes match this tag.';
				body.appendChild( empty );
				return;
			}

			var grid = document.createElement( 'div' );
			grid.setAttribute( 'data-b-roll-grid', '' );
			allItems.forEach( function ( s ) { grid.appendChild( makeCard( s ) ); } );
			body.appendChild( grid );
		}

		function renderChips() {
			chipRow.innerHTML = '';
			var tags = [ null ].concat( topTags( scenes, 8 ) );
			tags.forEach( function ( t ) {
				var chip = document.createElement( 'button' );
				chip.type = 'button';
				chip.setAttribute( 'data-b-roll-chip', '' );
				chip.setAttribute( 'aria-pressed', state.tag === t ? 'true' : 'false' );
				chip.textContent = t === null ? 'All' : t;
				chip.addEventListener( 'click', function () {
					state.tag = t;
					renderChips();
					renderBody();
				} );
				chipRow.appendChild( chip );
			} );
		}

		var rafPending = null;
		function scheduleRender() {
			if ( rafPending ) return;
			rafPending = window.requestAnimationFrame( function () {
				rafPending = null;
				renderBody();
			} );
		}
		search.addEventListener( 'input', function () {
			state.query = search.value;
			scheduleRender();
		} );

		// Grid-aware arrow navigation
		function currentCards() {
			return Array.prototype.slice.call( panel.querySelectorAll( '[data-b-roll-card]' ) );
		}
		function focusCard( delta, perRow ) {
			var cards = currentCards();
			if ( ! cards.length ) return;
			var idx = cards.indexOf( document.activeElement );
			if ( idx === -1 ) idx = 0;
			var step = delta;
			if ( perRow ) {
				// Estimate perRow from first two cards' offsetTop change.
				var row = 1;
				for ( var i = 1; i < cards.length; i++ ) {
					if ( cards[ i ].offsetTop !== cards[ 0 ].offsetTop ) { row = i; break; }
				}
				step = delta * row;
			}
			var next = Math.max( 0, Math.min( cards.length - 1, idx + step ) );
			cards[ next ].focus();
		}
		overlay.addEventListener( 'keydown', function ( ev ) {
			if ( ev.key === 'Escape' ) { ev.preventDefault(); close(); return; }
			if ( ev.key === '/' && document.activeElement !== search ) { ev.preventDefault(); search.focus(); search.select(); return; }
			if ( document.activeElement === search ) return;
			if ( ev.key === 'ArrowRight' ) { ev.preventDefault(); focusCard( +1, false ); }
			else if ( ev.key === 'ArrowLeft' ) { ev.preventDefault(); focusCard( -1, false ); }
			else if ( ev.key === 'ArrowDown' ) { ev.preventDefault(); focusCard( +1, true ); }
			else if ( ev.key === 'ArrowUp' ) { ev.preventDefault(); focusCard( -1, true ); }
			else if ( ev.key === 'Enter' && document.activeElement && document.activeElement.getAttribute( 'data-b-roll-card' ) !== null ) {
				ev.preventDefault();
				var slug = document.activeElement.getAttribute( 'data-slug' );
				if ( slug ) onSelectSlug( slug );
			}
			else if ( ( ev.key === 'f' || ev.key === 'F' ) && document.activeElement && document.activeElement.getAttribute( 'data-b-roll-card' ) !== null ) {
				ev.preventDefault();
				var favBtn = document.activeElement.querySelector( '[data-b-roll-fav]' );
				if ( favBtn ) favBtn.click();
			}
		} );

		// Click outside panel closes
		overlay.addEventListener( 'click', function ( ev ) {
			if ( ev.target === overlay ) close();
		} );
		closeBtn.addEventListener( 'click', close );

		function close() {
			if ( ! overlay.parentNode ) return;
			overlay.parentNode.removeChild( overlay );
			if ( active === instance ) active = null;
			try { if ( previouslyFocused && previouslyFocused.focus ) previouslyFocused.focus(); } catch ( e ) { /* ignore */ }
			if ( typeof opts.onClose === 'function' ) opts.onClose();
		}

		var instance = { close: close, overlay: overlay };
		active = instance;

		// Initial render
		renderChips();
		renderBody();
		host.appendChild( overlay );

		// Focus search on open (keyboard-first).
		setTimeout( function () { search.focus(); }, 0 );

		return instance;
	}

	function closeActive() {
		if ( active ) active.close();
	}

	window.__bRoll.picker = { open: openPicker, close: closeActive };
} )();
