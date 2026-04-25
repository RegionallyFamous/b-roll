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

	var SECTIONS = [
		{ id: 'wallpaper', label: 'Wallpaper' },
		{ id: 'icons',     label: 'Icons'     },
		{ id: 'apps',      label: 'Apps',      gated: 'appsEnabled' },
		{ id: 'about',     label: 'About'     },
	];

	var renderPanel = function ( body ) {
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
			// Skip gated sections (e.g. Apps) until their feature flag
			// comes in from the localized config.
			if ( section.gated && ! state.cfg[ section.gated ] ) {
				return;
			}
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
			} else if ( id === 'apps' ) {
				content.appendChild( renderApps() );
			} else {
				content.appendChild( renderAbout() );
			}
		}

		/* --- Apps section --- */

		function renderApps() {
			var wrap = el( 'div', { 'data-odd-apps': '1' } );
			wrap.appendChild( sectionHeader(
				'Apps',
				'Install ODD apps. Each app gets its own desktop icon and runs in a sandboxed window. Upload a .odd or .wp bundle, or install from the catalog.'
			) );

			// Upload row: a labeled file input paired with a drop zone.
			var upload = el( 'div', { class: 'odd-apps-upload' } );
			upload.innerHTML =
				'<strong>Install an app</strong>' +
				'<div class="odd-apps-upload__sub">Drop a .odd or .wp archive or choose one from disk.</div>';

			var input = el( 'input', { type: 'file', accept: '.odd,.wp,application/zip', style: 'display:none' } );
			var pick  = el( 'button', { type: 'button', class: 'odd-apps-btn' } );
			pick.textContent = 'Choose file…';
			pick.addEventListener( 'click', function () { input.click(); } );
			input.addEventListener( 'change', function () {
				if ( input.files && input.files[ 0 ] ) installFile( input.files[ 0 ], wrap );
			} );
			upload.appendChild( input );
			upload.appendChild( pick );

			upload.addEventListener( 'dragover', function ( e ) {
				e.preventDefault();
				upload.classList.add( 'is-dragover' );
			} );
			upload.addEventListener( 'dragleave', function () {
				upload.classList.remove( 'is-dragover' );
			} );
			upload.addEventListener( 'drop', function ( e ) {
				e.preventDefault();
				upload.classList.remove( 'is-dragover' );
				var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[ 0 ];
				if ( f ) installFile( f, wrap );
			} );
			wrap.appendChild( upload );

			// Status rail. Populated by installFile() / deletions.
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
			var card = el( 'div', { class: 'odd-card odd-card--catalog', 'data-catalog-slug': row.slug } );
			if ( row.installed ) card.classList.add( 'is-installed' );

			var thumb = el( 'div', { class: 'odd-card__thumb' } );
			if ( row.icon_url ) {
				// Built-in catalog icons are relative to the plugin's
				// apps/catalog/ folder; remote entries ship absolute URLs.
				var src = row.icon_url;
				if ( src.indexOf( 'http' ) !== 0 && src.indexOf( 'data:' ) !== 0 ) {
					src = ( state.cfg.pluginUrl || '' ) + '/apps/catalog/' + src;
				}
				thumb.appendChild( el( 'img', { src: src, alt: row.name, loading: 'lazy' } ) );
			} else {
				thumb.textContent = ( row.name || row.slug ).slice( 0, 2 ).toUpperCase();
				thumb.classList.add( 'odd-card__thumb--badge' );
			}
			card.appendChild( thumb );

			var meta = el( 'div', { class: 'odd-card__meta' } );
			var title = el( 'div', { class: 'odd-card__title' } );
			title.textContent = row.name || row.slug;
			if ( row.builtin ) {
				var pill = el( 'span', { class: 'odd-pill odd-pill--builtin' } );
				pill.textContent = 'built-in';
				title.appendChild( document.createTextNode( ' ' ) );
				title.appendChild( pill );
			}
			var sub = el( 'div', { class: 'odd-card__sub' } );
			sub.textContent = ( row.version ? 'v' + row.version + ' · ' : '' ) + ( row.description || '' );
			meta.appendChild( title );
			meta.appendChild( sub );
			card.appendChild( meta );

			var actions = el( 'div', { class: 'odd-card__actions' } );
			if ( row.installed ) {
				var openBtn = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--primary' } );
				openBtn.textContent = 'Open';
				openBtn.addEventListener( 'click', function () { openAppWindow( row.slug ); } );
				actions.appendChild( openBtn );
			} else {
				var installBtn = el( 'button', { type: 'button', class: 'odd-apps-btn odd-apps-btn--primary' } );
				installBtn.textContent = row.builtin ? 'Add' : 'Download';
				installBtn.addEventListener( 'click', function () {
					installBtn.disabled = true;
					var label = row.builtin ? 'Adding ' : 'Downloading ';
					setAppsStatus( wrap, label + ( row.name || row.slug ) + '…', 'busy' );
					installFromCatalog( row.slug ).then( function ( data ) {
						installBtn.disabled = false;
						if ( data && data.installed ) {
							setAppsStatus( wrap, 'Installed ' + ( data.manifest && data.manifest.name || row.name ) + '. Reloading…', 'ok' );
							var ev = window.__odd && window.__odd.events;
							if ( ev ) ev.emit( 'odd.app-installed', { slug: row.slug, manifest: data.manifest } );
							setTimeout( function () { try { window.location.reload(); } catch ( e ) {} }, 600 );
						} else {
							var msg = ( data && data.message ) || ( data && data.code ) || 'Install failed.';
							setAppsStatus( wrap, msg, 'error' );
						}
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
			} ).then( function ( r ) { return r.json(); } )
			  .catch( function () { return null; } );
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

			// The wallpaper engine subscribes to `odd.pickScene` via
			// @wordpress/hooks — firing this swaps the scene live
			// without a reload. See odd/src/wallpaper/index.js.
			if ( window.wp && window.wp.hooks && typeof window.wp.hooks.doAction === 'function' ) {
				try { window.wp.hooks.doAction( 'odd.pickScene', slug ); } catch ( e ) {}
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
			wrap.appendChild( sectionHeader( 'Icons', 'Themed icon sets for the dock and desktop shortcuts. Applying a set swaps the dock icons in place — no reload.' ) );

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
				// Live-swap instead of reloading: the panel stays
				// open, no flicker. The server filters at priority
				// 20 remain the source of truth for any full page
				// render, so subsequent admin loads pick up the
				// same choice from user meta.
				//
				// Switching **to** "none" needs a reload because we
				// don't have the pre-ODD icon URLs cached JS-side;
				// only the user's next load will rebuild them.
				if ( slug === 'none' || slug === '' ) {
					setTimeout( function () {
						try { window.location.reload(); } catch ( e ) {}
					}, 180 );
					return;
				}
				liveSwapIcons( slug );
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
			'.odd-panel .odd-card--catalog{cursor:default}',
			'.odd-panel .odd-card--catalog:hover{transform:none}',
			'.odd-panel .odd-card--catalog.is-installed{opacity:.72}',
			'.odd-panel .odd-pill{display:inline-block;padding:1px 6px;border-radius:999px;background:#eaf2ff;color:#135e96;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;vertical-align:middle}',
			'.odd-panel .odd-pill--builtin{background:#f0e6ff;color:#5e1b8c}',
		].join( '\n' );
		document.head.appendChild( s );
	}
} )();
