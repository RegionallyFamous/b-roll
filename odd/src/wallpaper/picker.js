/**
 * ODD picker — v0.7
 * ---------------------------------------------------------------
 * Scene selector overlay. Lazy-loaded on first gear click.
 *
 * Design & perf choices:
 *   - Overlay is mounted on document.body (NOT the wallpaper
 *     container, which has pointer-events: none from WP Desktop
 *     Mode). position: fixed + max z-index.
 *   - Search icon is a real SVG element inside a flex wrapper, so
 *     it can never stack-on-top-of or clip the placeholder text.
 *   - Scene thumbnails are tiny JPGs (<100 KB) with loading="lazy"
 *     and decoding="async" so the grid paints instantly.
 *   - Ranked substring search over label + franchise + tags.
 *   - Tag chips derived from the manifest at open time.
 *   - Favorites + Recents rows pinned at top (from __odd.prefs).
 *   - Cheap virtualization via `content-visibility: auto`.
 *   - Keyboard-first: `/` focuses search, arrows navigate, Enter
 *     selects, `f` favorites the focused card, Esc closes.
 *   - Accessible: role=dialog, aria-modal, aria-pressed on chips
 *     and cards.
 *   - prefersReducedMotion kills the entrance animation and hover
 *     transitions.
 *
 * Speed strategy — making scene swaps feel instant:
 *   - When the picker opens, we fire off a low-priority prefetch
 *     for every backdrop JPG so the HTTP cache is primed.
 *   - When the user hovers or focuses a card, we also warm the
 *     Pixi texture cache for that scene's cut-out PNGs via
 *     PIXI.Assets.load. By the time they click, assets/{backdrop,
 *     cut-outs} are already decoded, so the swap is a few ms.
 *   - These are fire-and-forget; failures are swallowed.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	window.__odd = window.__odd || {};

	var STYLE_ID = 'odd-wallpaper-picker-styles';
	var CSS = [
		// Root overlay (fixed, full-viewport, above OS chrome).
		'[data-odd-overlay]{',
			'position:fixed;inset:0;z-index:2147483646;',
			'display:flex;align-items:stretch;justify-content:center;',
			'background:radial-gradient(ellipse at top,rgba(30,24,48,.82) 0%,rgba(6,6,10,.82) 70%);',
			'backdrop-filter:blur(18px) saturate(140%);',
			'-webkit-backdrop-filter:blur(18px) saturate(140%);',
			'font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
			'color:#f4f4f8;',
			'-webkit-font-smoothing:antialiased;',
		'}',
		'[data-odd-overlay][data-reduced=false]{animation:oddOverlayIn .22s cubic-bezier(.2,.8,.2,1)}',
		'@keyframes oddOverlayIn{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:scale(1)}}',

		// Panel: scroll-contained flex column.
		'[data-odd-panel]{',
			'flex:1;max-width:1240px;margin:auto;',
			'padding:24px 32px 32px;',
			'display:flex;flex-direction:column;gap:18px;',
			'max-height:100%;overflow:hidden;',
		'}',

		// Header row.
		'[data-odd-head]{',
			'display:flex;gap:14px;align-items:center;flex-wrap:wrap;',
		'}',
		'[data-odd-brand]{',
			'display:flex;flex-direction:column;gap:2px;',
			'margin-right:8px;user-select:none;',
		'}',
		'[data-odd-brand-title]{',
			'font-size:18px;font-weight:700;letter-spacing:.2px;',
		'}',
		'[data-odd-brand-sub]{',
			'font-size:12px;opacity:.65;letter-spacing:.3px;',
		'}',

		// Search: flex wrapper holds the icon absolutely so there
		// is no way it can stack on top of the placeholder text.
		'[data-odd-search-wrap]{',
			'flex:1;min-width:220px;position:relative;display:flex;align-items:center;',
		'}',
		'[data-odd-search-wrap] svg{',
			'position:absolute;left:16px;top:50%;transform:translateY(-50%);',
			'width:18px;height:18px;pointer-events:none;opacity:.55;',
		'}',
		'[data-odd-search]{',
			'width:100%;box-sizing:border-box;',
			'background:rgba(18,18,26,.6);',
			'border:1px solid rgba(255,255,255,.12);',
			'border-radius:999px;',
			'padding:12px 18px 12px 44px;',
			'color:inherit;font:inherit;outline:none;',
			'transition:border-color .15s ease,background .15s ease,box-shadow .15s ease;',
		'}',
		'[data-odd-search]::placeholder{color:rgba(244,244,248,.45)}',
		'[data-odd-search]:focus{',
			'border-color:rgba(255,255,255,.32);',
			'background:rgba(28,28,38,.72);',
			'box-shadow:0 0 0 4px rgba(120,140,220,.12);',
		'}',

		// Close button.
		'[data-odd-close]{',
			'appearance:none;cursor:pointer;',
			'border:1px solid rgba(255,255,255,.14);',
			'background:rgba(18,18,26,.55);',
			'color:inherit;font:inherit;',
			'padding:10px 14px;border-radius:10px;',
			'display:flex;align-items:center;gap:6px;',
			'transition:background .15s ease,border-color .15s ease,transform .12s ease;',
		'}',
		'[data-odd-close]:hover{background:rgba(36,36,48,.75);border-color:rgba(255,255,255,.22)}',
		'[data-odd-close]:active{transform:scale(.97)}',
		'[data-odd-close] kbd{',
			'font:inherit;font-size:11px;opacity:.68;',
			'padding:1px 6px;border-radius:4px;',
			'background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);',
		'}',

		// Toolbar buttons — mic + shuffle sit next to Close.
		'[data-odd-tool]{',
			'appearance:none;cursor:pointer;',
			'border:1px solid rgba(255,255,255,.14);',
			'background:rgba(18,18,26,.55);',
			'color:inherit;font:inherit;',
			'padding:10px 12px;border-radius:10px;',
			'display:flex;align-items:center;gap:6px;min-height:40px;',
			'transition:background .15s ease,border-color .15s ease,transform .12s ease,color .15s ease;',
		'}',
		'[data-odd-tool]:hover{background:rgba(36,36,48,.75);border-color:rgba(255,255,255,.22)}',
		'[data-odd-tool]:active{transform:scale(.97)}',
		'[data-odd-tool][aria-pressed=true]{',
			'background:#fff;color:#0b0b10;border-color:transparent;font-weight:600;',
		'}',
		'[data-odd-tool] svg{width:16px;height:16px}',
		'[data-odd-tool][data-state=denied]{',
			'background:rgba(180,60,60,.35);border-color:rgba(240,120,120,.45);',
		'}',
		'[data-odd-tool] .dot{',
			'width:8px;height:8px;border-radius:50%;background:#ff2d6f;',
			'box-shadow:0 0 0 3px rgba(255,45,111,.25);',
			'animation:brAudioDot 1.2s ease-in-out infinite;',
		'}',
		'@keyframes brAudioDot{0%,100%{opacity:.85}50%{opacity:.4}}',

		// Chips row.
		'[data-odd-chips]{',
			'display:flex;gap:8px;flex-wrap:wrap;',
		'}',
		'[data-odd-chip]{',
			'appearance:none;cursor:pointer;',
			'border:1px solid rgba(255,255,255,.12);',
			'background:rgba(18,18,26,.45);',
			'color:inherit;font:inherit;',
			'padding:7px 14px;border-radius:999px;font-size:13px;',
			'transition:background .15s ease,color .15s ease,border-color .15s ease,transform .12s ease;',
		'}',
		'[data-odd-chip]:hover{background:rgba(36,36,48,.7);border-color:rgba(255,255,255,.2)}',
		'[data-odd-chip]:active{transform:scale(.97)}',
		'[data-odd-chip][aria-pressed=true]{',
			'background:#fff;color:#0b0b10;border-color:transparent;font-weight:600;',
		'}',

		// Body scroll region.
		'[data-odd-body]{',
			'overflow:auto;display:flex;flex-direction:column;gap:22px;',
			'padding:4px 6px 8px 2px;',
			'scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent;',
		'}',
		'[data-odd-body]::-webkit-scrollbar{width:10px}',
		'[data-odd-body]::-webkit-scrollbar-thumb{',
			'background:rgba(255,255,255,.15);border-radius:999px;',
			'border:2px solid transparent;background-clip:padding-box;',
		'}',
		'[data-odd-body]::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.28);background-clip:padding-box;border:2px solid transparent}',

		// Section title.
		'[data-odd-section-title]{',
			'font-size:11px;letter-spacing:.12em;text-transform:uppercase;',
			'opacity:.78;margin:0;font-weight:600;',
			'display:flex;align-items:center;gap:8px;',
		'}',
		'[data-odd-section-title] .count{',
			'font-weight:500;opacity:.6;letter-spacing:.05em;',
		'}',

		// Horizontal row (Favorites / Recent).
		'[data-odd-row]{',
			'display:flex;gap:14px;overflow-x:auto;',
			'padding:2px 2px 12px;',
			'scroll-snap-type:x proximity;',
			'scrollbar-width:none;',
		'}',
		'[data-odd-row]::-webkit-scrollbar{display:none}',
		'[data-odd-row] [data-odd-card]{flex:0 0 240px;scroll-snap-align:start}',

		// Grid (All scenes).
		'[data-odd-grid]{',
			'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;',
		'}',

		// Card.
		'[data-odd-card]{',
			'position:relative;aspect-ratio:16/10;border-radius:14px;overflow:hidden;',
			'cursor:pointer;border:1px solid rgba(255,255,255,.08);',
			'background:#111;appearance:none;padding:0;color:inherit;text-align:left;',
			'content-visibility:auto;contain-intrinsic-size:240px 150px;',
			'box-shadow:0 4px 14px rgba(0,0,0,.3);',
			'transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease,border-color .15s ease;',
		'}',
		'[data-odd-card]:hover{',
			'transform:translateY(-3px);',
			'border-color:rgba(255,255,255,.22);',
			'box-shadow:0 14px 30px rgba(0,0,0,.48);',
		'}',
		'[data-odd-card]:focus-visible{outline:none;border-color:#9ab7ff;box-shadow:0 0 0 3px rgba(120,150,240,.35)}',
		'[data-odd-card][aria-pressed=true]{',
			'border-color:#fff;',
			'box-shadow:0 0 0 3px rgba(255,255,255,.38),0 14px 30px rgba(0,0,0,.5);',
		'}',
		'[data-odd-card] img{',
			'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;',
			'transition:transform .4s cubic-bezier(.2,.8,.2,1);',
		'}',
		'[data-odd-card]:hover img{transform:scale(1.04)}',
		'[data-odd-meta]{',
			'position:absolute;left:0;right:0;bottom:0;',
			'padding:14px 16px 13px;',
			'display:flex;justify-content:space-between;align-items:flex-end;gap:10px;',
			'background:linear-gradient(to top,rgba(0,0,0,.82) 0%,rgba(0,0,0,.55) 55%,rgba(0,0,0,0) 100%);',
			'pointer-events:none;',
		'}',
		'[data-odd-label]{',
			'font-weight:700;font-size:15px;line-height:1.15;',
			'text-shadow:0 1px 2px rgba(0,0,0,.7);',
			'letter-spacing:.1px;',
		'}',
		'[data-odd-franchise]{',
			'font-size:11px;opacity:.82;margin-top:3px;letter-spacing:.2px;',
			'text-shadow:0 1px 2px rgba(0,0,0,.7);',
		'}',
		'[data-odd-now]{',
			'position:absolute;top:10px;left:10px;',
			'display:flex;align-items:center;gap:5px;',
			'padding:4px 9px;border-radius:999px;',
			'background:rgba(255,255,255,.96);color:#0b0b10;',
			'font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;',
			'box-shadow:0 2px 8px rgba(0,0,0,.35);',
		'}',
		'[data-odd-now]::before{',
			'content:"";width:6px;height:6px;border-radius:50%;background:#ff2d6f;',
			'animation:brNowPulse 1.6s ease-in-out infinite;',
		'}',
		'@keyframes brNowPulse{0%,100%{opacity:1}50%{opacity:.4}}',

		// Fav star.
		'[data-odd-fav]{',
			'appearance:none;cursor:pointer;pointer-events:auto;',
			'background:rgba(0,0,0,.55);',
			'border:1px solid rgba(255,255,255,.2);',
			'color:#fff;border-radius:999px;',
			'width:32px;height:32px;display:flex;align-items:center;justify-content:center;',
			'font-size:15px;padding:0;flex:0 0 auto;',
			'transition:background .15s ease,border-color .15s ease,transform .12s ease;',
		'}',
		'[data-odd-fav]:hover{background:rgba(0,0,0,.75);border-color:rgba(255,255,255,.4)}',
		'[data-odd-fav]:active{transform:scale(.92)}',
		'[data-odd-fav][aria-pressed=true]{',
			'background:#ffd469;color:#241a00;border-color:transparent;',
		'}',

		'[data-odd-empty]{padding:40px 24px;text-align:center;opacity:.65}',
		'[data-odd-error]{',
			'padding:12px 14px;border-radius:10px;',
			'background:rgba(160,40,40,.3);border:1px solid rgba(240,80,80,.4);',
		'}',
		'[data-odd-overlay][data-reduced=true] *{transition:none!important;animation:none!important}',
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

	// ---------- Prefetch helpers -------------------------------- //
	// Warm the HTTP cache (and Pixi texture cache when available)
	// for a given scene, so clicking its card results in a near-
	// instant swap. All failures are swallowed.

	var prefetchedBackdrops = {};
	var prefetchedCutouts   = {};

	function prefetchBackdrop( slug ) {
		if ( prefetchedBackdrops[ slug ] ) return;
		prefetchedBackdrops[ slug ] = true;
		try {
			var cfg = window.__odd.config || {};
			var url = cfg.assetUrl ? cfg.assetUrl( 'assets/wallpapers/' + slug + '.webp' ) : '';
			if ( ! url ) return;
			var img = new window.Image();
			img.decoding = 'async';
			img.src = url;
		} catch ( e ) { /* ignore */ }
	}

	function prefetchCutouts( slug ) {
		if ( prefetchedCutouts[ slug ] ) return;
		prefetchedCutouts[ slug ] = true;
		try {
			var cfg = window.__odd.config || {};
			var map = ( cfg.sceneMap || {} )[ slug ];
			var defs = map && Array.isArray( map.cutouts ) ? map.cutouts : [];
			if ( ! defs.length ) return;
			var ver  = cfg.version ? '?v=' + encodeURIComponent( cfg.version ) : '';
			var PIXI = window.PIXI;
			// Prefer the single-request atlas. If Pixi is around it
			// parses + caches the spritesheet so mountCutouts() later
			// is a pure lookup; if it isn't, the browser still wins
			// by warming the HTTP cache. Individual cut-outs remain
			// as the fallback for atlas-less scenes.
			var atlasUrl = ( cfg.pluginUrl || '' ) + '/assets/atlases/' + slug + '.json' + ver;
			if ( PIXI && PIXI.Assets && typeof PIXI.Assets.load === 'function' ) {
				PIXI.Assets.load( atlasUrl ).catch( function () {
					var base = ( cfg.pluginUrl || '' ) + '/assets/cutouts/' + slug + '/';
					defs.forEach( function ( def ) {
						PIXI.Assets.load( base + def.file + ver ).catch( function () { /* ignore */ } );
					} );
				} );
			} else {
				var probe = new window.XMLHttpRequest();
				try { probe.open( 'GET', atlasUrl, true ); probe.send(); } catch ( e ) { /* ignore */ }
			}
		} catch ( e ) { /* ignore */ }
	}

	function prefetchScene( slug ) {
		prefetchBackdrop( slug );
		prefetchCutouts( slug );
	}

	// Expose for callers (e.g. eager prefetch on idle).
	window.__odd.prefetchScene = prefetchScene;

	// ---------- Picker ------------------------------------------ //

	var active = null;  // current picker instance

	function openPicker( opts ) {
		if ( active ) active.close();
		ensureStyles();

		var cfg = window.__odd.config || {};
		var prefs = window.__odd.prefs;
		var scenes = cfg.scenes || [];
		var sceneMap = cfg.sceneMap || {};
		// Always mount on document.body. WP Desktop Mode sets
		// pointer-events: none on .wp-desktop-wallpaper, so anything
		// mounted inside the wallpaper container would be inert.
		var host = document.body;
		var reduced = !! opts.prefersReducedMotion;

		var previouslyFocused = document.activeElement;

		var overlay = document.createElement( 'div' );
		overlay.setAttribute( 'data-odd-overlay', '' );
		overlay.setAttribute( 'data-reduced', reduced ? 'true' : 'false' );
		overlay.setAttribute( 'role', 'dialog' );
		overlay.setAttribute( 'aria-modal', 'true' );
		overlay.setAttribute( 'aria-label', 'Pick a ODD scene' );

		var panel = document.createElement( 'div' );
		panel.setAttribute( 'data-odd-panel', '' );
		overlay.appendChild( panel );

		// ---- Head: brand + search + close ----
		var head = document.createElement( 'div' );
		head.setAttribute( 'data-odd-head', '' );
		panel.appendChild( head );

		var brand = document.createElement( 'div' );
		brand.setAttribute( 'data-odd-brand', '' );
		brand.innerHTML =
			'<div data-odd-brand-title>ODD</div>' +
			'<div data-odd-brand-sub>Pick a wallpaper scene</div>';
		head.appendChild( brand );

		var searchWrap = document.createElement( 'div' );
		searchWrap.setAttribute( 'data-odd-search-wrap', '' );
		// Inline SVG icon — no data-URL, no chance of overlapping text.
		searchWrap.innerHTML =
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
			' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
			'<circle cx="11" cy="11" r="7"/>' +
			'<line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
			'</svg>';
		var search = document.createElement( 'input' );
		search.type = 'search';
		search.setAttribute( 'data-odd-search', '' );
		search.setAttribute( 'placeholder', 'Search scenes\u2026' );
		search.setAttribute( 'aria-label', 'Search scenes' );
		searchWrap.appendChild( search );
		head.appendChild( searchWrap );

		// Audio-reactive toggle. Lazy-loads src/audio.js the first
		// time it's pressed so mic permission is only ever requested
		// on an explicit user gesture.
		var audioBtn = document.createElement( 'button' );
		audioBtn.type = 'button';
		audioBtn.setAttribute( 'data-odd-tool', '' );
		audioBtn.setAttribute( 'data-kind', 'audio' );
		audioBtn.setAttribute( 'aria-label', 'Toggle audio-reactive mode' );
		audioBtn.title = 'Audio-reactive mode (mic)';
		function renderAudioBtn() {
			var st = ( window.__odd.audio && window.__odd.audio.state )
				? window.__odd.audio.state()
				: { enabled: false, permission: 'unknown' };
			audioBtn.setAttribute( 'aria-pressed', st.enabled ? 'true' : 'false' );
			audioBtn.setAttribute( 'data-state', st.permission || '' );
			var label = st.enabled ? 'Audio on' : ( st.permission === 'denied' ? 'Mic denied' : 'Audio' );
			var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
				' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
				'<rect x="9" y="3" width="6" height="12" rx="3"/>' +
				'<path d="M5 11v1a7 7 0 0 0 14 0v-1"/>' +
				'<line x1="12" y1="19" x2="12" y2="22"/>' +
				'</svg>';
			audioBtn.innerHTML = icon + '<span>' + escAttr( label ) + '</span>' +
				( st.enabled ? '<span class="dot" aria-hidden="true"></span>' : '' );
		}
		renderAudioBtn();
		function refreshAudioBtn() { renderAudioBtn(); }
		window.addEventListener( 'odd:audio-change', refreshAudioBtn );
		audioBtn.addEventListener( 'click', function () {
			if ( typeof opts.onAudioToggle === 'function' ) {
				opts.onAudioToggle( renderAudioBtn );
			}
		} );
		head.appendChild( audioBtn );

		// Shuffle toggle + interval picker. Shuffle cycles the
		// wallpaper through favorites (or all scenes if no favs)
		// every N minutes. Off by default.
		var shuffleBtn = document.createElement( 'button' );
		shuffleBtn.type = 'button';
		shuffleBtn.setAttribute( 'data-odd-tool', '' );
		shuffleBtn.setAttribute( 'data-kind', 'shuffle' );
		shuffleBtn.setAttribute( 'aria-label', 'Toggle shuffle mode' );
		shuffleBtn.title = 'Cycle scenes automatically';
		function renderShuffleBtn() {
			var on = !! ( opts.shuffle && opts.shuffle.enabled );
			var minutes = ( opts.shuffle && opts.shuffle.minutes ) || 15;
			shuffleBtn.setAttribute( 'aria-pressed', on ? 'true' : 'false' );
			var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
				' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
				'<polyline points="16 3 21 3 21 8"/>' +
				'<line x1="4" y1="20" x2="21" y2="3"/>' +
				'<polyline points="21 16 21 21 16 21"/>' +
				'<line x1="15" y1="15" x2="21" y2="21"/>' +
				'<line x1="4" y1="4" x2="9" y2="9"/>' +
				'</svg>';
			var label = on ? ( 'Shuffle ' + minutes + 'm' ) : 'Shuffle';
			shuffleBtn.innerHTML = icon + '<span>' + escAttr( label ) + '</span>';
		}
		renderShuffleBtn();
		shuffleBtn.addEventListener( 'click', function ( ev ) {
			// Plain click toggles on/off. Alt/Option-click cycles
			// through interval presets so the feature stays one-button
			// without overwhelming the toolbar.
			var presets = [ 5, 10, 15, 30, 60 ];
			var current = ( opts.shuffle && opts.shuffle.minutes ) || 15;
			var enabled = !! ( opts.shuffle && opts.shuffle.enabled );
			if ( ev.altKey ) {
				var idx = presets.indexOf( current );
				var next = presets[ ( idx + 1 + presets.length ) % presets.length ];
				if ( typeof opts.onShuffleChange === 'function' ) {
					opts.onShuffleChange( { enabled: true, minutes: next } );
				}
			} else {
				if ( typeof opts.onShuffleChange === 'function' ) {
					opts.onShuffleChange( { enabled: ! enabled, minutes: current } );
				}
			}
			renderShuffleBtn();
		} );
		head.appendChild( shuffleBtn );

		var closeBtn = document.createElement( 'button' );
		closeBtn.type = 'button';
		closeBtn.setAttribute( 'data-odd-close', '' );
		closeBtn.setAttribute( 'aria-label', 'Close scene picker' );
		closeBtn.innerHTML = 'Close <kbd>Esc</kbd>';
		head.appendChild( closeBtn );

		// ---- Chips ----
		var chipRow = document.createElement( 'div' );
		chipRow.setAttribute( 'data-odd-chips', '' );
		panel.appendChild( chipRow );

		// ---- Body ----
		var body = document.createElement( 'div' );
		body.setAttribute( 'data-odd-body', '' );
		panel.appendChild( body );

		var state = {
			query: '',
			tag: null,  // null = All
		};

		// Card renderer.
		function makeCard( scene ) {
			var slug = scene.slug;
			var isCurrent = slug === opts.currentSlug;
			var isFav = prefs && prefs.get().favorites.indexOf( slug ) !== -1;
			var btn = document.createElement( 'button' );
			btn.type = 'button';
			btn.setAttribute( 'data-odd-card', '' );
			btn.setAttribute( 'data-slug', slug );
			btn.setAttribute( 'aria-label', scene.label + ( scene.franchise ? ' \u2014 ' + scene.franchise : '' ) );
			btn.setAttribute( 'aria-pressed', isCurrent ? 'true' : 'false' );
			btn.style.background = scene.fallbackColor || '#111';
			var thumb = cfg.assetUrl ? cfg.assetUrl( 'assets/previews/' + slug + '.webp' ) : '/assets/previews/' + slug + '.webp';
			btn.innerHTML = [
				'<img loading="lazy" decoding="async" alt="" src="' + escAttr( thumb ) + '" />',
				isCurrent ? '<span data-odd-now>Now playing</span>' : '',
				'<div data-odd-meta>',
				'<div><div data-odd-label>' + escAttr( scene.label ) + '</div>',
				scene.franchise ? '<div data-odd-franchise>' + escAttr( scene.franchise ) + '</div>' : '',
				'</div>',
				'<button type="button" data-odd-fav aria-label="Favorite ' + escAttr( scene.label ) +
					'" aria-pressed="' + ( isFav ? 'true' : 'false' ) + '">' + ( isFav ? '\u2605' : '\u2606' ) + '</button>',
				'</div>',
			].join( '' );
			btn.addEventListener( 'click', function ( ev ) {
				if ( ev.target && ev.target.closest && ev.target.closest( '[data-odd-fav]' ) ) return;
				onSelectSlug( slug );
			} );
			// Hover/focus prefetch: by the time they click, assets
			// are already warm. Hovering for >350 ms also kicks off a
			// live preview (swaps the wallpaper so the user can see
			// the scene without committing). We revert on leave.
			btn.addEventListener( 'pointerenter', function () {
				prefetchScene( slug );
				schedulePreview( slug );
			} );
			btn.addEventListener( 'pointerleave', function () {
				cancelPreview();
			} );
			btn.addEventListener( 'focus', function () {
				prefetchScene( slug );
				schedulePreview( slug );
			} );
			btn.addEventListener( 'blur', function () {
				cancelPreview();
			} );
			var fav = btn.querySelector( '[data-odd-fav]' );
			if ( fav ) {
				fav.addEventListener( 'click', function ( ev ) {
					ev.stopPropagation();
					if ( ! prefs ) return;
					prefs.toggleFavorite( slug );
					var now = prefs.get().favorites.indexOf( slug ) !== -1;
					fav.setAttribute( 'aria-pressed', now ? 'true' : 'false' );
					fav.textContent = now ? '\u2605' : '\u2606';
				} );
			}
			return btn;
		}

		function onSelectSlug( slug ) {
			cancelPreview( /* skipRevert */ true );
			committedSlug = slug;
			previewingSlug = null;
			if ( typeof opts.onSelect === 'function' ) opts.onSelect( slug );
			opts.currentSlug = slug;
			// Auto-dismiss the panel — the user picked one. They get
			// the same instant-feel snap that selecting a wallpaper
			// in the OS settings does. The crossfade snapshot in the
			// mount runner covers the swap underneath while the
			// overlay fades out.
			close();
		}

		// Live-preview on hover. After PREVIEW_DELAY_MS of dwelling on
		// a card, we swap the wallpaper to that scene without saving
		// any preference or recording a "recent". On leave, we revert
		// to the committed slug. Close also reverts if preview is
		// still active.
		var PREVIEW_DELAY_MS = 350;
		var committedSlug = opts.currentSlug || null;
		var previewingSlug = null;
		var previewTimer = null;
		function schedulePreview( slug ) {
			if ( typeof opts.onPreview !== 'function' ) return;
			if ( slug === committedSlug && ! previewingSlug ) return;
			if ( previewTimer ) clearTimeout( previewTimer );
			previewTimer = setTimeout( function () {
				previewTimer = null;
				if ( slug === previewingSlug ) return;
				previewingSlug = slug;
				try { opts.onPreview( slug ); } catch ( e ) { /* ignore */ }
			}, PREVIEW_DELAY_MS );
		}
		function cancelPreview( skipRevert ) {
			if ( previewTimer ) { clearTimeout( previewTimer ); previewTimer = null; }
			if ( skipRevert ) return;
			if ( previewingSlug && previewingSlug !== committedSlug ) {
				var target = committedSlug;
				previewingSlug = null;
				if ( typeof opts.onPreview === 'function' && target ) {
					try { opts.onPreview( target ); } catch ( e ) { /* ignore */ }
				}
			}
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
				h.setAttribute( 'data-odd-section-title', '' );
				h.innerHTML = escAttr( title ) +
					' <span class="count">(' + items.length + ')</span>';
				body.appendChild( h );
				var row = document.createElement( 'div' );
				row.setAttribute( 'data-odd-' + kind, '' );
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

			var titleText = q || state.tag ? 'Results' : 'All scenes';
			var h = document.createElement( 'h2' );
			h.setAttribute( 'data-odd-section-title', '' );
			h.innerHTML = escAttr( titleText ) +
				' <span class="count">(' + allItems.length + ')</span>';
			body.appendChild( h );

			if ( ! allItems.length ) {
				var empty = document.createElement( 'div' );
				empty.setAttribute( 'data-odd-empty', '' );
				empty.textContent = q ? 'No scenes match \u201C' + state.query + '\u201D.' : 'No scenes match this tag.';
				body.appendChild( empty );
				return;
			}

			var grid = document.createElement( 'div' );
			grid.setAttribute( 'data-odd-grid', '' );
			allItems.forEach( function ( s ) { grid.appendChild( makeCard( s ) ); } );
			body.appendChild( grid );
		}

		function renderChips() {
			chipRow.innerHTML = '';
			var tags = [ null ].concat( topTags( scenes, 8 ) );
			tags.forEach( function ( t ) {
				var chip = document.createElement( 'button' );
				chip.type = 'button';
				chip.setAttribute( 'data-odd-chip', '' );
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

		// Grid-aware arrow navigation.
		function currentCards() {
			return Array.prototype.slice.call( panel.querySelectorAll( '[data-odd-card]' ) );
		}
		function focusCard( delta, perRow ) {
			var cards = currentCards();
			if ( ! cards.length ) return;
			var idx = cards.indexOf( document.activeElement );
			if ( idx === -1 ) idx = 0;
			var step = delta;
			if ( perRow ) {
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
			else if ( ev.key === 'Enter' && document.activeElement && document.activeElement.getAttribute( 'data-odd-card' ) !== null ) {
				ev.preventDefault();
				var slug = document.activeElement.getAttribute( 'data-slug' );
				if ( slug ) onSelectSlug( slug );
			}
			else if ( ( ev.key === 'f' || ev.key === 'F' ) && document.activeElement && document.activeElement.getAttribute( 'data-odd-card' ) !== null ) {
				ev.preventDefault();
				var favBtn = document.activeElement.querySelector( '[data-odd-fav]' );
				if ( favBtn ) favBtn.click();
			}
		} );

		// Click outside panel closes.
		overlay.addEventListener( 'click', function ( ev ) {
			if ( ev.target === overlay ) close();
		} );
		closeBtn.addEventListener( 'click', close );

		var closing = false;
		function close() {
			if ( closing || ! overlay.parentNode ) return;
			closing = true;
			cancelPreview();
			window.removeEventListener( 'odd:audio-change', refreshAudioBtn );
			if ( active === instance ) active = null;
			var done = function () {
				if ( overlay.parentNode ) overlay.parentNode.removeChild( overlay );
				try { if ( previouslyFocused && previouslyFocused.focus ) previouslyFocused.focus(); } catch ( e ) { /* ignore */ }
				if ( typeof opts.onClose === 'function' ) opts.onClose();
			};
			if ( opts.prefersReducedMotion ) {
				done();
				return;
			}
			overlay.style.transition = 'opacity .18s ease, transform .18s ease';
			overlay.style.opacity = '0';
			overlay.style.transform = 'scale(.985)';
			setTimeout( done, 200 );
		}

		var instance = { close: close, overlay: overlay };
		active = instance;

		renderChips();
		renderBody();
		host.appendChild( overlay );

		// Prefetch every scene's backdrop on open so the HTTP cache
		// is primed by the time the user picks something. Spread out
		// in a rIC so we never compete with the overlay paint.
		var ric = window.requestIdleCallback || function ( fn ) { return setTimeout( fn, 200 ); };
		ric( function () {
			scenes.forEach( function ( s ) { prefetchBackdrop( s.slug ); } );
		} );

		// Focus search on open (keyboard-first).
		setTimeout( function () { search.focus(); }, 0 );

		return instance;
	}

	function closeActive() {
		if ( active ) active.close();
	}

	window.__odd.picker = { open: openPicker, close: closeActive };
} )();
