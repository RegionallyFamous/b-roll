import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const CURSORS_JS = resolve( __dirname, '../../src/cursors/index.js' );

function installHooks() {
	const handlers = new Map();
	window.wp = {
		hooks: {
			addAction: ( name, _ns, fn ) => {
				if ( ! handlers.has( name ) ) handlers.set( name, [] );
				handlers.get( name ).push( fn );
			},
			doAction: ( name, ...args ) => {
				( handlers.get( name ) || [] ).forEach( ( fn ) => fn( ...args ) );
			},
		},
	};
}

function loadRuntime() {
	const src = readFileSync( CURSORS_JS, 'utf8' );
	const fn = new Function( `${ src }\n//# sourceURL=cursors/index.js` );
	fn.call( globalThis );
}

describe( 'ODD cursor runtime', () => {
	beforeEach( () => {
		document.head.innerHTML = '';
		document.body.innerHTML = '';
		delete document.__oddCursorBridge;
		window.__odd = { debug: {} };
		window.odd = {
			cursorSet:        'oddlings-cursors',
			cursorStylesheet: '/wp-json/odd/v1/cursors/active.css?set=oddlings-cursors&v=test',
			cursorSets:       [
				{
					slug:    'oddlings-cursors',
					cursors: {
						default: { url: 'https://example.com/default.svg', hotspot: [ 4, 4 ] },
						pointer: { url: 'https://example.com/pointer.svg', hotspot: [ 18, 6 ] },
					},
				},
			],
		};
		delete window.wpDesktopConfig;
		installHooks();
	} );

	it( 'creates the cursor stylesheet link on boot', () => {
		loadRuntime();

		const link = document.getElementById( 'odd-cursors-css' );
		expect( link ).toBeTruthy();
		expect( link.getAttribute( 'href' ) ).toContain( 'set=oddlings-cursors' );
		expect( window.__odd.debug.cursors().link ).toBe( true );
	} );

	it( 'updates and clears the existing link through the public API', () => {
		loadRuntime();

		window.__odd.cursors.apply( '/cursor.css?set=other', 'other' );
		expect( document.getElementById( 'odd-cursors-css' ).getAttribute( 'href' ) ).toBe( '/cursor.css?set=other' );
		expect( window.odd.cursorSet ).toBe( 'other' );

		window.__odd.cursors.clear();
		expect( document.getElementById( 'odd-cursors-css' ) ).toBeNull();
		expect( window.odd.cursorStylesheet ).toBe( '' );
	} );

	it( 'responds to the odd.cursorSet hook', () => {
		loadRuntime();

		window.wp.hooks.doAction( 'odd.cursorSet', 'preview-cursors', '/cursor.css?set=preview-cursors' );

		const link = document.getElementById( 'odd-cursors-css' );
		expect( link.getAttribute( 'href' ) ).toBe( '/cursor.css?set=preview-cursors' );
		expect( window.__odd.cursors.status().activeSlug ).toBe( 'preview-cursors' );
	} );

	it( 'injects the current stylesheet into same-origin iframe documents', () => {
		loadRuntime();
		const iframeDoc = document.implementation.createHTMLDocument( 'frame' );

		window.__odd.cursors.injectInto( iframeDoc );

		const link = iframeDoc.getElementById( 'odd-cursors-css' );
		expect( link ).toBeTruthy();
		expect( link.getAttribute( 'href' ) ).toContain( 'set=oddlings-cursors' );
	} );

	it( 'bridges host elements that compute to native pointer cursors', () => {
		loadRuntime();
		const button = document.createElement( 'button' );
		button.style.cursor = 'pointer';
		document.body.appendChild( button );

		window.__odd.cursors.bridgeTarget( button );

		expect( button.style.cursor ).toContain( 'pointer.svg' );
		expect( window.__odd.cursors.status().bridged ).toBe( 1 );

		window.__odd.cursors.clear();
		expect( button.style.cursor ).toBe( 'pointer' );
	} );
} );
