/**
 * ODD Control Panel — native-window render callback.
 * ---------------------------------------------------------------
 * Registered on `window.wpDesktopNativeWindows.odd`; the shell
 * invokes this when the window opens and re-invokes it every
 * time the user re-opens a previously-closed instance. The
 * returned function is the teardown, called on close.
 *
 * Layout: macOS System Preferences-style two-pane. Left nav
 * lists sections (Wallpaper / Icons / About); right pane is
 * the live content area. All state flows through REST so the
 * wallpaper engine + dock filter pick up the change on its own
 * side — wallpaper via WP Desktop Mode's per-user settings,
 * icons via a soft reload (the server-side dock filter is the
 * canonical renderer).
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	window.wpDesktopNativeWindows = window.wpDesktopNativeWindows || {};

	var SECTIONS = [
		{ id: 'wallpaper', label: 'Wallpaper' },
		{ id: 'icons',     label: 'Icons'     },
		{ id: 'about',     label: 'About'     },
	];

	window.wpDesktopNativeWindows.odd = function ( body ) {
		body.innerHTML = '';
		injectStyles();
		body.classList.add( 'odd-panel' );
		body.style.cssText = [
			'display:grid',
			'grid-template-columns:200px 1fr',
			'height:100%',
			'min-height:0',
			'font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
			'color:#1d2327',
			'background:#f6f7f7',
		].join( ';' );

		var sidebar = el( 'nav', {
			'data-odd-sidebar': '1',
			style: 'background:#f0f0f1;border-right:1px solid #dcdcde;padding:14px 8px;display:flex;flex-direction:column;gap:2px;overflow:auto;',
		} );
		var content = el( 'section', {
			'data-odd-content': '1',
			style: 'padding:24px 28px;overflow:auto;min-width:0;',
		} );

		var state = {
			active:        'wallpaper',
			cfg:           clone( window.odd || {} ),
			posting:       false,
		};
		var buttons = {};

		SECTIONS.forEach( function ( section ) {
			var btn = el( 'button', {
				type: 'button',
				'data-section': section.id,
			} );
			btn.textContent = section.label;
			btn.className = 'odd-panel__nav';
			btn.addEventListener( 'click', function () { renderSection( section.id ); } );
			buttons[ section.id ] = btn;
			sidebar.appendChild( btn );
		} );

		body.appendChild( sidebar );
		body.appendChild( content );

		renderSection( state.active );

		return function teardown() {
			body.classList.remove( 'odd-panel' );
		};

		/* --- routing --- */

		function renderSection( id ) {
			state.active = id;
			for ( var k in buttons ) {
				if ( Object.prototype.hasOwnProperty.call( buttons, k ) ) {
					buttons[ k ].classList.toggle( 'is-active', k === id );
				}
			}
			content.innerHTML = '';
			if ( id === 'wallpaper' ) {
				content.appendChild( renderWallpaper() );
			} else if ( id === 'icons' ) {
				content.appendChild( renderIcons() );
			} else {
				content.appendChild( renderAbout() );
			}
		}

		/* --- Wallpaper section --- */

		function renderWallpaper() {
			var wrap = el( 'div' );
			wrap.appendChild( sectionHeader( 'Wallpaper', 'Pick a scene. Live preview updates the desktop in the background.' ) );

			var toolbar = el( 'div', { class: 'odd-toolbar' } );

			var shuffleRow = el( 'label', { class: 'odd-toggle' } );
			var shuffleBox = el( 'input', { type: 'checkbox' } );
			shuffleBox.checked = !! ( state.cfg.shuffle && state.cfg.shuffle.enabled );
			var shuffleLabel = el( 'span' );
			shuffleLabel.textContent = 'Shuffle every';
			var minutes = el( 'input', { type: 'number', min: '1', max: '240', class: 'odd-minutes' } );
			minutes.value = String( ( state.cfg.shuffle && state.cfg.shuffle.minutes ) || 15 );
			var minutesSuffix = el( 'span' );
			minutesSuffix.textContent = 'min';
			shuffleRow.appendChild( shuffleBox );
			shuffleRow.appendChild( shuffleLabel );
			shuffleRow.appendChild( minutes );
			shuffleRow.appendChild( minutesSuffix );
			toolbar.appendChild( shuffleRow );

			function pushShuffle() {
				var m = parseInt( minutes.value, 10 );
				if ( isNaN( m ) ) { m = 15; }
				if ( m < 1 ) m = 1;
				if ( m > 240 ) m = 240;
				minutes.value = String( m );
				savePrefs( { shuffle: { enabled: shuffleBox.checked, minutes: m } }, function ( data ) {
					if ( data && data.shuffle ) state.cfg.shuffle = data.shuffle;
				} );
			}
			shuffleBox.addEventListener( 'change', pushShuffle );
			minutes.addEventListener( 'change', pushShuffle );

			var audioRow = el( 'label', { class: 'odd-toggle' } );
			var audioBox = el( 'input', { type: 'checkbox' } );
			audioBox.checked = !! state.cfg.audioReactive;
			var audioLbl = el( 'span' );
			audioLbl.textContent = 'Audio-reactive';
			audioRow.appendChild( audioBox );
			audioRow.appendChild( audioLbl );
			toolbar.appendChild( audioRow );
			audioBox.addEventListener( 'change', function () {
				savePrefs( { audioReactive: audioBox.checked }, function ( data ) {
					if ( data ) state.cfg.audioReactive = !! data.audioReactive;
				} );
			} );

			wrap.appendChild( toolbar );

			var scenes = Array.isArray( state.cfg.scenes ) ? state.cfg.scenes : [];
			var grid = el( 'div', { class: 'odd-grid' } );
			scenes.forEach( function ( scene ) {
				grid.appendChild( renderSceneCard( scene ) );
			} );
			wrap.appendChild( grid );

			return wrap;
		}

		function renderSceneCard( scene ) {
			var active = scene.slug === ( state.cfg.wallpaper || state.cfg.scene );
			var card = el( 'button', {
				type: 'button',
				class: 'odd-card' + ( active ? ' is-active' : '' ),
				'data-slug': scene.slug,
			} );

			var img = el( 'img', {
				src: ( state.cfg.pluginUrl || '' ) + '/assets/previews/' + scene.slug + '.webp',
				alt: scene.label || scene.slug,
				loading: 'lazy',
			} );
			img.style.backgroundColor = scene.fallbackColor || '#111';
			card.appendChild( img );

			var meta = el( 'div', { class: 'odd-card__meta' } );
			var title = el( 'div', { class: 'odd-card__title' } );
			title.textContent = scene.label || scene.slug;
			var sub = el( 'div', { class: 'odd-card__sub' } );
			sub.textContent = scene.franchise || '';
			meta.appendChild( title );
			meta.appendChild( sub );
			card.appendChild( meta );

			card.addEventListener( 'click', function () {
				if ( scene.slug === ( state.cfg.wallpaper || state.cfg.scene ) ) return;
				applyScene( scene.slug, card );
			} );

			return card;
		}

		function applyScene( slug, cardEl ) {
			if ( state.posting ) return;
			state.posting = true;

			// Optimistic UI update.
			var all = content.querySelectorAll( '.odd-card' );
			for ( var i = 0; i < all.length; i++ ) all[ i ].classList.remove( 'is-active' );
			if ( cardEl ) cardEl.classList.add( 'is-active' );

			// The wallpaper engine subscribes to `odd/pickScene` via
			// @wordpress/hooks — firing this swaps the scene live
			// without a reload. See odd/src/wallpaper/index.js.
			if ( window.wp && window.wp.hooks && typeof window.wp.hooks.doAction === 'function' ) {
				try { window.wp.hooks.doAction( 'odd/pickScene', slug ); } catch ( e ) {}
			}

			savePrefs( { wallpaper: slug }, function ( data ) {
				state.posting = false;
				if ( data && typeof data.wallpaper === 'string' ) {
					state.cfg.wallpaper = data.wallpaper;
					state.cfg.scene = data.wallpaper;
				}
			} );
		}

		/* --- Icons section --- */

		function renderIcons() {
			var wrap = el( 'div' );
			wrap.appendChild( sectionHeader( 'Icons', 'Themed icon sets for the dock and desktop shortcuts. Applying a set reloads the admin once so the server can re-render.' ) );

			var sets = Array.isArray( state.cfg.iconSets ) ? state.cfg.iconSets.slice() : [];
			// Synthetic "None" pseudo-set so the user can opt out.
			sets.unshift( {
				slug:        'none',
				label:       'Default',
				franchise:   'WP Desktop Mode',
				description: 'Ship the stock Dashicons / WP Desktop Mode icons.',
				preview:     '',
				icons:       {},
			} );

			var grid = el( 'div', { class: 'odd-grid odd-grid--icons' } );
			sets.forEach( function ( set ) {
				grid.appendChild( renderIconSetCard( set ) );
			} );
			wrap.appendChild( grid );

			return wrap;
		}

		function renderIconSetCard( set ) {
			var currentSlug = state.cfg.iconSet || '';
			var isDefault = ! currentSlug;
			var active = ( set.slug === 'none' && isDefault ) || ( set.slug !== 'none' && set.slug === currentSlug );

			var card = el( 'button', {
				type: 'button',
				class: 'odd-card' + ( active ? ' is-active' : '' ),
				'data-slug': set.slug,
			} );

			var thumb = el( 'div', { class: 'odd-card__thumb' } );
			if ( set.preview ) {
				var img = el( 'img', { src: set.preview, alt: set.label, loading: 'lazy' } );
				thumb.appendChild( img );
			} else if ( set.icons && Object.keys( set.icons ).length ) {
				// Mini-grid of up to 4 icon SVGs as a generated preview.
				var keys = [ 'dashboard', 'posts', 'pages', 'media' ].filter( function ( k ) { return set.icons[ k ]; } );
				if ( ! keys.length ) keys = Object.keys( set.icons ).slice( 0, 4 );
				thumb.style.background = ( set.accent || '#f0f0f1' );
				var inner = el( 'div', { class: 'odd-thumb-grid' } );
				keys.slice( 0, 4 ).forEach( function ( k ) {
					var i = el( 'img', { src: set.icons[ k ], alt: k, loading: 'lazy' } );
					inner.appendChild( i );
				} );
				thumb.appendChild( inner );
			} else {
				thumb.textContent = 'No preview';
				thumb.classList.add( 'odd-card__thumb--empty' );
			}
			card.appendChild( thumb );

			var meta = el( 'div', { class: 'odd-card__meta' } );
			var title = el( 'div', { class: 'odd-card__title' } );
			title.textContent = set.label || set.slug;
			var sub = el( 'div', { class: 'odd-card__sub' } );
			sub.textContent = set.franchise || set.description || '';
			meta.appendChild( title );
			meta.appendChild( sub );
			card.appendChild( meta );

			card.addEventListener( 'click', function () {
				if ( active ) return;
				applyIconSet( set.slug, card );
			} );

			return card;
		}

		function applyIconSet( slug, cardEl ) {
			if ( state.posting ) return;
			state.posting = true;

			var all = content.querySelectorAll( '.odd-card' );
			for ( var i = 0; i < all.length; i++ ) all[ i ].classList.remove( 'is-active' );
			if ( cardEl ) cardEl.classList.add( 'is-active' );

			savePrefs( { iconSet: slug }, function ( data ) {
				state.posting = false;
				if ( data && typeof data.iconSet === 'string' ) {
					state.cfg.iconSet = data.iconSet;
				}
				// Icon swap is server-canonical: reload so the dock +
				// desktop icons rebuild through the `wp_desktop_dock_item`
				// + `wp_desktop_icons` filters. Live-swap via JS DOM
				// surgery is unreliable — the server-side filters at
				// priority 20 are the source of truth.
				setTimeout( function () {
					try { window.location.reload(); } catch ( e ) {}
				}, 180 );
			} );
		}

		/* --- About section --- */

		function renderAbout() {
			var cfg = state.cfg;
			var wrap = el( 'div' );
			wrap.appendChild( sectionHeader( 'ODD — Outlandish Desktop Decorator',
				'Generative wallpapers and themed icon sets for WP Desktop Mode. One plugin, one window, everything in one place.' ) );

			var meta = el( 'dl', { class: 'odd-about-meta' } );
			meta.innerHTML =
				'<dt>Version</dt><dd>' + escape( cfg.version || '—' ) + '</dd>' +
				'<dt>Scenes</dt><dd>' + ( Array.isArray( cfg.scenes ) ? cfg.scenes.length : 0 ) + '</dd>' +
				'<dt>Icon sets</dt><dd>' + ( Array.isArray( cfg.iconSets ) ? cfg.iconSets.length : 0 ) + '</dd>';
			wrap.appendChild( meta );

			var link = el( 'a', {
				href:   'https://github.com/RegionallyFamous/odd',
				target: '_blank',
				rel:    'noopener noreferrer',
				class:  'odd-about-link',
			} );
			link.textContent = 'github.com/RegionallyFamous/odd';
			wrap.appendChild( link );
			return wrap;
		}

		/* --- shared helpers --- */

		function sectionHeader( title, sub ) {
			var h = el( 'header', { class: 'odd-section-header' } );
			var hh = el( 'h2' );
			hh.textContent = title;
			var p = el( 'p' );
			p.textContent = sub;
			h.appendChild( hh );
			h.appendChild( p );
			return h;
		}

		function savePrefs( body, onDone ) {
			var cfg = state.cfg;
			if ( ! cfg.restUrl ) {
				if ( typeof onDone === 'function' ) onDone( null );
				return;
			}
			fetch( cfg.restUrl, {
				method:      'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce':   cfg.restNonce || '',
				},
				body: JSON.stringify( body ),
			} ).then( function ( r ) {
				return r.ok ? r.json() : null;
			} ).then( function ( data ) {
				if ( typeof onDone === 'function' ) onDone( data );
			} ).catch( function () {
				if ( typeof onDone === 'function' ) onDone( null );
			} );
		}
	};

	/* --- dom helpers (unscoped) --- */

	function el( tag, attrs ) {
		var n = document.createElement( tag );
		if ( attrs ) {
			for ( var k in attrs ) {
				if ( Object.prototype.hasOwnProperty.call( attrs, k ) ) {
					if ( k === 'class' ) n.className = attrs[ k ];
					else if ( k === 'style' ) n.style.cssText = attrs[ k ];
					else n.setAttribute( k, attrs[ k ] );
				}
			}
		}
		return n;
	}
	function clone( o ) { try { return JSON.parse( JSON.stringify( o ) ); } catch ( e ) { return {}; } }
	function escape( s ) {
		return String( s ).replace( /[&<>"']/g, function ( c ) {
			return ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } )[ c ];
		} );
	}

	/**
	 * Stylesheet is injected once per page and scopes under `.odd-panel`
	 * so it can't leak into the shell chrome. WP Desktop Mode native
	 * windows receive our body inside a chromeless frame; all typography
	 * + spacing conventions here come from the WP admin design system.
	 */
	function injectStyles() {
		if ( document.getElementById( 'odd-panel-styles' ) ) return;
		var s = document.createElement( 'style' );
		s.id = 'odd-panel-styles';
		s.textContent = [
			'.odd-panel .odd-panel__nav{text-align:left;padding:8px 12px;border:1px solid transparent;border-radius:6px;background:transparent;cursor:pointer;font:inherit;font-size:13px;color:#50575e;transition:background .12s ease,border-color .12s ease}',
			'.odd-panel .odd-panel__nav:hover{background:rgba(0,0,0,.04)}',
			'.odd-panel .odd-panel__nav.is-active{background:#fff;border-color:#c3c4c7;font-weight:600;color:#1d2327}',
			'.odd-panel .odd-section-header{margin:0 0 16px}',
			'.odd-panel .odd-section-header h2{margin:0 0 6px;font-size:18px;font-weight:600}',
			'.odd-panel .odd-section-header p{margin:0;color:#50575e;font-size:13px;max-width:58ch;line-height:1.45}',
			'.odd-panel .odd-toolbar{display:flex;flex-wrap:wrap;gap:16px 24px;align-items:center;padding:10px 12px;margin:0 0 16px;background:#fff;border:1px solid #dcdcde;border-radius:8px}',
			'.odd-panel .odd-toggle{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:#1d2327}',
			'.odd-panel .odd-toggle input[type="checkbox"]{margin:0}',
			'.odd-panel .odd-minutes{width:58px;padding:2px 6px;border:1px solid #8c8f94;border-radius:4px;font:inherit;font-size:13px}',
			'.odd-panel .odd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}',
			'.odd-panel .odd-grid--icons{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}',
			'.odd-panel .odd-card{all:unset;display:flex;flex-direction:column;background:#fff;border:1px solid #dcdcde;border-radius:10px;overflow:hidden;cursor:pointer;transition:transform .12s ease,border-color .12s ease,box-shadow .18s ease;position:relative}',
			'.odd-panel .odd-card:hover{border-color:#2271b1;box-shadow:0 4px 12px rgba(0,0,0,.08);transform:translateY(-1px)}',
			'.odd-panel .odd-card.is-active{border-color:#2271b1;box-shadow:0 0 0 2px #2271b1 inset}',
			'.odd-panel .odd-card.is-active::after{content:"✓";position:absolute;top:6px;right:8px;width:22px;height:22px;border-radius:50%;background:#2271b1;color:#fff;font-size:13px;line-height:22px;text-align:center;font-weight:700}',
			'.odd-panel .odd-card img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#111}',
			'.odd-panel .odd-card__thumb{display:flex;align-items:center;justify-content:center;aspect-ratio:16/10;background:#f0f0f1;color:#50575e;font-size:12px;padding:14px}',
			'.odd-panel .odd-card__thumb--empty{color:#8c8f94;font-style:italic}',
			'.odd-panel .odd-thumb-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6px;width:100%;height:100%;padding:4px}',
			'.odd-panel .odd-thumb-grid img{background:rgba(255,255,255,.85);border-radius:6px;padding:8px;object-fit:contain;aspect-ratio:1}',
			'.odd-panel .odd-card__meta{padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}',
			'.odd-panel .odd-card__title{font-size:13px;font-weight:600;color:#1d2327;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
			'.odd-panel .odd-card__sub{font-size:11px;color:#646970;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
			'.odd-panel .odd-about-meta{display:grid;grid-template-columns:110px 1fr;gap:6px 14px;font-size:13px;color:#50575e;margin:0 0 16px}',
			'.odd-panel .odd-about-link{font-size:13px;color:#2271b1;text-decoration:none}',
			'.odd-panel .odd-about-link:hover{text-decoration:underline}',
		].join( '\n' );
		document.head.appendChild( s );
	}
} )();
