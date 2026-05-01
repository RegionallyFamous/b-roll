/**
 * panel.test.js — smoke-test the ODD Shop render pipeline.
 *
 * Loads odd/src/panel/index.js, which registers a render callback on
 * `window.wpDesktopNativeWindows.odd`. We invoke the callback against
 * a detached host element with a stubbed `window.odd` config and
 * stubbed global.fetch, then exercise the critical paths:
 *
 *   - Rail lists the expected departments (Wallpapers, Icon Sets,
 *     Widgets, About).
 *   - Wallpaper department renders franchise shelves + scene cards.
 *   - Clicking a scene card opens the preview bar.
 *   - Clicking "Keep" POSTs /odd/v1/prefs with { wallpaper: slug }.
 *   - Clicking "Cancel" clears the preview bar.
 *   - Widgets department renders a widget shelf with Add/Remove buttons
 *     wired to `wp.desktop.widgetLayer`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const PANEL_JS = resolve( __dirname, '../../src/panel/index.js' );

function seedConfig() {
	window.odd = {
		pluginUrl: '',
		version:   'test',
		restUrl:   '/wp-json/odd/v1/prefs',
		restNonce: 'nonce-abc',
		bundlesUploadUrl: '/wp-json/odd/v1/bundles/upload',
		bundleCatalogUrl: '/wp-json/odd/v1/bundles/catalog',
		canInstall:       true,
		// Widgets are installed as catalog bundles and the
		// panel renders whatever the server reports in this list.
		// The two stock widgets live at `_tools/catalog-sources/
		// widgets/{sticky,eight-ball}/` — seed them here so the
		// Widgets-department test has cards to click.
		installedWidgets: [
			{ id: 'odd/sticky',     slug: 'sticky',     label: 'Sticky Note',    description: 'Tilted handwritten note that auto-saves.' },
			{ id: 'odd/eight-ball', slug: 'eight-ball', label: 'Magic 8-Ball',   description: 'Shake for definitive-ish WordPress advice.' },
		],
		wallpaper: 'flux',
		scene:     'flux',
		// Three slugs, three distinct categories: flux→Forms,
		// aurora→Skies, circuit-garden→Wilds. Lets us assert the
		// shelf grouping without depending on the per-franchise
		// labels that no longer drive layout.
		scenes: [
			{ slug: 'flux',           label: 'Flux',           franchise: 'Generative',    tags: [], fallbackColor: '#222233' },
			{ slug: 'aurora',         label: 'Aurora',         franchise: 'Atmosphere',    tags: [], fallbackColor: '#112233' },
			{ slug: 'circuit-garden', label: 'Circuit Garden', franchise: 'ODD Originals', tags: [], fallbackColor: '#0b1a10' },
		],
		theme: 'auto',
		chaosMode: false,
		sets: [
			{ slug: 'filament', label: 'Filament', franchise: 'Filament', accent: '#ff7a3c', icons: { dashboard: '', fallback: '' } },
		],
		iconSet:     '',
		favorites:   [],
		recents:     [],
		shuffle:     { enabled: false, minutes: 15 },
		screensaver: { enabled: false, minutes: 10, scene: 'current' },
		audioReactive: false,
		appsEnabled: false,
		apps:        [],
		userApps:    { installed: [], pinned: [] },
		systemHealth: {
			catalog: { source: 'fallback_file', bundle_count: 12, last_error_message: 'offline' },
			starter: { status: 'partial' },
			apps: { installed: 2 },
		},
	};
}

function installHooks() {
	const handlers = new Map();
	window.wp = window.wp || {};
	window.wp.hooks = {
		doAction: ( name, ...args ) => {
			( handlers.get( name ) || [] ).forEach( ( h ) => h( ...args ) );
		},
		addAction: ( name, _ns, fn ) => {
			if ( ! handlers.has( name ) ) handlers.set( name, [] );
			handlers.get( name ).push( fn );
		},
		removeAction: () => {},
		applyFilters: ( _name, value ) => value,
	};
}

function installWidgetLayer() {
	const calls = { add: [], remove: [] };
	let enabled = [];
	window.wp = window.wp || {};
	window.wp.desktop = window.wp.desktop || {};
	window.wp.desktop.widgetLayer = {
		add: ( id ) => { calls.add.push( id ); if ( ! enabled.includes( id ) ) enabled.push( id ); },
		remove: ( id ) => { calls.remove.push( id ); enabled = enabled.filter( ( x ) => x !== id ); },
		getEnabledIds: () => [ ...enabled ],
		__setEnabled: ( ids ) => { enabled = ids.slice(); },
	};
	return calls;
}

function loadPanel() {
	const src = readFileSync( PANEL_JS, 'utf8' );
	const fn = new Function( `${ src }\n//# sourceURL=panel/index.js` );
	fn.call( globalThis );
}

function mountPanel() {
	const host = document.createElement( 'div' );
	host.style.width = '900px';
	host.style.height = '600px';
	document.body.appendChild( host );
	const cleanup = window.wpDesktopNativeWindows.odd( host );
	return { host, cleanup };
}

describe( 'ODD Shop', () => {
	let fetchMock;

	beforeEach( () => {
		document.body.innerHTML = '';
		const existing = document.getElementById( 'odd-panel-styles' );
		if ( existing ) existing.remove();
		delete window.wpDesktopNativeWindows;
		if ( window.wp && window.wp.desktop ) delete window.wp.desktop.widgetLayer;
		try { window.localStorage.removeItem( 'wp-desktop-widgets' ); } catch ( e ) {}
		seedConfig();
		installHooks();

		fetchMock = vi.fn( () => Promise.resolve( {
			ok:   true,
			json: () => Promise.resolve( { wallpaper: 'aurora' } ),
		} ) );
		globalThis.fetch = fetchMock;

		loadPanel();
	} );

	afterEach( () => {
		delete globalThis.fetch;
	} );

	it( 'registers a render callback under window.wpDesktopNativeWindows.odd', () => {
		expect( typeof window.wpDesktopNativeWindows.odd ).toBe( 'function' );
	} );

	it( 'renders the department rail + shelf-grouped scene grid', () => {
		const { host, cleanup } = mountPanel();

		// Each rail button carries its store label inside a dedicated
		// node; scan `.odd-shop__rail-label strong` rather than the whole
		// button text (which also contains the glyph + tagline).
		const railLabels = Array.from( host.querySelectorAll( '.odd-shop__rail-label strong' ) )
			.map( ( n ) => n.textContent.trim() );
		expect( railLabels ).toEqual( expect.arrayContaining( [ 'Wallpapers', 'Icon Sets', 'Widgets', 'About' ] ) );
		const railGroups = Array.from( host.querySelectorAll( '.odd-shop__rail-group-heading' ) )
			.map( ( n ) => n.textContent.trim() );
		expect( railGroups ).toEqual( [ 'Decorate', 'Do more', 'You' ] );

		// Wallpapers department groups scenes by category; with
		// three slugs that map to three distinct categories
		// (Forms / Skies / Wilds), we should see three shelves.
		const shelves = host.querySelectorAll( '.odd-shop__shelf' );
		expect( shelves.length ).toBe( 3 );

		const cards = host.querySelectorAll( '.odd-card[data-slug]' );
		expect( cards.length ).toBe( 3 );

		if ( typeof cleanup === 'function' ) cleanup();
	} );

	it( 'keeps heroSafe:false scenes out of the live wallpaper hero', () => {
		window.odd.wallpaper = 'aurora';
		window.odd.scene = 'aurora';
		window.odd.scenes = [
			{ slug: 'flux', label: 'Flux', franchise: 'Generative', tags: [], fallbackColor: '#222233' },
			{ slug: 'aurora', label: 'Aurora', franchise: 'Atmosphere', tags: [], fallbackColor: '#112233', heroSafe: false },
		];
		const { host, cleanup } = mountPanel();

		expect( host.querySelector( '.odd-shop__hero' )?.getAttribute( 'data-hero-slug' ) ).toBe( 'flux' );

		if ( typeof cleanup === 'function' ) cleanup();
	} );

	it( 'clicking a scene card opens the preview bar and highlights the card', () => {
		const { host, cleanup } = mountPanel();

		const target = host.querySelector( '.odd-card[data-slug="aurora"]' );
		expect( target ).toBeTruthy();
		target.dispatchEvent( new MouseEvent( 'click', { bubbles: true, cancelable: true } ) );

		const bar = host.querySelector( '[data-odd-preview-bar]' );
		expect( bar, 'preview bar must appear after clicking a scene card' ).toBeTruthy();
		expect( target.classList.contains( 'is-previewing' ) ).toBe( true );

		if ( typeof cleanup === 'function' ) cleanup();
	} );

	it( 'clicking "Keep" posts /odd/v1/prefs with the picked scene and clears the bar', async () => {
		const { host, cleanup } = mountPanel();

		host.querySelector( '.odd-card[data-slug="aurora"]' )
			.dispatchEvent( new MouseEvent( 'click', { bubbles: true, cancelable: true } ) );

		const keep = Array.from( host.querySelectorAll( '.odd-preview-bar__actions button' ) )
			.find( ( b ) => b.textContent.trim() === 'Keep' );
		expect( keep, 'Keep button must be present in the preview bar' ).toBeTruthy();
		keep.dispatchEvent( new MouseEvent( 'click', { bubbles: true, cancelable: true } ) );

		expect( fetchMock ).toHaveBeenCalled();
		const [ url, opts ] = fetchMock.mock.calls[ 0 ];
		expect( url ).toContain( '/odd/v1/prefs' );
		expect( opts.method ).toBe( 'POST' );
		expect( JSON.parse( opts.body ) ).toMatchObject( { wallpaper: 'aurora' } );

		// Wait for the fetch chain to flush the state updates.
		await new Promise( ( r ) => setTimeout( r, 0 ) );
		await new Promise( ( r ) => setTimeout( r, 0 ) );
		await new Promise( ( r ) => setTimeout( r, 0 ) );

		const bar = host.querySelector( '[data-odd-preview-bar]' );
		expect( bar, 'preview bar should clear after Keep' ).toBeFalsy();

		if ( typeof cleanup === 'function' ) cleanup();
	} );

	it( 'clicking "Cancel" clears the preview bar without POSTing', () => {
		const { host, cleanup } = mountPanel();

		host.querySelector( '.odd-card[data-slug="aurora"]' )
			.dispatchEvent( new MouseEvent( 'click', { bubbles: true, cancelable: true } ) );

		const cancel = Array.from( host.querySelectorAll( '.odd-preview-bar__actions button' ) )
			.find( ( b ) => b.textContent.trim() === 'Cancel' );
		expect( cancel ).toBeTruthy();
		cancel.dispatchEvent( new MouseEvent( 'click', { bubbles: true, cancelable: true } ) );

		expect( host.querySelector( '[data-odd-preview-bar]' ) ).toBeFalsy();
		expect( fetchMock ).not.toHaveBeenCalled();

		if ( typeof cleanup === 'function' ) cleanup();
	} );

	it( 'does not render a topbar Install pill — uploads go through the dedicated Install tab', () => {
		const { host, cleanup } = mountPanel();

		// The topbar Install pill was removed in favor of the
		// dedicated Install rail tab + the shop-wide drop overlay.
		// Guard against it sneaking back in via a casual edit.
		expect( host.querySelector( '[data-odd-install-pill]' ) ).toBeFalsy();
		expect( host.querySelector( '[data-odd-install-input]' ) ).toBeFalsy();

		if ( typeof cleanup === 'function' ) cleanup();
	} );

	it( 'searches across departments and renders unified results', () => {
		window.odd.iconSets = [
			{ slug: 'filament', label: 'Filament', franchise: 'ODD Defaults', accent: '#ff7a3c', icons: { dashboard: '', fallback: '' } },
		];
		const { host, cleanup } = mountPanel();

		const search = host.querySelector( '[data-odd-search]' );
		search.value = 'filament';
		search.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( host.querySelector( '.odd-section-header h2' ).textContent.trim() ).toBe( 'Search' );
		expect( host.querySelector( '[data-odd-shop-card][data-set-slug="filament"]' ) ).toBeTruthy();
		const shelfTitles = Array.from( host.querySelectorAll( '.odd-shop__shelf-title' ) )
			.map( ( node ) => node.textContent.trim() );
		expect( shelfTitles ).toContain( 'Icon Sets' );

		if ( typeof cleanup === 'function' ) cleanup();
	} );

	it( 'Settings renders server-provided system health and copy diagnostics action', () => {
		window.__odd = window.__odd || {};
		window.__odd.diagnostics = { copy: vi.fn( () => Promise.resolve( true ) ) };
		const { host, cleanup } = mountPanel();

		const settingsTab = Array.from( host.querySelectorAll( '.odd-shop__rail-item' ) )
			.find( ( b ) => b.querySelector( '.odd-shop__rail-label strong' )?.textContent.trim() === 'Settings' );
		settingsTab.dispatchEvent( new MouseEvent( 'click', { bubbles: true, cancelable: true } ) );

		const health = host.querySelector( '.odd-shop__health' );
		expect( health ).toBeTruthy();
		expect( health.textContent ).toContain( 'fallback file' );
		expect( health.textContent ).toContain( 'Starter: partial' );
		const copy = Array.from( health.querySelectorAll( 'button' ) )
			.find( ( b ) => b.textContent.trim() === 'Copy diagnostics' );
		copy.dispatchEvent( new MouseEvent( 'click', { bubbles: true, cancelable: true } ) );
		expect( window.__odd.diagnostics.copy ).toHaveBeenCalled();

		if ( typeof cleanup === 'function' ) cleanup();
	} );

	it( 'Widgets department renders unified widget cards with the Add/Active state machine', () => {
		const calls = installWidgetLayer();
		const { host, cleanup } = mountPanel();

		// Switch to the Widgets tab.
		const widgetsTab = Array.from( host.querySelectorAll( '.odd-shop__rail-item' ) )
			.find( ( b ) => b.querySelector( '.odd-shop__rail-label strong' )?.textContent.trim() === 'Widgets' );
		expect( widgetsTab, 'Widgets rail button must be present' ).toBeTruthy();
		widgetsTab.dispatchEvent( new MouseEvent( 'click', { bubbles: true, cancelable: true } ) );

		// Both ODD widgets should render as unified tiles.
		const cards = host.querySelectorAll( '[data-odd-shop-card][data-odd-card-type="widget"]' );
		expect( cards.length ).toBe( 2 );

		const stickyCard = host.querySelector( '.odd-shop__tile--widget[data-widget-id="odd/sticky"]' );
		expect( stickyCard, 'sticky card must be rendered' ).toBeTruthy();

		// Installed-but-not-on-desktop widgets show `Add`.
		const addBtn = stickyCard.parentNode.querySelector( '.odd-shop__card-btn' );
		expect( addBtn.textContent.trim() ).toBe( 'Add' );
		addBtn.dispatchEvent( new MouseEvent( 'click', { bubbles: true, cancelable: true } ) );
		expect( calls.add ).toEqual( [ 'odd/sticky' ] );

		// After add the card flips to `Active` (disabled) and the
		// wrap is marked `.is-active`. The plan explicitly keeps
		// Remove out of the card surface — removal happens from
		// the desktop widget chrome itself.
		const refreshedSticky = host.querySelector( '.odd-shop__tile--widget[data-widget-id="odd/sticky"]' );
		const refreshedWrap   = refreshedSticky.closest( '.odd-shop__card-wrap' );
		expect( refreshedWrap.classList.contains( 'is-active' ) ).toBe( true );
		const activeBtn = refreshedWrap.querySelector( '.odd-shop__card-btn' );
		expect( activeBtn.textContent.trim() ).toBe( 'Active' );
		expect( activeBtn.disabled ).toBe( true );

		if ( typeof cleanup === 'function' ) cleanup();
	} );
} );
