/**
 * ODD ↔ WP Desktop Mode hook bridge.
 * ---------------------------------------------------------------
 * Newer Desktop Mode builds expose richer lifecycle, widget, iframe,
 * layout, settings-tab, and activity APIs. This module adopts them
 * opportunistically while staying silent on older host versions.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	window.__odd = window.__odd || {};
	if ( window.__odd.desktopHooks ) return;

	var NS = 'odd.desktop-hooks';
	var INSTALLED = [];
	var ODD_WINDOW_PREFIX = 'odd-app-';

	function hooks() {
		return ( window.wp && window.wp.hooks ) || null;
	}

	function desktop() {
		return ( window.wp && window.wp.desktop ) || null;
	}

	function diagnostics() {
		return window.__odd && window.__odd.diagnostics;
	}

	function events() {
		return window.__odd && window.__odd.events;
	}

	function record( level, label, payload ) {
		var d = diagnostics();
		if ( d && typeof d.record === 'function' ) {
			d.record( level || 'info', [ label, payload || {} ] );
		}
	}

	function emit( name, payload ) {
		var e = events();
		if ( e && typeof e.emit === 'function' ) {
			e.emit( name, payload || {} );
		}
	}

	function addAction( name, cb ) {
		var h = hooks();
		if ( ! h || typeof h.addAction !== 'function' ) return;
		try {
			h.addAction( name, NS, cb );
			INSTALLED.push( function () {
				try { h.removeAction( name, NS ); } catch ( _ ) {}
			} );
		} catch ( _ ) {}
	}

	function addFilter( name, cb ) {
		var h = hooks();
		if ( ! h || typeof h.addFilter !== 'function' ) return;
		try {
			h.addFilter( name, NS, cb );
			INSTALLED.push( function () {
				try { h.removeFilter( name, NS ); } catch ( _ ) {}
			} );
		} catch ( _ ) {}
	}

	function addDomEvent( name, cb ) {
		if ( typeof document === 'undefined' || typeof document.addEventListener !== 'function' ) return;
		document.addEventListener( name, cb );
		INSTALLED.push( function () {
			try { document.removeEventListener( name, cb ); } catch ( _ ) {}
		} );
	}

	function addActivity( channel, cb ) {
		var d = desktop();
		if ( ! d || ! d.activity || typeof d.activity.subscribe !== 'function' ) return;
		try {
			var off = d.activity.subscribe( channel, cb );
			if ( typeof off === 'function' ) INSTALLED.push( off );
		} catch ( _ ) {}
	}

	function cfg() {
		return ( window.odd && typeof window.odd === 'object' ) ? window.odd : {};
	}

	function ready( cb ) {
		var d = desktop();
		if ( d && typeof d.ready === 'function' ) {
			d.ready( cb );
			return;
		}
		cb();
	}

	function applyClass( classes, className ) {
		if ( Array.isArray( classes ) ) {
			if ( classes.indexOf( className ) === -1 ) classes.push( className );
			return classes;
		}
		classes = String( classes || '' );
		return classes.indexOf( className ) === -1 ? ( classes + ' ' + className ).trim() : classes;
	}

	function isOddWindow( id ) {
		id = String( id || '' );
		return id === 'odd' || id.indexOf( ODD_WINDOW_PREFIX ) === 0;
	}

	function isOddWidget( id ) {
		return String( id || '' ).indexOf( 'odd/' ) === 0;
	}

	function itemId( item ) {
		if ( ! item || typeof item !== 'object' ) return '';
		return String( item.id || item.windowId || item.baseId || item.menuSlug || item.slug || '' );
	}

	function isOddDockItem( item ) {
		var id = itemId( item );
		if ( isOddWindow( id ) || isOddWidget( id ) ) return true;
		if ( id === 'odd' ) return true;
		if ( item && typeof item.title === 'string' && item.title.indexOf( 'ODD' ) === 0 ) return true;
		if ( item && typeof item.url === 'string' && item.url.indexOf( 'odd' ) !== -1 ) return true;
		return false;
	}

	function isOddCommand( slug ) {
		slug = String( slug || '' );
		return slug === 'shuffle' || slug.indexOf( 'odd' ) === 0;
	}

	function windowIdFromWindow( win ) {
		if ( ! win || typeof win !== 'object' ) return '';
		if ( win.id ) return String( win.id );
		if ( win.windowId ) return String( win.windowId );
		if ( win.config && win.config.id ) return String( win.config.id );
		return '';
	}

	function normalizeWindowPayload( payload ) {
		if ( ! payload || typeof payload !== 'object' ) return {};
		var windowId = payload.windowId || payload.id || '';
		var out = {};
		for ( var key in payload ) {
			if ( Object.prototype.hasOwnProperty.call( payload, key ) ) {
				out[ key ] = payload[ key ];
			}
		}
		if ( windowId && ! out.id ) out.id = windowId;
		if ( windowId && ! out.windowId ) out.windowId = windowId;
		return out;
	}

	function setupWindowDiagnostics() {
		var map = {
			'wp-desktop.window.opened':              'odd.window-opened',
			'wp-desktop.window.reopened':            'odd.window-reopened',
			'wp-desktop.window.content-loading':     'odd.window-content-loading',
			'wp-desktop.window.content-loaded':      'odd.window-content-loaded',
			'wp-desktop.window.closing':             'odd.window-closing',
			'wp-desktop.window.closed':              'odd.window-closed',
			'wp-desktop.window.focused':             'odd.window-focused',
			'wp-desktop.window.blurred':             'odd.window-blurred',
			'wp-desktop.window.changed':             'odd.window-changed',
			'wp-desktop.window.detached':            'odd.window-detached',
			'wp-desktop.window.bounds-changed':      'odd.window-bounds-changed',
			'wp-desktop.window.body-resized':        'odd.window-body-resized',
			'wp-desktop.native-window.after-render': 'odd.native-window-after-render',
			'wp-desktop.native-window.before-close': 'odd.native-window-before-close',
		};
		Object.keys( map ).forEach( function ( hookName ) {
			addAction( hookName, function ( payload ) {
				var windowId = payload && ( payload.windowId || payload.id );
				if ( ! isOddWindow( windowId ) ) return;
				var normalized = normalizeWindowPayload( payload );
				record( 'info', hookName, normalized );
				emit( map[ hookName ], normalized );
			} );
		} );

		addFilter( 'wp-desktop.window.loading-overlay', function ( host, ctx ) {
			var windowId = ctx && ctx.windowId;
			if ( ! host || ! isOddWindow( windowId ) ) return host;
			try {
				host.setAttribute( 'data-odd-loading-observed', 'true' );
			} catch ( _ ) {}
			record( 'info', 'wp-desktop.window.loading-overlay', { windowId: windowId } );
			return host;
		} );

		addFilter( 'wp-desktop.native-window.before-render', function ( body, ctx ) {
			var windowId = ctx && ( ctx.windowId || ctx.id || ( ctx.config && ctx.config.id ) );
			if ( ! body || ! isOddWindow( windowId ) ) return body;
			try { body.setAttribute( 'data-odd-native-window', windowId ); } catch ( _ ) {}
			record( 'info', 'wp-desktop.native-window.before-render', { windowId: windowId } );
			return body;
		} );
	}

	function setupIframeDiagnostics() {
		addAction( 'wp-desktop.iframe.error', function ( payload ) {
			record( 'error', 'wp-desktop.iframe.error', payload || {} );
			emit( 'odd.iframe-error', payload || {} );
		} );
		addAction( 'wp-desktop.iframe.network-completed', function ( payload ) {
			if ( ! payload ) return;
			if ( payload.failed || Number( payload.status || 0 ) >= 400 ) {
				record( 'warn', 'wp-desktop.iframe.network-completed', payload );
			}
		} );
		addAction( 'wp-desktop.iframe.ready', function ( payload ) {
			var windowId = payload && payload.windowId;
			if ( isOddWindow( windowId ) ) {
				record( 'info', 'wp-desktop.iframe.ready', payload );
			}
		} );
	}

	function setupWidgetDiagnostics() {
		[
			'wp-desktop.widget.mounting',
			'wp-desktop.widget.added',
			'wp-desktop.widget.removed',
			'wp-desktop.widget.mounted',
			'wp-desktop.widget.unmounting',
		].forEach( function ( hookName ) {
			addAction( hookName, function ( payload ) {
				if ( payload && isOddWidget( payload.id ) ) {
					record( 'info', hookName, payload );
				}
			} );
		} );
		addAction( 'wp-desktop.widget.mount-failed', function ( payload ) {
			if ( payload && isOddWidget( payload.id ) ) {
				record( 'error', 'wp-desktop.widget.mount-failed', payload );
				emit( 'odd.error', {
					source:   'desktop.widget.mount-failed',
					severity: 'error',
					message:  payload.error && payload.error.message || 'Widget mount failed',
					err:      payload.error,
				} );
			}
		} );
	}

	function setupWallpaperDiagnostics() {
		[
			'wp-desktop.wallpaper.mounting',
			'wp-desktop.wallpaper.mounted',
			'wp-desktop.wallpaper.unmounting',
			'wp-desktop.wallpaper.visibility',
		].forEach( function ( hookName ) {
			addAction( hookName, function ( payload ) {
				record( 'info', hookName, payload || {} );
				if ( hookName === 'wp-desktop.wallpaper.visibility' ) {
					emit( 'odd.visibility-changed', payload || {} );
				}
			} );
		} );
		addAction( 'wp-desktop.wallpaper.mount-failed', function ( payload ) {
			record( 'error', 'wp-desktop.wallpaper.mount-failed', payload || {} );
			emit( 'odd.error', {
				source:   'desktop.wallpaper.mount-failed',
				severity: 'error',
				message:  payload && payload.error && payload.error.message || 'Wallpaper mount failed',
				err:      payload && payload.error,
			} );
		} );
		addFilter( 'wp-desktop.wallpaper.surfaces', function ( surfaces ) {
			surfaces = Array.isArray( surfaces ) ? surfaces : [];
			record( 'info', 'wp-desktop.wallpaper.surfaces', { count: surfaces.length } );
			return surfaces;
		} );
	}

	function setupDockDiagnostics() {
		addAction( 'wp-desktop.dock.before-render', function ( ctx ) {
			record( 'info', 'wp-desktop.dock.before-render', {
				dockId: ctx && ctx.dockId,
				rail:   ctx && ctx.rail,
				items:  ctx && Array.isArray( ctx.items ) ? ctx.items.length : 0,
			} );
		} );
		addFilter( 'wp-desktop.dock.tile-class', function ( classes, ctx ) {
			if ( ctx && isOddDockItem( ctx.item ) ) {
				return applyClass( classes, 'odd-desktop-tile' );
			}
			return classes;
		} );
		addFilter( 'wp-desktop.dock.tile-element', function ( el, ctx ) {
			if ( el && ctx && isOddDockItem( ctx.item ) ) {
				try { el.setAttribute( 'data-odd-dock-tile', itemId( ctx.item ) || 'odd' ); } catch ( _ ) {}
			}
			return el;
		} );
		addFilter( 'wp-desktop.dock.tile-tooltip', function ( label, ctx ) {
			if ( ctx && isOddDockItem( ctx.item ) && label && String( label ).indexOf( 'ODD' ) === -1 ) {
				return String( label ) + ' · ODD';
			}
			return label;
		} );
		[
			'wp-desktop.dock.tile-rendered',
			'wp-desktop.dock.after-render',
			'wp-desktop.dock.item-appended',
			'wp-desktop.dock.item-removed',
		].forEach( function ( hookName ) {
			addAction( hookName, function ( payload ) {
				if ( hookName.indexOf( 'tile' ) !== -1 && payload && ! isOddDockItem( payload.item ) ) return;
				record( 'info', hookName, payload || {} );
			} );
		} );
	}

	function setupCommandDiagnostics() {
		addFilter( 'wp-desktop.command.before-run', function ( intent ) {
			if ( intent && isOddCommand( intent.slug ) ) {
				record( 'info', 'wp-desktop.command.before-run', intent );
			}
			return intent;
		} );
		addAction( 'wp-desktop.command.after-run', function ( payload ) {
			if ( payload && isOddCommand( payload.slug ) ) {
				record( 'info', 'wp-desktop.command.after-run', payload );
			}
		} );
		addAction( 'wp-desktop.command.error', function ( payload ) {
			if ( payload && isOddCommand( payload.slug ) ) {
				record( 'error', 'wp-desktop.command.error', payload );
				emit( 'odd.error', {
					source:   'desktop.command.' + payload.slug,
					severity: 'error',
					message:  payload.error && payload.error.message || 'ODD command failed',
					err:      payload.error,
				} );
			}
		} );
		addFilter( 'wp-desktop.open-command.items', function ( items ) {
			items = Array.isArray( items ) ? items : [];
			var api = window.__odd && window.__odd.api;
			items.push( {
				id:          'odd',
				label:       'ODD Shop',
				description: 'Open the ODD Shop.',
				icon:        'dashicons-cart',
				open:        function () { if ( api && typeof api.openPanel === 'function' ) api.openPanel(); },
			} );
			var apps = cfg().apps;
			if ( Array.isArray( apps ) && window.wp && window.wp.desktop && typeof window.wp.desktop.openWindow === 'function' ) {
				apps.forEach( function ( app ) {
					if ( ! app || ! app.slug ) return;
					items.push( {
						id:          'odd-app-' + app.slug,
						label:       app.name || app.label || app.slug,
						description: 'Open ODD app.',
						icon:        app.icon || 'dashicons-screenoptions',
						open:        function () { window.wp.desktop.openWindow( 'odd-app-' + app.slug ); },
					} );
				} );
			}
			return items;
		} );
	}

	function setupLayoutDiagnostics() {
		addDomEvent( 'wp-desktop-layout-changed', function ( event ) {
			var detail = event && event.detail || {};
			record( 'info', 'wp-desktop-layout-changed', detail );
			emit( 'odd.desktop-layout-changed', detail );
		} );
		addDomEvent( 'wp-desktop-presence-changed', function ( event ) {
			record( 'info', 'wp-desktop-presence-changed', event && event.detail || {} );
		} );
	}

	function setupActivityDiagnostics() {
		[
			'wp-desktop/toast-requested',
			'wp-desktop/toast-shown',
			'wp-desktop/window-attention-requested',
			'wp-desktop/badge-changed',
			'wp-desktop/open-requested',
			'wp-desktop/presence-changed',
			'wp-desktop/presence-snapshot-applied',
		].forEach( function ( channel ) {
			addActivity( channel, function ( payload ) {
				record( 'info', 'wp.desktop.activity.' + channel, payload || {} );
			} );
		} );
	}

	function setupTitlebarButton() {
		ready( function () {
			var d = desktop();
			if ( ! d || typeof d.registerTitleBarButton !== 'function' ) return;
			try {
				d.registerTitleBarButton( {
					id:        'odd/copy-diagnostics',
					label:     'Copy ODD diagnostics',
					icon:      'dashicons-clipboard',
					placement: 'right',
					order:     80,
					owner:     'odd-desktop-hooks',
					match:     function ( win ) { return isOddWindow( windowIdFromWindow( win ) ); },
					onClick:   function () {
						var diag = diagnostics();
						if ( diag && typeof diag.copy === 'function' ) diag.copy();
					},
				} );
			} catch ( _ ) {}
		} );
	}

	function setupDevtoolsDiagnostics() {
		var requestDisposers = {};
		addAction( 'wp-desktop.window.opened', function ( payload ) {
			var windowId = payload && ( payload.windowId || payload.id );
			var d = desktop();
			if ( ! isOddWindow( windowId ) || ! d || ! d.devtools || typeof d.devtools.onRequest !== 'function' ) return;
			if ( requestDisposers[ windowId ] ) return;
			try {
				requestDisposers[ windowId ] = d.devtools.onRequest( windowId, function ( req ) {
					if ( req && ( req.failed || Number( req.status || 0 ) >= 400 ) ) {
						record( 'warn', 'wp.desktop.devtools.request', req );
					}
				}, { observe: false } );
				INSTALLED.push( function () {
					if ( requestDisposers[ windowId ] ) {
						try { requestDisposers[ windowId ](); } catch ( _ ) {}
						delete requestDisposers[ windowId ];
					}
				} );
			} catch ( _ ) {}
		} );
	}

	function setupBroadSurfaceDiagnostics() {
		[
			'wp-desktop.window.chrome.theme-changed',
			'wp-desktop.window.chrome.applied',
			'wp-desktop.window.attention',
		].forEach( function ( hookName ) {
			addAction( hookName, function ( payload ) {
				record( 'info', hookName, payload || {} );
			} );
		} );

		ready( function () {
			var d = desktop();
			if ( ! d ) return;
			record( 'info', 'wp.desktop.surface-summary', {
				palettes:      d.listPalettes && typeof d.listPalettes === 'function' ? d.listPalettes().length : null,
				settingsTabs:  d.listSettingsTabs && typeof d.listSettingsTabs === 'function' ? d.listSettingsTabs().length : null,
				railRenderers: d.listDockRailRenderers && typeof d.listDockRailRenderers === 'function' ? d.listDockRailRenderers().length : null,
				systemTiles:   d.listSystemTiles && typeof d.listSystemTiles === 'function' ? d.listSystemTiles().length : null,
			} );
		} );
	}

	function renderSettingsTab( body ) {
		if ( ! body ) return;
		var d = diagnostics();
		var recent = d && typeof d.recent === 'function' ? d.recent().slice( -5 ).reverse() : [];
		body.innerHTML = [
			'<wpd-section heading="ODD" description="Shop, catalog, and diagnostics." stack>',
			'<wpd-stack gap="8">',
			'<wpd-button data-odd-settings-open-shop>Open ODD Shop</wpd-button>',
			'<wpd-button data-odd-settings-copy>Copy diagnostics</wpd-button>',
			'</wpd-stack>',
			'<wpd-section heading="Current state" stack>',
			'<wpd-code block data-odd-settings-health></wpd-code>',
			'</wpd-section>',
			'<wpd-section heading="Recent diagnostics" stack>',
			'<wpd-code block data-odd-settings-log></wpd-code>',
			'</wpd-section>',
			'</wpd-section>',
		].join( '' );

		var health = body.querySelector( '[data-odd-settings-health]' );
		if ( health ) {
			var cfg = window.odd || {};
			var system = cfg.systemHealth || {};
			health.textContent = JSON.stringify( {
				version: cfg.version || '',
				scene: cfg.scene || cfg.wallpaper || '',
				iconSet: cfg.iconSet || '',
				cursorSet: cfg.cursorSet || '',
				catalog: system.catalog || {},
				content: system.content || {},
				desktopMode: system.desktopMode || {},
			}, null, 2 );
		}

		var log = body.querySelector( '[data-odd-settings-log]' );
		if ( log ) {
			log.textContent = recent.length
				? recent.map( function ( item ) {
					return '[' + item.level + '] ' + item.message;
				} ).join( '\n' )
				: 'No diagnostics recorded yet.';
		}

		var open = body.querySelector( '[data-odd-settings-open-shop]' );
		if ( open ) {
			open.addEventListener( 'click', function () {
				var api = window.__odd && window.__odd.api;
				if ( api && typeof api.openPanel === 'function' ) api.openPanel();
			} );
		}
		var copy = body.querySelector( '[data-odd-settings-copy]' );
		if ( copy ) {
			copy.addEventListener( 'click', function () {
				if ( d && typeof d.copy === 'function' ) d.copy();
			} );
		}
	}

	function setupSettingsTab() {
		var d = desktop();
		if ( ! d || typeof d.registerSettingsTab !== 'function' ) return;
		function register() {
			try {
				d.registerSettingsTab( {
					id:         'odd',
					label:      'ODD',
					capability: 'manage_options',
					order:      50,
					owner:      'odd-desktop-hooks',
					render:     renderSettingsTab,
				} );
			} catch ( _ ) {}
		}
		if ( typeof d.ready === 'function' ) {
			d.ready( register );
		} else {
			register();
		}
	}

	setupWindowDiagnostics();
	setupIframeDiagnostics();
	setupWidgetDiagnostics();
	setupWallpaperDiagnostics();
	setupDockDiagnostics();
	setupCommandDiagnostics();
	setupLayoutDiagnostics();
	setupActivityDiagnostics();
	setupSettingsTab();
	setupTitlebarButton();
	setupDevtoolsDiagnostics();
	setupBroadSurfaceDiagnostics();

	window.__odd.desktopHooks = {
		renderSettingsTab: renderSettingsTab,
		uninstall: function () {
			while ( INSTALLED.length ) {
				try { INSTALLED.pop()(); } catch ( _ ) {}
			}
		},
	};
} )();
