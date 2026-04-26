/**
 * ODD Shop — native-window render callback.
 * ---------------------------------------------------------------
 * Registered on `window.wpDesktopNativeWindows.odd`; the shell
 * invokes this when the window opens and re-invokes it every
 * time the user re-opens a previously-closed instance. The
 * returned function is the teardown, called on close.
 *
 * Layout: Mac App Store–style shop with a top bar, a left
 * department rail (Wallpapers / Icon Sets / Apps / About), and
 * a right content pane that groups items into franchise
 * "shelves". All state still flows through the same REST
 * endpoint used by the legacy control panel — wallpaper via
 * WP Desktop Mode's per-user settings, icons via a soft reload
 * (the server-side dock filter is the canonical renderer). Only
 * the chrome + copy changed; the data model and live-swap hook
 * wiring are untouched.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	window.wpDesktopNativeWindows = window.wpDesktopNativeWindows || {};

	var _safeCall = ( window.__odd && window.__odd.safeCall ) || function ( fn ) { try { return fn(); } catch ( e ) {} };
	var _events   = window.__odd && window.__odd.events;
	function reportError( source, err ) {
		if ( _events ) {
			try {
				_events.emit( 'odd.error', {
					source:   source,
					err:      err,
					severity: 'error',
					message:  err && err.message,
					stack:    err && err.stack,
				} );
			} catch ( e ) {}
		}
	}

	// Mac App Store–style "departments". The ids are unchanged so
	// localized config (`appsEnabled`), slash commands, and tests
	// keep working; only the user-facing labels + icons moved.
	var SECTIONS = [
		{ id: 'wallpaper', label: 'Wallpapers', icon: '🖼', tagline: 'Live generative scenes' },
		{ id: 'icons',     label: 'Icon Sets',  icon: '🧩', tagline: 'Re-skin the dock' },
		{ id: 'widgets',   label: 'Widgets',    icon: '🧷', tagline: 'Desktop companions' },
		{ id: 'apps',      label: 'Apps',       icon: '📦', tagline: 'Mini apps that just run', gated: 'appsEnabled' },
		{ id: 'about',     label: 'About',      icon: '👁', tagline: 'Credits & chaos' },
	];

	var renderPanel = function ( body ) {
		// Bundle-install lookup tables. Hoisted so nested
		// render functions can use them regardless of file order.
		var DEPT_FOR_TYPE = {
			'app':      'apps',
			'icon-set': 'icons',
			'scene':    'wallpaper',
			'widget':   'widgets',
		};
		var NOUN_FOR_TYPE = {
			'app':      'app',
			'icon-set': 'icon set',
			'scene':    'scene',
			'widget':   'widget',
		};

		body.innerHTML = '';
		injectStyles();
		body.classList.add( 'odd-panel', 'odd-shop' );
		body.style.cssText = [
			'display:grid',
			'grid-template-rows:auto 1fr',
			'grid-template-columns:236px 1fr',
			'height:100%',
			'min-height:0',
			'font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
			'color:#1d1d1f',
			'background:#f5f5f7',
		].join( ';' );

		// Top bar — window-wide chrome band that frames the whole
		// store. Spans both columns and gives the sidebar + content
		// a shared ceiling like the macOS App Store window.
		var topbar = el( 'header', { 'data-odd-topbar': '1', class: 'odd-shop__topbar' } );
		var brandWrap = el( 'div', { class: 'odd-shop__brand' } );
		var brandMark = el( 'span', { class: 'odd-shop__brand-mark', 'aria-hidden': 'true' } );
		brandMark.textContent = '👁';
		var brandText = el( 'div', { class: 'odd-shop__brand-text' } );
		var brandTitle = el( 'strong' );
		brandTitle.textContent = 'ODD Shop';
		var brandSub = el( 'span' );
		brandSub.textContent = 'Outlandish Desktop Decorator';
		brandText.appendChild( brandTitle );
		brandText.appendChild( brandSub );
		brandWrap.appendChild( brandMark );
		brandWrap.appendChild( brandText );
		topbar.appendChild( brandWrap );

		// Search field — filters the current department's shelves in
		// place (no REST call; pure client-side title/franchise match).
		// Mirrors the App Store's "Search" pill but doesn't try to be
		// a global search — cross-department search would need its own
		// result surface and is a v2 problem.
		var searchWrap = el( 'label', { class: 'odd-shop__search', 'aria-label': 'Search' } );
		var searchGlyph = el( 'span', { class: 'odd-shop__search-glyph', 'aria-hidden': 'true' } );
		searchGlyph.textContent = '⌕';
		var searchInput = el( 'input', {
			type: 'search',
			class: 'odd-shop__search-input',
			placeholder: 'Search wallpapers, icons, apps…',
			'data-odd-search': '1',
		} );
		searchInput.addEventListener( 'input', function () {
			state.query = searchInput.value || '';
			// Only re-render when the current department actually
			// pays attention to the filter, so typing never churns
			// the About hero or the Apps uploader.
			if ( state.active === 'wallpaper' || state.active === 'icons' ) {
				renderSection( state.active, { keepQuery: true } );
			}
		} );
		searchWrap.appendChild( searchGlyph );
		searchWrap.appendChild( searchInput );
		topbar.appendChild( searchWrap );

		// Universal install pill. Accepts a .wp bundle of any type
		// (app, icon-set, scene, widget) and routes it through
		// /odd/v1/bundles/upload. Hidden for users without
		// manage_options — the REST endpoint rejects them too, but
		// the UI shouldn't hint at an action they can't take.
		var installPill = null;
		var installInput = null;
		if ( ( window.odd || {} ).canInstall ) {
			installPill = el( 'button', {
				type:         'button',
				class:        'odd-shop__install',
				'aria-label': 'Install from .wp file',
				'data-odd-install-pill': '1',
			} );
			var installGlyph = el( 'span', { class: 'odd-shop__install-glyph', 'aria-hidden': 'true' } );
			installGlyph.textContent = '⇪';
			var installLabel = el( 'span', { class: 'odd-shop__install-label' } );
			installLabel.textContent = 'Install';
			installPill.appendChild( installGlyph );
			installPill.appendChild( installLabel );

			installInput = el( 'input', {
				type:   'file',
				accept: '.wp,application/zip',
				style:  'display:none',
				'data-odd-install-input': '1',
			} );
			installPill.addEventListener( 'click', function () { installInput.click(); } );
			installInput.addEventListener( 'change', function () {
				if ( installInput.files && installInput.files[ 0 ] ) {
					installBundle( installInput.files[ 0 ] );
					installInput.value = '';
				}
			} );
			topbar.appendChild( installPill );
			topbar.appendChild( installInput );
		}

		var sidebar = el( 'nav', {
			'data-odd-sidebar': '1',
			class: 'odd-shop__rail',
		} );
		var railHeader = el( 'div', { class: 'odd-shop__rail-heading' } );
		railHeader.textContent = 'Store';
		sidebar.appendChild( railHeader );

		var content = el( 'section', {
			'data-odd-content': '1',
			class: 'odd-shop__content',
		} );

		var state = {
			active:        'wallpaper',
			cfg:           clone( window.odd || {} ),
			posting:       false,
			// Preview state: when non-null, the user has clicked a
			// scene or icon-set card and the shell is showing the
			// live result without having committed yet. Confirming
			// persists via REST; cancelling reverts to `original`.
			//
			//   { kind: 'wallpaper' | 'iconSet',
			//     slug:         'aurora',
			//     originalSlug: 'flux',
			//     iconSnapshot: [ { img, src } ]   // iconSet only
			//     reloadOnCommit: bool              // iconSet only
			//   }
			preview:       null,
			// Live client-side filter. Threaded into wallpaper +
			// icons rendering; cleared on department switch unless
			// the caller passes `keepQuery: true` (e.g. the search
			// field re-rendering its own tab).
			query:         '',
		};
		var buttons = {};

		SECTIONS.forEach( function ( section ) {
			// Skip gated sections (e.g. Apps) until their feature flag
			// comes in from the localized config.
			if ( section.gated && ! state.cfg[ section.gated ] ) {
				return;
			}
			var btn = el( 'button', {
				type: 'button',
				'data-section': section.id,
			} );
			btn.className = 'odd-panel__nav odd-shop__rail-item';
			var glyph = el( 'span', { class: 'odd-shop__rail-glyph', 'aria-hidden': 'true' } );
			glyph.textContent = section.icon || '•';
			var labelWrap = el( 'span', { class: 'odd-shop__rail-label' } );
			var label = el( 'strong' );
			label.textContent = section.label;
			labelWrap.appendChild( label );
			if ( section.tagline ) {
				var tag = el( 'span' );
				tag.textContent = section.tagline;
				labelWrap.appendChild( tag );
			}
			btn.appendChild( glyph );
			btn.appendChild( labelWrap );
			btn.addEventListener( 'click', function () { renderSection( section.id ); } );
			buttons[ section.id ] = btn;
			sidebar.appendChild( btn );
		} );

		// Footer caption in the rail — mimics the App Store's small
		// account/region line. Version bumps at runtime from cfg so
		// a new release surfaces immediately in the chrome.
		var railFoot = el( 'div', { class: 'odd-shop__rail-foot' } );
		railFoot.textContent = state.cfg.version
			? 'ODD v' + state.cfg.version
			: 'ODD';
		sidebar.appendChild( railFoot );

		body.appendChild( topbar );
		body.appendChild( sidebar );
		body.appendChild( content );

		installDropAnywhere( body );

		renderSection( state.active );

		return function teardown() {
			body.classList.remove( 'odd-panel', 'odd-shop' );
			// Pull the widget-layer subscriptions so a reopen doesn't
			// stack duplicate listeners that each re-render the
			// section on every widget add/remove.
			try {
				if ( window.wp && window.wp.hooks ) {
					window.wp.hooks.removeAction( 'wp-desktop.widget.added',   'odd/widgets' );
					window.wp.hooks.removeAction( 'wp-desktop.widget.removed', 'odd/widgets' );
				}
			} catch ( e ) {}
		};

		/* --- routing --- */

		function renderSection( id, opts ) {
			opts = opts || {};
			// Abandoning a tab with a pending preview reverts the
			// live swap — no silent commits because the user clicked
			// "About" to look at stats.
			if ( state.preview ) {
				var sameTab = ( id === 'wallpaper' && state.preview.kind === 'wallpaper' ) ||
					( id === 'icons' && state.preview.kind === 'iconSet' );
				if ( ! sameTab ) cancelPreview();
			}

			// Department switch resets the search query so hopping
			// into Icons after filtering Wallpapers doesn't greet
			// the user with a stale "no results" state.
			if ( state.active !== id && ! opts.keepQuery ) {
				state.query = '';
				var input = document.querySelector( '[data-odd-search]' );
				if ( input && input.value ) input.value = '';
			}

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
			} else if ( id === 'widgets' ) {
				content.appendChild( renderWidgets() );
			} else if ( id === 'apps' ) {
				content.appendChild( renderApps() );
			} else {
				content.appendChild( renderAbout() );
			}
			// If we re-entered the tab that owns an active preview,
			// re-draw the sticky confirmation bar.
			if ( state.preview ) renderPreviewBar();

			// Flash-highlight the just-installed tile, if we owe
			// the user one from a bundle install that landed on
			// this department.
			highlightJustInstalled();
		}

		/* --- Apps section --- */

		function renderApps() {
			var wrap = el( 'div', { 'data-odd-apps': '1', class: 'odd-shop__dept odd-shop__dept--apps' } );
			wrap.appendChild( sectionHeader(
				'Apps',
				'Mini apps that run on your WordPress desktop without using — or knowing — anything about WordPress. Open the dock icon and they just work. Upload a .wp bundle, or install from the curated catalog below.',
				{ eyebrow: 'ODD · Mini Apps' }
			) );

			// Editorial banner for the Apps department. Replaces the
			// previous gradient-only treatment so Apps gets the same
			// visual weight as Wallpapers + Icon Sets.
			wrap.appendChild( renderAppsHero() );

			// Per-department install link — lives under the hero so
			// users who landed here from the sidebar can install
			// without hunting for the topbar pill. The universal
			// installer routes by manifest.type, so the same .wp
			// flow works for every department.
			wrap.appendChild( renderDeptInstallLink( 'app' ) );

			// Status rail. Populated by installBundle() / deletions.
			var status = el( 'div', { class: 'odd-apps-status', 'data-odd-apps-status': '1' } );
			wrap.appendChild( status );

			var installedHead = el( 'h3', { class: 'odd-apps-subhead' } );
			installedHead.textContent = 'Installed';
			wrap.appendChild( installedHead );

			// Installed apps gallery.
			var gallery = el( 'div', { class: 'odd-grid odd-grid--apps', 'data-odd-apps-gallery': '1' } );
			wrap.appendChild( gallery );

			fetchApps().then( function ( apps ) {
				renderAppsGallery( gallery, apps, wrap );
			} );

			// Catalog — everything available, installed or not. The
			// server marks each row with `installed: true/false` so
			// the UI can flip a card's primary action.
			var catalogHead = el( 'h3', { class: 'odd-apps-subhead odd-apps-subhead--catalog' } );
			catalogHead.textContent = 'Catalog';
			wrap.appendChild( catalogHead );
			var catalogNote = el( 'div', { class: 'odd-apps-note' } );
			catalogNote.textContent = 'Curated ODD apps. Built-ins come with the plugin; remote apps download from the internet on install.';
			wrap.appendChild( catalogNote );
			var catalog = el( 'div', { class: 'odd-grid odd-grid--apps', 'data-odd-apps-catalog': '1' } );
			wrap.appendChild( catalog );
			fetchCatalog().then( function ( rows ) {
				renderCatalogGallery( catalog, rows, wrap );
			} );

			return wrap;
		}

		function renderCatalogGallery( gallery, rows, wrap ) {
			gallery.innerHTML = '';
			gallery.classList.remove( 'odd-grid', 'odd-grid--apps' );
			gallery.classList.add( 'odd-catalog-list' );
			if ( ! rows || ! rows.length ) {
				var empty = el( 'div', { class: 'odd-apps-empty' } );
				empty.textContent = 'Catalog is empty.';
				gallery.appendChild( empty );
				return;
			}
			rows.forEach( function ( row ) {
				gallery.appendChild( renderCatalogCard( row, wrap ) );
			} );
		}

		function renderCatalogCard( row, wrap ) {
			var card = el( 'div', { class: 'odd-catalog-row', 'data-catalog-slug': row.slug } );
			if ( row.installed ) card.classList.add( 'is-installed' );

			var iconWrap = el( 'div', { class: 'odd-catalog-row__icon' } );
			if ( row.icon_url ) {
				var src = row.icon_url;
				if ( src.indexOf( 'http' ) !== 0 && src.indexOf( 'data:' ) !== 0 ) {
					src = ( state.cfg.pluginUrl || '' ) + '/apps/catalog/' + src;
				}
				iconWrap.appendChild( el( 'img', { src: src, alt: '', loading: 'lazy' } ) );
			} else {
				iconWrap.classList.add( 'odd-catalog-row__icon--badge' );
				iconWrap.textContent = ( row.name || row.slug ).slice( 0, 2 ).toUpperCase();
			}
			card.appendChild( iconWrap );

			var body = el( 'div', { class: 'odd-catalog-row__body' } );
			var titleRow = el( 'div', { class: 'odd-catalog-row__title' } );
			var titleText = el( 'span', { class: 'odd-catalog-row__name' } );
			titleText.textContent = row.name || row.slug;
			titleRow.appendChild( titleText );
			if ( row.builtin ) {
				var pill = el( 'span', { class: 'odd-pill odd-pill--builtin' } );
				pill.textContent = 'built-in';
				titleRow.appendChild( pill );
			}
			if ( row.version ) {
				var ver = el( 'span', { class: 'odd-catalog-row__version' } );
				ver.textContent = 'v' + row.version;
				titleRow.appendChild( ver );
			}
			body.appendChild( titleRow );

			if ( row.description ) {
				var desc = el( 'div', { class: 'odd-catalog-row__desc' } );
				desc.textContent = row.description;
				body.appendChild( desc );
			}
			card.appendChild( body );

			var actions = el( 'div', { class: 'odd-catalog-row__actions' } );
			if ( row.installed ) {
				var installed = el( 'span', { class: 'odd-catalog-row__installed' } );
				installed.textContent = 'Installed';
				actions.appendChild( installed );
				var openBtn = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--primary odd-apps-btn--pill' } );
				openBtn.textContent = 'Open';
				openBtn.addEventListener( 'click', function () { openAppWindow( row.slug ); } );
				actions.appendChild( openBtn );
			} else {
				var installBtn = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--primary odd-apps-btn--pill' } );
				installBtn.textContent = row.builtin ? 'Add' : 'Get';
				installBtn.addEventListener( 'click', function () {
					var originalLabel = installBtn.textContent;
					installBtn.disabled = true;
					installBtn.textContent = row.builtin ? 'Adding…' : 'Getting…';
					var label = row.builtin ? 'Adding ' : 'Downloading ';
					setAppsStatus( wrap, label + ( row.name || row.slug ) + '…', 'busy' );
					installFromCatalog( row.slug ).then( function ( res ) {
						if ( res && res.ok && res.data && res.data.installed ) {
							var m = res.data.manifest;
							setAppsStatus( wrap, 'Installed ' + ( ( m && m.name ) || row.name ) + '. Reloading…', 'ok' );
							var ev = window.__odd && window.__odd.events;
							if ( ev ) ev.emit( 'odd.app-installed', { slug: row.slug, manifest: m } );
							setTimeout( function () { try { window.location.reload(); } catch ( e ) {} }, 600 );
							return;
						}
						installBtn.disabled = false;
						installBtn.textContent = originalLabel;
						var msg = ( res && res.message ) ||
							( res && res.data && ( res.data.message || res.data.code ) ) ||
							'Install failed.';
						setAppsStatus( wrap, msg, 'error' );
					} );
				} );
				actions.appendChild( installBtn );
			}
			card.appendChild( actions );
			return card;
		}

		function fetchCatalog() {
			return fetch( appsBaseUrl() + '/catalog', {
				credentials: 'same-origin',
				headers: { 'X-WP-Nonce': state.cfg.restNonce || '' },
			} ).then( function ( r ) { return r.ok ? r.json() : { apps: [] }; } )
			  .then( function ( d ) { return ( d && Array.isArray( d.apps ) ) ? d.apps : []; } )
			  .catch( function () { return []; } );
		}
		function installFromCatalog( slug ) {
			return fetch( appsBaseUrl() + '/install-from-catalog', {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce':   state.cfg.restNonce || '',
				},
				body: JSON.stringify( { slug: slug } ),
			} ).then( function ( r ) {
				return r.json().then( function ( data ) {
					return { ok: r.ok, status: r.status, data: data };
				} ).catch( function () {
					return { ok: false, status: r.status, message: 'HTTP ' + r.status };
				} );
			} ).catch( function ( err ) {
				reportError( 'apps.install-from-catalog', err );
				return { ok: false, message: ( err && err.message ) || 'Network error while installing.' };
			} );
		}

		function renderAppsGallery( gallery, apps, wrap ) {
			gallery.innerHTML = '';
			if ( ! apps || ! apps.length ) {
				var empty = el( 'div', { class: 'odd-apps-empty' } );
				empty.textContent = 'No apps installed yet. Upload one above.';
				gallery.appendChild( empty );
				return;
			}
			apps.forEach( function ( app ) {
				gallery.appendChild( renderAppCard( app, wrap ) );
			} );
		}

		function renderAppCard( app, wrap ) {
			var card = el( 'div', { class: 'odd-card odd-card--app', 'data-app-slug': app.slug } );
			if ( ! app.enabled ) card.classList.add( 'is-disabled' );

			var thumb = el( 'div', { class: 'odd-card__thumb' } );
			if ( app.icon ) {
				// The /apps/icon/{slug} route is public (no X-WP-Nonce)
				// so <img> can fetch it; /apps/serve/... would 401
				// because img tags can't send custom headers.
				var src = ( app.icon.indexOf( 'data:' ) === 0 || app.icon.indexOf( 'http' ) === 0 )
					? app.icon
					: ( ( state.cfg.restUrl || '' ).replace( /\/prefs\/?$/, '' ) + '/apps/icon/' + app.slug );
				var img = el( 'img', { src: src, alt: app.name, loading: 'lazy' } );
				thumb.appendChild( img );
			} else {
				thumb.textContent = ( app.name || app.slug ).slice( 0, 2 ).toUpperCase();
				thumb.classList.add( 'odd-card__thumb--badge' );
			}
			card.appendChild( thumb );

			var meta = el( 'div', { class: 'odd-card__meta' } );
			var title = el( 'div', { class: 'odd-card__title' } );
			title.textContent = app.name || app.slug;
			var sub = el( 'div', { class: 'odd-card__sub' } );
			sub.textContent = ( app.version ? 'v' + app.version : '' ) + ( app.description ? ( app.version ? ' — ' : '' ) + app.description : '' );
			meta.appendChild( title );
			meta.appendChild( sub );
			card.appendChild( meta );

			var actions = el( 'div', { class: 'odd-card__actions' } );

			var open = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--primary' } );
			open.textContent = 'Open';
			open.addEventListener( 'click', function () { openAppWindow( app.slug ); } );

			var toggle = el( 'button', { type: 'button', class: 'odd-apps-btn' } );
			toggle.textContent = app.enabled ? 'Disable' : 'Enable';
			toggle.addEventListener( 'click', function () {
				toggleApp( app.slug, ! app.enabled ).then( function ( ok ) {
					if ( ok ) refreshAppsGallery( wrap );
				} );
			} );

			var del = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--danger' } );
			del.textContent = 'Delete';
			del.addEventListener( 'click', function () {
				if ( ! window.confirm( 'Uninstall "' + ( app.name || app.slug ) + '"?' ) ) return;
				deleteApp( app.slug ).then( function ( ok ) {
					if ( ok ) {
						var ev = window.__odd && window.__odd.events;
						if ( ev ) ev.emit( 'odd.app-uninstalled', { slug: app.slug } );
						refreshAppsGallery( wrap );
					}
				} );
			} );

			actions.appendChild( open );
			actions.appendChild( toggle );
			actions.appendChild( del );
			card.appendChild( actions );

			return card;
		}

		function refreshAppsGallery( wrap ) {
			var gallery = wrap.querySelector( '[data-odd-apps-gallery]' );
			if ( ! gallery ) return;
			fetchApps().then( function ( apps ) {
				renderAppsGallery( gallery, apps, wrap );
			} );
		}

		function setAppsStatus( wrap, msg, kind ) {
			var rail = wrap.querySelector( '[data-odd-apps-status]' );
			if ( ! rail ) return;
			rail.textContent = msg || '';
			rail.className = 'odd-apps-status' + ( kind ? ' is-' + kind : '' );
		}

		function installFile( file, wrap ) {
			if ( ! file ) return;
			setAppsStatus( wrap, 'Installing ' + file.name + '…', 'busy' );
			uploadApp( file ).then( function ( data ) {
				if ( data && data.installed && data.manifest ) {
					setAppsStatus( wrap, 'Installed ' + data.manifest.name + '. Reloading so its icon appears…', 'ok' );
					var ev = window.__odd && window.__odd.events;
					if ( ev ) ev.emit( 'odd.app-installed', { slug: data.manifest.slug, manifest: data.manifest } );
					setTimeout( function () {
						try { window.location.reload(); } catch ( e ) {}
					}, 600 );
				} else {
					var msg = ( data && data.message ) || ( data && data.code ) || 'Install failed.';
					setAppsStatus( wrap, msg, 'error' );
				}
			} );
		}

		// ----------------------------------------------------------
		// Universal bundle install.
		//
		// Accepts a .wp of any type, routes through the universal
		// /odd/v1/bundles/upload endpoint, surfaces progress + errors
		// through both the topbar pill and window.__odd.api.toast,
		// and on success auto-switches to the landing department +
		// flash-highlights the new tile for the user.
		//
		// DEPT_FOR_TYPE + NOUN_FOR_TYPE are hoisted up top so inner
		// helpers (renderDeptInstallLink, etc.) resolve them even
		// when renderSection runs before this block is evaluated.
		// ----------------------------------------------------------

		function bundlesUploadUrl() {
			var cfg = state.cfg || {};
			if ( cfg.bundlesUploadUrl ) return cfg.bundlesUploadUrl;
			var base = cfg.restUrl || '';
			return base.replace( /\/prefs\/?$/, '/bundles/upload' );
		}

		function toast( msg ) {
			try {
				if ( window.__odd && window.__odd.api && typeof window.__odd.api.toast === 'function' ) {
					window.__odd.api.toast( msg );
					return;
				}
			} catch ( e ) {}
			// Fallback — the plain WP Desktop notice channel.
			try {
				if ( window.wp && window.wp.desktop && typeof window.wp.desktop.toast === 'function' ) {
					window.wp.desktop.toast( msg );
				}
			} catch ( e2 ) {}
		}

		function errorCopy( code, fallback ) {
			switch ( code ) {
				case 'invalid_extension':    return 'That file isn\'t a .wp bundle.';
				case 'invalid_zip':          return 'That file isn\'t a valid ZIP archive.';
				case 'zip_unavailable':     return 'This site is missing the PHP ZipArchive extension — ask the host to enable it.';
				case 'too_many_files':      return 'Bundle has too many files. The limit is 2000.';
				case 'too_large':           return 'Bundle is too large. Keep it under 25 MB uncompressed.';
				case 'zip_bomb':            return 'Bundle contains a suspicious compression ratio and was rejected.';
				case 'path_traversal':      return 'Bundle contains a path-traversal entry and was rejected.';
				case 'symlink_in_archive': return 'Bundle contains a symlink and was rejected.';
				case 'forbidden_file_type': return 'Bundle contains a server-executable file and was rejected.';
				case 'missing_manifest':    return 'Bundle is missing a manifest.json at the root.';
				case 'invalid_manifest':    return 'Bundle\'s manifest.json is not valid JSON.';
				case 'missing_manifest_field': return 'Bundle\'s manifest.json is missing a required field.';
				case 'invalid_slug':        return 'Bundle slug must be lowercase letters, numbers, and hyphens.';
				case 'slug_exists':         return 'A bundle with that slug is already installed. Remove the existing one first.';
				case 'unsupported_type':   return 'This ODD version doesn\'t know how to install that bundle type.';
				case 'install_in_progress': return 'Another install of this bundle is already in progress.';
				case 'missing_entry':       return 'Bundle is missing the entry file declared in manifest.json.';
				case 'invalid_entry':       return 'Bundle\'s entry path is invalid.';
				case 'missing_preview':     return 'Bundle is missing preview.webp.';
				case 'missing_wallpaper':   return 'Bundle is missing wallpaper.webp.';
				case 'missing_icon':        return 'Bundle is missing one of the SVGs it declared.';
				case 'missing_required_icons': return fallback || 'Icon set is missing required keys.';
				case 'invalid_svg':         return 'An SVG in this bundle isn\'t well-formed.';
				case 'extract_mkdir_failed':
				case 'extract_rename_failed':
					return 'ODD couldn\'t finalise the install. Check wp-content permissions and try again.';
				default: return fallback || 'Install failed.';
			}
		}

		function jsConfirmAlreadyGiven() {
			var store = window.__odd && window.__odd.store;
			try {
				if ( store && typeof store.get === 'function' && store.get( 'bundles.jsConfirmed' ) ) {
					return true;
				}
			} catch ( e ) {}
			return false;
		}

		function jsConfirmRemember() {
			var store = window.__odd && window.__odd.store;
			try {
				if ( store && typeof store.set === 'function' ) {
					store.set( 'bundles.jsConfirmed', true );
				}
			} catch ( e ) {}
		}

		// Non-modal inline confirmation banner injected at the top
		// of the Shop body. Resolves the supplied callback with true
		// (Install) or false (Cancel). The banner auto-dismisses when
		// clicked outside (treated as Cancel) so there's no trapped
		// state if the user walks away. One-time per session via
		// jsConfirmRemember().
		function confirmJavaScriptInline( type, done ) {
			if ( 'scene' !== type && 'widget' !== type ) { done( true ); return; }
			if ( jsConfirmAlreadyGiven() ) { done( true ); return; }

			var root = document.querySelector( '.odd-shop' ) || document.body;
			// Avoid stacking multiple banners if the user clicks fast.
			var existing = root.querySelector( '.odd-shop__js-confirm' );
			if ( existing ) existing.parentNode.removeChild( existing );

			var banner = el( 'div', { class: 'odd-shop__js-confirm', role: 'alertdialog', 'aria-live': 'polite' } );
			banner.appendChild( el( 'strong', {}, [ 'Run JavaScript from this package?' ] ) );
			banner.appendChild( el( 'p', {}, [
				'This ',
				type,
				' bundle ships JavaScript that will run in your admin session. Install only from trusted sources.',
			] ) );

			var actions = el( 'div', { class: 'odd-shop__js-confirm-actions' } );
			var cancel  = el( 'button', { type: 'button', class: 'odd-shop__js-confirm-btn' }, [ 'Cancel' ] );
			var install = el( 'button', { type: 'button', class: 'odd-shop__js-confirm-btn is-primary' }, [ 'Install' ] );

			var settled = false;
			function finish( ok ) {
				if ( settled ) return;
				settled = true;
				if ( ok ) jsConfirmRemember();
				try { banner.parentNode.removeChild( banner ); } catch ( e ) {}
				done( ok );
			}
			cancel.addEventListener( 'click', function () { finish( false ); } );
			install.addEventListener( 'click', function () { finish( true ); } );
			actions.appendChild( cancel );
			actions.appendChild( install );
			banner.appendChild( actions );

			root.insertBefore( banner, root.firstChild );
			// Focus the affirmative action so keyboard users can
			// confirm with Return immediately.
			setTimeout( function () { try { install.focus(); } catch ( e ) {} }, 10 );
		}

		function setInstallPillState( installing, progressText ) {
			var pill = document.querySelector( '[data-odd-install-pill]' );
			if ( ! pill ) return;
			if ( installing ) {
				pill.classList.add( 'is-busy' );
				pill.setAttribute( 'aria-busy', 'true' );
				if ( progressText ) pill.setAttribute( 'title', progressText );
			} else {
				pill.classList.remove( 'is-busy' );
				pill.removeAttribute( 'aria-busy' );
				pill.removeAttribute( 'title' );
			}
		}

		function handleInstallSuccess( data ) {
			var type  = ( data && data.type ) || 'app';
			var slug  = ( data && data.slug ) || ( data && data.manifest && data.manifest.slug ) || '';
			var name  = ( data && data.manifest && ( data.manifest.name || data.manifest.label ) ) || slug;
			var noun  = NOUN_FOR_TYPE[ type ] || 'bundle';
			var dept  = DEPT_FOR_TYPE[ type ] || state.active;

			toast( 'Installed ' + noun + ' "' + name + '".' );

			var ev = window.__odd && window.__odd.events;
			if ( ev ) {
				try { ev.emit( 'odd.bundle-installed', { slug: slug, type: type, manifest: data.manifest } ); } catch ( e ) {}
				// Back-compat: existing listeners still expect
				// `odd.app-installed` for type: app.
				if ( 'app' === type ) {
					try { ev.emit( 'odd.app-installed', { slug: slug, manifest: data.manifest } ); } catch ( e2 ) {}
				}
			}

			// Apps need a hard reload to surface their dock icon +
			// register their native window. Other types slot into
			// the panel without a reload.
			if ( 'app' === type ) {
				setTimeout( function () {
					try { window.location.reload(); } catch ( e ) {}
				}, 600 );
				return;
			}

			state.justInstalled = { type: type, slug: slug, at: Date.now() };
			renderSection( dept );
		}

		function highlightJustInstalled() {
			if ( ! state.justInstalled ) return;
			var slug = state.justInstalled.slug;
			if ( ! slug ) { state.justInstalled = null; return; }
			// Wait a tick so the section has rendered its cards.
			setTimeout( function () {
				var selectors = [
					'[data-slug="' + slug + '"]',
					'[data-scene-slug="' + slug + '"]',
					'[data-set-slug="' + slug + '"]',
					'[data-widget-id="odd/' + slug + '"]',
					'[data-catalog-slug="' + slug + '"]',
				];
				var tile = null;
				for ( var i = 0; i < selectors.length && ! tile; i++ ) {
					tile = document.querySelector( '.odd-shop ' + selectors[ i ] );
				}
				if ( tile ) {
					tile.classList.add( 'is-just-installed' );
					try { tile.scrollIntoView( { behavior: 'smooth', block: 'center' } ); } catch ( e ) {}
					setTimeout( function () { tile.classList.remove( 'is-just-installed' ); }, 2400 );
				}
				state.justInstalled = null;
			}, 80 );
		}

		function uploadBundle( file ) {
			var fd = new FormData();
			fd.append( 'file', file, file.name );
			return fetch( bundlesUploadUrl(), {
				method:      'POST',
				credentials: 'same-origin',
				headers:     { 'X-WP-Nonce': ( state.cfg || {} ).restNonce || '' },
				body:        fd,
			} ).then( function ( r ) {
				return r.json().then( function ( data ) {
					return { ok: r.ok, status: r.status, data: data };
				}, function () {
					return { ok: r.ok, status: r.status, data: null };
				} );
			} ).catch( function () {
				return { ok: false, status: 0, data: null };
			} );
		}

		function installBundle( file ) {
			if ( ! file ) return;
			if ( state.posting ) return;

			// Early type sniff from the filename: we don't know the
			// manifest.type until the server parses the archive, so
			// the JS confirmation is conservative — ask whenever the
			// file might be a scene/widget. Authors name type
			// manifests in a consistent way (…-scene.wp / …-widget.wp)
			// via the documented naming convention; the safe default
			// is to ask. The server still does the real type routing.
			var lower       = ( file.name || '' ).toLowerCase();
			var mightExecJs = /scene|widget/.test( lower );

			function proceed() {
				state.posting = true;
				setInstallPillState( true, 'Installing ' + file.name + '…' );
				toast( 'Installing ' + file.name + '…' );

				uploadBundle( file ).then( function ( res ) {
					state.posting = false;
					setInstallPillState( false );

					if ( res.ok && res.data && res.data.installed ) {
						// Second-chance JS confirm for when the
						// filename didn't tip us off but the
						// manifest did. The install has already
						// happened; this just arms the store for
						// any follow-up JS install in the session.
						if ( ( 'scene' === res.data.type || 'widget' === res.data.type ) && ! mightExecJs ) {
							jsConfirmRemember();
						}
						handleInstallSuccess( res.data );
						return;
					}
					onInstallFailure( res );
				} );
			}

			if ( mightExecJs ) {
				confirmJavaScriptInline( 'scene', function ( ok ) {
					if ( ! ok ) { toast( 'Install cancelled.' ); return; }
					proceed();
				} );
				return;
			}
			proceed();
		}

		function onInstallFailure( res ) {
			var data    = ( res && res.data ) || {};
			var code    = data.code || 'install_failed';
			var message = errorCopy( code, data.message );
			toast( message );

			// Leave a breadcrumb on the Apps status rail when the
			// user is on that department, so the message doesn't
			// disappear with the toast.
			var statusWrap = document.querySelector( '[data-odd-apps-status]' );
			if ( statusWrap ) {
				statusWrap.textContent = message;
				statusWrap.setAttribute( 'data-odd-status', 'error' );
			}
		}

		// Shop-wide drag-and-drop overlay — accept a .wp dropped
		// anywhere inside the panel, not just on the topbar pill.
		function installDropAnywhere( body ) {
			if ( ! ( window.odd || {} ).canInstall ) return;
			if ( body.__oddDropInstalled ) return;
			body.__oddDropInstalled = true;
			body.addEventListener( 'dragover', function ( e ) {
				if ( ! e.dataTransfer || ! e.dataTransfer.types ) return;
				var types = Array.prototype.slice.call( e.dataTransfer.types );
				if ( types.indexOf( 'Files' ) === -1 ) return;
				e.preventDefault();
				body.classList.add( 'is-dropping' );
			} );
			body.addEventListener( 'dragleave', function ( e ) {
				if ( e.target === body ) body.classList.remove( 'is-dropping' );
			} );
			body.addEventListener( 'drop', function ( e ) {
				body.classList.remove( 'is-dropping' );
				var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[ 0 ];
				if ( ! f ) return;
				if ( ! /\.wp$/i.test( f.name ) ) return;
				e.preventDefault();
				installBundle( f );
			} );
		}

		function renderDeptInstallLink( type ) {
			if ( ! ( window.odd || {} ).canInstall ) {
				return document.createDocumentFragment();
			}
			var wrap = el( 'div', { class: 'odd-shop__get-more' } );
			var label = el( 'span', { class: 'odd-shop__get-more-label' } );
			label.textContent = 'Got a ' + ( NOUN_FOR_TYPE[ type ] || 'bundle' ) + ' of your own?';
			var btn = el( 'button', { type: 'button', class: 'odd-shop__get-more-btn' } );
			btn.textContent = 'Install from file…';
			btn.addEventListener( 'click', function () {
				var input = document.querySelector( '[data-odd-install-input]' );
				if ( input ) input.click();
			} );
			wrap.appendChild( label );
			wrap.appendChild( btn );
			return wrap;
		}

		function appsBaseUrl() {
			// cfg.restUrl is the /odd/v1/prefs endpoint; swap the tail
			// for /apps to get the apps namespace.
			var base = state.cfg.restUrl || '';
			return base.replace( /\/prefs\/?$/, '/apps' );
		}
		function fetchApps() {
			return fetch( appsBaseUrl(), {
				credentials: 'same-origin',
				headers: { 'X-WP-Nonce': state.cfg.restNonce || '' },
			} ).then( function ( r ) { return r.ok ? r.json() : { apps: [] }; } )
			  .then( function ( data ) { return ( data && Array.isArray( data.apps ) ) ? data.apps : []; } )
			  .catch( function () { return []; } );
		}
		function toggleApp( slug, enabled ) {
			return fetch( appsBaseUrl() + '/' + encodeURIComponent( slug ) + '/toggle', {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce':   state.cfg.restNonce || '',
				},
				body: JSON.stringify( { enabled: !! enabled } ),
			} ).then( function ( r ) { return r.ok; } ).catch( function () { return false; } );
		}
		function deleteApp( slug ) {
			return fetch( appsBaseUrl() + '/' + encodeURIComponent( slug ), {
				method: 'DELETE',
				credentials: 'same-origin',
				headers: { 'X-WP-Nonce': state.cfg.restNonce || '' },
			} ).then( function ( r ) { return r.ok; } ).catch( function () { return false; } );
		}
		function uploadApp( file ) {
			var fd = new FormData();
			fd.append( 'file', file, file.name );
			return fetch( appsBaseUrl() + '/upload', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'X-WP-Nonce': state.cfg.restNonce || '' },
				body: fd,
			} ).then( function ( r ) { return r.json(); } )
			  .catch( function () { return null; } );
		}
		function openAppWindow( slug ) {
			// Single-window contract: open through the host's window
			// registry so re-clicks raise the existing window instead
			// of spawning duplicates.
			var wpd = window.wp && window.wp.desktop;
			if ( wpd && typeof wpd.openWindow === 'function' ) {
				try { wpd.openWindow( 'odd-app-' + slug ); return; } catch ( e ) {}
			}
			if ( wpd && typeof wpd.registerWindow === 'function' ) {
				try { wpd.registerWindow( { id: 'odd-app-' + slug } ); return; } catch ( e ) {}
			}
		}

		/* --- Wallpaper section --- */

		function renderWallpaper() {
			var wrap = el( 'div', { class: 'odd-shop__dept odd-shop__dept--wallpaper' } );
			wrap.appendChild( sectionHeader(
				'Wallpapers',
				'Live generative scenes for your WordPress desktop. Preview before you commit.',
				{ eyebrow: 'ODD · Living Art' }
			) );

			wrap.appendChild( renderDeptInstallLink( 'scene' ) );

			var allScenes = Array.isArray( state.cfg.scenes ) ? state.cfg.scenes.slice() : [];
			var scenes = filterByQuery( allScenes, state.query );

			// Hero — the currently-active scene, or the first result
			// if the user has filtered away the active one. No hero
			// when the filter eliminates everything.
			if ( scenes.length ) {
				var featured = pickFeaturedScene( scenes );
				if ( featured ) wrap.appendChild( renderWallpaperHero( featured ) );
			}

			// Category quilt — gradient franchise tiles that jump
			// to their shelf when clicked. Hidden while searching so
			// the result-focused view stays tight.
			if ( ! state.query ) {
				wrap.appendChild( renderCategoryQuilt( allScenes, 'wallpaper' ) );
			}

			var settings = el( 'div', { class: 'odd-wallpaper-settings' } );

			var shuffleCard = el( 'div', { class: 'odd-setting-card odd-setting-card--shuffle' } );
			var shuffleRow = el( 'label', { class: 'odd-switch-row' } );
			var shuffleBox = el( 'input', { type: 'checkbox' } );
			shuffleBox.checked = !! ( state.cfg.shuffle && state.cfg.shuffle.enabled );
			var shuffleKnob = el( 'span', { class: 'odd-switch' } );
			var shuffleText = el( 'span', { class: 'odd-setting-card__text' } );
			var shuffleLabel = el( 'strong' );
			shuffleLabel.textContent = 'Shuffle every';
			var shuffleHint = el( 'span' );
			shuffleHint.textContent = 'Rotate scenes automatically while the desktop is open.';
			shuffleText.appendChild( shuffleLabel );
			shuffleText.appendChild( shuffleHint );
			var minutes = el( 'input', { type: 'number', min: '1', max: '240', class: 'odd-minutes' } );
			minutes.value = String( ( state.cfg.shuffle && state.cfg.shuffle.minutes ) || 15 );
			var shuffleControls = el( 'div', { class: 'odd-setting-card__controls' } );
			var minutesPrefix = el( 'span' );
			minutesPrefix.textContent = 'Every';
			var minutesSuffix = el( 'span' );
			minutesSuffix.textContent = 'minutes';
			shuffleRow.appendChild( shuffleBox );
			shuffleRow.appendChild( shuffleKnob );
			shuffleRow.appendChild( shuffleText );
			shuffleControls.appendChild( minutesPrefix );
			shuffleControls.appendChild( minutes );
			shuffleControls.appendChild( minutesSuffix );
			shuffleCard.appendChild( shuffleRow );
			shuffleCard.appendChild( shuffleControls );
			settings.appendChild( shuffleCard );

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

			var audioRow = el( 'label', { class: 'odd-setting-card odd-setting-card--audio odd-switch-row' } );
			var audioBox = el( 'input', { type: 'checkbox' } );
			audioBox.checked = !! state.cfg.audioReactive;
			var audioKnob = el( 'span', { class: 'odd-switch' } );
			var audioText = el( 'span', { class: 'odd-setting-card__text' } );
			var audioLbl = el( 'strong' );
			audioLbl.textContent = 'Audio-reactive';
			var audioHint = el( 'span' );
			audioHint.textContent = 'Let scenes pulse subtly with sound when supported.';
			audioText.appendChild( audioLbl );
			audioText.appendChild( audioHint );
			audioRow.appendChild( audioBox );
			audioRow.appendChild( audioKnob );
			audioRow.appendChild( audioText );
			settings.appendChild( audioRow );
			audioBox.addEventListener( 'change', function () {
				savePrefs( { audioReactive: audioBox.checked }, function ( data ) {
					if ( data ) state.cfg.audioReactive = !! data.audioReactive;
				} );
			} );

			wrap.appendChild( settings );

			// Screensaver controls row — a second toolbar beneath the
			// shuffle row, grouped because the options are only
			// meaningful when the checkbox is on.
			var ss = state.cfg.screensaver || { enabled: false, minutes: 5, scene: 'current' };
			var ssRow = el( 'div', { class: 'odd-setting-card odd-setting-card--screensaver' } );

			var ssToggle = el( 'label', { class: 'odd-switch-row' } );
			var ssBox = el( 'input', { type: 'checkbox' } );
			ssBox.checked = !! ss.enabled;
			var ssKnob = el( 'span', { class: 'odd-switch' } );
			var ssText = el( 'span', { class: 'odd-setting-card__text' } );
			var ssLbl = el( 'strong' );
			ssLbl.textContent = 'Screensaver after';
			var ssHint = el( 'span' );
			ssHint.textContent = 'Dim into a full-screen scene when the admin sits idle.';
			ssText.appendChild( ssLbl );
			ssText.appendChild( ssHint );
			var ssControls = el( 'div', { class: 'odd-setting-card__controls odd-setting-card__controls--screensaver' } );
			var ssMins = el( 'input', { type: 'number', min: '1', max: '120', class: 'odd-minutes' } );
			ssMins.value = String( Math.max( 1, Math.min( 120, ( ss.minutes | 0 ) || 5 ) ) );
			var ssMinsLbl = el( 'span' );
			ssMinsLbl.textContent = 'minutes idle';
			ssToggle.appendChild( ssBox );
			ssToggle.appendChild( ssKnob );
			ssToggle.appendChild( ssText );
			ssRow.appendChild( ssToggle );
			ssControls.appendChild( ssMins );
			ssControls.appendChild( ssMinsLbl );

			// Scene choice for the screensaver. "Current" = whatever
			// is active when the timer fires. "Random" = pick a new
			// one each time. Explicit slugs pick that scene every
			// time it fires.
			var ssSceneWrap = el( 'label', { class: 'odd-setting-field' } );
			var ssSceneLbl = el( 'span' );
			ssSceneLbl.textContent = 'Play';
			var ssSceneSel = el( 'select', { class: 'odd-select' } );
			var ssChoices = [
				{ value: 'current', label: 'current scene' },
				{ value: 'random',  label: 'a random scene' },
			];
			( state.cfg.scenes || [] ).forEach( function ( s ) {
				ssChoices.push( { value: s.slug, label: s.label || s.slug } );
			} );
			ssChoices.forEach( function ( opt ) {
				var o = el( 'option', { value: opt.value } );
				o.textContent = opt.label;
				ssSceneSel.appendChild( o );
			} );
			ssSceneSel.value = ss.scene || 'current';
			ssSceneWrap.appendChild( ssSceneLbl );
			ssSceneWrap.appendChild( ssSceneSel );
			ssControls.appendChild( ssSceneWrap );

			var ssPreview = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--pill odd-setting-preview' } );
			ssPreview.textContent = 'Preview';
			ssPreview.addEventListener( 'click', function () {
				var ssApi = window.__odd && window.__odd.screensaver;
				if ( ssApi && typeof ssApi.show === 'function' ) ssApi.show();
			} );
			ssControls.appendChild( ssPreview );
			ssRow.appendChild( ssControls );

			function pushScreensaver() {
				var m = parseInt( ssMins.value, 10 );
				if ( isNaN( m ) ) m = 5;
				if ( m < 1 ) m = 1;
				if ( m > 120 ) m = 120;
				ssMins.value = String( m );
				var patch = {
					screensaver: {
						enabled: ssBox.checked,
						minutes: m,
						scene:   ssSceneSel.value || 'current',
					},
				};
				savePrefs( patch, function ( data ) {
					if ( data && data.screensaver ) {
						state.cfg.screensaver = data.screensaver;
						// Push to the live module so the idle timer
						// picks up new values without reload.
						var ssApi = window.__odd && window.__odd.screensaver;
						if ( ssApi && typeof ssApi.applyPrefs === 'function' ) ssApi.applyPrefs( data.screensaver );
						var events = window.__odd && window.__odd.events;
						if ( events ) { try { events.emit( 'odd.screensaver-prefs-changed', data.screensaver ); } catch ( e ) {} }
					}
				} );
			}
			ssBox.addEventListener( 'change', pushScreensaver );
			ssMins.addEventListener( 'change', pushScreensaver );
			ssSceneSel.addEventListener( 'change', pushScreensaver );

			wrap.appendChild( ssRow );

			if ( ! scenes.length ) {
				wrap.appendChild( renderEmptyResults( 'No scenes match "' + state.query + '".' ) );
				return wrap;
			}

			var shelves = groupByCategory( scenes, 'wallpaper', 'More' );
			shelves.forEach( function ( shelf ) {
				wrap.appendChild( renderShelf( shelf.franchise, shelf.items, renderSceneCard, { scope: 'wallpaper' } ) );
			} );

			return wrap;
		}

		/**
		 * Pick the scene to feature in the department hero.
		 * Prefers the committed-active scene when it's still in the
		 * filtered pool; otherwise falls back to the first result so
		 * search queries always show a hero even when the active
		 * scene was filtered out.
		 */
		function pickFeaturedScene( scenes ) {
			var current = state.cfg.wallpaper || state.cfg.scene;
			for ( var i = 0; i < scenes.length; i++ ) {
				if ( scenes[ i ] && scenes[ i ].slug === current ) return scenes[ i ];
			}
			return scenes[ 0 ] || null;
		}

		function renderWallpaperHero( scene ) {
			var currentSlug = state.cfg.wallpaper || state.cfg.scene;
			var isActive    = scene.slug === currentSlug;
			var previewUrl  = ( state.cfg.pluginUrl || '' ) + '/assets/previews/' + scene.slug + '.webp';

			var hero = el( 'div', {
				class: 'odd-shop__hero',
				'data-hero-slug': scene.slug,
				style: 'background-color:' + ( scene.fallbackColor || '#1d1d1f' ),
			} );
			var bg = el( 'div', { class: 'odd-shop__hero-bg', 'aria-hidden': 'true' } );
			bg.style.backgroundImage = 'url("' + previewUrl + '")';
			hero.appendChild( bg );
			hero.appendChild( el( 'div', { class: 'odd-shop__hero-scrim', 'aria-hidden': 'true' } ) );

			var inner = el( 'div', { class: 'odd-shop__hero-body' } );
			var eyebrow = el( 'div', { class: 'odd-shop__hero-eyebrow' } );
			eyebrow.textContent = isActive ? 'Now playing' : 'Featured scene';
			var title = el( 'h3', { class: 'odd-shop__hero-title' } );
			title.textContent = scene.label || scene.slug;
			var sub = el( 'p', { class: 'odd-shop__hero-sub' } );
			sub.textContent = heroTagline( scene );
			var actions = el( 'div', { class: 'odd-shop__hero-actions' } );

			if ( isActive && ! state.preview ) {
				var active = el( 'span', { class: 'odd-shop__hero-badge' } );
				active.textContent = '✓ Active';
				actions.appendChild( active );
			} else {
				var previewBtn = el( 'button', {
					type: 'button',
					class: 'odd-shop__hero-btn odd-shop__hero-btn--primary',
				} );
				previewBtn.innerHTML = '<span aria-hidden="true">▶</span> Preview';
				previewBtn.addEventListener( 'click', function ( e ) {
					e.stopPropagation();
					previewScene( scene.slug );
				} );
				actions.appendChild( previewBtn );
			}

			inner.appendChild( eyebrow );
			inner.appendChild( title );
			inner.appendChild( sub );
			inner.appendChild( actions );
			hero.appendChild( inner );

			var thumb = el( 'div', { class: 'odd-shop__hero-thumb', 'aria-hidden': 'true' } );
			var thumbImg = el( 'img', { src: previewUrl, alt: '', loading: 'lazy' } );
			thumb.appendChild( thumbImg );
			hero.appendChild( thumb );

			return hero;
		}

		/**
		 * Tagline copy for the hero. Uses the scene's tags where
		 * available so each franchise hero reads as distinct; falls
		 * back to a franchise-flavoured line otherwise.
		 */
		function heroTagline( scene ) {
			if ( scene.tagline && typeof scene.tagline === 'string' ) return scene.tagline;
			if ( Array.isArray( scene.tags ) && scene.tags.length ) {
				return scene.tags.slice( 0, 3 ).join( ' · ' );
			}
			switch ( scene.franchise ) {
				case 'Atmosphere':    return 'Painterly weather and ambient light.';
				case 'Paper':         return 'Folded forms drifting through negative space.';
				case 'ODD Originals': return 'House specials from the ODD studio.';
				default:              return 'A generative scene that lives on your desktop.';
			}
		}

		function renderEmptyResults( message ) {
			var wrap = el( 'div', { class: 'odd-shop__empty' } );
			var icon = el( 'div', { class: 'odd-shop__empty-icon', 'aria-hidden': 'true' } );
			icon.textContent = '🔍';
			var big = el( 'div', { class: 'odd-shop__empty-title' } );
			big.textContent = 'No results';
			var sub = el( 'div', { class: 'odd-shop__empty-sub' } );
			sub.textContent = message || 'Try a different search term.';
			wrap.appendChild( icon );
			wrap.appendChild( big );
			wrap.appendChild( sub );
			return wrap;
		}

		/**
		 * Client-side filter used by the top-bar search pill. Matches
		 * against label, slug, franchise, and any tag — everything the
		 * user can actually see on a card.
		 */
		function filterByQuery( items, query ) {
			if ( ! query ) return items;
			var q = String( query ).toLowerCase().trim();
			if ( ! q ) return items;
			return items.filter( function ( item ) {
				if ( ! item ) return false;
				var hay = [
					item.label,
					item.slug,
					item.franchise,
					item.description,
				].filter( Boolean ).join( ' ' ).toLowerCase();
				if ( hay.indexOf( q ) >= 0 ) return true;
				if ( Array.isArray( item.tags ) ) {
					for ( var i = 0; i < item.tags.length; i++ ) {
						if ( String( item.tags[ i ] || '' ).toLowerCase().indexOf( q ) >= 0 ) return true;
					}
				}
				return false;
			} );
		}

		/**
		 * Deterministic gradient for each category tile. Looks
		 * colorful + editorial without pulling in a palette library,
		 * and a string hash makes new categories pick a stable color
		 * without hand-tuning this list every time. Palette tables
		 * live inside the function so they survive the `var`-hoist
		 * ordering — `franchiseGradient` gets called during initial
		 * render before sibling `var`-decl palettes would be assigned.
		 *
		 * Named after `franchise` for legacy continuity; we feed
		 * category names through it now (Skies / Wilds / Places /
		 * Forms / Playful / Crafted / Technical / Cool / Default),
		 * keeping a few legacy franchise entries below for fallback.
		 */
		/**
		 * SVG artwork for each category tile. Each returns a compact
		 * <svg> string sized to the tile's 240×120 viewbox, positioned
		 * absolute by `.odd-shop__quilt-art`. Artwork is white-on-
		 * gradient at low-ish opacity so it reads as decoration behind
		 * the category name + count, and crops cleanly on either side
		 * via preserveAspectRatio="xMaxYMid slice".
		 *
		 * Unknown categories fall back to a concentric-dots default,
		 * so new franchises always get *something* visual.
		 */
		function categoryArtwork( name ) {
			var SVG_OPEN = '<svg viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">';
			var SVG_CLOSE = '</svg>';
			var ART = {
				'Skies':
					'<circle cx="196" cy="32" r="22" fill="#fff" opacity=".55"/>' +
					'<circle cx="196" cy="32" r="13" fill="#fff" opacity=".55"/>' +
					'<ellipse cx="158" cy="58" rx="42" ry="12" fill="#fff" opacity=".55"/>' +
					'<ellipse cx="130" cy="48" rx="26" ry="8" fill="#fff" opacity=".38"/>',
				'Wilds':
					'<circle cx="210" cy="28" r="10" fill="#fff" opacity=".6"/>' +
					'<path d="M140 98 L172 44 L192 72 L212 38 L244 98 Z" fill="#fff" opacity=".58"/>' +
					'<path d="M108 98 L134 56 L150 82 L170 60 L198 98 Z" fill="#fff" opacity=".38"/>',
				'Places':
					'<circle cx="200" cy="28" r="8" fill="#fff" opacity=".7"/>' +
					'<rect x="138" y="60" width="22" height="42" fill="#fff" opacity=".5"/>' +
					'<rect x="164" y="40" width="18" height="62" fill="#fff" opacity=".72"/>' +
					'<rect x="186" y="52" width="24" height="50" fill="#fff" opacity=".48"/>' +
					'<rect x="214" y="66" width="20" height="36" fill="#fff" opacity=".4"/>',
				'Forms':
					'<circle cx="180" cy="52" r="34" fill="#fff" opacity=".34"/>' +
					'<rect x="150" y="46" width="48" height="48" rx="4" fill="#fff" opacity=".48" transform="rotate(12 174 70)"/>' +
					'<path d="M204 30 L236 92 L172 92 Z" fill="#fff" opacity=".58"/>',
				'Playful':
					'<path d="M194 20 L198 34 L212 34 L201 43 L206 58 L194 50 L182 58 L187 43 L176 34 L190 34 Z" fill="#fff" opacity=".75"/>' +
					'<circle cx="148" cy="40" r="4" fill="#fff" opacity=".75"/>' +
					'<circle cx="228" cy="58" r="5" fill="#fff" opacity=".7"/>' +
					'<rect x="166" y="70" width="9" height="9" fill="#fff" opacity=".55" transform="rotate(20 170 74)"/>' +
					'<rect x="214" y="88" width="7" height="7" fill="#fff" opacity=".65" transform="rotate(30 217 91)"/>' +
					'<path d="M134 86 L138 94 L146 90 L142 82 Z" fill="#fff" opacity=".55"/>',
				'Crafted':
					'<path d="M148 94 L192 22 L236 94 Z" fill="#fff" opacity=".6"/>' +
					'<path d="M192 22 L192 94 L148 94 Z" fill="#fff" opacity=".32"/>' +
					'<path d="M192 22 L236 94 L192 94 Z" fill="#000" opacity=".12"/>',
				'Technical':
					'<path d="M138 40 L170 40 L170 60 L200 60 L200 80 L234 80" stroke="#fff" stroke-width="2.5" fill="none" opacity=".7"/>' +
					'<path d="M138 80 L160 80 L160 64 L186 64 L186 44 L224 44" stroke="#fff" stroke-width="2.5" fill="none" opacity=".42"/>' +
					'<circle cx="170" cy="40" r="5" fill="#fff" opacity=".85"/>' +
					'<circle cx="200" cy="60" r="5" fill="#fff" opacity=".85"/>' +
					'<circle cx="186" cy="64" r="4" fill="#fff" opacity=".65"/>',
				'Cool':
					'<circle cx="200" cy="60" r="46" fill="none" stroke="#fff" stroke-width="2" opacity=".38"/>' +
					'<circle cx="200" cy="60" r="30" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>' +
					'<circle cx="200" cy="60" r="13" fill="#fff" opacity=".75"/>',
				'Generative':
					'<path d="M124 96 Q160 36 202 70 Q232 96 244 44" fill="none" stroke="#fff" stroke-width="2.5" opacity=".7"/>' +
					'<path d="M128 78 Q162 26 204 56 Q234 80 244 28" fill="none" stroke="#fff" stroke-width="2" opacity=".45"/>' +
					'<circle cx="202" cy="70" r="4" fill="#fff" opacity=".85"/>' +
					'<circle cx="168" cy="62" r="3" fill="#fff" opacity=".7"/>',
				'Atmosphere':
					'<path d="M110 32 Q150 16 190 32 T280 32" fill="none" stroke="#fff" stroke-width="3" opacity=".45"/>' +
					'<path d="M100 58 Q140 42 180 58 T270 58" fill="none" stroke="#fff" stroke-width="3" opacity=".65"/>' +
					'<path d="M110 84 Q150 68 190 84 T280 84" fill="none" stroke="#fff" stroke-width="3" opacity=".4"/>',
				'Paper':
					'<path d="M150 24 L222 24 L222 96 L150 96 Z" fill="#fff" opacity=".55"/>' +
					'<path d="M222 24 L222 96 L162 96 Z" fill="#000" opacity=".18"/>' +
					'<path d="M150 24 L222 24 L182 62 Z" fill="#fff" opacity=".7"/>',
				'ODD Originals':
					'<ellipse cx="196" cy="60" rx="42" ry="24" fill="#fff" opacity=".7"/>' +
					'<circle cx="196" cy="60" r="14" fill="#0c0a1d"/>' +
					'<circle cx="200" cy="56" r="4" fill="#fff"/>',
				'WP Desktop Mode':
					'<rect x="136" y="26" width="98" height="72" rx="6" fill="#fff" opacity=".5"/>' +
					'<rect x="136" y="26" width="98" height="14" rx="6" fill="#fff" opacity=".32"/>' +
					'<circle cx="146" cy="33" r="2.5" fill="#fff" opacity=".9"/>' +
					'<circle cx="154" cy="33" r="2.5" fill="#fff" opacity=".78"/>' +
					'<circle cx="162" cy="33" r="2.5" fill="#fff" opacity=".66"/>' +
					'<rect x="148" y="52" width="74" height="8" rx="2" fill="#fff" opacity=".3"/>' +
					'<rect x="148" y="66" width="52" height="8" rx="2" fill="#fff" opacity=".25"/>',
				'Default':
					'<circle cx="200" cy="60" r="38" fill="#fff" opacity=".35"/>' +
					'<circle cx="200" cy="60" r="22" fill="#fff" opacity=".55"/>' +
					'<circle cx="200" cy="60" r="8" fill="#fff" opacity=".85"/>',
			};
			var inner = ART[ name ];
			if ( ! inner ) {
				// Deterministic pick from a few "safe" fallbacks so new
				// categories still get a distinct illustration.
				var FALLBACKS = [ 'Cool', 'Forms', 'Generative', 'Default' ];
				var hash = 0;
				var key = String( name || '' );
				for ( var i = 0; i < key.length; i++ ) {
					hash = ( ( hash << 5 ) - hash + key.charCodeAt( i ) ) | 0;
				}
				inner = ART[ FALLBACKS[ Math.abs( hash ) % FALLBACKS.length ] ];
			}
			return SVG_OPEN + inner + SVG_CLOSE;
		}

		function franchiseGradient( name ) {
			var PALETTE = {
				'Skies':            'linear-gradient(135deg,#1a4b8e 0%,#5dadec 60%,#a3d8f4 100%)',
				'Wilds':            'linear-gradient(135deg,#0f6b3a 0%,#2fa970 60%,#a8dca0 100%)',
				'Places':           'linear-gradient(135deg,#b94a3b 0%,#f08e5b 60%,#ffd9a8 100%)',
				'Forms':            'linear-gradient(135deg,#3a1a72 0%,#8a3fc8 60%,#e89cf0 100%)',
				'Playful':          'linear-gradient(135deg,#d6266d 0%,#ff7a3c 60%,#ffd56a 100%)',
				'Crafted':          'linear-gradient(135deg,#a04a18 0%,#e0964c 60%,#f4dca4 100%)',
				'Technical':        'linear-gradient(135deg,#0a3a4a 0%,#2596be 60%,#9ee0f0 100%)',
				'Cool':             'linear-gradient(135deg,#5d6470 0%,#9aa3b1 60%,#dde2ea 100%)',
				'Default':          'linear-gradient(135deg,#1d1d1f 0%,#4a4a52 60%,#9a9aa6 100%)',
				'Generative':       'linear-gradient(135deg,#b84df1 0%,#ff68b3 100%)',
				'Atmosphere':       'linear-gradient(135deg,#00b4db 0%,#2c9afe 100%)',
				'Paper':            'linear-gradient(135deg,#f6d365 0%,#fda085 100%)',
				'ODD Originals':    'linear-gradient(135deg,#0c0a1d 0%,#ff1c6a 100%)',
				'WP Desktop Mode':  'linear-gradient(135deg,#2c3e50 0%,#4ca1af 100%)',
			};
			var FALLBACK = [
				'linear-gradient(135deg,#8e2de2 0%,#4a00e0 100%)',
				'linear-gradient(135deg,#11998e 0%,#38ef7d 100%)',
				'linear-gradient(135deg,#fc5c7d 0%,#6a82fb 100%)',
				'linear-gradient(135deg,#f7971e 0%,#ffd200 100%)',
				'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
			];
			if ( PALETTE[ name ] ) return PALETTE[ name ];
			var hash = 0;
			var key = String( name || '' );
			for ( var i = 0; i < key.length; i++ ) {
				hash = ( ( hash << 5 ) - hash + key.charCodeAt( i ) ) | 0;
			}
			return FALLBACK[ Math.abs( hash ) % FALLBACK.length ];
		}

		/**
		 * Resolve an item to its display category. Each manifest
		 * declares a narrow `franchise` string (one per item, more
		 * or less); shelving by franchise produced one-row shelves
		 * everywhere. The slug → category tables below roll those
		 * up into broader buckets so each shelf has real siblings.
		 * Items that aren't curated yet fall back to their declared
		 * franchise so nothing disappears — they'll just appear on
		 * their own shelf at the bottom until the table catches up.
		 *
		 * Tables live inside the function so they survive `var`-
		 * hoist ordering: `categoryOf` is hoisted as a function
		 * declaration and gets called during initial render before
		 * any sibling `var` blocks have actually run their RHS.
		 */
		function categoryOf( item, kind ) {
			var SCENE_CATEGORY = {
				'flux':                'Forms',
				'origami':             'Forms',
				'terrazzo':            'Forms',
				'aurora':              'Skies',
				'rainfall':            'Skies',
				'big-sky':             'Skies',
				'cloud-city':          'Skies',
				'weather-factory':     'Skies',
				'circuit-garden':      'Wilds',
				'tropical-greenhouse': 'Wilds',
				'wildflower-meadow':   'Wilds',
				'tide-pool':           'Wilds',
				'abyssal-aquarium':    'Wilds',
				'sun-print':           'Wilds',
				'iris-observatory':    'Places',
				'pocket-dimension':    'Places',
				'balcony-noon':        'Places',
				'mercado':             'Places',
				'beach-umbrellas':     'Places',
			};
			var ICON_SET_CATEGORY = {
				'none':              'Default',
				'arcade-tokens':     'Playful',
				'lemonade-stand':    'Playful',
				'tiki':              'Playful',
				'stadium':           'Playful',
				'eyeball-avenue':    'Playful',
				'claymation':        'Crafted',
				'cross-stitch':      'Crafted',
				'botanical-plate':   'Crafted',
				'fold':              'Crafted',
				'risograph':         'Crafted',
				'blueprint':         'Technical',
				'circuit-bend':      'Technical',
				'hologram':          'Technical',
				'monoline':          'Technical',
				'filament':          'Technical',
				'arctic':            'Cool',
				'brutalist-stencil': 'Cool',
			};
			if ( ! item ) return 'More';
			var table = kind === 'icons' ? ICON_SET_CATEGORY : SCENE_CATEGORY;
			if ( item.slug && table[ item.slug ] ) return table[ item.slug ];
			return ( item.franchise && String( item.franchise ) ) || 'More';
		}

		/**
		 * Stable display order for the bucketed shelves. Listed in
		 * descending breadth so the densest categories surface
		 * first; uncategorized franchises fall to the bottom.
		 */
		function compareCategoryNames( a, b ) {
			var CATEGORY_ORDER = [
				'Skies', 'Wilds', 'Places', 'Forms',
				'Default', 'Playful', 'Crafted', 'Technical', 'Cool',
			];
			var ai = CATEGORY_ORDER.indexOf( a );
			var bi = CATEGORY_ORDER.indexOf( b );
			if ( ai === -1 && bi === -1 ) return a.localeCompare( b );
			if ( ai === -1 ) return 1;
			if ( bi === -1 ) return -1;
			return ai - bi;
		}

		/**
		 * Category quilt — a 2-col grid of gradient category tiles
		 * that scroll the content pane to the matching shelf when
		 * clicked. Purely navigational; no state changes.
		 */
		function renderCategoryQuilt( items, scope ) {
			var kind = scope === 'icons' ? 'icons' : 'wallpaper';
			var counts = {};
			var seen = {};
			items.forEach( function ( it ) {
				var cat = categoryOf( it, kind );
				if ( ! cat ) return;
				if ( ! Object.prototype.hasOwnProperty.call( counts, cat ) ) {
					counts[ cat ] = 0;
					seen[ cat ] = true;
				}
				counts[ cat ]++;
			} );
			var order = Object.keys( seen ).sort( compareCategoryNames );
			var wrap = el( 'div', { class: 'odd-shop__quilt' } );
			var head = el( 'div', { class: 'odd-shop__shelf-head' } );
			var title = el( 'h3', { class: 'odd-shop__shelf-title' } );
			title.textContent = 'Browse by category';
			head.appendChild( title );
			wrap.appendChild( head );
			var grid = el( 'div', { class: 'odd-shop__quilt-grid' } );
			order.forEach( function ( category ) {
				var tile = el( 'button', {
					type: 'button',
					class: 'odd-shop__quilt-tile',
					style: 'background:' + franchiseGradient( category ),
					'data-franchise-jump': category,
					'data-scope': scope,
				} );
				var art = el( 'span', {
					class: 'odd-shop__quilt-art',
					'aria-hidden': 'true',
				} );
				art.innerHTML = categoryArtwork( category );
				var name = el( 'span', { class: 'odd-shop__quilt-name' } );
				name.textContent = category;
				var count = el( 'span', { class: 'odd-shop__quilt-count' } );
				count.textContent = counts[ category ] + ( counts[ category ] === 1
					? ( scope === 'wallpaper' ? ' scene' : ' set' )
					: ( scope === 'wallpaper' ? ' scenes' : ' sets' ) );
				tile.appendChild( art );
				tile.appendChild( name );
				tile.appendChild( count );
				tile.addEventListener( 'click', function () {
					var target = content.querySelector( '[data-shelf-anchor="' + cssEscape( category ) + '"]' );
					if ( target && typeof target.scrollIntoView === 'function' ) {
						target.scrollIntoView( { behavior: 'smooth', block: 'start' } );
					}
				} );
				grid.appendChild( tile );
			} );
			wrap.appendChild( grid );
			return wrap;
		}

		// Narrow CSS.escape shim — jsdom doesn't have it and the
		// category strings we anchor by contain spaces + apostrophes.
		function cssEscape( s ) {
			return String( s ).replace( /[^a-zA-Z0-9_-]/g, function ( c ) {
				return '\\' + c.charCodeAt( 0 ).toString( 16 ) + ' ';
			} );
		}

		/**
		 * Group an array of items by their resolved category. Items
		 * without a slug-table entry collapse into their `franchise`
		 * (or `fallback`) so nothing disappears. Categories are then
		 * sorted by `CATEGORY_ORDER` so curated buckets come first
		 * and uncategorized stragglers fall to the bottom.
		 */
		function groupByCategory( items, kind, fallback ) {
			var order = [];
			var bag = {};
			items.forEach( function ( item ) {
				if ( ! item ) return;
				var c = categoryOf( item, kind ) || fallback || 'More';
				if ( ! Object.prototype.hasOwnProperty.call( bag, c ) ) {
					bag[ c ] = [];
					order.push( c );
				}
				bag[ c ].push( item );
			} );
			order.sort( compareCategoryNames );
			return order.map( function ( c ) {
				return { franchise: c, items: bag[ c ] };
			} );
		}

		/**
		 * Render a MAS-style shelf: franchise title + count anchor
		 * over a horizontally-scrolling row of cards built by
		 * `cardFn`. `opts.scope` ("wallpaper" | "icons") swaps the
		 * card track class so wallpapers get square-ish tile cards
		 * while icon sets get wide list rows that still wrap on
		 * narrow widths.
		 */
		function renderShelf( franchise, items, cardFn, opts ) {
			opts = opts || {};
			var scope = opts.scope || 'wallpaper';
			var shelf = el( 'section', {
				class: 'odd-shop__shelf',
				'data-shelf-anchor': franchise,
			} );
			var head = el( 'div', { class: 'odd-shop__shelf-head' } );
			var title = el( 'h3', { class: 'odd-shop__shelf-title' } );
			title.textContent = franchise;
			var count = el( 'span', { class: 'odd-shop__shelf-count' } );
			var noun;
			if ( scope === 'wallpaper' ) {
				noun = items.length === 1 ? 'scene' : 'scenes';
			} else if ( scope === 'widgets' ) {
				noun = items.length === 1 ? 'widget' : 'widgets';
			} else {
				noun = items.length === 1 ? 'set' : 'sets';
			}
			count.textContent = items.length + ' ' + noun;
			head.appendChild( title );
			head.appendChild( count );
			shelf.appendChild( head );

			// Tiles layout for wallpapers + widgets (both have a big
			// visual preview panel); list rows for icon sets (which
			// want text-heavy metadata alongside their mini-grid).
			var trackClass = ( scope === 'wallpaper' || scope === 'widgets' )
				? 'odd-shop__shelf-track odd-shop__shelf-track--tiles'
				: 'odd-shop__shelf-track odd-shop__shelf-track--list';
			var track = el( 'div', { class: trackClass } );
			items.forEach( function ( item ) {
				track.appendChild( cardFn( item ) );
			} );

			// Wrap the track in a slider shell so we can overlay
			// prev/next pills. The native scroll still works for
			// touch, wheel, and keyboard — buttons are a convenience
			// layer that nudge by roughly-one-card-width on click.
			var slider = el( 'div', { class: 'odd-shop__slider' } );
			var prev = el( 'button', {
				type: 'button',
				class: 'odd-shop__slider-btn odd-shop__slider-btn--prev',
				'aria-label': 'Scroll ' + franchise + ' back',
			} );
			prev.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
			var next = el( 'button', {
				type: 'button',
				class: 'odd-shop__slider-btn odd-shop__slider-btn--next',
				'aria-label': 'Scroll ' + franchise + ' forward',
			} );
			next.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 4 L17 12 L9 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
			slider.appendChild( prev );
			slider.appendChild( track );
			slider.appendChild( next );
			shelf.appendChild( slider );

			// Scroll by roughly one card's worth of width, clamped so
			// a narrow pane still advances a meaningful distance.
			function step( dir ) {
				var amt = Math.max( 260, Math.round( track.clientWidth * 0.85 ) );
				if ( typeof track.scrollBy === 'function' ) {
					track.scrollBy( { left: dir * amt, behavior: 'smooth' } );
				} else {
					track.scrollLeft += dir * amt;
				}
			}
			prev.addEventListener( 'click', function () { step( -1 ); } );
			next.addEventListener( 'click', function () { step( 1 ); } );

			// Fade the buttons in/out depending on whether there's
			// content to scroll toward. Called on scroll, on resize,
			// and once after mount (images arriving later can change
			// scrollWidth). `is-overflowing` gates visibility entirely
			// so short shelves don't show buttons at all.
			function updateButtons() {
				var canPrev = track.scrollLeft > 2;
				var canNext = track.scrollLeft + track.clientWidth < track.scrollWidth - 2;
				slider.classList.toggle( 'is-start', ! canPrev );
				slider.classList.toggle( 'is-end', ! canNext );
				slider.classList.toggle( 'is-overflowing', track.scrollWidth > track.clientWidth + 2 );
			}
			track.addEventListener( 'scroll', updateButtons, { passive: true } );
			if ( typeof window !== 'undefined' && typeof window.setTimeout === 'function' ) {
				window.setTimeout( updateButtons, 0 );
				window.setTimeout( updateButtons, 400 );
			}
			if ( typeof ResizeObserver !== 'undefined' ) {
				try { new ResizeObserver( updateButtons ).observe( track ); } catch ( _e ) {}
			}

			return shelf;
		}

		function renderSceneCard( scene ) {
			var currentSlug = state.cfg.wallpaper || state.cfg.scene;
			var active = scene.slug === currentSlug;
			var isPreview = state.preview && state.preview.kind === 'wallpaper' && state.preview.slug === scene.slug;

			// Shell is still a button so keyboard activation works the
			// same way it did in the old grid; the inner Preview pill
			// stops propagation so its click-through doesn't toggle
			// preview twice.
			var card = el( 'button', {
				type: 'button',
				class: 'odd-card odd-shop__tile'
					+ ( active && ! state.preview ? ' is-active' : '' )
					+ ( isPreview ? ' is-previewing' : '' ),
				'data-slug': scene.slug,
				'aria-label': ( scene.label || scene.slug ) + ' — ' + ( scene.franchise || 'scene' ),
			} );

			var thumb = el( 'div', { class: 'odd-shop__tile-thumb' } );
			thumb.style.backgroundColor = scene.fallbackColor || '#111';
			var img = el( 'img', {
				src: ( state.cfg.pluginUrl || '' ) + '/assets/previews/' + scene.slug + '.webp',
				alt: '',
				loading: 'lazy',
			} );
			thumb.appendChild( img );
			if ( active && ! state.preview ) {
				var badge = el( 'span', { class: 'odd-shop__tile-badge' } );
				badge.textContent = '✓ Active';
				thumb.appendChild( badge );
			}
			card.appendChild( thumb );

			var meta = el( 'div', { class: 'odd-shop__tile-meta' } );
			var metaText = el( 'div', { class: 'odd-shop__tile-text' } );
			var title = el( 'div', { class: 'odd-card__title odd-shop__tile-title' } );
			title.textContent = scene.label || scene.slug;
			var sub = el( 'div', { class: 'odd-card__sub odd-shop__tile-sub' } );
			sub.textContent = ( scene.franchise || 'Scene' ) + ' · Scene';
			metaText.appendChild( title );
			metaText.appendChild( sub );

			var pill = el( 'span', { class: 'odd-shop__tile-pill' } );
			if ( isPreview ) pill.textContent = 'Previewing';
			else if ( active && ! state.preview ) pill.textContent = 'Open';
			else pill.textContent = 'Preview';

			meta.appendChild( metaText );
			meta.appendChild( pill );
			card.appendChild( meta );

			card.addEventListener( 'click', function () {
				var current = state.cfg.wallpaper || state.cfg.scene;
				// Clicking the already-active (committed) card clears
				// any pending preview back to the real state.
				if ( scene.slug === current && ! state.preview ) return;
				if ( state.preview && state.preview.kind === 'wallpaper' && scene.slug === state.preview.originalSlug ) {
					cancelPreview();
					return;
				}
				previewScene( scene.slug );
			} );

			return card;
		}

		function previewScene( slug ) {
			if ( state.posting ) return;

			// First click starts a preview; subsequent clicks on other
			// cards just swap the preview target without changing the
			// `originalSlug` we'd revert to on cancel.
			var originalSlug;
			if ( state.preview && state.preview.kind === 'wallpaper' ) {
				originalSlug = state.preview.originalSlug;
			} else if ( state.preview && state.preview.kind === 'iconSet' ) {
				// Entering a wallpaper preview while an icon preview is
				// open just leaves the icon preview in place.
				originalSlug = state.cfg.wallpaper || state.cfg.scene;
			} else {
				originalSlug = state.cfg.wallpaper || state.cfg.scene;
			}

			state.preview = {
				kind: 'wallpaper',
				slug: slug,
				originalSlug: originalSlug,
			};

			// Live-swap the visible wallpaper without persisting.
			pickSceneLive( slug );

			// Re-decorate the grid so "is-previewing" highlights move.
			redecorateSceneGrid();
			renderPreviewBar();
		}

		function pickSceneLive( slug ) {
			if ( window.wp && window.wp.hooks && typeof window.wp.hooks.doAction === 'function' ) {
				try { window.wp.hooks.doAction( 'odd.pickScene', slug ); } catch ( e ) {}
			}
		}

		function redecorateSceneGrid() {
			var cards = content.querySelectorAll( '.odd-card[data-slug]' );
			var currentSlug = state.cfg.wallpaper || state.cfg.scene;
			var previewSlug = state.preview && state.preview.kind === 'wallpaper' ? state.preview.slug : null;
			for ( var i = 0; i < cards.length; i++ ) {
				var c = cards[ i ];
				var slug = c.getAttribute( 'data-slug' );
				c.classList.remove( 'is-active', 'is-previewing' );
				if ( previewSlug && slug === previewSlug ) c.classList.add( 'is-previewing' );
				else if ( ! previewSlug && slug === currentSlug ) c.classList.add( 'is-active' );

				// Keep the inline pill label in sync so the shelf
				// cards mirror the hero state without a full re-render.
				var pill = c.querySelector( '.odd-shop__tile-pill' );
				if ( pill ) {
					if ( previewSlug && slug === previewSlug ) pill.textContent = 'Previewing';
					else if ( ! previewSlug && slug === currentSlug ) pill.textContent = 'Open';
					else pill.textContent = 'Preview';
				}
				// Badge (top-left "Active" chip) only exists on the
				// committed card; add / remove as the committed slug
				// moves so it travels with the live state.
				var thumb = c.querySelector( '.odd-shop__tile-thumb' );
				if ( thumb ) {
					var existingBadge = thumb.querySelector( '.odd-shop__tile-badge' );
					var shouldBadge   = ! previewSlug && slug === currentSlug;
					if ( shouldBadge && ! existingBadge ) {
						var b = document.createElement( 'span' );
						b.className = 'odd-shop__tile-badge';
						b.textContent = '✓ Active';
						thumb.appendChild( b );
					} else if ( ! shouldBadge && existingBadge ) {
						existingBadge.remove();
					}
				}
			}
		}

		function confirmScenePreview() {
			if ( ! state.preview || state.preview.kind !== 'wallpaper' || state.posting ) return;
			state.posting = true;
			var slug = state.preview.slug;

			savePrefs( { wallpaper: slug }, function ( data ) {
				state.posting = false;
				if ( data && typeof data.wallpaper === 'string' ) {
					state.cfg.wallpaper = data.wallpaper;
					state.cfg.scene    = data.wallpaper;
				}
				state.preview = null;
				redecorateSceneGrid();
				renderPreviewBar();
			} );
		}

		function cancelPreview() {
			if ( ! state.preview ) return;
			if ( state.preview.kind === 'wallpaper' ) {
				pickSceneLive( state.preview.originalSlug );
			} else if ( state.preview.kind === 'iconSet' ) {
				restoreIconSnapshot();
			}
			state.preview = null;
			redecorateSceneGrid();
			redecorateIconGrid();
			renderPreviewBar();
		}

		/* --- Icons section --- */

		function renderIcons() {
			var wrap = el( 'div', { class: 'odd-shop__dept odd-shop__dept--icons' } );
			wrap.appendChild( sectionHeader(
				'Icon Sets',
				'Themed packs re-skin the dock and desktop shortcuts. Preview swaps icons in place — only the "Default" set needs a reload.',
				{ eyebrow: 'ODD · Dock Couture' }
			) );

			wrap.appendChild( renderDeptInstallLink( 'icon-set' ) );

			var sets = Array.isArray( state.cfg.iconSets ) ? state.cfg.iconSets.slice() : [];

			// Quilt + shelves only feature real, themed sets so each
			// category has actual siblings instead of a 1-item shelf.
			// The "Default" pseudo-set is reachable via the dedicated
			// reset pill below — and via the hero, when no custom set
			// has been committed yet.
			var realSets = sets.filter( function ( s ) {
				return s && s.slug && s.slug !== 'none';
			} );

			var defaultSet = {
				slug:        'none',
				label:       'Default',
				franchise:   'WP Desktop Mode',
				description: 'Ship the stock Dashicons / WP Desktop Mode icons.',
				preview:     '',
				icons:       {},
			};
			var heroPool = state.cfg.iconSet === 'none'
				? [ defaultSet ].concat( realSets )
				: realSets;

			var filtered = filterByQuery( realSets, state.query );

			if ( heroPool.length ) {
				var featuredSet = pickFeaturedSet( heroPool );
				if ( featuredSet ) wrap.appendChild( renderIconHero( featuredSet ) );
			}

			// "Reset to default" pill — only shown when a custom set is
			// committed. Gives users an obvious way back without
			// cluttering the catalog with a singleton "Default" shelf.
			if ( state.cfg.iconSet && state.cfg.iconSet !== 'none' && ! state.query ) {
				var resetRow = el( 'div', { class: 'odd-shop__reset-row' } );
				var resetLeft = el( 'div', { class: 'odd-shop__reset-left' } );
				var resetIcon = el( 'span', { class: 'odd-shop__reset-icon', 'aria-hidden': 'true' } );
				resetIcon.textContent = '↺';
				var resetText = el( 'span', { class: 'odd-shop__reset-text' } );
				resetText.textContent = 'Want the stock WordPress icons back?';
				resetLeft.appendChild( resetIcon );
				resetLeft.appendChild( resetText );
				var resetBtn = el( 'button', {
					type: 'button',
					class: 'odd-shop__reset-btn',
				} );
				resetBtn.textContent = 'Reset to default';
				resetBtn.addEventListener( 'click', function () {
					previewIconSet( 'none' );
				} );
				resetRow.appendChild( resetLeft );
				resetRow.appendChild( resetBtn );
				wrap.appendChild( resetRow );
			}

			if ( ! state.query ) {
				wrap.appendChild( renderCategoryQuilt( realSets, 'icons' ) );
			}

			if ( ! filtered.length ) {
				wrap.appendChild( renderEmptyResults( 'No icon sets match "' + state.query + '".' ) );
				return wrap;
			}

			var shelves = groupByCategory( filtered, 'icons', 'More' );
			shelves.forEach( function ( shelf ) {
				wrap.appendChild( renderShelf( shelf.franchise, shelf.items, renderIconSetCard, { scope: 'icons' } ) );
			} );

			return wrap;
		}

		function pickFeaturedSet( sets ) {
			// Only honor a current selection if the user has explicitly
			// picked something; an empty/missing iconSet pref means
			// "fresh user", and the hero should show off a real pack
			// rather than advertise "ship stock WP dock as-is".
			var current = state.cfg.iconSet;
			if ( typeof current === 'string' && current !== '' ) {
				for ( var i = 0; i < sets.length; i++ ) {
					if ( sets[ i ] && sets[ i ].slug === current ) return sets[ i ];
				}
			}
			for ( var j = 0; j < sets.length; j++ ) {
				if ( sets[ j ] && sets[ j ].slug !== 'none' ) return sets[ j ];
			}
			return sets[ 0 ] || null;
		}

		function renderIconHero( set ) {
			var currentSlug = state.cfg.iconSet || '';
			var isActive    = ( set.slug === 'none' && ! currentSlug ) || ( set.slug !== 'none' && set.slug === currentSlug );
			var accent      = set.accent && /^#[0-9a-f]{3,8}$/i.test( set.accent ) ? set.accent : '#0071e3';
			var bannerUrl   = ( state.cfg.pluginUrl || '' ) + '/assets/shop/icons-hero.webp';

			var hero = el( 'div', {
				class: 'odd-shop__hero odd-shop__hero--icons',
				'data-hero-slug': set.slug,
				style: 'background-color:#1d1640',
			} );
			// Editorial banner backdrop — a constellation of pastel
			// app-icon stickers on a deep galactic gradient. Empty
			// left third is intentional headline real estate.
			var bg = el( 'div', { class: 'odd-shop__hero-bg', 'aria-hidden': 'true' } );
			bg.style.backgroundImage = 'url("' + bannerUrl + '")';
			hero.appendChild( bg );
			var scrim = el( 'div', { class: 'odd-shop__hero-scrim', 'aria-hidden': 'true' } );
			hero.appendChild( scrim );

			var inner = el( 'div', { class: 'odd-shop__hero-body' } );
			var eyebrow = el( 'div', { class: 'odd-shop__hero-eyebrow' } );
			eyebrow.textContent = isActive ? 'Active set' : 'Featured set';
			var title = el( 'h3', { class: 'odd-shop__hero-title' } );
			title.textContent = set.label || set.slug;
			var sub = el( 'p', { class: 'odd-shop__hero-sub' } );
			sub.textContent = set.description || 'A themed pack for the WordPress desktop dock.';
			var actions = el( 'div', { class: 'odd-shop__hero-actions' } );

			if ( isActive && ! state.preview ) {
				var active = el( 'span', { class: 'odd-shop__hero-badge' } );
				active.textContent = '✓ Active';
				actions.appendChild( active );
			} else {
				var previewBtn = el( 'button', {
					type: 'button',
					class: 'odd-shop__hero-btn odd-shop__hero-btn--primary',
				} );
				previewBtn.innerHTML = '<span aria-hidden="true">▶</span> Preview';
				previewBtn.addEventListener( 'click', function ( e ) {
					e.stopPropagation();
					previewIconSet( set.slug );
				} );
				actions.appendChild( previewBtn );
			}

			inner.appendChild( eyebrow );
			inner.appendChild( title );
			inner.appendChild( sub );
			inner.appendChild( actions );
			hero.appendChild( inner );

			// Icon quartet floating bottom-right, mirroring the
			// scene hero's preview thumbnail.
			if ( set.icons && typeof set.icons === 'object' ) {
				var thumb = el( 'div', { class: 'odd-shop__hero-thumb odd-shop__hero-thumb--icons', 'aria-hidden': 'true' } );
				if ( accent ) thumb.style.background = accent;
				var quartet = el( 'div', { class: 'odd-shop__hero-quartet' } );
				[ 'dashboard', 'posts', 'pages', 'media' ].forEach( function ( k ) {
					if ( set.icons[ k ] ) {
						quartet.appendChild( el( 'img', { src: set.icons[ k ], alt: '', loading: 'lazy' } ) );
					}
				} );
				if ( quartet.children.length ) {
					thumb.appendChild( quartet );
					hero.appendChild( thumb );
				}
			}

			return hero;
		}

		/**
		 * Apps hero — editorial banner for the whole department.
		 * The Apps tab doesn't have a "currently active" item the way
		 * Wallpapers + Icon Sets do, so the hero is purely a brand
		 * masthead: backdrop art + eyebrow + headline + tagline. No
		 * action buttons on the hero itself; install + manage actions
		 * live in the rows below.
		 */
		function renderAppsHero() {
			var bannerUrl = ( state.cfg.pluginUrl || '' ) + '/assets/shop/apps-hero.webp';
			var hero = el( 'div', {
				class: 'odd-shop__hero odd-shop__hero--apps',
				'data-hero-slug': 'apps',
				style: 'background-color:#f4d4c5',
			} );
			var bg = el( 'div', { class: 'odd-shop__hero-bg', 'aria-hidden': 'true' } );
			bg.style.backgroundImage = 'url("' + bannerUrl + '")';
			hero.appendChild( bg );
			hero.appendChild( el( 'div', { class: 'odd-shop__hero-scrim', 'aria-hidden': 'true' } ) );

			var inner = el( 'div', { class: 'odd-shop__hero-body' } );
			var eyebrow = el( 'div', { class: 'odd-shop__hero-eyebrow' } );
			eyebrow.textContent = 'Mini Apps';
			var title = el( 'h3', { class: 'odd-shop__hero-title' } );
			title.textContent = 'Apps that just run.';
			var sub = el( 'p', { class: 'odd-shop__hero-sub' } );
			sub.textContent = 'Tiny standalone programs that live on your WordPress desktop. They don\'t use WordPress, they don\'t know about WordPress — they just run.';
			inner.appendChild( eyebrow );
			inner.appendChild( title );
			inner.appendChild( sub );
			hero.appendChild( inner );

			return hero;
		}

		function renderIconSetCard( set ) {
			var currentSlug = state.cfg.iconSet || '';
			var isDefault = ! currentSlug;
			var active = ( set.slug === 'none' && isDefault ) || ( set.slug !== 'none' && set.slug === currentSlug );
			var isPreview = state.preview && state.preview.kind === 'iconSet' && state.preview.slug === set.slug;

			var card = el( 'div', {
				class: 'odd-catalog-row odd-catalog-row--iconset'
					+ ( active && ! state.preview ? ' is-active' : '' )
					+ ( isPreview ? ' is-previewing' : '' ),
				'data-slug': set.slug,
			} );

			var iconWrap = el( 'div', { class: 'odd-catalog-row__icon' } );
			if ( set.preview ) {
				iconWrap.appendChild( el( 'img', { src: set.preview, alt: '', loading: 'lazy' } ) );
			} else if ( set.icons && Object.keys( set.icons ).length ) {
				var keys = [ 'dashboard', 'posts', 'pages', 'media' ].filter( function ( k ) { return set.icons[ k ]; } );
				if ( ! keys.length ) keys = Object.keys( set.icons ).slice( 0, 4 );
				if ( set.accent ) iconWrap.style.background = set.accent;
				var inner = el( 'div', { class: 'odd-iconset-mini' } );
				keys.slice( 0, 4 ).forEach( function ( k ) {
					inner.appendChild( el( 'img', { src: set.icons[ k ], alt: '', loading: 'lazy' } ) );
				} );
				iconWrap.appendChild( inner );
			} else {
				iconWrap.classList.add( 'odd-catalog-row__icon--badge' );
				iconWrap.textContent = ( set.label || set.slug ).slice( 0, 2 ).toUpperCase();
			}
			card.appendChild( iconWrap );

			var body = el( 'div', { class: 'odd-catalog-row__body' } );
			var titleRow = el( 'div', { class: 'odd-catalog-row__title' } );
			var titleText = el( 'span', { class: 'odd-catalog-row__name' } );
			titleText.textContent = set.label || set.slug;
			titleRow.appendChild( titleText );
			if ( set.franchise ) {
				var franchise = el( 'span', { class: 'odd-catalog-row__version' } );
				franchise.textContent = set.franchise;
				titleRow.appendChild( franchise );
			}
			body.appendChild( titleRow );
			if ( set.description ) {
				var desc = el( 'div', { class: 'odd-catalog-row__desc' } );
				desc.textContent = set.description;
				body.appendChild( desc );
			}
			card.appendChild( body );

			var actions = el( 'div', { class: 'odd-catalog-row__actions' } );
			var btn = el( 'button', {
				type: 'button',
				class: 'odd-apps-btn odd-apps-btn--pill' + ( active && ! state.preview ? '' : ' odd-apps-btn--primary' ),
			} );
			if ( isPreview ) {
				btn.textContent = 'Previewing';
				btn.disabled = true;
			} else if ( active && ! state.preview ) {
				btn.textContent = 'Active';
				btn.disabled = true;
			} else {
				btn.textContent = 'Preview';
			}
			btn.addEventListener( 'click', function ( e ) {
				e.stopPropagation();
				if ( btn.disabled ) return;
				previewIconSet( set.slug );
			} );
			actions.appendChild( btn );
			card.appendChild( actions );

			// Whole-row click also starts a preview (except on the
			// action button, which stops propagation). Makes the grid
			// feel like the wallpaper cards.
			card.addEventListener( 'click', function () {
				if ( isPreview ) return;
				if ( active && ! state.preview ) return;
				previewIconSet( set.slug );
			} );

			return card;
		}

		function previewIconSet( slug ) {
			if ( state.posting ) return;

			var isNone  = ( slug === 'none' || slug === '' );
			var current = state.cfg.iconSet || '';

			// First entry into preview mode — snapshot the current
			// dock + desktop-shortcut icon <img>.src URLs so Cancel
			// can revert pixel-for-pixel. Subsequent preview
			// switches don't re-snapshot: we always revert to the
			// on-screen state *before* the preview flow started.
			if ( ! state.preview || state.preview.kind !== 'iconSet' ) {
				state.preview = {
					kind:           'iconSet',
					slug:           slug,
					originalSlug:   current,
					iconSnapshot:   snapshotIconDom(),
					reloadOnCommit: isNone,
				};
			} else {
				state.preview.slug           = slug;
				state.preview.reloadOnCommit = isNone;
			}

			if ( isNone ) {
				// No live preview — we can't rebuild the pre-ODD
				// icon URLs client-side. Keep the current icons
				// visible and warn via the preview bar that commit
				// requires a reload.
				restoreIconSnapshot();
			} else {
				liveSwapIcons( slug );
			}

			redecorateIconGrid();
			renderPreviewBar();
		}

		function snapshotIconDom() {
			var snap = [];
			var tiles = document.querySelectorAll( '.wp-desktop-dock__item[data-menu-slug] img' );
			for ( var i = 0; i < tiles.length; i++ ) {
				snap.push( { img: tiles[ i ], src: tiles[ i ].getAttribute( 'src' ) } );
			}
			var shortcuts = document.querySelectorAll( '.wp-desktop-icon[data-icon-id] img' );
			for ( var j = 0; j < shortcuts.length; j++ ) {
				snap.push( { img: shortcuts[ j ], src: shortcuts[ j ].getAttribute( 'src' ) } );
			}
			return snap;
		}

		function restoreIconSnapshot() {
			if ( ! state.preview || ! Array.isArray( state.preview.iconSnapshot ) ) return;
			var snap = state.preview.iconSnapshot;
			for ( var i = 0; i < snap.length; i++ ) {
				var rec = snap[ i ];
				if ( rec && rec.img && rec.src ) rec.img.setAttribute( 'src', rec.src );
			}
		}

		function redecorateIconGrid() {
			var rows = content.querySelectorAll( '.odd-catalog-row--iconset' );
			var currentSlug = state.cfg.iconSet || '';
			var previewSlug = state.preview && state.preview.kind === 'iconSet' ? state.preview.slug : null;
			for ( var i = 0; i < rows.length; i++ ) {
				var row = rows[ i ];
				var slug = row.getAttribute( 'data-slug' );
				var isActive     = ( slug === 'none' && ! currentSlug ) || ( slug !== 'none' && slug === currentSlug );
				var isPreviewing = previewSlug && slug === previewSlug;
				row.classList.toggle( 'is-active',     !! ( isActive && ! previewSlug ) );
				row.classList.toggle( 'is-previewing', !! isPreviewing );

				var btn = row.querySelector( '.odd-apps-btn' );
				if ( btn ) {
					if ( isPreviewing ) {
						btn.textContent = 'Previewing';
						btn.disabled = true;
						btn.classList.remove( 'odd-apps-btn--primary' );
					} else if ( isActive && ! previewSlug ) {
						btn.textContent = 'Active';
						btn.disabled = true;
						btn.classList.remove( 'odd-apps-btn--primary' );
					} else {
						btn.textContent = 'Preview';
						btn.disabled = false;
						btn.classList.add( 'odd-apps-btn--primary' );
					}
				}
			}
		}

		function confirmIconPreview() {
			if ( ! state.preview || state.preview.kind !== 'iconSet' || state.posting ) return;
			state.posting = true;
			var slug   = state.preview.slug;
			var reload = state.preview.reloadOnCommit;

			savePrefs( { iconSet: slug }, function ( data ) {
				state.posting = false;
				if ( data && typeof data.iconSet === 'string' ) {
					state.cfg.iconSet = data.iconSet;
				}
				state.preview = null;
				if ( reload ) {
					setTimeout( function () {
						try { window.location.reload(); } catch ( e ) {}
					}, 180 );
					return;
				}
				redecorateIconGrid();
				renderPreviewBar();
			} );
		}

		/**
		 * Rewrite every dock tile and desktop-shortcut icon in the
		 * current document to the selected set's icon URLs. Works
		 * because v1.0.4 switched ODD icons over to real HTTP URLs
		 * (`/odd/v1/icons/{set}/{key}`), which WP Desktop Mode's
		 * `resolveIcon()` renders as `<img>` tags — so we can just
		 * update `.src` in place instead of rebuilding DOM nodes.
		 */
		function liveSwapIcons( slug ) {
			var set = null;
			var sets = Array.isArray( state.cfg.iconSets ) ? state.cfg.iconSets : [];
			for ( var i = 0; i < sets.length; i++ ) {
				if ( sets[ i ] && sets[ i ].slug === slug ) { set = sets[ i ]; break; }
			}
			var icons = ( set && set.icons && typeof set.icons === 'object' ) ? set.icons : null;
			var fallback = icons && icons.fallback ? icons.fallback : '';

			function keyFromMenuSlug( dock ) {
				if ( ! dock ) return '';
				// WPDM sets data-menu-slug to the sanitized html id of
				// the admin menu, typically "menu-posts", "menu-dashboard"…
				var m = /^menu-(.+)$/.exec( dock );
				if ( m && m[ 1 ] ) {
					var k = m[ 1 ];
					if ( k === 'comments' || k === 'appearance'
						|| k === 'plugins'  || k === 'users'
						|| k === 'tools'    || k === 'settings'
						|| k === 'links'    || k === 'profile'
						|| k === 'dashboard'|| k === 'media'
						|| k === 'posts'    || k === 'pages' ) {
						return k;
					}
				}
				return '';
			}

			function resolve( key ) {
				if ( icons && key && icons[ key ] ) return icons[ key ];
				return fallback;
			}

			// Dock tiles (left rail + taskbar).
			var tiles = document.querySelectorAll( '.wp-desktop-dock__item[data-menu-slug]' );
			for ( var t = 0; t < tiles.length; t++ ) {
				var tile = tiles[ t ];
				var url = resolve( keyFromMenuSlug( tile.getAttribute( 'data-menu-slug' ) ) );
				if ( ! url ) continue;
				replaceTileIcon( tile, url );
			}

			// Desktop shortcut icons (buttons inside .wp-desktop-icons).
			var shortcuts = document.querySelectorAll( '.wp-desktop-icon[data-icon-id]' );
			for ( var s = 0; s < shortcuts.length; s++ ) {
				var sc = shortcuts[ s ];
				var id = sc.getAttribute( 'data-icon-id' );
				// Skip the ODD Control Panel's own icon — keep the
				// eye recognizable regardless of the active set.
				if ( id === 'odd' ) continue;
				var sUrl = resolve( id ) || fallback;
				if ( ! sUrl ) continue;
				replaceShortcutIcon( sc, sUrl );
			}
		}

		function replaceTileIcon( tile, url ) {
			var primary = tile.querySelector( '.wp-desktop-dock__item-primary' );
			if ( ! primary ) return;
			var img = primary.querySelector( '.wp-desktop-dock__item-img' );
			if ( img ) { img.src = url; return; }
			var span = primary.querySelector( '.wp-desktop-dock__item-svg' );
			if ( span ) { span.style.backgroundImage = 'url("' + url + '")'; return; }
			// First paint landed on a letter badge or dashicon —
			// replace it with a fresh <img>.
			var existing = primary.querySelector(
				'.wp-desktop-dock__item-letter, .dashicons'
			);
			if ( existing ) existing.remove();
			var fresh = document.createElement( 'img' );
			fresh.className = 'wp-desktop-dock__item-img';
			fresh.src = url;
			fresh.alt = '';
			fresh.setAttribute( 'aria-hidden', 'true' );
			// Badges and other primary children (badge <span>) come
			// after the icon, so prepend keeps DOM order sane.
			primary.insertBefore( fresh, primary.firstChild );
		}

		function replaceShortcutIcon( sc, url ) {
			var host = sc.querySelector( '.wp-desktop-icon__image' );
			if ( ! host ) return;
			host.className = 'wp-desktop-icon__image';
			host.style.background = '';
			var img = host.querySelector( 'img' );
			if ( img ) { img.src = url; return; }
			while ( host.firstChild ) host.removeChild( host.firstChild );
			var fresh = document.createElement( 'img' );
			fresh.src = url;
			fresh.alt = '';
			host.appendChild( fresh );
		}

		/* --- Widgets section ---------------------------------------
		 *
		 * Widgets are small, self-contained cards that live in the
		 * right-side column (or anywhere the user drags them) on the
		 * desktop itself — not inside the ODD window. WP Desktop
		 * Mode persists enabled widget ids to localStorage and
		 * exposes `wp.desktop.widgetLayer.add(id)` / `.remove(id)` /
		 * `.getEnabledIds()` for programmatic wiring. Everything in
		 * this tab is a thin UI over those three calls plus the
		 * `wp-desktop.widget.added` / `.removed` hooks for the case
		 * where the user dismisses a widget from its own × button
		 * while the Shop is open.
		 */

		function widgetCatalog() {
			// Keep this list in sync with `src/widgets/index.js`. We
			// duplicate the metadata here (glyph + gradient + tagline)
			// rather than pulling it from the registry because the
			// widget registry doesn't carry editorial copy or palette
			// — those are a Shop concern, not a runtime concern.
			var builtIns = [
				{
					id:          'odd/sticky',
					label:       'Sticky Note',
					glyph:       '📝',
					accent:      '#f4b93a',
					gradient:    'linear-gradient(135deg,#ffd84a 0%,#ff9c5b 55%,#ff6a3d 100%)',
					tagline:     'Tilted handwritten note, auto-saves.',
					description: 'A pocket-sized scratchpad that picks a different tilt on every load. Scribble a URL, a todo, a reminder — it saves locally as you type, no database round-trip. Drag from the title bar and it\'ll remember wherever you drop it.',
				},
				{
					id:          'odd/eight-ball',
					label:       'Magic 8-Ball',
					glyph:       '🎱',
					accent:      '#3b2fa0',
					gradient:    'linear-gradient(135deg,#1f1f2d 0%,#3b2fa0 55%,#7a49d6 100%)',
					tagline:     'Shake for definitive-ish WordPress advice.',
					description: 'Thirty WordPress-flavoured answers from a mystical plastic sphere. Click the ball to shake. Best consulted before a destructive migration, never during. Reduced-motion mode downgrades the rattle to a quick cross-fade.',
				},
			];

			var base   = builtIns.slice();
			var extras = Array.isArray( state.cfg.installedWidgets ) ? state.cfg.installedWidgets : [];
			// Merge installed widgets as their own cards. They don't
			// ship editorial palette metadata so the Shop synthesises
			// a neutral gradient + glyph fallback per card.
			for ( var i = 0; i < extras.length; i++ ) {
				var w = extras[ i ] || {};
				if ( ! w.id ) continue;
				base.push( {
					id:          w.id,
					label:       w.label || w.slug || w.id,
					glyph:       '🧩',
					accent:      '#6d6d8a',
					gradient:    'linear-gradient(135deg,#3b3b52 0%,#6d6d8a 55%,#b5b5cc 100%)',
					tagline:     w.description || 'Installed widget.',
					description: w.description || 'A community-installed widget. Remove it by uninstalling the bundle from wp-content/odd-widgets/.',
					installed:   true,
					slug:        w.slug,
				} );
			}
			return base;
		}

		

		function enabledWidgetIds() {
			try {
				if ( window.wp && window.wp.desktop && window.wp.desktop.widgetLayer ) {
					var layer = window.wp.desktop.widgetLayer;
					if ( typeof layer.getEnabledIds === 'function' ) {
						return layer.getEnabledIds() || [];
					}
				}
			} catch ( e ) {}
			// Fallback — read the same localStorage key the desktop
			// layer writes to. Keeps the Shop functional even if the
			// desktop layer object is temporarily unavailable (e.g.
			// during boot races after a hard reload).
			try {
				var raw = window.localStorage.getItem( 'wp-desktop-widgets' );
				if ( ! raw ) return [];
				var parsed = JSON.parse( raw );
				return Array.isArray( parsed ) ? parsed.filter( function ( x ) { return typeof x === 'string'; } ) : [];
			} catch ( e2 ) { return []; }
		}

		function toggleWidget( id, shouldAdd ) {
			function notify( msg ) {
				try {
					if ( window.__odd && window.__odd.api && typeof window.__odd.api.toast === 'function' ) {
						window.__odd.api.toast( msg );
					}
				} catch ( e ) {}
			}
			if ( ! window.wp || ! window.wp.desktop || ! window.wp.desktop.widgetLayer ) {
				notify( 'Widgets need WP Desktop Mode 0.8+.' );
				return;
			}
			var layer = window.wp.desktop.widgetLayer;
			try {
				if ( shouldAdd && typeof layer.add === 'function' ) {
					layer.add( id );
				} else if ( ! shouldAdd && typeof layer.remove === 'function' ) {
					layer.remove( id );
				}
			} catch ( e ) {
				notify( 'Couldn\'t toggle that widget.' );
				return;
			}
			// The widgetLayer fires the `wp-desktop.widget.added` /
			// `.removed` hooks we're listening to below, but re-render
			// synchronously too so the Shop doesn't flicker with a
			// stale "Add" state while the hook propagates.
			if ( state.active === 'widgets' ) {
				renderSection( 'widgets', { keepQuery: true } );
			}
		}

		// Widget hooks are installed once per panel mount. Re-entering
		// the Widgets tab reuses the single subscription; teardown
		// isn't needed because a panel close re-runs the mount path.
		if ( ! state.widgetHooksInstalled ) {
			state.widgetHooksInstalled = true;
			try {
				if ( window.wp && window.wp.hooks ) {
					window.wp.hooks.addAction( 'wp-desktop.widget.added', 'odd/widgets', function () {
						if ( state.active === 'widgets' ) renderSection( 'widgets', { keepQuery: true } );
					} );
					window.wp.hooks.addAction( 'wp-desktop.widget.removed', 'odd/widgets', function () {
						if ( state.active === 'widgets' ) renderSection( 'widgets', { keepQuery: true } );
					} );
				}
			} catch ( e ) {}
		}

		function renderWidgets() {
			var wrap = el( 'div', { class: 'odd-shop__dept odd-shop__dept--widgets' } );
			wrap.appendChild( sectionHeader(
				'Widgets',
				'Small, self-contained cards that live on the desktop itself — not inside this window. Add one and it appears in the right-hand column; drag it by its title bar to park it anywhere.',
				{ eyebrow: 'ODD · Desktop Companions' }
			) );

			wrap.appendChild( renderDeptInstallLink( 'widget' ) );

			var catalog = widgetCatalog();
			var enabled = enabledWidgetIds();
			var enabledMap = {};
			enabled.forEach( function ( eid ) { enabledMap[ eid ] = true; } );

			var filtered = state.query
				? catalog.filter( function ( w ) {
					var q = state.query.toLowerCase();
					return ( w.label || '' ).toLowerCase().indexOf( q ) !== -1
						|| ( w.tagline || '' ).toLowerCase().indexOf( q ) !== -1
						|| ( w.description || '' ).toLowerCase().indexOf( q ) !== -1;
				} )
				: catalog;

			// Hero: whatever's currently on the desktop goes first.
			// If nothing is enabled we feature the top of the catalog
			// as a "try me" slot.
			var hero = null;
			for ( var i = 0; i < catalog.length; i++ ) {
				if ( enabledMap[ catalog[ i ].id ] ) { hero = catalog[ i ]; break; }
			}
			if ( ! hero ) hero = catalog[ 0 ];
			if ( hero && ! state.query ) {
				wrap.appendChild( renderWidgetsHero( hero, !! enabledMap[ hero.id ] ) );
			}

			if ( ! filtered.length ) {
				wrap.appendChild( renderEmptyResults( 'No widgets match "' + state.query + '".' ) );
				return wrap;
			}

			wrap.appendChild( renderShelf(
				'Widgets',
				filtered,
				function ( w ) { return renderWidgetCard( w, !! enabledMap[ w.id ] ); },
				{ scope: 'widgets' }
			) );

			// Gentle reminder footer — widgets live on the desktop
			// itself, which may not be obvious when browsing them
			// from inside an ODD window that sits on top of the dock.
			if ( ! state.query ) {
				var tip = el( 'div', { class: 'odd-shop__tip' } );
				var tipIcon = el( 'span', { class: 'odd-shop__tip-icon', 'aria-hidden': 'true' } );
				tipIcon.textContent = '💡';
				var tipText = el( 'span', { class: 'odd-shop__tip-text' } );
				tipText.textContent = 'Added widgets appear on your desktop\'s right column — drag one by its title bar to park it wherever you like.';
				tip.appendChild( tipIcon );
				tip.appendChild( tipText );
				wrap.appendChild( tip );
			}

			return wrap;
		}

		function renderWidgetsHero( widget, isEnabled ) {
			var hero = el( 'div', {
				class: 'odd-shop__hero odd-shop__hero--widgets',
				'data-hero-slug': widget.id,
				style: 'background:' + widget.gradient,
			} );
			// Giant translucent glyph floats to the right as the hero's
			// visual anchor — no painted artwork to ship, and the
			// gradient + emoji combo reads instantly across locales.
			// `aria-hidden` keeps screen readers from narrating an
			// emoji that's purely decorative.
			var art = el( 'div', {
				class: 'odd-shop__hero-glyph',
				'aria-hidden': 'true',
			} );
			art.textContent = widget.glyph;
			hero.appendChild( art );
			hero.appendChild( el( 'div', { class: 'odd-shop__hero-scrim', 'aria-hidden': 'true' } ) );

			var inner = el( 'div', { class: 'odd-shop__hero-body' } );
			var eyebrow = el( 'div', { class: 'odd-shop__hero-eyebrow' } );
			eyebrow.textContent = isEnabled ? 'On your desktop' : 'Featured widget';
			var title = el( 'h3', { class: 'odd-shop__hero-title' } );
			title.textContent = widget.label;
			var sub = el( 'p', { class: 'odd-shop__hero-sub' } );
			sub.textContent = widget.description;

			// Use the shared hero-actions/hero-btn pattern so the CTA
			// visually matches anything else we might drop in other
			// departments later. Primary = white pill for "Add";
			// ghost = translucent bordered pill for "Remove from
			// desktop" (the destructive-ish inverse).
			var actions = el( 'div', { class: 'odd-shop__hero-actions' } );
			var cta = el( 'button', {
				type: 'button',
				class: 'odd-shop__hero-btn ' + ( isEnabled ? 'odd-shop__hero-btn--ghost' : 'odd-shop__hero-btn--primary' ),
			} );
			cta.textContent = isEnabled ? 'Remove from desktop' : 'Add to desktop';
			cta.addEventListener( 'click', function () {
				toggleWidget( widget.id, ! isEnabled );
			} );
			actions.appendChild( cta );

			inner.appendChild( eyebrow );
			inner.appendChild( title );
			inner.appendChild( sub );
			inner.appendChild( actions );
			hero.appendChild( inner );
			return hero;
		}

		function renderWidgetCard( widget, isEnabled ) {
			var card = el( 'div', {
				class: 'odd-card odd-shop__tile odd-shop__tile--widget'
					+ ( isEnabled ? ' is-active' : '' ),
				'data-widget-id': widget.id,
			} );

			var thumb = el( 'div', { class: 'odd-shop__tile-thumb odd-shop__tile-thumb--widget' } );
			thumb.style.background = widget.gradient;
			var glyph = el( 'div', { class: 'odd-shop__tile-glyph', 'aria-hidden': 'true' } );
			glyph.textContent = widget.glyph;
			thumb.appendChild( glyph );
			// Inner shine overlay adds a subtle physical quality to the
			// gradient thumb — reads as "molded plastic sticker" rather
			// than "flat rectangle with emoji".
			thumb.appendChild( el( 'span', { class: 'odd-shop__tile-shine', 'aria-hidden': 'true' } ) );
			if ( isEnabled ) {
				var chip = el( 'span', { class: 'odd-shop__tile-chip' } );
				chip.appendChild( el( 'span', { class: 'odd-shop__tile-chip-dot', 'aria-hidden': 'true' } ) );
				chip.appendChild( document.createTextNode( 'On desktop' ) );
				thumb.appendChild( chip );
			}
			card.appendChild( thumb );

			var meta = el( 'div', { class: 'odd-shop__tile-meta' } );
			var h = el( 'div', { class: 'odd-shop__tile-title' } );
			h.textContent = widget.label;
			var p = el( 'div', { class: 'odd-shop__tile-sub' } );
			p.textContent = widget.tagline;
			meta.appendChild( h );
			meta.appendChild( p );
			card.appendChild( meta );

			var actions = el( 'div', { class: 'odd-shop__tile-actions' } );
			var btn = el( 'button', {
				type: 'button',
				class: 'odd-shop__tile-btn' + ( isEnabled ? ' odd-shop__tile-btn--ghost' : ' odd-shop__tile-btn--primary' ),
				'aria-pressed': isEnabled ? 'true' : 'false',
			} );
			btn.textContent = isEnabled ? 'Remove' : 'Add to desktop';
			btn.addEventListener( 'click', function () {
				toggleWidget( widget.id, ! isEnabled );
			} );
			actions.appendChild( btn );
			card.appendChild( actions );

			return card;
		}

		/* --- About section ---------------------------------------
		 *
		 * This is the one place in the panel that breaks the admin-style
		 * discipline of every other tab. Everything else is a macOS-ish
		 * two-pane; this is a self-indulgent title card. The big ODD
		 * wordmark also doubles as a chaos button: clicking it fires
		 * a random scene commit — same live-swap + REST write the
		 * wallpaper grid's Keep button uses — so it's a "real"
		 * affordance and not a decorative div.
		 */

		function renderAbout() {
			var cfg = state.cfg;

			// Pull accent colors from installed icon sets so the About
			// palette ties into whatever set is currently loaded. Fall
			// back to a neon rainbow if no manifests are readable.
			var accents = [];
			if ( Array.isArray( cfg.iconSets ) ) {
				cfg.iconSets.forEach( function ( s ) {
					if ( s && typeof s.accent === 'string' && /^#[0-9a-f]{3,8}$/i.test( s.accent ) ) {
						accents.push( s.accent );
					}
				} );
			}
			if ( accents.length < 3 ) {
				accents = [ '#ff3d9a', '#ffd23f', '#00d1b2', '#6a5cff', '#ff6d00' ];
			}

			var wrap = el( 'div', { class: 'odd-about', 'data-odd-about': '1' } );

			/* hero */
			var hero = el( 'div', { class: 'odd-about__hero' } );

			var word = el( 'button', {
				type:        'button',
				class:       'odd-about__word',
				'aria-label':'ODD — tap for chaos',
				title:       'tap for chaos',
			} );
			[ 'O', 'D', 'D' ].forEach( function ( letter, i ) {
				var a1 = accents[ i % accents.length ];
				var a2 = accents[ ( i + 1 ) % accents.length ];
				var sp = el( 'span', {
					class: 'odd-about__letter',
					style: '--odd-accent:' + a1 + ';--odd-accent2:' + a2 + ';animation-delay:' + ( i * -0.4 ) + 's',
				} );
				sp.textContent = letter;
				word.appendChild( sp );
			} );
			word.addEventListener( 'click', function () {
				// Random scene swap — chaos commit, no preview bar.
				// Fires through the same live-swap + REST path the
				// wallpaper grid uses when the user confirms, so the
				// active card elsewhere stays in sync on reload.
				if ( state.posting ) return;
				var scenes = Array.isArray( cfg.scenes ) ? cfg.scenes : [];
				var current = cfg.wallpaper || cfg.scene;
				var choices = scenes.filter( function ( s ) { return s && s.slug && s.slug !== current; } );
				if ( choices.length ) {
					var next = choices[ Math.floor( Math.random() * choices.length ) ];
					// If a preview is open, cancel it first so we don't
					// stack two swaps.
					if ( state.preview ) cancelPreview();
					state.posting = true;
					pickSceneLive( next.slug );
					savePrefs( { wallpaper: next.slug }, function ( data ) {
						state.posting = false;
						if ( data && typeof data.wallpaper === 'string' ) {
							state.cfg.wallpaper = data.wallpaper;
							state.cfg.scene    = data.wallpaper;
							cfg.wallpaper      = data.wallpaper;
							cfg.scene          = data.wallpaper;
						}
					} );
				}
				word.classList.remove( 'is-whee' );
				// Force reflow so the animation restarts even on
				// back-to-back clicks.
				void word.offsetWidth;
				word.classList.add( 'is-whee' );
			} );
			hero.appendChild( word );

			var byline = el( 'div', { class: 'odd-about__byline' } );
			byline.textContent = 'Outlandish Desktop Decorator';
			hero.appendChild( byline );

			var taglines = [
				'Generative wallpapers. Unserious icons. Apps that just run.',
				'A plugin that decorates your WordPress like nothing matters.',
				'Pixi on the canvas. Personality in the icons. Perils in the apps.',
				'The only WordPress plugin with a chaos cast and a shuffle timer.',
				'Server-canonical icons. Client-chaotic everything else.',
				'Built on WP Desktop Mode. Decorated beyond recognition.',
				'Every scene is a vibe. Every vibe has a ticker.',
				'Outlandish by default. Opinionated by necessity.',
				'Your admin panel called. It wants its dignity back.',
			];
			var tag = el( 'p', { class: 'odd-about__tag' } );
			var tagIdx = Math.floor( Math.random() * taglines.length );
			tag.textContent = taglines[ tagIdx ];
			hero.appendChild( tag );

			// Rotate tagline every ~5s with a soft crossfade. Self-clears
			// the interval as soon as the node leaves the DOM (which
			// happens on section swap because renderSection clobbers
			// `content.innerHTML`).
			var tagTimer = setInterval( function () {
				if ( ! document.contains( tag ) ) {
					clearInterval( tagTimer );
					return;
				}
				tagIdx = ( tagIdx + 1 ) % taglines.length;
				tag.style.opacity = '0';
				setTimeout( function () {
					if ( ! document.contains( tag ) ) return;
					tag.textContent = taglines[ tagIdx ];
					tag.style.opacity = '1';
				}, 260 );
			}, 5200 );

			wrap.appendChild( hero );

			/* stats */
			var stats = el( 'div', { class: 'odd-about__stats' } );
			var items = [
				{ k: 'Version',   v: cfg.version || '—' },
				{ k: 'Scenes',    v: Array.isArray( cfg.scenes )   ? cfg.scenes.length   : 0 },
				{ k: 'Icon sets', v: Array.isArray( cfg.iconSets ) ? cfg.iconSets.length : 0 },
			];
			if ( cfg.appsEnabled ) {
				items.push( { k: 'Apps', v: Array.isArray( cfg.apps ) ? cfg.apps.length : 0 } );
			}
			items.forEach( function ( it, i ) {
				var tint = accents[ i % accents.length ];
				var card = el( 'div', {
					class: 'odd-about__stat',
					style: '--odd-tint:' + tint,
				} );
				var v = el( 'div', { class: 'odd-about__stat-v' } );
				v.textContent = String( it.v );
				var k = el( 'div', { class: 'odd-about__stat-k' } );
				k.textContent = it.k;
				card.appendChild( v );
				card.appendChild( k );
				stats.appendChild( card );
			} );
			wrap.appendChild( stats );

			/* foot */
			var foot = el( 'div', { class: 'odd-about__foot' } );
			var link = el( 'a', {
				href:   'https://github.com/RegionallyFamous/odd',
				target: '_blank',
				rel:    'noopener noreferrer',
				class:  'odd-about__link',
			} );
			link.innerHTML = '<span aria-hidden="true">★</span> github.com/RegionallyFamous/odd';
			foot.appendChild( link );

			var credit = el( 'p', { class: 'odd-about__credit' } );
			credit.textContent = 'Painted backdrops, scripted motion, mini apps that mind their business. Built on WP Desktop Mode. Use responsibly. Or don\'t.';
			foot.appendChild( credit );
			wrap.appendChild( foot );

			return wrap;
		}

		/* --- shared helpers --- */

		/**
		 * Sticky confirmation bar for the preview-and-confirm flow.
		 * Mounted as the last child of the content pane; removed when
		 * `state.preview` is cleared. Keep / Apply writes the pending
		 * change through REST; Cancel reverts the live swap.
		 */
		function renderPreviewBar() {
			var existing = content.querySelector( '[data-odd-preview-bar]' );
			if ( existing && existing.parentNode ) existing.parentNode.removeChild( existing );
			if ( ! state.preview ) return;

			var kind     = state.preview.kind;
			var slug     = state.preview.slug;
			var reload   = state.preview.kind === 'iconSet' && state.preview.reloadOnCommit;
			var itemName = '';
			if ( kind === 'wallpaper' ) {
				var scenes = Array.isArray( state.cfg.scenes ) ? state.cfg.scenes : [];
				for ( var i = 0; i < scenes.length; i++ ) {
					if ( scenes[ i ] && scenes[ i ].slug === slug ) { itemName = scenes[ i ].label || slug; break; }
				}
			} else {
				if ( slug === 'none' || slug === '' ) {
					itemName = 'Default icons';
				} else {
					var sets = Array.isArray( state.cfg.iconSets ) ? state.cfg.iconSets : [];
					for ( var j = 0; j < sets.length; j++ ) {
						if ( sets[ j ] && sets[ j ].slug === slug ) { itemName = sets[ j ].label || slug; break; }
					}
				}
			}

			var bar = el( 'div', { class: 'odd-preview-bar', 'data-odd-preview-bar': '1', role: 'status' } );

			var eye = el( 'div', { class: 'odd-preview-bar__eye', 'aria-hidden': 'true' } );
			eye.textContent = '👁';
			bar.appendChild( eye );

			var text = el( 'div', { class: 'odd-preview-bar__text' } );
			if ( kind === 'wallpaper' ) {
				text.innerHTML = 'Previewing <em></em>. Keep to save, Cancel to revert.';
			} else if ( reload ) {
				text.innerHTML = 'Applying <em></em> reloads the page to restore stock dock icons.';
			} else {
				text.innerHTML = 'Previewing <em></em> icons. Apply to save, Cancel to revert.';
			}
			text.querySelector( 'em' ).textContent = itemName || slug;
			bar.appendChild( text );

			var actions = el( 'div', { class: 'odd-preview-bar__actions' } );
			var cancel = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--pill' } );
			cancel.textContent = 'Cancel';
			cancel.addEventListener( 'click', function () { cancelPreview(); } );
			actions.appendChild( cancel );

			var commit = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--pill odd-apps-btn--primary' } );
			if ( kind === 'wallpaper' ) {
				commit.textContent = 'Keep';
				commit.addEventListener( 'click', function () { confirmScenePreview(); } );
			} else {
				commit.textContent = reload ? 'Apply & reload' : 'Apply';
				commit.addEventListener( 'click', function () { confirmIconPreview(); } );
			}
			actions.appendChild( commit );

			bar.appendChild( actions );
			content.appendChild( bar );
		}

		function sectionHeader( title, sub, opts ) {
			opts = opts || {};
			var h = el( 'header', { class: 'odd-section-header odd-shop__dept-header' } );
			if ( opts.eyebrow ) {
				var eb = el( 'div', { class: 'odd-shop__dept-eyebrow' } );
				eb.textContent = opts.eyebrow;
				h.appendChild( eb );
			}
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

	window.wpDesktopNativeWindows.odd = function ( body ) {
		try {
			return renderPanel( body );
		} catch ( err ) {
			reportError( 'panel.render', err );
			try {
				body.innerHTML =
					'<div style="padding:24px;font-family:system-ui;color:#1d2327">' +
					'<h2 style="margin:0 0 8px">ODD panel didn\'t load</h2>' +
					'<p style="color:#50575e;margin:0">A scene or widget threw while the panel was rendering. Reload the page or check the browser console.</p>' +
					'</div>';
			} catch ( e ) {}
			return function () {};
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
			'.odd-panel .odd-wallpaper-settings{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin:0 0 12px}',
			'.odd-panel .odd-setting-card{position:relative;display:flex;flex-direction:column;gap:14px;padding:18px 20px;background:linear-gradient(180deg,#fff,#fbfbff);border:1px solid #dfe3ea;border-radius:16px;box-shadow:0 14px 30px -24px rgba(20,14,40,.35),0 1px 0 rgba(255,255,255,.9) inset;color:#1d2327}',
			'.odd-panel .odd-setting-card--screensaver{margin:0 0 18px;grid-column:1/-1;background:linear-gradient(135deg,#ffffff 0%,#f8fbff 58%,#fff8ec 100%)}',
			'.odd-panel .odd-switch-row{position:relative;display:flex;align-items:flex-start;gap:14px;cursor:pointer}',
			'.odd-panel .odd-switch-row input[type="checkbox"]{position:absolute;opacity:0;pointer-events:none}',
			'.odd-panel .odd-switch{position:relative;flex:0 0 auto;width:42px;height:24px;margin-top:2px;border-radius:999px;background:#dcdcde;box-shadow:0 1px 2px rgba(0,0,0,.16) inset;transition:background .16s ease,box-shadow .16s ease}',
			'.odd-panel .odd-switch::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 2px 7px rgba(20,14,40,.24);transition:transform .18s cubic-bezier(.2,.8,.2,1)}',
			'.odd-panel .odd-switch-row input[type="checkbox"]:checked + .odd-switch{background:linear-gradient(135deg,#2271b1,#8b5cf6);box-shadow:0 8px 18px -12px #2271b1}',
			'.odd-panel .odd-switch-row input[type="checkbox"]:checked + .odd-switch::after{transform:translateX(18px)}',
			'.odd-panel .odd-switch-row input[type="checkbox"]:focus-visible + .odd-switch{outline:2px solid #2271b1;outline-offset:3px}',
			'.odd-panel .odd-setting-card__text{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}',
			'.odd-panel .odd-setting-card__text strong{font-size:14px;font-weight:700;line-height:1.25;color:#1d2327}',
			'.odd-panel .odd-setting-card__text span{font-size:12px;line-height:1.45;color:#50575e}',
			'.odd-panel .odd-setting-card__controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;color:#50575e;font-size:12px;font-weight:600}',
			'.odd-panel .odd-setting-card__controls--screensaver{justify-content:flex-start}',
			'.odd-panel .odd-setting-field{display:inline-flex;align-items:center;gap:8px;color:#50575e;font-size:12px;font-weight:600}',
			'.odd-panel .odd-minutes{width:72px;min-height:38px;padding:6px 10px;border:1px solid #c7ced8;border-radius:10px;font:inherit;font-size:14px;font-weight:700;color:#1d2327;background:#fff;box-shadow:0 1px 0 rgba(255,255,255,.8) inset;text-align:center}',
			'.odd-panel .odd-minutes:focus,.odd-panel .odd-select:focus{border-color:#2271b1;box-shadow:0 0 0 2px rgba(34,113,177,.14);outline:none}',
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
			/* About — bleeds edge-to-edge inside the content pane so
			 * the conic gradient can actually show up. Relies on the
			 * outer section's 24/28 padding via negative margins. */
			'.odd-panel .odd-about{position:relative;margin:-24px -28px 0;padding:44px 28px 36px;overflow:hidden;isolation:isolate;color:#0c0a1d}',
			'.odd-panel .odd-about::before{content:"";position:absolute;inset:-25%;background:conic-gradient(from 0deg,#ff3d9a,#ffd23f,#00d1b2,#6a5cff,#ff6d00,#ff3d9a);filter:blur(90px) saturate(1.2);opacity:.38;z-index:-2;animation:odd-about-spin 32s linear infinite;will-change:transform}',
			'.odd-panel .odd-about::after{content:"";position:absolute;inset:0;background:radial-gradient(130% 90% at 50% -10%,rgba(255,255,255,0) 0%,rgba(255,255,255,.55) 55%,#f6f7f7 100%);z-index:-1;pointer-events:none}',
			'.odd-panel .odd-about__hero{text-align:center;padding:14px 8px 28px}',
			'.odd-panel .odd-about__word{all:unset;display:inline-flex;gap:.04em;cursor:pointer;font:900 clamp(84px,16vw,168px)/0.85 "Helvetica Neue",-apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:-0.05em;user-select:none;-webkit-user-select:none;transition:transform .18s ease}',
			'.odd-panel .odd-about__word:hover{transform:scale(1.02)}',
			'.odd-panel .odd-about__word:active{transform:scale(0.98)}',
			'.odd-panel .odd-about__word:focus-visible{outline:3px dashed #1d2327;outline-offset:10px;border-radius:8px}',
			'.odd-panel .odd-about__letter{display:inline-block;background:linear-gradient(135deg,var(--odd-accent,#ff3d9a) 0%,var(--odd-accent2,#6a5cff) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;animation:odd-about-bounce 4.2s ease-in-out infinite;will-change:transform,filter}',
			'.odd-panel .odd-about__word.is-whee .odd-about__letter{animation:odd-about-whee .7s cubic-bezier(.2,1,.3,1) 1}',
			'.odd-panel .odd-about__byline{margin-top:8px;font-size:13px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;background:linear-gradient(90deg,#ff3d9a,#ffd23f,#00d1b2,#6a5cff,#ff3d9a);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;animation:odd-about-slide 9s linear infinite}',
			'.odd-panel .odd-about__tag{margin:22px auto 0;max-width:46ch;font-size:14px;line-height:1.55;color:#1d2327;font-style:italic;opacity:1;transition:opacity .24s ease}',
			'.odd-panel .odd-about__stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:8px auto 0;max-width:620px}',
			'.odd-panel .odd-about__stat{position:relative;padding:18px 14px 16px;border-radius:16px;background:rgba(255,255,255,.78);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.9);box-shadow:0 12px 30px -20px rgba(20,14,40,.3),0 1px 0 rgba(255,255,255,.8) inset;text-align:center;overflow:hidden}',
			'.odd-panel .odd-about__stat::before{content:"";position:absolute;left:-20%;right:-20%;bottom:-70%;height:130%;background:radial-gradient(closest-side,var(--odd-tint,#ff3d9a) 0%,transparent 72%);opacity:.38;pointer-events:none}',
			'.odd-panel .odd-about__stat > *{position:relative}',
			'.odd-panel .odd-about__stat-v{font:800 30px/1 "Helvetica Neue",-apple-system,BlinkMacSystemFont,sans-serif;color:var(--odd-tint,#1d2327);letter-spacing:-0.02em;font-variant-numeric:tabular-nums;word-break:break-word}',
			'.odd-panel .odd-about__stat-k{margin-top:6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#50575e;font-weight:700}',
			'.odd-panel .odd-about__foot{margin:32px auto 0;max-width:620px;text-align:center}',
			'.odd-panel .odd-about__link{display:inline-flex;align-items:center;gap:8px;padding:9px 20px;border-radius:999px;background:#0c0a1d;color:#fff;font-size:13px;font-weight:600;text-decoration:none;transition:transform .2s ease,box-shadow .2s ease,background .2s ease}',
			'.odd-panel .odd-about__link:hover{transform:translateY(-2px);box-shadow:0 14px 30px -16px rgba(106,92,255,.75);background:#1a1533}',
			'.odd-panel .odd-about__link span{color:#ffd23f;font-size:15px;line-height:1}',
			'.odd-panel .odd-about__credit{margin:18px auto 0;max-width:52ch;font-size:12px;color:#646970;line-height:1.55}',
			'@keyframes odd-about-spin{to{transform:rotate(360deg)}}',
			'@keyframes odd-about-bounce{0%,100%{transform:translateY(0) rotate(0);filter:hue-rotate(0deg) saturate(1)}25%{transform:translateY(-6px) rotate(-2.5deg)}50%{transform:translateY(0) rotate(0);filter:hue-rotate(24deg) saturate(1.1)}75%{transform:translateY(-4px) rotate(2.5deg)}}',
			'@keyframes odd-about-whee{0%{transform:scale(1) rotate(0);filter:hue-rotate(0deg)}45%{transform:scale(1.18) rotate(-8deg);filter:hue-rotate(220deg) saturate(1.4)}100%{transform:scale(1) rotate(0);filter:hue-rotate(0deg)}}',
			'@keyframes odd-about-slide{to{background-position:200% 0}}',
			'@media (prefers-reduced-motion: reduce){.odd-panel .odd-about::before,.odd-panel .odd-about__letter,.odd-panel .odd-about__byline,.odd-panel .odd-about__word{animation:none!important;transition:none!important}.odd-panel .odd-about__tag{transition:none!important}}',
			'.odd-panel .odd-apps-upload{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;padding:16px;margin:0 0 16px;background:#fff;border:1px dashed #8c8f94;border-radius:10px;color:#1d2327}',
			'.odd-panel .odd-apps-upload.is-dragover{border-color:#2271b1;background:#eaf2ff}',
			'.odd-panel .odd-apps-upload strong{flex:0 0 auto;font-size:14px}',
			'.odd-panel .odd-apps-upload__sub{flex:1 1 auto;font-size:12px;color:#646970}',
			'.odd-panel .odd-apps-btn{all:unset;cursor:pointer;padding:6px 12px;border:1px solid #8c8f94;border-radius:6px;font-size:12px;font-weight:500;background:#fff;color:#1d2327;transition:background .12s ease,border-color .12s ease}',
			'.odd-panel .odd-apps-btn:hover{background:#f0f0f1;border-color:#2271b1}',
			'.odd-panel .odd-apps-btn--primary{background:#2271b1;color:#fff;border-color:#2271b1}',
			'.odd-panel .odd-apps-btn--primary:hover{background:#135e96;border-color:#135e96;color:#fff}',
			'.odd-panel .odd-apps-btn--danger{color:#b32d2e;border-color:#b32d2e}',
			'.odd-panel .odd-apps-btn--danger:hover{background:#b32d2e;color:#fff}',
			'.odd-panel .odd-apps-status{min-height:20px;margin:0 0 12px;font-size:12px;color:#646970}',
			'.odd-panel .odd-apps-status.is-busy{color:#50575e}',
			'.odd-panel .odd-apps-status.is-ok{color:#008a20}',
			'.odd-panel .odd-apps-status.is-error{color:#b32d2e}',
			'.odd-panel .odd-apps-empty{padding:32px 16px;text-align:center;color:#646970;font-size:13px;border:1px dashed #dcdcde;border-radius:10px;background:#fff}',
			'.odd-panel .odd-grid--apps{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}',
			'.odd-panel .odd-card--app{cursor:default}',
			'.odd-panel .odd-card--app:hover{transform:none}',
			'.odd-panel .odd-card--app.is-disabled{opacity:.55}',
			'.odd-panel .odd-card__thumb--badge{font-size:24px;font-weight:700;color:#2271b1;background:linear-gradient(135deg,#e9f2fb,#fff)}',
			'.odd-panel .odd-card__actions{display:flex;gap:6px;padding:0 12px 12px;flex-wrap:wrap}',
			'.odd-panel .odd-apps-subhead{margin:24px 0 10px;font-size:13px;font-weight:600;color:#1d2327;text-transform:uppercase;letter-spacing:.06em}',
			'.odd-panel .odd-apps-subhead--catalog{margin-top:32px}',
			'.odd-panel .odd-apps-note{margin:0 0 12px;font-size:12px;color:#646970;max-width:58ch;line-height:1.5}',
			'.odd-panel .odd-catalog-list{display:flex;flex-direction:column;gap:8px;margin:0 0 16px}',
			'.odd-panel .odd-catalog-row{display:grid;grid-template-columns:56px 1fr auto;align-items:center;gap:14px;padding:12px 14px;background:#fff;border:1px solid #e0e0e3;border-radius:12px;transition:border-color .12s ease,box-shadow .12s ease}',
			'.odd-panel .odd-catalog-row:hover{border-color:#cdd1d5;box-shadow:0 1px 2px rgba(0,0,0,.04)}',
			'.odd-panel .odd-catalog-row.is-installed{background:#fafbfc}',
			'.odd-panel .odd-catalog-row__icon{width:56px;height:56px;border-radius:14px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f0f0f1;flex-shrink:0}',
			'.odd-panel .odd-catalog-row__icon img{width:100%;height:100%;object-fit:cover;display:block}',
			'.odd-panel .odd-catalog-row__icon--badge{font-size:20px;font-weight:700;color:#2271b1;background:linear-gradient(135deg,#e9f2fb,#fff)}',
			'.odd-panel .odd-catalog-row__body{min-width:0;display:flex;flex-direction:column;gap:3px}',
			'.odd-panel .odd-catalog-row__title{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}',
			'.odd-panel .odd-catalog-row__name{font-size:14px;font-weight:600;color:#1d2327;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}',
			'.odd-panel .odd-catalog-row__version{font-size:11px;color:#8c8f94;font-variant-numeric:tabular-nums}',
			'.odd-panel .odd-catalog-row__desc{font-size:12px;color:#50575e;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
			'.odd-panel .odd-catalog-row__actions{display:flex;align-items:center;gap:10px;flex-shrink:0}',
			'.odd-panel .odd-catalog-row__installed{font-size:11px;color:#8c8f94;text-transform:uppercase;letter-spacing:.04em}',
			'.odd-panel .odd-apps-btn--pill{border-radius:999px;padding:6px 18px;font-weight:600}',
			'.odd-panel .odd-apps-btn:disabled{opacity:1;cursor:default}',
			'.odd-panel .odd-catalog-row--iconset{cursor:pointer}',
			'.odd-panel .odd-catalog-row--iconset.is-active{border-color:#2271b1;box-shadow:0 0 0 1px #2271b1 inset}',
			'.odd-panel .odd-catalog-row--iconset.is-active .odd-catalog-row__icon{box-shadow:0 0 0 2px #2271b1}',
			'.odd-panel .odd-catalog-row--iconset.is-previewing{border-color:#d97706;box-shadow:0 0 0 2px #f59e0b inset;background:#fffbeb}',
			'.odd-panel .odd-catalog-row--iconset.is-previewing .odd-catalog-row__icon{box-shadow:0 0 0 2px #f59e0b}',
			/* Click-to-preview affordances for scene cards. Amber so
			 * the state is distinct from the committed blue `is-active`. */
			'.odd-panel .odd-card.is-previewing{border-color:#d97706;box-shadow:0 0 0 2px #f59e0b inset}',
			'.odd-panel .odd-card.is-previewing::after{content:"👁";position:absolute;top:6px;right:8px;width:22px;height:22px;border-radius:50%;background:#f59e0b;color:#fff;font-size:12px;line-height:22px;text-align:center;font-weight:700}',
			/* Preview confirmation bar — sticky at the bottom of the
			 * scrollable content pane. Uses a slight lift + amber tint
			 * so it reads as a decision, not a toolbar. */
			'.odd-panel .odd-preview-bar{position:sticky;bottom:-24px;margin:16px -28px -24px;padding:14px 28px;background:#fff;border-top:1px solid #f59e0b;box-shadow:0 -12px 28px -18px rgba(20,14,40,.18);display:flex;align-items:center;gap:16px;z-index:5;animation:odd-preview-slide .22s cubic-bezier(.2,.8,.2,1)}',
			'.odd-panel .odd-preview-bar__eye{width:28px;height:28px;border-radius:50%;background:#f59e0b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}',
			'.odd-panel .odd-preview-bar__text{flex:1 1 auto;min-width:0;font-size:13px;color:#1d2327;line-height:1.4}',
			'.odd-panel .odd-preview-bar__text strong{font-weight:700}',
			'.odd-panel .odd-preview-bar__text em{font-style:normal;color:#92400e;font-weight:600}',
			'.odd-panel .odd-preview-bar__actions{display:flex;gap:8px;flex-shrink:0}',
			'@keyframes odd-preview-slide{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}',
			'@media (prefers-reduced-motion: reduce){.odd-panel .odd-preview-bar{animation:none}}',
			'.odd-panel .odd-setting-preview{min-height:36px;background:#111827!important;color:#fff!important;border-color:#111827!important;box-shadow:0 10px 18px -14px rgba(17,24,39,.8);margin-left:auto}',
			'.odd-panel .odd-setting-preview:hover{background:#1f2937!important;border-color:#1f2937!important;color:#fff!important}',
			'.odd-panel .odd-select{min-height:38px;min-width:190px;padding:6px 34px 6px 10px;border:1px solid #c7ced8;border-radius:10px;font:inherit;font-size:14px;font-weight:600;background:#fff;color:#1d2327}',
			'@media (max-width: 560px){.odd-panel .odd-select{min-width:0;width:100%}.odd-panel .odd-setting-field{width:100%;align-items:flex-start;flex-direction:column}.odd-panel .odd-setting-preview{margin-left:0;width:100%;text-align:center}}',
			'.odd-panel .odd-iconset-mini{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:3px;width:100%;height:100%;padding:6px;box-sizing:border-box}',
			'.odd-panel .odd-iconset-mini img{width:100%;height:100%;object-fit:contain;background:rgba(255,255,255,.85);border-radius:4px;padding:2px;box-sizing:border-box}',
			'.odd-panel .odd-pill{display:inline-block;padding:1px 6px;border-radius:999px;background:#eaf2ff;color:#135e96;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;vertical-align:middle}',
			'.odd-panel .odd-pill--builtin{background:#f0e6ff;color:#5e1b8c}',

			/* ------------------------------------------------------------
			 * ODD Shop — Mac App Store-style chrome.
			 *
			 * Scopes under `.odd-shop` so the redesign never leaks into
			 * other windows or into callers who style `.odd-panel` alone.
			 * Overrides a handful of legacy tokens (rail width, spacing,
			 * shelf grids, preview bar) without touching the semantic
			 * markup — cards, switches and the About hero all inherit.
			 * ------------------------------------------------------------ */
			/* Tokens. ink-3 was #6e6e73 (Apple secondary label) but at
			 * 11px on white the contrast came out 4.7:1 which felt
			 * washed-out next to the shop\'s saturated cards; bumped
			 * to #5d5d62 for a comfortable 5.7:1. ink-2 stays close
			 * to label-secondary for body copy. */
			'.odd-panel.odd-shop{--odd-shop-bg:#f5f5f7;--odd-shop-surface:#fff;--odd-shop-rail-bg:rgba(247,247,249,0.85);--odd-shop-border:rgba(60,60,67,0.14);--odd-shop-border-strong:rgba(60,60,67,0.22);--odd-shop-ink:#1d1d1f;--odd-shop-ink-2:#3a3a3d;--odd-shop-ink-3:#5d5d62;--odd-shop-accent:#0071e3;--odd-shop-accent-2:#5856d6;--odd-shop-radius:14px;--odd-shop-radius-lg:20px}',
			'.odd-panel.odd-shop{color:var(--odd-shop-ink)}',

			/* Top bar. Spans columns 1 / -1 so it caps the entire frame.
			 * Inset top highlight + 1px ink border at the bottom give
			 * it the "chrome-under-glass" feel of the macOS app store. */
			'.odd-panel.odd-shop .odd-shop__topbar{grid-column:1/-1;display:grid;grid-template-columns:minmax(220px,auto) 1fr;align-items:center;gap:16px;padding:10px 22px;min-height:56px;background:linear-gradient(180deg,#fbfbfd 0%,#f1f1f4 100%);border-bottom:1px solid var(--odd-shop-border);box-shadow:inset 0 1px 0 rgba(255,255,255,.6);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px);position:relative;z-index:2}',

			/* Search pill — centers the text input with an inline
			 * glyph; re-renders the active department on input. */
			'.odd-panel.odd-shop .odd-shop__search{display:flex;align-items:center;gap:8px;justify-self:center;width:100%;max-width:380px;padding:7px 14px;border-radius:999px;background:#fff;border:1px solid var(--odd-shop-border-strong);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 1px 2px rgba(0,0,0,.03);transition:border-color .14s ease,box-shadow .14s ease}',
			'.odd-panel.odd-shop .odd-shop__search:focus-within{border-color:var(--odd-shop-accent);box-shadow:0 0 0 3px rgba(0,113,227,.16)}',
			'.odd-panel.odd-shop .odd-shop__search-glyph{color:var(--odd-shop-ink-3);font-size:14px;line-height:1;flex-shrink:0}',
			'.odd-panel.odd-shop .odd-shop__search-input{flex:1 1 auto;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:13px;color:var(--odd-shop-ink);padding:3px 0}',
			'.odd-panel.odd-shop .odd-shop__search-input::placeholder{color:var(--odd-shop-ink-3)}',
			'.odd-panel.odd-shop .odd-shop__search-input::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none;width:12px;height:12px;background:var(--odd-shop-ink-3);-webkit-mask:radial-gradient(circle,currentColor 55%,transparent 60%);mask:radial-gradient(circle,currentColor 55%,transparent 60%);border-radius:50%;cursor:pointer}',
			'.odd-panel.odd-shop .odd-shop__brand{display:flex;align-items:center;gap:12px}',
			'.odd-panel.odd-shop .odd-shop__brand-mark{width:32px;height:32px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:17px;background:linear-gradient(135deg,#ff3d9a 0%,#6a5cff 55%,#00d1b2 100%);color:#fff;box-shadow:0 6px 14px -6px rgba(106,92,255,.6),0 1px 0 rgba(255,255,255,.4) inset}',
			'.odd-panel.odd-shop .odd-shop__brand-text{display:flex;flex-direction:column;line-height:1.1;min-width:0}',
			'.odd-panel.odd-shop .odd-shop__brand-text strong{font-size:14px;font-weight:700;letter-spacing:-.01em;color:var(--odd-shop-ink)}',
			'.odd-panel.odd-shop .odd-shop__brand-text span{font-size:11px;color:var(--odd-shop-ink-3);letter-spacing:.02em}',

			/* Rail — translucent panel on the left, similar in feel to
			 * the App Store sidebar. Buttons keep the `.odd-panel__nav`
			 * base class so the old click target semantics (data-section)
			 * still work; we just layer MAS styling on top. */
			'.odd-panel.odd-shop .odd-shop__rail{background:var(--odd-shop-rail-bg);border-right:1px solid var(--odd-shop-border);padding:18px 12px 14px;display:flex;flex-direction:column;gap:4px;overflow:auto;-webkit-backdrop-filter:saturate(1.4) blur(18px);backdrop-filter:saturate(1.4) blur(18px)}',
			'.odd-panel.odd-shop .odd-shop__rail-heading{padding:4px 10px 10px;font-size:11px;font-weight:700;color:var(--odd-shop-ink-3);text-transform:uppercase;letter-spacing:.08em}',
			'.odd-panel.odd-shop .odd-shop__rail-item{all:unset;display:grid;grid-template-columns:28px 1fr;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;color:var(--odd-shop-ink-2);transition:background .14s ease,color .14s ease,transform .14s ease}',
			'.odd-panel.odd-shop .odd-shop__rail-item:hover{background:rgba(0,0,0,.045);color:var(--odd-shop-ink)}',
			'.odd-panel.odd-shop .odd-shop__rail-item:focus-visible{outline:3px solid var(--odd-shop-accent);outline-offset:2px}',
			'.odd-panel.odd-shop .odd-shop__rail-item.is-active{background:linear-gradient(180deg,#1d8cff 0%,#006cdd 100%);color:#fff;box-shadow:0 6px 14px -8px rgba(0,113,227,.8),0 1px 0 rgba(255,255,255,.3) inset}',
			'.odd-panel.odd-shop .odd-shop__rail-item.is-active .odd-shop__rail-label span{color:rgba(255,255,255,.82)}',
			'.odd-panel.odd-shop .odd-shop__rail-glyph{width:28px;height:28px;border-radius:9px;background:rgba(0,0,0,.06);display:inline-flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}',
			'.odd-panel.odd-shop .odd-shop__rail-item.is-active .odd-shop__rail-glyph{background:rgba(255,255,255,.22);color:#fff}',
			'.odd-panel.odd-shop .odd-shop__rail-label{display:flex;flex-direction:column;min-width:0;line-height:1.2;gap:1px}',
			'.odd-panel.odd-shop .odd-shop__rail-label strong{font-weight:600;font-size:13px}',
			'.odd-panel.odd-shop .odd-shop__rail-label span{font-size:11px;color:var(--odd-shop-ink-3);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
			'.odd-panel.odd-shop .odd-shop__rail-foot{margin-top:auto;padding:10px 12px 4px;font-size:11px;color:var(--odd-shop-ink-3);letter-spacing:.02em;font-variant-numeric:tabular-nums}',

			/* Content pane — larger padding + subtle surface so the
			 * shelves feel like they float on the store background. */
			'.odd-panel.odd-shop .odd-shop__content{padding:32px 40px 0;overflow:auto;min-width:0;background:var(--odd-shop-bg)}',

			/* Department header — eyebrow label above an outsized title,
			 * matching the App Store department pages ("Apps We Love"). */
			'.odd-panel.odd-shop .odd-shop__dept{padding-bottom:36px}',
			'.odd-panel.odd-shop .odd-shop__dept-header{margin:0 0 26px}',
			'.odd-panel.odd-shop .odd-shop__dept-eyebrow{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--odd-shop-accent);margin-bottom:8px}',
			'.odd-panel.odd-shop .odd-section-header h2{font-size:30px;font-weight:700;letter-spacing:-.018em;color:var(--odd-shop-ink);margin:0 0 8px}',
			'.odd-panel.odd-shop .odd-section-header p{color:var(--odd-shop-ink-2);font-size:14px;line-height:1.5;max-width:64ch}',

			/* Hero — the department\'s featured item. Full-bleed card
			 * with a scene preview as background, a dark left-side
			 * scrim for text legibility, and a floating thumbnail at
			 * the bottom-right that echoes the App Store\'s preview. */
			'.odd-panel.odd-shop .odd-shop__hero{position:relative;overflow:hidden;margin:0 0 32px;min-height:248px;border-radius:var(--odd-shop-radius-lg);color:#fff;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:24px;padding:32px 36px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 24px 52px -28px rgba(20,14,40,.35);isolation:isolate;background-color:#1d1d1f}',
			'.odd-panel.odd-shop .odd-shop__hero-bg{position:absolute;inset:0;background-size:cover;background-position:center;filter:saturate(1.05);z-index:-2}',
			/* Scrim is asymmetric: heavy on the left where text lives,
			 * fully transparent on the right where the artwork sits.
			 * Tuned for both bright (Aurora, Origami) and dark scenes;
			 * the title also carries its own text-shadow as belt + braces. */
			/* Hero scrim is the linchpin of hero readability. Earlier
			 * passes used a gentle gradient that worked on dark
			 * backdrops but fell apart on bright editorial art (icons,
			 * apps banners). This pass anchors the left ~half at near-
			 * solid black, keeps the title block in solid territory,
			 * and only releases to transparent past the body content
			 * so the right edge of the hero still shows the artwork.
			 * Two stacked layers: a hard left ink panel + a soft
			 * vertical haze along the bottom for thumbnail bleed. */
			'.odd-panel.odd-shop .odd-shop__hero-scrim{position:absolute;inset:0;background:linear-gradient(98deg,rgba(0,0,0,.94) 0%,rgba(0,0,0,.92) 36%,rgba(0,0,0,.72) 50%,rgba(0,0,0,.32) 66%,rgba(0,0,0,0) 84%),linear-gradient(180deg,rgba(0,0,0,0) 60%,rgba(0,0,0,.35) 100%);z-index:-1}',
			'.odd-panel.odd-shop .odd-shop__hero--icons .odd-shop__hero-scrim,.odd-panel.odd-shop .odd-shop__hero--apps .odd-shop__hero-scrim{background:linear-gradient(98deg,rgba(0,0,0,.92) 0%,rgba(0,0,0,.88) 36%,rgba(0,0,0,.62) 52%,rgba(0,0,0,.22) 70%,rgba(0,0,0,0) 88%),linear-gradient(180deg,rgba(0,0,0,0) 65%,rgba(0,0,0,.35) 100%)}',
			/* Apps banner is a pastel sunrise; soften the white text by
			 * giving it a warm-dark scrim instead of pure black. */
			'.odd-panel.odd-shop .odd-shop__hero--apps .odd-shop__hero-scrim{background:linear-gradient(95deg,rgba(40,8,28,.7) 0%,rgba(40,8,28,.42) 32%,rgba(40,8,28,.06) 60%,rgba(40,8,28,0) 90%)}',
			'.odd-panel.odd-shop .odd-shop__hero-body{display:flex;flex-direction:column;gap:10px;max-width:58%;min-width:0;position:relative;z-index:1}',
			'.odd-panel.odd-shop .odd-shop__hero-eyebrow{display:inline-block;align-self:flex-start;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.28);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.5)}',
			/* Hero title + subtitle ride a stacked text-shadow that
			 * doubles as a soft halo: a tight 1px shadow nails the
			 * letterforms; a longer 14px shadow softens the edge so
			 * we still get separation from any pixel that bleeds
			 * past the scrim on a really bright preview. */
			'.odd-panel.odd-shop .odd-shop__hero-title{margin:6px 0 0;font-size:40px;font-weight:800;letter-spacing:-.022em;line-height:1.04;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.85),0 2px 14px rgba(0,0,0,.55)}',
			'.odd-panel.odd-shop .odd-shop__hero-sub{margin:0;font-size:15px;line-height:1.5;color:#fff;max-width:48ch;text-shadow:0 1px 2px rgba(0,0,0,.7),0 1px 8px rgba(0,0,0,.45)}',
			'.odd-panel.odd-shop .odd-shop__hero-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}',
			'.odd-panel.odd-shop .odd-shop__hero-btn{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:10px 22px;border-radius:999px;font-size:13px;font-weight:600;letter-spacing:.01em;transition:transform .16s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease,background .16s ease,border-color .16s ease}',
			'.odd-panel.odd-shop .odd-shop__hero-btn--primary{background:#fff;color:#1d1d1f;box-shadow:0 8px 20px -14px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.5) inset}',
			'.odd-panel.odd-shop .odd-shop__hero-btn--primary:hover{transform:translateY(-1px);box-shadow:0 14px 28px -14px rgba(0,0,0,.55),0 1px 0 rgba(255,255,255,.6) inset}',
			'.odd-panel.odd-shop .odd-shop__hero-btn--primary:active{transform:translateY(0)}',
			'.odd-panel.odd-shop .odd-shop__hero-btn--ghost{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.38);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}',
			'.odd-panel.odd-shop .odd-shop__hero-btn--ghost:hover{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.55);transform:translateY(-1px)}',
			'.odd-panel.odd-shop .odd-shop__hero-btn--ghost:active{transform:translateY(0)}',
			'.odd-panel.odd-shop .odd-shop__hero-btn:focus-visible{outline:3px solid rgba(255,255,255,.82);outline-offset:3px}',
			'.odd-panel.odd-shop .odd-shop__hero-btn span{font-size:10px;line-height:1}',
			'.odd-panel.odd-shop .odd-shop__hero-badge{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;background:rgba(255,255,255,.18);color:#fff;font-size:12px;font-weight:700;letter-spacing:.02em;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}',
			'.odd-panel.odd-shop .odd-shop__hero-thumb{width:150px;height:96px;border-radius:12px;overflow:hidden;box-shadow:0 18px 36px -18px rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.22);justify-self:end;align-self:end;background:#222}',
			'.odd-panel.odd-shop .odd-shop__hero-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
			'.odd-panel.odd-shop .odd-shop__hero-thumb--icons{display:flex;align-items:center;justify-content:center;padding:10px;background:rgba(255,255,255,.18)}',
			'.odd-panel.odd-shop .odd-shop__hero-quartet{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6px;width:100%;height:100%}',
			'.odd-panel.odd-shop .odd-shop__hero-quartet img{width:100%;height:100%;object-fit:contain;background:rgba(255,255,255,.9);border-radius:8px;padding:6px;box-sizing:border-box}',

			/* Category quilt — gradient franchise tiles that jump
			 * to their shelf. Two columns on wide, single on narrow. */
			'.odd-panel.odd-shop .odd-shop__quilt{margin:0 0 32px}',
			'.odd-panel.odd-shop .odd-shop__quilt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}',
			'.odd-panel.odd-shop .odd-shop__quilt-tile{all:unset;cursor:pointer;position:relative;display:flex;flex-direction:column;justify-content:flex-end;min-height:120px;padding:18px 20px;border-radius:var(--odd-shop-radius);color:#fff;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04),0 14px 32px -22px rgba(20,14,40,.38);transition:transform .16s ease,box-shadow .16s ease}',
			'.odd-panel.odd-shop .odd-shop__quilt-tile::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 0%,rgba(0,0,0,0) 35%,rgba(0,0,0,.32) 100%);pointer-events:none}',
			// Category artwork — full-bleed SVG decoration behind the
			// name + count, cropped to the right half of the tile via
			// preserveAspectRatio="xMaxYMid slice". Transitions gently
			// on hover to hint at interactivity.
			'.odd-panel.odd-shop .odd-shop__quilt-art{position:absolute;inset:0;pointer-events:none;opacity:.88;transition:opacity .18s ease,transform .22s ease;z-index:0}',
			'.odd-panel.odd-shop .odd-shop__quilt-art svg{width:100%;height:100%;display:block}',
			'.odd-panel.odd-shop .odd-shop__quilt-tile:hover .odd-shop__quilt-art{opacity:1;transform:scale(1.04)}',
			// Subtle "→" arrow hint that animates in on hover, signaling
			// "this tile takes you somewhere". z-index:1 to sit over the scrim.
			'.odd-panel.odd-shop .odd-shop__quilt-tile::before{content:"→";position:absolute;top:16px;right:18px;z-index:1;font-size:18px;font-weight:700;color:#fff;opacity:0;transform:translateX(-4px);transition:opacity .16s ease,transform .16s ease;text-shadow:0 1px 3px rgba(0,0,0,.35)}',
			'.odd-panel.odd-shop .odd-shop__quilt-tile:hover{transform:translateY(-2px);box-shadow:0 2px 4px rgba(0,0,0,.06),0 20px 40px -22px rgba(20,14,40,.45)}',
			'.odd-panel.odd-shop .odd-shop__quilt-tile:hover::before,.odd-panel.odd-shop .odd-shop__quilt-tile:focus-visible::before{opacity:.92;transform:translateX(0)}',
			'.odd-panel.odd-shop .odd-shop__quilt-tile:focus-visible{outline:3px solid var(--odd-shop-accent);outline-offset:3px}',
			'.odd-panel.odd-shop .odd-shop__quilt-name{position:relative;z-index:1;font-size:22px;font-weight:800;letter-spacing:-.015em;line-height:1.05;text-shadow:0 2px 8px rgba(0,0,0,.28),0 1px 2px rgba(0,0,0,.18)}',
			'.odd-panel.odd-shop .odd-shop__quilt-count{position:relative;z-index:1;margin-top:6px;font-size:12px;font-weight:700;letter-spacing:.02em;color:#fff;font-variant-numeric:tabular-nums;text-shadow:0 1px 4px rgba(0,0,0,.32),0 1px 1px rgba(0,0,0,.22)}',

			/* "Reset to default" row — only renders when a custom icon
			 * set is committed. Sits between the hero and the quilt
			 * so users always have an obvious way back to stock. */
			'.odd-panel.odd-shop .odd-shop__reset-row{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:0 0 24px;padding:12px 16px;border-radius:var(--odd-shop-radius);background:linear-gradient(180deg,#f5f9ff,#eef4ff);border:1px solid rgba(0,113,227,.22)}',
			'.odd-panel.odd-shop .odd-shop__reset-left{display:flex;align-items:center;gap:12px;min-width:0}',
			'.odd-panel.odd-shop .odd-shop__reset-icon{flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:#fff;color:var(--odd-shop-accent);display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;box-shadow:0 4px 10px -6px rgba(0,113,227,.5)}',
			'.odd-panel.odd-shop .odd-shop__reset-text{font-size:13px;font-weight:500;color:var(--odd-shop-ink-2)}',
			'.odd-panel.odd-shop .odd-shop__reset-btn{all:unset;cursor:pointer;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.01em;background:#fff;color:var(--odd-shop-accent);border:1px solid rgba(0,113,227,.32);transition:background .14s ease,border-color .14s ease}',
			'.odd-panel.odd-shop .odd-shop__reset-btn:hover{background:rgba(0,113,227,.1);border-color:rgba(0,113,227,.5)}',
			'.odd-panel.odd-shop .odd-shop__reset-btn:focus-visible{outline:3px solid var(--odd-shop-accent);outline-offset:2px}',

			/* Shelves — franchise row with an anchor-style title + count
			 * pill and a horizontally-scrolling track beneath.
			 * A tiny fade-up-on-enter reads as "this pane just loaded"
			 * without being showy; dropped under reduced-motion. */
			'.odd-panel.odd-shop .odd-shop__shelf{margin:0 0 36px;scroll-margin-top:16px;animation:odd-shop-rise .38s cubic-bezier(.2,.8,.2,1) both}',
			'.odd-panel.odd-shop .odd-shop__shelf:last-child{margin-bottom:48px}',
			'.odd-panel.odd-shop .odd-shop__shelf-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin:0 0 16px}',
			'.odd-panel.odd-shop .odd-shop__shelf-title{margin:0;font-size:19px;font-weight:700;letter-spacing:-.012em;color:var(--odd-shop-ink)}',
			'.odd-panel.odd-shop .odd-shop__shelf-count{font-size:11px;color:var(--odd-shop-ink-3);font-weight:700;letter-spacing:.02em;font-variant-numeric:tabular-nums;padding:3px 10px;border-radius:999px;background:rgba(60,60,67,.08);text-transform:uppercase}',
			'@keyframes odd-shop-rise{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}',
			'@media (prefers-reduced-motion: reduce){.odd-panel.odd-shop .odd-shop__shelf{animation:none}}',

			/* Shelf tracks — horizontal scroller with snap so drag
			 * gestures stop on a card boundary. Extra right padding
			 * leaves the last card breathing room against the pane. */
			'.odd-panel.odd-shop .odd-shop__shelf-track{display:flex;gap:14px;overflow-x:auto;overflow-y:visible;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:4px 4px 14px;margin:-4px -4px 0;scrollbar-width:none}',
			'.odd-panel.odd-shop .odd-shop__shelf-track::-webkit-scrollbar{height:0;display:none}',
			'.odd-panel.odd-shop .odd-shop__shelf-track--tiles > .odd-shop__tile{flex:0 0 224px;scroll-snap-align:start}',
			'.odd-panel.odd-shop .odd-shop__shelf-track--list > .odd-catalog-row{flex:0 0 320px;max-width:360px;scroll-snap-align:start}',

			/* Slider shell — relative box that anchors the prev/next
			 * pills on top of the horizontally-scrolling track. The
			 * native scroll still drives motion; the buttons just
			 * nudge it by ~one card width. Buttons fade out at either
			 * end and hide entirely when the track isn\'t overflowing,
			 * so short shelves (1–2 cards) stay clean.
			 */
			'.odd-panel.odd-shop .odd-shop__slider{position:relative}',
			'.odd-panel.odd-shop .odd-shop__slider-btn{all:unset;position:absolute;top:50%;transform:translateY(-50%);z-index:3;width:36px;height:36px;border-radius:999px;background:rgba(255,255,255,.96);border:1px solid var(--odd-shop-border-strong);display:none;align-items:center;justify-content:center;color:var(--odd-shop-ink);cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.08),0 14px 28px -18px rgba(20,14,40,.4);transition:opacity .18s ease,transform .18s ease,background .18s ease,box-shadow .18s ease,color .18s ease;-webkit-backdrop-filter:saturate(1.4) blur(10px);backdrop-filter:saturate(1.4) blur(10px)}',
			'.odd-panel.odd-shop .odd-shop__slider-btn--prev{left:-14px}',
			'.odd-panel.odd-shop .odd-shop__slider-btn--next{right:-14px}',
			'.odd-panel.odd-shop .odd-shop__slider.is-overflowing .odd-shop__slider-btn{display:flex}',
			'.odd-panel.odd-shop .odd-shop__slider.is-start .odd-shop__slider-btn--prev{opacity:0;pointer-events:none;transform:translateY(-50%) scale(.85)}',
			'.odd-panel.odd-shop .odd-shop__slider.is-end .odd-shop__slider-btn--next{opacity:0;pointer-events:none;transform:translateY(-50%) scale(.85)}',
			'.odd-panel.odd-shop .odd-shop__slider-btn:hover{background:#fff;color:var(--odd-shop-accent);transform:translateY(-50%) scale(1.08);box-shadow:0 6px 14px rgba(0,0,0,.12),0 18px 32px -18px rgba(20,14,40,.5)}',
			'.odd-panel.odd-shop .odd-shop__slider-btn:active{transform:translateY(-50%) scale(.96)}',
			'.odd-panel.odd-shop .odd-shop__slider-btn:focus-visible{outline:3px solid var(--odd-shop-accent);outline-offset:2px}',
			'@media (prefers-reduced-motion: reduce){.odd-panel.odd-shop .odd-shop__slider-btn{transition:none}}',

			/* Tiles — roughly square MAS-style app cards. The button
			 * role keeps keyboard activation working; the inner pill
			 * stops propagation so it doesn\'t double-toggle. */
			'.odd-panel.odd-shop .odd-shop__tile{all:unset;display:flex;flex-direction:column;cursor:pointer;border-radius:var(--odd-shop-radius);background:#fff;border:1px solid var(--odd-shop-border);overflow:hidden;position:relative;transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease}',
			'.odd-panel.odd-shop .odd-shop__tile:hover{transform:translateY(-2px);border-color:var(--odd-shop-border-strong);box-shadow:0 18px 36px -24px rgba(20,14,40,.4)}',
			'.odd-panel.odd-shop .odd-shop__tile:focus-visible{outline:3px solid var(--odd-shop-accent);outline-offset:2px}',
			'.odd-panel.odd-shop .odd-shop__tile.is-active{border-color:var(--odd-shop-accent);box-shadow:0 0 0 2px var(--odd-shop-accent) inset}',
			'.odd-panel.odd-shop .odd-shop__tile.is-previewing{border-color:#d97706;box-shadow:0 0 0 2px #f59e0b inset}',
			'.odd-panel.odd-shop .odd-shop__tile-thumb{position:relative;aspect-ratio:16/10;width:100%;background:#1d1d1f;overflow:hidden}',
			'.odd-panel.odd-shop .odd-shop__tile-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
			'.odd-panel.odd-shop .odd-shop__tile-badge{position:absolute;top:8px;left:8px;display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.94);color:var(--odd-shop-accent);font-size:10px;font-weight:700;letter-spacing:.04em;box-shadow:0 4px 10px -4px rgba(0,0,0,.4)}',
			'.odd-panel.odd-shop .odd-shop__tile-meta{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;padding:13px 14px 15px}',
			'.odd-panel.odd-shop .odd-shop__tile-text{min-width:0;display:flex;flex-direction:column;gap:3px;overflow:hidden}',
			'.odd-panel.odd-shop .odd-shop__tile-title{font-size:14px;font-weight:600;color:var(--odd-shop-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
			'.odd-panel.odd-shop .odd-shop__tile-sub{font-size:11px;color:var(--odd-shop-ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
			'.odd-panel.odd-shop .odd-shop__tile-pill{flex-shrink:0;padding:6px 15px;border-radius:999px;background:rgba(0,113,227,.12);color:var(--odd-shop-accent);font-size:11px;font-weight:700;letter-spacing:.02em}',
			'.odd-panel.odd-shop .odd-shop__tile:hover .odd-shop__tile-pill{background:rgba(0,113,227,.18)}',
			'.odd-panel.odd-shop .odd-shop__tile.is-active .odd-shop__tile-pill{background:var(--odd-shop-accent);color:#fff}',
			'.odd-panel.odd-shop .odd-shop__tile.is-previewing .odd-shop__tile-pill{background:#fde68a;color:#7c3a00}',

			/* Empty-results state used when search filters every item.
			 * Centered stack — icon, title, subtitle — on a dashed
			 * surface so users immediately see "this is intentionally
			 * blank" rather than "something broke". */
			'.odd-panel.odd-shop .odd-shop__empty{padding:56px 16px 60px;text-align:center;color:var(--odd-shop-ink-3);border:1px dashed var(--odd-shop-border-strong);border-radius:var(--odd-shop-radius-lg);background:#fff}',
			'.odd-panel.odd-shop .odd-shop__empty-icon{font-size:34px;line-height:1;margin-bottom:14px;opacity:.75}',
			'.odd-panel.odd-shop .odd-shop__empty-title{font-size:17px;font-weight:700;color:var(--odd-shop-ink);margin-bottom:6px;letter-spacing:-.01em}',
			'.odd-panel.odd-shop .odd-shop__empty-sub{font-size:13px;max-width:34ch;margin:0 auto}',

			/* Legacy card + catalog rows inherit the old styling when
			 * they surface outside a shelf (About hero, Apps section). */
			'.odd-panel.odd-shop .odd-card{border-radius:var(--odd-shop-radius);border-color:var(--odd-shop-border);background:#fff}',
			'.odd-panel.odd-shop .odd-card__title{font-size:14px}',
			'.odd-panel.odd-shop .odd-card__sub{font-size:11px;color:var(--odd-shop-ink-3)}',

			/* Settings cards keep their shape but pick up the shop palette. */
			'.odd-panel.odd-shop .odd-wallpaper-settings{margin:0 0 22px}',
			'.odd-panel.odd-shop .odd-setting-card{border-radius:var(--odd-shop-radius);border-color:var(--odd-shop-border);background:linear-gradient(180deg,#fff 0%,#fafafd 100%)}',
			'.odd-panel.odd-shop .odd-setting-card--screensaver{background:linear-gradient(135deg,#ffffff 0%,#f4f6fc 50%,#fff6e6 100%)}',
			'.odd-panel.odd-shop .odd-switch-row input[type="checkbox"]:checked + .odd-switch{background:var(--odd-shop-accent);box-shadow:0 8px 20px -14px rgba(0,113,227,.7)}',

			/* Catalog rows (icon sets + app catalog) feel more "store-shelf"
			 * with a soft lift on hover so the row reads as "tappable
			 * surface" instead of "static list item". */
			'.odd-panel.odd-shop .odd-catalog-row{border-radius:var(--odd-shop-radius);border-color:var(--odd-shop-border);background:#fff;transition:transform .14s cubic-bezier(.2,.8,.2,1),border-color .14s ease,box-shadow .16s ease}',
			'.odd-panel.odd-shop .odd-catalog-row:hover{transform:translateY(-1px);border-color:var(--odd-shop-border-strong);box-shadow:0 14px 28px -22px rgba(20,14,40,.35)}',
			'.odd-panel.odd-shop .odd-catalog-row--iconset.is-active{border-color:var(--odd-shop-accent);box-shadow:0 0 0 1px var(--odd-shop-accent) inset,0 14px 28px -22px rgba(0,113,227,.3)}',

			/* Primary pills use the shop blue. "Preview" stays legacy-styled
			 * so the amber preview state still reads as "staging", not "live". */
			'.odd-panel.odd-shop .odd-apps-btn--primary{background:var(--odd-shop-accent);border-color:var(--odd-shop-accent)}',
			'.odd-panel.odd-shop .odd-apps-btn--primary:hover{background:#0a66cf;border-color:#0a66cf}',
			'.odd-panel.odd-shop .odd-apps-btn--pill{border-radius:999px;font-weight:600}',

			/* Preview bar — floating pill anchored to the bottom-right
			 * of the content pane. Compact, rounded, with the eye
			 * glyph + message text + two pill buttons. Replaces the
			 * legacy full-width "sticky toolbar" look. */
			'.odd-panel.odd-shop .odd-preview-bar{position:sticky;bottom:16px;margin:16px 0 0 auto;padding:10px 14px 10px 16px;background:rgba(255,255,255,.96);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px);border:1px solid var(--odd-shop-border-strong);border-radius:999px;box-shadow:0 18px 40px -22px rgba(20,14,40,.4),0 2px 4px rgba(0,0,0,.04);display:flex;align-items:center;gap:12px;width:fit-content;max-width:min(640px,calc(100% - 16px));z-index:5;animation:odd-shop-preview-in .22s cubic-bezier(.2,.8,.2,1)}',
			'.odd-panel.odd-shop .odd-preview-bar__eye{width:24px;height:24px;border-radius:999px;background:var(--odd-shop-accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}',
			'.odd-panel.odd-shop .odd-preview-bar__text{font-size:12px;color:var(--odd-shop-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
			'.odd-panel.odd-shop .odd-preview-bar__text em{font-style:normal;font-weight:700;color:var(--odd-shop-ink)}',
			'.odd-panel.odd-shop .odd-preview-bar__actions{gap:6px}',
			'.odd-panel.odd-shop .odd-preview-bar .odd-apps-btn{padding:5px 14px;font-size:12px}',
			'@keyframes odd-shop-preview-in{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}',
			'@media (prefers-reduced-motion: reduce){.odd-panel.odd-shop .odd-preview-bar{animation:none}}',

			/* About hero gets a bit more breathing room against the new
			 * content padding. Negative margins stay wired through. */
			'.odd-panel.odd-shop .odd-about{margin:-28px -36px 0;padding:52px 36px 44px}',

			/* Apps catalog lives inside an implicit shelf — add matching
			 * surface styling + subheads so it doesn't visually orphan. */
			'.odd-panel.odd-shop .odd-apps-subhead{font-size:11px;letter-spacing:.08em;color:var(--odd-shop-ink-3);margin:24px 0 10px}',
			'.odd-panel.odd-shop .odd-apps-upload{border-radius:var(--odd-shop-radius);border-color:var(--odd-shop-border-strong);background:#fff}',
			'.odd-panel.odd-shop .odd-apps-upload.is-dragover{border-color:var(--odd-shop-accent);background:#eef5ff}',

			/* Widgets department — gradient thumbnails with a giant
			 * emoji glyph instead of painted artwork (widgets are
			 * code-only, no ship-side textures). Hero reuses the same
			 * trick: a translucent oversized glyph with a gentle bob
			 * animation in place of a WebP. The animation is purely
			 * decorative so it drops out under reduced-motion. */
			'.odd-panel.odd-shop .odd-shop__hero--widgets{background:linear-gradient(135deg,#1f1f2d 0%,#3b2fa0 100%)}',
			'.odd-panel.odd-shop .odd-shop__hero--widgets .odd-shop__hero-scrim{background:linear-gradient(98deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.58) 36%,rgba(0,0,0,.3) 58%,rgba(0,0,0,0) 82%),linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(0,0,0,.32) 100%)}',
			'.odd-panel.odd-shop .odd-shop__hero-glyph{position:absolute;top:50%;right:6%;transform:translateY(-50%);font-size:clamp(130px,26vw,240px);line-height:1;opacity:.58;filter:drop-shadow(0 16px 34px rgba(0,0,0,.38));pointer-events:none;z-index:0;animation:odd-shop-bob 7s ease-in-out infinite;will-change:transform}',
			'@keyframes odd-shop-bob{0%,100%{transform:translateY(-50%)}50%{transform:translateY(calc(-50% - 10px))}}',
			'@media (prefers-reduced-motion: reduce){.odd-panel.odd-shop .odd-shop__hero-glyph{animation:none}}',

			/* Widget cards — tile shell with a gradient top panel and
			 * a stacked meta+action layout. Override the shared tile
			 * meta grid so the action pill sits on its own row. The
			 * inner shine overlay + drop-shadow on the glyph give the
			 * thumb a "molded sticker" feel instead of flat gradient. */
			'.odd-panel.odd-shop .odd-shop__tile--widget{display:flex;flex-direction:column}',
			'.odd-panel.odd-shop .odd-shop__tile-thumb--widget{display:flex;align-items:center;justify-content:center;aspect-ratio:16/10;background:#1d1d1f}',
			'.odd-panel.odd-shop .odd-shop__tile-glyph{font-size:76px;line-height:1;filter:drop-shadow(0 10px 22px rgba(0,0,0,.35));transition:transform .24s cubic-bezier(.2,.8,.2,1)}',
			'.odd-panel.odd-shop .odd-shop__tile--widget:hover .odd-shop__tile-glyph{transform:scale(1.06) translateY(-2px)}',
			'.odd-panel.odd-shop .odd-shop__tile-shine{position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 90% at 15% 0%,rgba(255,255,255,.32) 0%,rgba(255,255,255,0) 55%),linear-gradient(180deg,rgba(255,255,255,.08) 0%,rgba(0,0,0,.18) 100%)}',
			'.odd-panel.odd-shop .odd-shop__tile-chip{position:absolute;top:10px;left:10px;display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 8px;border-radius:999px;background:rgba(255,255,255,.96);color:var(--odd-shop-accent);font-size:10px;font-weight:700;letter-spacing:.04em;box-shadow:0 6px 14px -6px rgba(0,0,0,.45);z-index:1}',
			'.odd-panel.odd-shop .odd-shop__tile-chip-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 2px rgba(34,197,94,.22)}',
			'.odd-panel.odd-shop .odd-shop__tile--widget .odd-shop__tile-meta{display:flex;flex-direction:column;gap:4px;padding:14px 16px 8px;grid-template-columns:none}',
			'.odd-panel.odd-shop .odd-shop__tile--widget .odd-shop__tile-title{white-space:normal;overflow:visible;text-overflow:clip;font-size:15px}',
			'.odd-panel.odd-shop .odd-shop__tile--widget .odd-shop__tile-sub{white-space:normal;overflow:visible;text-overflow:clip;line-height:1.45;color:var(--odd-shop-ink-3)}',
			'.odd-panel.odd-shop .odd-shop__tile-actions{padding:4px 16px 16px;display:flex;justify-content:flex-start}',

			/* Tile buttons — shared primary / ghost pill language with
			 * the hero buttons so the two layouts feel like one
			 * interaction system. Primary = accent fill, ghost = white
			 * w/ border to signal the inverse (remove) action. */
			'.odd-panel.odd-shop .odd-shop__tile-btn{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:7px 18px;border-radius:999px;border:1px solid transparent;font-size:12px;font-weight:600;letter-spacing:.01em;transition:transform .14s cubic-bezier(.2,.8,.2,1),background .16s ease,border-color .16s ease,box-shadow .16s ease}',
			'.odd-panel.odd-shop .odd-shop__tile-btn--primary{background:var(--odd-shop-accent);color:#fff;box-shadow:0 6px 14px -8px rgba(0,113,227,.7)}',
			'.odd-panel.odd-shop .odd-shop__tile-btn--primary:hover{background:#0a66cf;transform:translateY(-1px);box-shadow:0 10px 20px -10px rgba(0,113,227,.7)}',
			'.odd-panel.odd-shop .odd-shop__tile-btn--primary:active{transform:translateY(0)}',
			'.odd-panel.odd-shop .odd-shop__tile-btn--ghost{background:#fff;color:var(--odd-shop-ink);border-color:var(--odd-shop-border-strong)}',
			'.odd-panel.odd-shop .odd-shop__tile-btn--ghost:hover{background:#f6f6f8;border-color:#b8b8c2;transform:translateY(-1px)}',
			'.odd-panel.odd-shop .odd-shop__tile-btn--ghost:active{transform:translateY(0)}',
			'.odd-panel.odd-shop .odd-shop__tile-btn:focus-visible{outline:3px solid var(--odd-shop-accent);outline-offset:2px}',
			'.odd-panel.odd-shop .odd-shop__tile--widget.is-active{border-color:var(--odd-shop-accent);box-shadow:0 0 0 1px var(--odd-shop-accent) inset,0 18px 36px -24px rgba(0,113,227,.35)}',

			/* Shared "tip" row — used under the Widgets department today,
			 * available for any department that wants an inline note. */
			'.odd-panel.odd-shop .odd-shop__tip{display:flex;align-items:flex-start;gap:12px;margin:20px 0 0;padding:14px 18px;border-radius:var(--odd-shop-radius);background:linear-gradient(180deg,#fafbff,#f3f6ff);border:1px solid rgba(0,113,227,.18);color:var(--odd-shop-ink-2);font-size:13px;line-height:1.5}',
			'.odd-panel.odd-shop .odd-shop__tip-icon{flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 10px -6px rgba(0,113,227,.4)}',
			'.odd-panel.odd-shop .odd-shop__tip-text{flex:1 1 auto;min-width:0}',

			/* Topbar install pill — sits beside the search field and
			 * lets admins drop a .wp straight into the Shop. */
			'.odd-panel.odd-shop .odd-shop__install{all:unset;display:inline-flex;align-items:center;gap:8px;justify-self:end;padding:7px 14px 7px 12px;border-radius:999px;background:#fff;border:1px solid var(--odd-shop-border-strong);cursor:pointer;color:var(--odd-shop-ink);font-size:12.5px;font-weight:600;transition:border-color .14s ease,background .14s ease,box-shadow .14s ease,transform .14s ease}',
			'.odd-panel.odd-shop .odd-shop__install:hover{border-color:var(--odd-shop-accent);box-shadow:0 6px 14px -10px rgba(0,113,227,.5)}',
			'.odd-panel.odd-shop .odd-shop__install:focus-visible{outline:3px solid var(--odd-shop-accent);outline-offset:2px}',
			'.odd-panel.odd-shop .odd-shop__install.is-busy{opacity:.85;pointer-events:none}',
			'.odd-panel.odd-shop .odd-shop__install.is-busy .odd-shop__install-glyph{animation:odd-shop-spin .9s linear infinite}',
			'.odd-panel.odd-shop .odd-shop__install-glyph{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:999px;background:linear-gradient(135deg,#ff3d9a 0%,#6a5cff 55%,#00d1b2 100%);color:#fff;font-size:12px;font-weight:700;line-height:1}',
			'@keyframes odd-shop-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',

			/* Per-department "Got a scene of your own?" helper link. */
			'.odd-panel.odd-shop .odd-shop__get-more{display:flex;align-items:center;gap:10px;margin:0 0 20px;padding:12px 16px;border-radius:var(--odd-shop-radius);background:rgba(0,113,227,.06);border:1px dashed rgba(0,113,227,.25);color:var(--odd-shop-ink-2);font-size:12.5px}',
			'.odd-panel.odd-shop .odd-shop__get-more-label{flex:1 1 auto}',
			'.odd-panel.odd-shop .odd-shop__get-more-btn{all:unset;padding:4px 10px;border-radius:999px;background:#fff;border:1px solid var(--odd-shop-border-strong);cursor:pointer;color:var(--odd-shop-accent);font-size:12px;font-weight:600}',
			'.odd-panel.odd-shop .odd-shop__get-more-btn:hover{border-color:var(--odd-shop-accent);background:rgba(0,113,227,.08)}',

			/* Shop-wide drop overlay — only visible while a file is
			 * being dragged over the Shop body. */
			'.odd-panel.odd-shop.is-dropping{position:relative}',
			'.odd-panel.odd-shop.is-dropping::before{content:"";position:absolute;inset:0;z-index:9;pointer-events:none;background:rgba(0,113,227,.12);border:3px dashed var(--odd-shop-accent);border-radius:var(--odd-shop-radius-lg);animation:odd-shop-pulse 1.2s ease-in-out infinite}',
			'.odd-panel.odd-shop.is-dropping::after{content:"Drop to install";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;pointer-events:none;padding:12px 22px;border-radius:999px;background:#fff;color:var(--odd-shop-accent);font-weight:700;font-size:15px;box-shadow:0 18px 40px -16px rgba(0,113,227,.5)}',
			'@keyframes odd-shop-pulse{0%,100%{opacity:.6}50%{opacity:1}}',

			/* Just-installed flash — 2.4s ring around a fresh tile. */
			'.odd-panel.odd-shop .is-just-installed{animation:odd-shop-just 2.4s cubic-bezier(.22,.8,.32,1) both}',
			'@keyframes odd-shop-just{0%{box-shadow:0 0 0 0 rgba(0,113,227,0),0 0 0 2px var(--odd-shop-accent) inset}20%{box-shadow:0 0 0 8px rgba(0,113,227,.18),0 0 0 2px var(--odd-shop-accent) inset}100%{box-shadow:0 0 0 0 rgba(0,113,227,0)}}',
			'@media (prefers-reduced-motion: reduce){.odd-panel.odd-shop .is-just-installed{animation:none;box-shadow:0 0 0 2px var(--odd-shop-accent) inset}}',

			/* One-time JS-execution confirmation banner for scene +
			 * widget installs. Non-modal: sits at the top of the
			 * Shop body, gives [Cancel] [Install], remembered on
			 * window.__odd.store. */
			'.odd-panel.odd-shop .odd-shop__js-confirm{margin:0 0 20px;padding:16px 18px;border-radius:var(--odd-shop-radius);background:linear-gradient(180deg,#fff7ed,#fff1e0);border:1px solid rgba(217,119,6,.32);color:var(--odd-shop-ink)}',
			'.odd-panel.odd-shop .odd-shop__js-confirm strong{display:block;margin:0 0 4px;font-size:14px;font-weight:700}',
			'.odd-panel.odd-shop .odd-shop__js-confirm p{margin:0 0 12px;font-size:13px;color:var(--odd-shop-ink-2);line-height:1.45}',
			'.odd-panel.odd-shop .odd-shop__js-confirm-actions{display:flex;justify-content:flex-end;gap:8px}',
			'.odd-panel.odd-shop .odd-shop__js-confirm-btn{all:unset;padding:7px 14px;border-radius:999px;border:1px solid var(--odd-shop-border-strong);background:#fff;cursor:pointer;color:var(--odd-shop-ink);font-size:12.5px;font-weight:600}',
			'.odd-panel.odd-shop .odd-shop__js-confirm-btn:hover{border-color:var(--odd-shop-ink-2)}',
			'.odd-panel.odd-shop .odd-shop__js-confirm-btn.is-primary{background:var(--odd-shop-accent);border-color:var(--odd-shop-accent);color:#fff}',
			'.odd-panel.odd-shop .odd-shop__js-confirm-btn.is-primary:hover{background:#005bbf;border-color:#005bbf}',
			'.odd-panel.odd-shop .odd-shop__js-confirm-btn:focus-visible{outline:3px solid var(--odd-shop-accent);outline-offset:2px}',

			/* Rail collapses the tagline on narrow widths so the chrome
			 * still reads at the WP Desktop Mode minimum of 720×480. */
			'@media (max-width:820px){',
			'  .odd-panel.odd-shop{grid-template-columns:64px 1fr}',
			'  .odd-panel.odd-shop .odd-shop__rail{padding:14px 6px}',
			'  .odd-panel.odd-shop .odd-shop__rail-heading{display:none}',
			'  .odd-panel.odd-shop .odd-shop__rail-label{display:none}',
			'  .odd-panel.odd-shop .odd-shop__rail-item{grid-template-columns:1fr;justify-items:center}',
			'  .odd-panel.odd-shop .odd-shop__rail-foot{display:none}',
			'  .odd-panel.odd-shop .odd-shop__content{padding:20px 22px 0}',
			'  .odd-panel.odd-shop .odd-about{margin:-20px -22px 0;padding:44px 22px 36px}',
			'}',
		].join( '\n' );
		document.head.appendChild( s );
	}
} )();
