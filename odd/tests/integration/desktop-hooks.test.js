import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFoundation } from './harness.js';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const SRC = resolve( __dirname, '../../src/shared/desktop-hooks.js' );

function loadDesktopHooks() {
	const src = readFileSync( SRC, 'utf8' );
	const fn = new Function( `${ src }\n//# sourceURL=desktop-hooks.js` );
	fn.call( globalThis );
}

describe( 'Desktop Mode hook bridge', () => {
	beforeEach( () => {
		loadFoundation( {
			config: {
				version: 'test',
				scene: 'oddling-desktop',
				iconSet: 'oddlings',
				cursorSet: 'oddlings',
				systemHealth: { catalog: { source: 'transient' }, content: { scenes: 1 } },
			},
		} );
	} );

	it( 'registers the ODD settings tab when Desktop Mode exposes settings tabs', () => {
		const registerSettingsTab = vi.fn();
		window.wp.desktop = {
			ready: ( cb ) => cb(),
			registerSettingsTab,
		};

		loadDesktopHooks();

		expect( registerSettingsTab ).toHaveBeenCalledTimes( 1 );
		expect( registerSettingsTab.mock.calls[ 0 ][ 0 ] ).toMatchObject( {
			id: 'odd',
			label: 'ODD',
			owner: 'odd-desktop-hooks',
		} );
		expect( typeof registerSettingsTab.mock.calls[ 0 ][ 0 ].render ).toBe( 'function' );
	} );

	it( 'records iframe failures and mirrors them to the ODD event bus', () => {
		window.wp.desktop = { ready: ( cb ) => cb() };
		const seen = [];
		window.__odd.events.on( 'odd.iframe-error', ( payload ) => seen.push( payload ) );

		loadDesktopHooks();
		window.wp.hooks.doAction( 'wp-desktop.iframe.error', {
			windowId: 'odd-app-demo',
			message: 'boom',
		} );

		expect( seen ).toHaveLength( 1 );
		expect( seen[ 0 ].message ).toBe( 'boom' );
		expect( window.__odd.diagnostics.recent().some( ( row ) => row.message.includes( 'wp-desktop.iframe.error' ) ) ).toBe( true );
	} );

	it( 'normalizes Desktop Mode window payloads for ODD app listeners', () => {
		window.wp.desktop = { ready: ( cb ) => cb() };
		const opened = [];
		window.__odd.events.on( 'odd.window-opened', ( payload ) => opened.push( payload ) );

		loadDesktopHooks();
		window.wp.hooks.doAction( 'wp-desktop.window.opened', {
			windowId: 'odd-app-demo',
			title: 'Demo',
		} );

		expect( opened ).toHaveLength( 1 );
		expect( opened[ 0 ].id ).toBe( 'odd-app-demo' );
		expect( opened[ 0 ].windowId ).toBe( 'odd-app-demo' );
	} );

	it( 'marks ODD loading overlays without replacing them', () => {
		window.wp.desktop = { ready: ( cb ) => cb() };
		loadDesktopHooks();

		const overlay = document.createElement( 'div' );
		const next = window.wp.hooks.applyFilters(
			'wp-desktop.window.loading-overlay',
			overlay,
			{ windowId: 'odd' },
		);

		expect( next ).toBe( overlay );
		expect( overlay.getAttribute( 'data-odd-loading-observed' ) ).toBe( 'true' );
	} );

	it( 'registers a title-bar diagnostics button for ODD windows', () => {
		const registerTitleBarButton = vi.fn();
		window.wp.desktop = {
			ready: ( cb ) => cb(),
			registerTitleBarButton,
		};

		loadDesktopHooks();

		expect( registerTitleBarButton ).toHaveBeenCalledTimes( 1 );
		const def = registerTitleBarButton.mock.calls[ 0 ][ 0 ];
		expect( def ).toMatchObject( {
			id:    'odd/copy-diagnostics',
			owner: 'odd-desktop-hooks',
		} );
		expect( def.match( { id: 'odd-app-demo' } ) ).toBe( true );
		expect( def.match( { id: 'plugins' } ) ).toBe( false );
	} );

	it( 'decorates ODD dock tiles without replacing the tile element', () => {
		window.wp.desktop = { ready: ( cb ) => cb() };
		loadDesktopHooks();

		const classes = window.wp.hooks.applyFilters(
			'wp-desktop.dock.tile-class',
			[ 'tile' ],
			{ item: { id: 'odd-app-demo', title: 'Demo' } },
		);
		expect( classes ).toContain( 'odd-desktop-tile' );

		const tile = document.createElement( 'button' );
		const next = window.wp.hooks.applyFilters(
			'wp-desktop.dock.tile-element',
			tile,
			{ item: { id: 'odd', title: 'ODD Shop' } },
		);
		expect( next ).toBe( tile );
		expect( tile.getAttribute( 'data-odd-dock-tile' ) ).toBe( 'odd' );
		expect( tile.getAttribute( 'data-odd-cursor' ) ).toBe( 'pointer' );
	} );

	it( 'maps window and widget hook payload elements to semantic cursor roots', () => {
		window.wp.desktop = { ready: ( cb ) => cb() };
		loadDesktopHooks();

		const win = document.createElement( 'div' );
		win.innerHTML = '<div class="wp-desktop-window-titlebar"></div><button>Run</button><input type="text">';
		window.wp.hooks.doAction( 'wp-desktop.window.opened', {
			windowId: 'odd-app-demo',
			element: win,
		} );

		expect( win.getAttribute( 'data-odd-cursor-root' ) ).toBe( 'true' );
		expect( win.querySelector( '.wp-desktop-window-titlebar' ).getAttribute( 'data-odd-cursor' ) ).toBe( 'grab' );
		expect( win.querySelector( 'button' ).getAttribute( 'data-odd-cursor' ) ).toBe( 'pointer' );
		expect( win.querySelector( 'input' ).getAttribute( 'data-odd-cursor' ) ).toBe( 'text' );

		const widget = document.createElement( 'div' );
		widget.innerHTML = '<div class="odd-widget__move"></div><button>Tap</button>';
		window.wp.hooks.doAction( 'wp-desktop.widget.mounted', {
			id: 'odd/weather',
			element: widget,
		} );

		expect( widget.getAttribute( 'data-odd-cursor-root' ) ).toBe( 'true' );
		expect( widget.querySelector( '.odd-widget__move' ).getAttribute( 'data-odd-cursor' ) ).toBe( 'grab' );
	} );

	it( 'injects active cursor stylesheets into ODD iframe ready payloads', () => {
		window.wp.desktop = { ready: ( cb ) => cb() };
		const injectInto = vi.fn();
		window.__odd.cursors = { injectInto };
		loadDesktopHooks();

		const doc = document.implementation.createHTMLDocument( 'frame' );
		window.wp.hooks.doAction( 'wp-desktop.iframe.ready', {
			windowId: 'odd-app-demo',
			document: doc,
		} );

		expect( injectInto ).toHaveBeenCalledWith( doc );
	} );

	it( 'adds ODD entries to Desktop Mode open command suggestions', () => {
		const openWindow = vi.fn();
		window.odd.apps = [ { slug: 'timer', name: 'Timer' } ];
		window.wp.desktop = { ready: ( cb ) => cb(), openWindow };
		loadDesktopHooks();

		const items = window.wp.hooks.applyFilters( 'wp-desktop.open-command.items', [] );
		expect( items.map( ( item ) => item.id ) ).toEqual( expect.arrayContaining( [ 'odd', 'odd-app-timer' ] ) );

		items.find( ( item ) => item.id === 'odd-app-timer' ).open();
		expect( openWindow ).toHaveBeenCalledWith( 'odd-app-timer' );
	} );

	it( 'records command lifecycle diagnostics for ODD commands', () => {
		window.wp.desktop = { ready: ( cb ) => cb() };
		loadDesktopHooks();

		window.wp.hooks.applyFilters( 'wp-desktop.command.before-run', { slug: 'shuffle', args: '' } );
		window.wp.hooks.doAction( 'wp-desktop.command.error', {
			slug: 'odd-panel',
			error: new Error( 'nope' ),
		} );

		const log = window.__odd.diagnostics.recent().map( ( row ) => row.message );
		expect( log.some( ( row ) => row.includes( 'wp-desktop.command.before-run' ) ) ).toBe( true );
		expect( log.some( ( row ) => row.includes( 'wp-desktop.command.error' ) ) ).toBe( true );
	} );
} );
