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

	var wpI18nOdd = window.wp && window.wp.i18n;
	function __( s ) {
		return ( wpI18nOdd && typeof wpI18nOdd.__ === 'function' ) ? wpI18nOdd.__( s, 'odd' ) : s;
	}

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
		{ id: 'wallpaper', label: __( 'Wallpapers' ), icon: '🖼', tagline: __( 'Live generative scenes' ) },
		{ id: 'icons',     label: __( 'Icon Sets' ),  icon: '🧩', tagline: __( 'Re-skin the dock' ) },
		{ id: 'widgets',   label: __( 'Widgets' ),    icon: '🧷', tagline: __( 'Desktop companions' ) },
		{ id: 'apps',      label: __( 'Apps' ),       icon: '📦', tagline: __( 'Mini apps that just run' ), gated: 'appsEnabled' },
		{ id: 'install',   label: __( 'Install' ),  icon: '⇪', tagline: __( 'Add a .wp bundle' ),        gated: 'canInstall' },
		{ id: 'settings',  label: __( 'Settings' ),  icon: '⚙', tagline: __( 'Shuffle, audio, screensaver' ) },
		{ id: 'about',     label: __( 'About' ),     icon: '👁', tagline: __( 'Credits & chaos' ) },
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
		brandTitle.textContent = __( 'ODD Shop' );
		var brandSub = el( 'span' );
		brandSub.textContent = __( 'Outlandish Desktop Decorator' );
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
		var searchWrap = el( 'label', { class: 'odd-shop__search', 'aria-label': __( 'Search' ) } );
		var searchGlyph = el( 'span', { class: 'odd-shop__search-glyph', 'aria-hidden': 'true' } );
		searchGlyph.textContent = '⌕';
		var searchInput = el( 'input', {
			type: 'search',
			class: 'odd-shop__search-input',
			placeholder: __( 'Search wallpapers, icons, apps…' ),
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
		railHeader.textContent = __( 'Store' );
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
		installShopKeyboard( body, sidebar, buttons, renderSection );

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
			} else if ( id === 'install' ) {
				content.appendChild( renderInstall() );
			} else if ( id === 'settings' ) {
				content.appendChild( renderSettings() );
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
			catalogNote.textContent = 'Curated ODD apps from the remote catalog. Each one downloads on install; nothing ships with the plugin itself.';
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
				installed.textContent = row.update_available ? 'Update available' : 'Installed';
				if ( row.update_available ) {
					installed.classList.add( 'odd-catalog-row__installed--update' );
				}
				actions.appendChild( installed );

				if ( row.update_available ) {
					// Reinstall through the same install-from-catalog route
					// with `allow_update=1`. The server-side handler
					// uninstalls the old bundle first so the universal
					// installer can lay the new files down without the
					// slug-collision guard firing.
					var updateBtn = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--pill odd-apps-btn--primary' } );
					updateBtn.textContent = 'Update';
					updateBtn.addEventListener( 'click', function () {
						updateBtn.disabled = true;
						updateBtn.textContent = 'Updating…';
						setAppsStatus( wrap, 'Updating ' + ( row.name || row.slug ) + '…', 'busy' );
						installFromCatalog( row.slug, { allowUpdate: true } ).then( function ( res ) {
							if ( res && res.ok && res.data && res.data.installed ) {
								setAppsStatus( wrap, 'Updated ' + ( row.name || row.slug ) + '. Reloading…', 'ok' );
								setTimeout( function () { try { window.location.reload(); } catch ( e ) {} }, 600 );
								return;
							}
							updateBtn.disabled = false;
							updateBtn.textContent = 'Update';
							setAppsStatus( wrap, ( res && res.message ) || 'Update failed.', 'error' );
						} );
					} );
					actions.appendChild( updateBtn );
				}
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
		function installFromCatalog( slug, opts ) {
			opts = opts || {};
			var body = { slug: slug };
			if ( opts.allowUpdate ) body.allow_update = 1;
			return fetch( appsBaseUrl() + '/install-from-catalog', {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce':   state.cfg.restNonce || '',
				},
				body: JSON.stringify( body ),
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
				empty.textContent = 'No apps installed yet — install one from the catalog below, or upload a .wp bundle above.';
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
		// helpers (status messaging, routing, etc.) resolve them even
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
				case 'invalid_extension':    return __( 'That file isn\u2019t a .wp bundle.' );
				case 'invalid_zip':          return __( 'That file isn\u2019t a valid ZIP archive.' );
				case 'zip_unavailable':     return __( 'This site is missing the PHP ZipArchive extension \u2014 ask the host to enable it.' );
				case 'too_many_files':      return __( 'Bundle has too many files. The limit is 2000.' );
				case 'too_large':           return __( 'Bundle is too large. Keep it under 25 MB uncompressed.' );
				case 'zip_bomb':            return __( 'Bundle contains a suspicious compression ratio and was rejected.' );
				case 'path_traversal':      return __( 'Bundle contains a path-traversal entry and was rejected.' );
				case 'symlink_in_archive': return __( 'Bundle contains a symlink and was rejected.' );
				case 'forbidden_file_type': return __( 'Bundle contains a server-executable file and was rejected.' );
				case 'missing_manifest':    return __( 'Bundle is missing a manifest.json at the root.' );
				case 'invalid_manifest':    return __( 'Bundle\u2019s manifest.json is not valid JSON.' );
				case 'missing_manifest_field': return __( 'Bundle\u2019s manifest.json is missing a required field.' );
				case 'invalid_slug':        return __( 'Bundle slug must be lowercase letters, numbers, and hyphens.' );
				case 'slug_exists':         return __( 'A bundle with that slug is already installed. Remove the existing one first.' );
				case 'unsupported_type':   return __( 'This ODD version doesn\u2019t know how to install that bundle type.' );
				case 'install_in_progress': return __( 'Another install of this bundle is already in progress.' );
				case 'missing_entry':       return __( 'Bundle is missing the entry file declared in manifest.json.' );
				case 'invalid_entry':       return __( 'Bundle\u2019s entry path is invalid.' );
				case 'missing_preview':     return __( 'Bundle is missing preview.webp.' );
				case 'missing_wallpaper':   return __( 'Bundle is missing wallpaper.webp.' );
				case 'missing_icon':        return __( 'Bundle is missing one of the SVGs it declared.' );
				case 'missing_required_icons': return fallback ? __( fallback ) : __( 'Icon set is missing required keys.' );
				case 'invalid_svg':         return __( 'An SVG in this bundle isn\u2019t well-formed.' );
				case 'rest_too_many_requests': return __( 'Too many requests. Please wait a minute and try again.' );
				case 'extract_mkdir_failed':
				case 'extract_rename_failed':
					return __( 'ODD couldn\u2019t finalise the install. Check wp-content permissions and try again.' );
				default: return fallback ? __( fallback ) : __( 'Install failed.' );
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
			var code    = data.code || ( data.data && data.data.code ) || 'install_failed';
			if ( typeof data.message === 'string' && ! data.code && data.status ) {
				code = 'install_failed';
			}
			var message = errorCopy( code, data.message || ( res && res.message ) );
			toast( message );

			// Leave a breadcrumb on the Apps status rail when the
			// user is on that department, so the message doesn't
			// disappear with the toast.
			var statusWrap = document.querySelector( '[data-odd-apps-status]' );
			if ( statusWrap ) {
				statusWrap.textContent = message;
				statusWrap.setAttribute( 'data-odd-status', 'error' );
			}

			showInstallTroubleshoot( res, message, code, data );
		}

		/**
		 * Non-blocking recovery UI: structured server payload + one-click
		 * diagnostics for GitHub issues (plan item 21).
		 */
		function showInstallTroubleshoot( res, message, code, data ) {
			var root = document.querySelector( '.odd-shop' ) || document.body;
			var old = root.querySelector( '.odd-install-trouble' );
			if ( old ) {
				try { old.parentNode.removeChild( old ); } catch ( e0 ) {}
			}

			var backdrop = el( 'div', {
				class:                 'odd-install-trouble',
				role:                  'dialog',
				'aria-modal':          'true',
				'aria-labelledby':     'odd-trouble-title',
				'data-odd-troubleshoot': '1',
			} );
			var card = el( 'div', { class: 'odd-install-trouble__card' } );
			var title = el( 'h2', { class: 'odd-install-trouble__title', id: 'odd-trouble-title' } );
			title.textContent = __( 'Install failed' );
			var sub = el( 'p', { class: 'odd-install-trouble__lede' } );
			sub.textContent = message;

			var pre = el( 'pre', { class: 'odd-install-trouble__pre' } );
			var payload = {
				code:    code,
				status:  res && res.status,
				message: message,
				body:    data,
			};
			try {
				pre.textContent = JSON.stringify( payload, null, 2 );
			} catch ( e1 ) {
				pre.textContent = String( message );
			}

			var row = el( 'div', { class: 'odd-install-trouble__row' } );
			var closeBtn = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--pill' } );
			closeBtn.textContent = __( 'Close' );
			closeBtn.addEventListener( 'click', function () {
				try { backdrop.parentNode.removeChild( backdrop ); } catch ( e2 ) {}
			} );
			var copyBtn = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--primary odd-apps-btn--pill' } );
			copyBtn.textContent = __( 'Copy diagnostics' );
			copyBtn.addEventListener( 'click', function () {
				var d = window.__odd && window.__odd.diagnostics;
				if ( d && typeof d.copy === 'function' ) {
					copyBtn.disabled = true;
					d.copy().then( function ( ok ) {
						copyBtn.textContent = ok ? __( 'Copied' ) : __( 'Copy failed' );
						setTimeout( function () {
							copyBtn.disabled = false;
							copyBtn.textContent = __( 'Copy diagnostics' );
						}, 2000 );
					} );
					return;
				}
				try {
					navigator.clipboard.writeText( pre.textContent );
					copyBtn.textContent = __( 'Copied' );
				} catch ( e3 ) {
					copyBtn.textContent = __( 'Copy failed' );
				}
			} );
			row.appendChild( closeBtn );
			row.appendChild( copyBtn );

			card.appendChild( title );
			card.appendChild( sub );
			card.appendChild( pre );
			var hintP = el( 'p', { class: 'odd-install-trouble__hint' } );
			hintP.textContent = __( 'Full environment + log ring buffer is copied when diagnostics are available.' );
			card.appendChild( hintP );
			card.appendChild( row );
			backdrop.appendChild( card );
			root.appendChild( backdrop );
			setTimeout( function () { try { closeBtn.focus(); } catch ( e4 ) {} }, 10 );
		}

		/** Keyboard help overlay (/) search focus, ? shortcuts, rail arrows (plan item 20). */
		function installShopKeyboard( body, rail, buttons, renderSection ) {
			var helpOpen = null;
			function isTypingTarget( t ) {
				if ( ! t || ! t.tagName ) return false;
				var tag = t.tagName;
				if ( tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ) return true;
				if ( t.isContentEditable ) return true;
				return false;
			}
			function closeHelp() {
				if ( helpOpen && helpOpen.parentNode ) {
					try { helpOpen.parentNode.removeChild( helpOpen ); } catch ( e ) {}
				}
				helpOpen = null;
			}
			function openHelp() {
				closeHelp();
				var layer = el( 'div', { class: 'odd-kbd-help', role: 'dialog', 'aria-modal': 'true', 'aria-label': __( 'Keyboard shortcuts' ) } );
				var inner = el( 'div', { class: 'odd-kbd-help__card' } );
				var h2t = el( 'h2', { class: 'odd-kbd-help__title' } );
				h2t.textContent = __( 'Keyboard shortcuts' );
				inner.appendChild( h2t );
				var list = el( 'ul', { class: 'odd-kbd-help__list' } );
				var rows = [
					[ '/ ', __( 'Focus search' ) ],
					[ '? ', __( 'Show this help' ) ],
					[ __( 'Escape' ), __( 'Close' ) ],
					[ '\u2191 / \u2193', __( 'Move in the sidebar' ) ],
				];
				for ( var r = 0; r < rows.length; r++ ) {
					var li = el( 'li' );
					var k  = el( 'kbd', { class: 'odd-kbd-help__key' } );
					k.textContent = rows[ r ][ 0 ];
					li.appendChild( k );
					li.appendChild( document.createTextNode( ' ' + rows[ r ][ 1 ] ) );
					list.appendChild( li );
				}
				inner.appendChild( list );
				var done = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--primary odd-apps-btn--pill' } );
				done.textContent = __( 'Got it' );
				done.addEventListener( 'click', closeHelp );
				inner.appendChild( done );
				layer.appendChild( inner );
				layer.addEventListener( 'click', function ( ev ) { if ( ev.target === layer ) closeHelp(); } );
				body.appendChild( layer );
				helpOpen = layer;
				setTimeout( function () { try { done.focus(); } catch ( e2 ) {} }, 10 );
			}

			body.addEventListener( 'keydown', function ( ev ) {
				if ( ev.key === 'Escape' ) {
					closeHelp();
					return;
				}
				if ( isTypingTarget( ev.target ) && ev.key !== 'Escape' ) {
					return;
				}
				if ( ev.key === '?' || ( ev.key === '/' && ev.shiftKey ) ) {
					ev.preventDefault();
					if ( helpOpen ) closeHelp();
					else openHelp();
					return;
				}
				if ( ev.key === '/' ) {
					var sea = document.querySelector( '[data-odd-search]' );
					if ( sea && ev.target !== sea ) {
						ev.preventDefault();
						try { sea.focus(); } catch ( e3 ) {}
					}
					return;
				}
			} );

			rail.setAttribute( 'role', 'navigation' );
			rail.setAttribute( 'aria-label', __( 'Store sections' ) );
			rail.addEventListener( 'keydown', function ( ev ) {
				if ( ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp' ) return;
				var items = rail.querySelectorAll( '.odd-shop__rail-item' );
				if ( ! items || ! items.length ) return;
				var list = Array.prototype.slice.call( items );
				var ix   = list.indexOf( document.activeElement );
				if ( ix < 0 ) return;
				ev.preventDefault();
				var next = ev.key === 'ArrowDown' ? Math.min( list.length - 1, ix + 1 ) : Math.max( 0, ix - 1 );
				try { list[ next ].focus(); } catch ( e4 ) {}
			} );
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

		/**
		 * Render a "Discover" shelf for a content type (scene,
		 * icon-set, widget). Pulls from the server-provided
		 * bundleCatalog pre-baked into window.odd, so first paint
		 * doesn't wait on a REST round-trip. Returns null when the
		 * catalog is empty for that type so the caller can skip
		 * appending an empty header.
		 *
		 * Per-card layout reuses the list-row pattern from the Apps
		 * catalog (avatar + name + description + action pill) since
		 * remote entries ship URLs and descriptions rather than
		 * painted previews.
		 */
		function renderDiscoverShelf( type ) {
			var catalog = ( state.cfg.bundleCatalog || {} );
			var key = ( type === 'icon-set' ) ? 'iconSet' : type;
			var rows = Array.isArray( catalog[ key ] ) ? catalog[ key ] : [];
			if ( ! rows.length ) return null;

			var shelf = el( 'section', { class: 'odd-shop__shelf', 'data-shelf-anchor': 'Discover' } );
			var head  = el( 'div', { class: 'odd-shop__shelf-head' } );
			var title = el( 'h3', { class: 'odd-shop__shelf-title' } );
			title.textContent = 'Discover';
			var count = el( 'span', { class: 'odd-shop__shelf-count' } );
			count.textContent = rows.length + ' from the catalog';
			head.appendChild( title );
			head.appendChild( count );
			shelf.appendChild( head );

			var list = el( 'div', { class: 'odd-catalog-list' } );
			rows.forEach( function ( row ) {
				list.appendChild( renderDiscoverRow( row ) );
			} );
			shelf.appendChild( list );
			return shelf;
		}

		function renderDiscoverRow( row ) {
			var wrap = el( 'div', { class: 'odd-catalog-row' } );
			if ( row.installed ) wrap.classList.add( 'is-installed' );

			var iconWrap = el( 'div', { class: 'odd-catalog-row__icon' } );
			if ( row.icon_url ) {
				iconWrap.appendChild( el( 'img', { src: row.icon_url, alt: '', loading: 'lazy' } ) );
			} else {
				iconWrap.classList.add( 'odd-catalog-row__icon--badge' );
				iconWrap.textContent = ( row.name || row.slug ).slice( 0, 2 ).toUpperCase();
			}
			wrap.appendChild( iconWrap );

			var body = el( 'div', { class: 'odd-catalog-row__body' } );
			var titleRow = el( 'div', { class: 'odd-catalog-row__title' } );
			var name = el( 'span', { class: 'odd-catalog-row__name' } );
			name.textContent = row.name || row.slug;
			titleRow.appendChild( name );
			if ( row.version ) {
				var v = el( 'span', { class: 'odd-catalog-row__version' } );
				v.textContent = 'v' + row.version;
				titleRow.appendChild( v );
			}
			body.appendChild( titleRow );
			if ( row.description ) {
				var desc = el( 'div', { class: 'odd-catalog-row__desc' } );
				desc.textContent = row.description;
				body.appendChild( desc );
			}
			wrap.appendChild( body );

			var actions = el( 'div', { class: 'odd-catalog-row__actions' } );
			if ( row.installed ) {
				var tag = el( 'span', { class: 'odd-catalog-row__installed' } );
				tag.textContent = 'Installed';
				actions.appendChild( tag );
			} else {
				var btn = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--primary odd-apps-btn--pill' } );
				btn.textContent = 'Install';
				btn.addEventListener( 'click', function () {
					installFromBundleCatalog( row, btn );
				} );
				actions.appendChild( btn );
			}
			wrap.appendChild( actions );
			return wrap;
		}

		/**
		 * POST to /odd/v1/bundles/install-from-catalog and funnel
		 * through the same success / failure handlers that the file-
		 * upload path uses, so the UX (highlight, toast, soft reload
		 * for icon sets) is identical regardless of install source.
		 */
		function installFromBundleCatalog( row, btn ) {
			if ( btn ) {
				btn.disabled = true;
				btn.textContent = 'Installing…';
			}
			var url = ( state.cfg.bundleInstallUrl || '' ) ||
				( ( state.cfg.restUrl || '' ).replace( /\/prefs\/?$/, '' ) + '/bundles/install-from-catalog' );
			fetch( url, {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce':   state.cfg.restNonce || '',
				},
				body: JSON.stringify( { slug: row.slug } ),
			} ).then( function ( r ) {
				return r.json().then( function ( data ) {
					return { ok: r.ok, status: r.status, data: data };
				} ).catch( function () {
					return { ok: false, status: r.status, message: 'HTTP ' + r.status };
				} );
			} ).then( function ( res ) {
				if ( res.ok && res.data && res.data.installed ) {
					handleInstallSuccess( res.data );
				} else {
					onInstallFailure( res );
					if ( btn ) {
						btn.disabled = false;
						btn.textContent = 'Install';
					}
				}
			} ).catch( function ( err ) {
				reportError( 'bundles.install-from-catalog', err );
				toast( ( err && err.message ) || 'Network error while installing.' );
				if ( btn ) {
					btn.disabled = false;
					btn.textContent = 'Install';
				}
			} );
		}

		/**
		 * Dedicated "Install" department — one canonical surface
		 * for dropping a .wp archive of any type (app, icon set,
		 * scene, widget) instead of sprinkling "Install from
		 * file…" affordances across every shelf. The topbar
		 * Install pill and the Shop-wide drop overlay still work
		 * from anywhere; this tab just makes the action a
		 * first-class destination with room to explain the format.
		 */
		function renderInstall() {
			var wrap = el( 'div', { class: 'odd-shop__dept odd-shop__dept--install' } );
			wrap.appendChild( sectionHeader(
				'Install a .wp bundle',
				'Drop a .wp archive to add an app, icon set, scene, or widget. One manifest, one format, one install flow — no companion plugins needed. Authors: see the .wp manifest reference for the schema.',
				{ eyebrow: 'ODD · Universal Installer' }
			) );

			// Primary drop zone. Clicking anywhere inside it fires
			// the hidden topbar <input type="file">, which routes
			// through installBundle() like every other entry point.
			var zone = el( 'div', {
				class: 'odd-shop__dropzone',
				'data-odd-install-zone': '1',
				role: 'button',
				tabindex: '0',
				'aria-label': 'Install a .wp bundle',
			} );
			var zoneGlyph = el( 'div', { class: 'odd-shop__dropzone-glyph', 'aria-hidden': 'true' } );
			zoneGlyph.textContent = '⇪';
			var zoneTitle = el( 'div', { class: 'odd-shop__dropzone-title' } );
			zoneTitle.textContent = 'Drop a .wp file here';
			var zoneSub = el( 'div', { class: 'odd-shop__dropzone-sub' } );
			zoneSub.textContent = 'or click to choose one from your computer.';
			var zoneBtn = el( 'button', {
				type: 'button',
				class: 'odd-shop__dropzone-btn',
				'data-odd-install-choose': '1',
			} );
			zoneBtn.textContent = 'Choose .wp file…';
			zone.appendChild( zoneGlyph );
			zone.appendChild( zoneTitle );
			zone.appendChild( zoneSub );
			zone.appendChild( zoneBtn );

			function triggerPicker() {
				var input = document.querySelector( '[data-odd-install-input]' );
				if ( input ) input.click();
			}
			zone.addEventListener( 'click', triggerPicker );
			zone.addEventListener( 'keydown', function ( e ) {
				if ( e.key === 'Enter' || e.key === ' ' ) {
					e.preventDefault();
					triggerPicker();
				}
			} );

			// Local drag highlight — tighter than the Shop-wide
			// overlay so the target is unambiguous when the user
			// is already on this tab.
			zone.addEventListener( 'dragover', function ( e ) {
				if ( ! e.dataTransfer || ! e.dataTransfer.types ) return;
				var types = Array.prototype.slice.call( e.dataTransfer.types );
				if ( types.indexOf( 'Files' ) === -1 ) return;
				e.preventDefault();
				zone.classList.add( 'is-hover' );
			} );
			zone.addEventListener( 'dragleave', function () {
				zone.classList.remove( 'is-hover' );
			} );
			zone.addEventListener( 'drop', function ( e ) {
				zone.classList.remove( 'is-hover' );
				var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[ 0 ];
				if ( ! f ) return;
				if ( ! /\.wp$/i.test( f.name ) ) return;
				e.preventDefault();
				installBundle( f );
			} );
			wrap.appendChild( zone );

			// "What can I install?" — four cards that describe
			// each content type. These aren't actions, they're
			// affordance cues so the user knows the .wp format
			// carries more than just apps.
			var types = [
				{ type: 'app',      label: 'Apps',       icon: '📦', desc: 'Mini apps with their own dock icon and window. Served in a sandboxed frame; never a WordPress admin page.' },
				{ type: 'scene',    label: 'Scenes',     icon: '🖼', desc: 'Live generative wallpapers that paint on top of the WordPress desktop.' },
				{ type: 'icon-set', label: 'Icon Sets',  icon: '🧩', desc: 'Themed SVG packs that re-skin the dock and desktop shortcuts.' },
				{ type: 'widget',   label: 'Widgets',    icon: '🧷', desc: 'Small cards that live on the desktop itself — drag by the title bar to park them.' },
			];
			var grid = el( 'div', { class: 'odd-shop__install-types' } );
			types.forEach( function ( t ) {
				var card = el( 'div', { class: 'odd-shop__install-type' } );
				var g = el( 'span', { class: 'odd-shop__install-type-glyph', 'aria-hidden': 'true' } );
				g.textContent = t.icon;
				var l = el( 'strong' );
				l.textContent = t.label;
				var d = el( 'span', { class: 'odd-shop__install-type-desc' } );
				d.textContent = t.desc;
				card.appendChild( g );
				card.appendChild( l );
				card.appendChild( d );
				grid.appendChild( card );
			} );
			wrap.appendChild( grid );

			return wrap;
		}

		/**
		 * Dedicated Settings department — Shuffle + Audio-reactive +
		 * Screensaver used to sit on top of the Wallpapers shelf,
		 * which cluttered scene browsing and hid preferences behind a
		 * department that wasn't really about preferences. They all
		 * live here now. All three continue to write through the same
		 * /odd/v1/prefs endpoint (`shuffle`, `audioReactive`,
		 * `screensaver`), so the REST contract is unchanged.
		 */
		function renderSettings() {
			var wrap = el( 'div', { class: 'odd-shop__dept odd-shop__dept--settings' } );
			wrap.appendChild( sectionHeader(
				'Settings',
				'Tweak how the ODD desktop behaves — rotate scenes automatically, react to sound, or dim into a full-screen screensaver when you step away.',
				{ eyebrow: 'ODD · Preferences' }
			) );

			var settings = el( 'div', { class: 'odd-wallpaper-settings' } );

			// Shuffle — rotates the wallpaper every N minutes while
			// the desktop window is open. `state.cfg.shuffle` is the
			// committed value from REST; we mirror writes back onto
			// it so a re-render stays in sync.
			var shuffleCard = el( 'div', { class: 'odd-setting-card odd-setting-card--shuffle' } );
			var shuffleRow = el( 'label', { class: 'odd-switch-row' } );
			var shuffleBox = el( 'input', { type: 'checkbox' } );
			shuffleBox.checked = !! ( state.cfg.shuffle && state.cfg.shuffle.enabled );
			var shuffleKnob = el( 'span', { class: 'odd-switch' } );
			var shuffleText = el( 'span', { class: 'odd-setting-card__text' } );
			var shuffleLabel = el( 'strong' );
			shuffleLabel.textContent = __( 'Shuffle every' );
			var shuffleHint = el( 'span' );
			shuffleHint.textContent = __( 'Rotate scenes automatically while the desktop is open.' );
			shuffleText.appendChild( shuffleLabel );
			shuffleText.appendChild( shuffleHint );
			var minutes = el( 'input', {
				type:         'number',
				min:          '1',
				max:          '240',
				class:        'odd-minutes',
				'aria-label': __( 'Shuffle interval (minutes)' ),
			} );
			minutes.value = String( ( state.cfg.shuffle && state.cfg.shuffle.minutes ) || 15 );
			var shuffleControls = el( 'div', { class: 'odd-setting-card__controls' } );
			var minutesPrefix = el( 'span' );
			minutesPrefix.textContent = __( 'Every' );
			var minutesSuffix = el( 'span' );
			minutesSuffix.textContent = __( 'minutes' );
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

			// Audio-reactive — opt-in hook that lets scenes sample
			// the system audio analyser in tick(). Off by default
			// because mic/tab capture requires a user gesture.
			var audioRow = el( 'label', { class: 'odd-setting-card odd-setting-card--audio odd-switch-row' } );
			var audioBox = el( 'input', { type: 'checkbox' } );
			audioBox.checked = !! state.cfg.audioReactive;
			var audioKnob = el( 'span', { class: 'odd-switch' } );
			var audioText = el( 'span', { class: 'odd-setting-card__text' } );
			var audioLbl = el( 'strong' );
			audioLbl.textContent = __( 'Audio-reactive' );
			var audioHint = el( 'span' );
			audioHint.textContent = __( 'Let scenes pulse subtly with sound when supported.' );
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

			// Screensaver — dims into a full-screen scene after N
			// minutes of admin idleness. The scene selector reads
			// the current scene list off state.cfg.scenes so it
			// always reflects whatever is installed.
			var ss = state.cfg.screensaver || { enabled: false, minutes: 5, scene: 'current' };
			var ssRow = el( 'div', { class: 'odd-setting-card odd-setting-card--screensaver' } );

			var ssToggle = el( 'label', { class: 'odd-switch-row' } );
			var ssBox = el( 'input', { type: 'checkbox' } );
			ssBox.checked = !! ss.enabled;
			var ssKnob = el( 'span', { class: 'odd-switch' } );
			var ssText = el( 'span', { class: 'odd-setting-card__text' } );
			var ssLbl = el( 'strong' );
			ssLbl.textContent = __( 'Screensaver after' );
			var ssHint = el( 'span' );
			ssHint.textContent = __( 'Dim into a full-screen scene when the admin sits idle.' );
			ssText.appendChild( ssLbl );
			ssText.appendChild( ssHint );
			var ssControls = el( 'div', { class: 'odd-setting-card__controls odd-setting-card__controls--screensaver' } );
			var ssMins = el( 'input', {
				type:         'number',
				min:          '1',
				max:          '120',
				class:        'odd-minutes',
				'aria-label': __( 'Screensaver idle timeout (minutes)' ),
			} );
			ssMins.value = String( Math.max( 1, Math.min( 120, ( ss.minutes | 0 ) || 5 ) ) );
			var ssMinsLbl = el( 'span' );
			ssMinsLbl.textContent = __( 'minutes idle' );
			ssToggle.appendChild( ssBox );
			ssToggle.appendChild( ssKnob );
			ssToggle.appendChild( ssText );
			ssRow.appendChild( ssToggle );
			ssControls.appendChild( ssMins );
			ssControls.appendChild( ssMinsLbl );

			var ssSceneWrap = el( 'label', { class: 'odd-setting-field' } );
			var ssSceneLbl = el( 'span' );
			ssSceneLbl.textContent = __( 'Play' );
			var ssSceneSel = el( 'select', { class: 'odd-select' } );
			var ssChoices = [
				{ value: 'current', label: __( 'current scene' ) },
				{ value: 'random',  label: __( 'a random scene' ) },
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
			ssPreview.textContent = __( 'Preview' );
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

			// v3.0+: scenes all come from installed bundles (plus the
			// built-in "pending" fallback exposed by the runtime for
			// first-boot safety). Filter the pending slug out of the
			// shop — users shouldn't see or pick it as a real scene.
			var allScenes = ( Array.isArray( state.cfg.scenes ) ? state.cfg.scenes : [] )
				.filter( function ( s ) { return s && s.slug && s.slug !== 'odd-pending'; } );
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

			if ( ! scenes.length ) {
				if ( state.query ) {
					wrap.appendChild( renderEmptyResults( 'No scenes match "' + state.query + '".' ) );
					return wrap;
				}
				wrap.appendChild( renderEmptyDept(
					'scenes',
					'Install one from the Discover shelf below — or wait a moment while ODD finishes its first-run setup.',
					'🎨'
				) );
				var discoverEmpty = renderDiscoverShelf( 'scene' );
				if ( discoverEmpty ) wrap.appendChild( discoverEmpty );
				return wrap;
			}

			// Personal shelves — "Recents" (last 12 scenes the user
			// switched to) and "Favorites" (starred by the user).
			// Rendered above Discover so the most-personal content
			// sits closest to the hero. Hidden while searching so the
			// result-focused view stays tight.
			if ( ! state.query ) {
				var recentsShelf = renderPersonalShelf( 'Recents', state.cfg.recents, allScenes, 'wallpaper' );
				if ( recentsShelf ) wrap.appendChild( recentsShelf );
				var favShelf = renderPersonalShelf( 'Favorites', state.cfg.favorites, allScenes, 'wallpaper' );
				if ( favShelf ) wrap.appendChild( favShelf );
			}

			// Discover shelf — server-curated remote scenes from the
			// catalog. Skipped entirely when the user is searching so
			// the query only filters what they actually have on disk.
			if ( ! state.query ) {
				var discover = renderDiscoverShelf( 'scene' );
				if ( discover ) wrap.appendChild( discover );
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
			var previewUrl  = scene.previewUrl || ( ( state.cfg.pluginUrl || '' ) + '/assets/previews/' + scene.slug + '.webp' );

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
		 * Empty-state card shown at the top of a department when the
		 * user has zero bundles of that type installed. On a fresh
		 * site this is common — the starter pack is still downloading
		 * in the background, and the Discover shelf below renders
		 * remote catalog entries so the user can install manually or
		 * just wait for the starter pack cron to finish.
		 *
		 * @param {string} kind  Friendly plural ("scenes", "icon sets", etc.).
		 * @param {string} hint  Second-line microcopy.
		 * @param {string} glyph Emoji or unicode for the decorative badge.
		 * @return {HTMLElement}
		 */
		function renderEmptyDept( kind, hint, glyph ) {
			var wrap = el( 'div', { class: 'odd-shop__empty odd-shop__empty--dept' } );
			var icon = el( 'div', { class: 'odd-shop__empty-icon', 'aria-hidden': 'true' } );
			icon.textContent = glyph || '✨';
			var big  = el( 'div', { class: 'odd-shop__empty-title' } );
			big.textContent = 'No ' + kind + ' installed yet';
			var sub  = el( 'div', { class: 'odd-shop__empty-sub' } );
			sub.textContent = hint || 'Browse the Discover shelf below to add some.';
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
		/**
		 * Render a personal shelf ("Recents" / "Favorites") for the
		 * wallpaper department. Maps a slug list (from state.cfg) to
		 * full scene objects from `allScenes`, preserving the slug-
		 * list ordering so "Recents" reads newest-first and
		 * "Favorites" reads in insertion order. Returns null when
		 * the list resolves to zero scenes so the caller can skip a
		 * visually-empty shelf.
		 */
		function renderPersonalShelf( title, slugs, allScenes, scope ) {
			if ( ! Array.isArray( slugs ) || ! slugs.length ) return null;
			var bySlug = {};
			( allScenes || [] ).forEach( function ( s ) {
				if ( s && s.slug ) bySlug[ s.slug ] = s;
			} );
			var items = [];
			for ( var i = 0; i < slugs.length; i++ ) {
				if ( bySlug[ slugs[ i ] ] ) items.push( bySlug[ slugs[ i ] ] );
			}
			if ( ! items.length ) return null;
			return renderShelf( title, items, renderSceneCard, { scope: scope || 'wallpaper' } );
		}

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
				'aria-label': ( scene.label || scene.slug ) + ' — ' + ( categoryOf( scene, 'wallpaper' ) || scene.franchise || 'scene' ),
			} );

			var thumb = el( 'div', { class: 'odd-shop__tile-thumb' } );
			thumb.style.backgroundColor = scene.fallbackColor || '#111';
			var img = el( 'img', {
				src: scene.previewUrl || ( ( state.cfg.pluginUrl || '' ) + '/assets/previews/' + scene.slug + '.webp' ),
				alt: '',
				loading: 'lazy',
			} );
			thumb.appendChild( img );
			if ( active && ! state.preview ) {
				var badge = el( 'span', { class: 'odd-shop__tile-badge' } );
				badge.textContent = '✓ Active';
				thumb.appendChild( badge );

				// Iris "watching" sticker — ties the active wallpaper
				// pick to the same eye glyph used by the marketing
				// site, the favicon, and the brand mark.
				var iris = el( 'span', {
					class: 'odd-shop__iris-sticker',
					'aria-hidden': 'true',
					title: 'Iris is watching',
				} );
				iris.innerHTML =
					'<svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true">'
						+ '<defs>'
							+ '<linearGradient id="oddIrisBg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">'
								+ '<stop offset="0%" stop-color="#ff4fa8"/>'
								+ '<stop offset="55%" stop-color="#9d6bff"/>'
								+ '<stop offset="100%" stop-color="#5a35d6"/>'
							+ '</linearGradient>'
							+ '<radialGradient id="oddIrisIris" cx="42%" cy="38%" r="68%">'
								+ '<stop offset="0%" stop-color="#c6fbff"/>'
								+ '<stop offset="45%" stop-color="#70f5ff"/>'
								+ '<stop offset="100%" stop-color="#1e7ac9"/>'
							+ '</radialGradient>'
						+ '</defs>'
						+ '<rect x="0" y="0" width="64" height="64" rx="14" ry="14" fill="url(#oddIrisBg)"/>'
						+ '<g class="odd-shop__iris-blinker">'
							+ '<circle cx="32" cy="32" r="20" fill="#fdfaf2" stroke="#130826" stroke-width="3"/>'
							+ '<circle cx="32" cy="32" r="13" fill="url(#oddIrisIris)"/>'
							+ '<circle cx="32" cy="32" r="6" fill="#091425"/>'
							+ '<circle cx="29" cy="29" r="2.4" fill="#ffffff"/>'
						+ '</g>'
					+ '</svg>';
				thumb.appendChild( iris );
			}
			card.appendChild( thumb );

			var fav = isFavorite( scene.slug );
			var star = el( 'span', {
				class: 'odd-shop__fav' + ( fav ? ' is-on' : '' ),
				role: 'button',
				tabindex: '0',
				'aria-label': fav ? 'Remove from favorites' : 'Add to favorites',
				'aria-pressed': fav ? 'true' : 'false',
				title: fav ? 'Unfavorite' : 'Favorite',
			} );
			star.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 3.6 L14.6 9.1 L20.5 9.9 L16.2 14.2 L17.3 20.1 L12 17.3 L6.7 20.1 L7.8 14.2 L3.5 9.9 L9.4 9.1 Z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
			star.addEventListener( 'click', function ( ev ) {
				ev.stopPropagation();
				ev.preventDefault();
				toggleFavorite( scene.slug );
			} );
			star.addEventListener( 'keydown', function ( ev ) {
				if ( ev.key === 'Enter' || ev.key === ' ' ) {
					ev.stopPropagation();
					ev.preventDefault();
					toggleFavorite( scene.slug );
				}
			} );
			// Intentionally NOT appended to `thumb` — nesting an
			// interactive widget inside a <button> trips axe's
			// nested-interactive rule. The star moves to the
			// `tile-wrap` sibling at the bottom of this fn.

			var meta = el( 'div', { class: 'odd-shop__tile-meta' } );
			var metaText = el( 'div', { class: 'odd-shop__tile-text' } );
			var title = el( 'div', { class: 'odd-card__title odd-shop__tile-title' } );
			title.textContent = scene.label || scene.slug;
			var sub = el( 'div', { class: 'odd-card__sub odd-shop__tile-sub' } );
			// Prefer the canonical category (Skies/Wilds/Places/Forms)
			// over the free-form `franchise` label so the subtitle is
			// stable even when a scene manifest omits `franchise`
			// altogether. `franchise` stays as a soft historical
			// label; third-party scenes can set either.
			var sceneCat = categoryOf( scene, 'wallpaper' ) || scene.franchise || 'Scene';
			sub.textContent = sceneCat + ' · Scene';
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
				if ( scene.slug === current && ! state.preview ) return;
				if ( state.preview && state.preview.kind === 'wallpaper' && scene.slug === state.preview.originalSlug ) {
					cancelPreview();
					return;
				}
				previewScene( scene.slug );
			} );

			// Wrap so the interactive card <button> and the favorite
			// star can live as siblings rather than parent/child —
			// axe flags nested interactive controls as serious.
			var wrap = el( 'div', {
				class: 'odd-shop__tile-wrap',
				'data-slug': scene.slug,
			} );
			wrap.appendChild( card );
			wrap.appendChild( star );
			return wrap;
		}

		function isFavorite( slug ) {
			var list = Array.isArray( state.cfg.favorites ) ? state.cfg.favorites : [];
			for ( var i = 0; i < list.length; i++ ) {
				if ( list[ i ] === slug ) return true;
			}
			return false;
		}

		/**
		 * Toggle a slug in the user's favorites list and persist to
		 * REST. Mutates state.cfg.favorites optimistically so the
		 * next re-render reflects the change even before the POST
		 * settles; if REST returns an authoritative list we overwrite
		 * with that.
		 */
		function toggleFavorite( slug ) {
			var list = Array.isArray( state.cfg.favorites ) ? state.cfg.favorites.slice() : [];
			var idx = list.indexOf( slug );
			if ( idx >= 0 ) {
				list.splice( idx, 1 );
			} else {
				list.unshift( slug );
				if ( list.length > 50 ) list = list.slice( 0, 50 );
			}
			state.cfg.favorites = list;
			savePrefs( { favorites: list }, function ( data ) {
				if ( data && Array.isArray( data.favorites ) ) {
					state.cfg.favorites = data.favorites;
				}
				redecorateSceneGrid();
			} );
			redecorateSceneGrid();
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
				// Sync the favorite star's on-state so flipping a
				// favorite on one tile updates that tile without a
				// full re-render. The star lives as a *sibling* of
				// the card (nested interactive = axe violation), so
				// hop up to the tile-wrap to find it.
				var tileWrap = c.closest( '.odd-shop__tile-wrap' );
				var star = ( tileWrap || c ).querySelector( '.odd-shop__fav' );
				if ( star ) {
					var favOn = isFavorite( slug );
					star.classList.toggle( 'is-on', favOn );
					star.setAttribute( 'aria-pressed', favOn ? 'true' : 'false' );
					star.setAttribute( 'aria-label', favOn ? 'Remove from favorites' : 'Add to favorites' );
					star.setAttribute( 'title', favOn ? 'Unfavorite' : 'Favorite' );
				}

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
				if ( state.query ) {
					wrap.appendChild( renderEmptyResults( 'No icon sets match "' + state.query + '".' ) );
					return wrap;
				}
				wrap.appendChild( renderEmptyDept(
					'icon sets',
					'Install one from the Discover shelf below to re-skin the dock and desktop shortcuts.',
					'🎛️'
				) );
				var discoverIconsEmpty = renderDiscoverShelf( 'icon-set' );
				if ( discoverIconsEmpty ) wrap.appendChild( discoverIconsEmpty );
				return wrap;
			}

			if ( ! state.query ) {
				var discoverIcons = renderDiscoverShelf( 'icon-set' );
				if ( discoverIcons ) wrap.appendChild( discoverIcons );
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
			// v3.0+: ODD ships no stock widgets. Every widget — including
			// Sticky Note and Magic 8-Ball — is an installable bundle
			// from the remote catalog, so this list is seeded entirely
			// from `installedWidgets`. The Discover shelf below this
			// function renders remote widget entries users can add.
			var base   = [];
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
				if ( state.query ) {
					wrap.appendChild( renderEmptyResults( 'No widgets match "' + state.query + '".' ) );
					return wrap;
				}
				wrap.appendChild( renderEmptyDept(
					'widgets',
					'Install one from the Discover shelf below to park a little card on your desktop.',
					'🧩'
				) );
				var discoverWidgetsEmpty = renderDiscoverShelf( 'widget' );
				if ( discoverWidgetsEmpty ) wrap.appendChild( discoverWidgetsEmpty );
				return wrap;
			}

			if ( ! state.query ) {
				var discoverWidgets = renderDiscoverShelf( 'widget' );
				if ( discoverWidgets ) wrap.appendChild( discoverWidgets );
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

			// Diagnostics: bundle environment + recent log entries into
			// the clipboard for bug reports. Zero server-side telemetry;
			// the entire payload is assembled on this machine and only
			// leaves the browser when the user pastes it somewhere.
			var diagRow = el( 'div', { class: 'odd-about__diag' } );
			var diagBtn = el( 'button', {
				type: 'button',
				class: 'odd-apps-btn odd-apps-btn--pill',
				'data-odd-copy-diagnostics': '1',
			} );
			diagBtn.textContent = 'Copy diagnostics';
			diagBtn.addEventListener( 'click', function () {
				var d = window.__odd && window.__odd.diagnostics;
				if ( ! d || typeof d.copy !== 'function' ) {
					diagBtn.textContent = 'Diagnostics unavailable';
					return;
				}
				diagBtn.disabled = true;
				d.copy().then( function ( ok ) {
					diagBtn.textContent = ok ? 'Copied — paste into GitHub' : 'Copy failed';
					setTimeout( function () {
						diagBtn.disabled = false;
						diagBtn.textContent = 'Copy diagnostics';
					}, 2400 );
				} );
			} );
			diagRow.appendChild( diagBtn );

			var diagHint = el( 'p', { class: 'odd-about__diag-hint' } );
			diagHint.textContent = 'Assembles ODD version, environment, recent errors, and registry counts into the clipboard. Nothing is sent anywhere — paste it into an issue if something\'s broken.';
			diagRow.appendChild( diagHint );
			foot.appendChild( diagRow );

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
	/**
	 * Mount the panel stylesheet.
	 *
	 * In production, odd/includes/enqueue.php enqueues
	 * odd/src/panel/styles.css as handle `odd-panel-style`, so this
	 * function is a no-op. In tests or standalone contexts the server
	 * enqueue doesn't run, so we inject a `<link>` pointing at the
	 * plugin's styles.css via `window.odd.pluginUrl`.
	 *
	 * Either way, we leave an empty `#odd-panel-styles` sentinel so
	 * consumers (and panel.test.js) can still test for its presence.
	 */
	function injectStyles() {
		if ( document.getElementById( 'odd-panel-styles' ) ) return;
		var marker = document.createElement( 'style' );
		marker.id = 'odd-panel-styles';
		document.head.appendChild( marker );
		// If the server-side enqueue already shipped odd-panel-style,
		// the link is already in the DOM and we're done.
		if ( document.querySelector( 'link[data-odd-panel-style]' ) ) return;
		if ( document.getElementById( 'odd-panel-style-css' ) ) return;
		var base = ( window.odd && window.odd.pluginUrl ) || '';
		if ( ! base ) return;
		var link = document.createElement( 'link' );
		link.rel  = 'stylesheet';
		link.href = base + '/src/panel/styles.css';
		link.setAttribute( 'data-odd-panel-style', '1' );
		document.head.appendChild( link );
	}
} )();
