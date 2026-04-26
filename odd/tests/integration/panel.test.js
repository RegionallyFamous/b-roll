/**
 * panel.test.js — smoke-test the ODD Shop render pipeline.
 *
 * Loads odd/src/panel/index.js, which registers a render callback on
 * `window.wpDesktopNativeWindows.odd`. We invoke the callback against
 * a detached host element with a stubbed `window.odd` config and
 * stubbed global.fetch, then exercise the critical paths:
 *
 *   - Rail lists the expected departments (Wallpapers, Icon Sets, About).
 *   - Wallpaper department renders franchise shelves + scene cards.
 *   - Clicking a scene card opens the preview bar.
 *   - Clicking "Keep" POSTs /odd/v1/prefs with { wallpaper: slug }.
 *   - Clicking "Cancel" clears the preview bar.
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
		expect( railLabels ).toEqual( expect.arrayContaining( [ 'Wallpapers', 'Icon Sets', 'About' ] ) );

		// Wallpapers department groups scenes by category; with
		// three slugs that map to three distinct categories
		// (Forms / Skies / Wilds), we should see three shelves.
		const shelves = host.querySelectorAll( '.odd-shop__shelf' );
		expect( shelves.length ).toBe( 3 );

		const cards = host.querySelectorAll( '.odd-card[data-slug]' );
		expect( cards.length ).toBe( 3 );

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
} );
