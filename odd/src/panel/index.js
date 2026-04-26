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
			// Abandoning a tab with a pending preview reverts the
			// live swap — no silent commits because the user clicked
			// "About" to look at stats.
			if ( state.preview ) {
				var sameTab = ( id === 'wallpaper' && state.preview.kind === 'wallpaper' ) ||
					( id === 'icons' && state.preview.kind === 'iconSet' );
				if ( ! sameTab ) cancelPreview();
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
			} else if ( id === 'apps' ) {
				content.appendChild( renderApps() );
			} else {
				content.appendChild( renderAbout() );
			}
			// If we re-entered the tab that owns an active preview,
			// re-draw the sticky confirmation bar.
			if ( state.preview ) renderPreviewBar();
		}

		/* --- Apps section --- */

		function renderApps() {
			var wrap = el( 'div', { 'data-odd-apps': '1' } );
			wrap.appendChild( sectionHeader(
				'Apps',
				'Install ODD apps. Each app gets its own desktop icon and runs in a sandboxed window. Upload a .wp bundle, or install from the catalog.'
			) );

			// Upload row: a labeled file input paired with a drop zone.
			var upload = el( 'div', { class: 'odd-apps-upload' } );
			upload.innerHTML =
				'<strong>Install an app</strong>' +
				'<div class="odd-apps-upload__sub">Drop a .wp archive or choose one from disk.</div>';

			var input = el( 'input', { type: 'file', accept: '.wp,application/zip', style: 'display:none' } );
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

			var scenes = Array.isArray( state.cfg.scenes ) ? state.cfg.scenes : [];
			var grid = el( 'div', { class: 'odd-grid' } );
			scenes.forEach( function ( scene ) {
				grid.appendChild( renderSceneCard( scene ) );
			} );
			wrap.appendChild( grid );

			return wrap;
		}

		function renderSceneCard( scene ) {
			var currentSlug = state.cfg.wallpaper || state.cfg.scene;
			var active = scene.slug === currentSlug;
			var isPreview = state.preview && state.preview.kind === 'wallpaper' && state.preview.slug === scene.slug;

			var card = el( 'button', {
				type: 'button',
				class: 'odd-card'
					+ ( active && ! state.preview ? ' is-active' : '' )
					+ ( isPreview ? ' is-previewing' : '' ),
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

			var list = el( 'div', { class: 'odd-catalog-list' } );
			sets.forEach( function ( set ) {
				list.appendChild( renderIconSetCard( set ) );
			} );
			wrap.appendChild( list );

			return wrap;
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
				'Generative wallpapers. Unserious icons. Apps in a sandbox.',
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
			credit.textContent = 'Painted backdrops, scripted motion, sandboxed apps. Built on WP Desktop Mode. Use responsibly. Or don\'t.';
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
			'.odd-panel .odd-wallpaper-settings{display:grid;grid-template-columns:minmax(260px,1fr) minmax(220px,.75fr);gap:12px;margin:0 0 12px}',
			'.odd-panel .odd-setting-card{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px;min-width:0;padding:16px 18px;background:linear-gradient(180deg,#fff,#fbfbff);border:1px solid #dfe3ea;border-radius:16px;box-shadow:0 14px 30px -24px rgba(20,14,40,.35),0 1px 0 rgba(255,255,255,.9) inset;color:#1d2327}',
			'.odd-panel .odd-setting-card--screensaver{margin:0 0 18px;align-items:flex-start;background:linear-gradient(135deg,#ffffff 0%,#f8fbff 58%,#fff8ec 100%)}',
			'.odd-panel .odd-setting-card--audio{justify-content:flex-start}',
			'.odd-panel .odd-switch-row{position:relative;display:flex;align-items:center;gap:12px;min-width:0;cursor:pointer}',
			'.odd-panel .odd-switch-row input[type="checkbox"]{position:absolute;opacity:0;pointer-events:none}',
			'.odd-panel .odd-switch{position:relative;flex:0 0 auto;width:44px;height:26px;border-radius:999px;background:#dcdcde;box-shadow:0 1px 2px rgba(0,0,0,.16) inset;transition:background .16s ease,box-shadow .16s ease}',
			'.odd-panel .odd-switch::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 7px rgba(20,14,40,.24);transition:transform .18s cubic-bezier(.2,.8,.2,1)}',
			'.odd-panel .odd-switch-row input[type="checkbox"]:checked + .odd-switch{background:linear-gradient(135deg,#2271b1,#8b5cf6);box-shadow:0 8px 18px -12px #2271b1}',
			'.odd-panel .odd-switch-row input[type="checkbox"]:checked + .odd-switch::after{transform:translateX(18px)}',
			'.odd-panel .odd-switch-row input[type="checkbox"]:focus-visible + .odd-switch{outline:2px solid #2271b1;outline-offset:3px}',
			'.odd-panel .odd-setting-card__text{display:flex;flex-direction:column;gap:3px;min-width:0}',
			'.odd-panel .odd-setting-card__text strong{font-size:13px;line-height:1.2;color:#1d2327}',
			'.odd-panel .odd-setting-card__text span{font-size:11px;line-height:1.35;color:#646970}',
			'.odd-panel .odd-setting-card__controls{display:flex;align-items:center;gap:8px;flex:0 0 auto;color:#50575e;font-size:12px;font-weight:600}',
			'.odd-panel .odd-setting-card__controls--screensaver{flex-wrap:wrap;justify-content:flex-end;padding-top:2px}',
			'.odd-panel .odd-setting-field{display:inline-flex;align-items:center;gap:8px;color:#50575e;font-size:12px;font-weight:600}',
			'.odd-panel .odd-minutes{width:70px;min-height:38px;padding:6px 10px;border:1px solid #c7ced8;border-radius:10px;font:inherit;font-size:14px;font-weight:700;color:#1d2327;background:#fff;box-shadow:0 1px 0 rgba(255,255,255,.8) inset}',
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
			'.odd-panel .odd-setting-preview{min-height:36px;background:#111827!important;color:#fff!important;border-color:#111827!important;box-shadow:0 10px 18px -14px rgba(17,24,39,.8)}',
			'.odd-panel .odd-setting-preview:hover{background:#1f2937!important;border-color:#1f2937!important;color:#fff!important}',
			'.odd-panel .odd-select{min-height:38px;min-width:190px;padding:6px 34px 6px 10px;border:1px solid #c7ced8;border-radius:10px;font:inherit;font-size:14px;font-weight:600;background:#fff;color:#1d2327}',
			'@media (max-width: 760px){.odd-panel .odd-wallpaper-settings{grid-template-columns:1fr}.odd-panel .odd-setting-card,.odd-panel .odd-setting-card--screensaver{align-items:stretch;flex-direction:column}.odd-panel .odd-setting-card__controls,.odd-panel .odd-setting-card__controls--screensaver{justify-content:flex-start}.odd-panel .odd-select{min-width:0;width:100%}.odd-panel .odd-setting-field{width:100%;align-items:flex-start;flex-direction:column}}',
			'.odd-panel .odd-iconset-mini{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:3px;width:100%;height:100%;padding:6px;box-sizing:border-box}',
			'.odd-panel .odd-iconset-mini img{width:100%;height:100%;object-fit:contain;background:rgba(255,255,255,.85);border-radius:4px;padding:2px;box-sizing:border-box}',
			'.odd-panel .odd-pill{display:inline-block;padding:1px 6px;border-radius:999px;background:#eaf2ff;color:#135e96;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;vertical-align:middle}',
			'.odd-panel .odd-pill--builtin{background:#f0e6ff;color:#5e1b8c}',
		].join( '\n' );
		document.head.appendChild( s );
	}
} )();
