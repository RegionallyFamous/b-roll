import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFoundation } from './harness.js';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const SRC = resolve( __dirname, '../../src/apps/window-host.js' );

function loadWindowHost() {
	const src = readFileSync( SRC, 'utf8' );
	const fn = new Function( `${ src }\n//# sourceURL=window-host.js` );
	fn.call( globalThis );
}

describe( 'ODD app window host', () => {
	beforeEach( () => {
		document.body.innerHTML = '';
		delete window.wpDesktopNativeWindows;
		loadFoundation( {
			config: {
				userApps:     { installed: [ 'demo' ], pinned: [] },
				appServeUrls: { demo: '/odd-app/demo/' },
			},
		} );
	} );

	it( 'marks native-window content loading and loaded around iframe hydration', () => {
		loadWindowHost();
		const body = document.createElement( 'div' );
		document.body.appendChild( body );
		const markContentLoading = vi.fn();
		const markContentLoaded = vi.fn();

		window.wpDesktopNativeWindows[ 'odd-app-demo' ]( body, {
			window: { markContentLoading, markContentLoaded },
		} );

		expect( markContentLoading ).toHaveBeenCalledTimes( 1 );
		const frame = body.querySelector( 'iframe.odd-app-frame' );
		expect( frame ).toBeTruthy();

		frame.dispatchEvent( new Event( 'load' ) );
		expect( markContentLoaded ).toHaveBeenCalledTimes( 1 );
		const metrics = window.__odd.diagnostics.metrics();
		expect( metrics.counters[ 'app.iframe.loaded' ] ).toBe( 1 );
		expect( metrics.timings.some( ( row ) => row.name === 'app.iframe.load' && row.meta.slug === 'demo' ) ).toBe( true );
	} );

	it( 'surfaces a visible error when an app has no serve URL', () => {
		window.odd.appServeUrls = {};
		loadWindowHost();
		const body = document.createElement( 'div' );
		document.body.appendChild( body );
		const errors = [];
		window.__odd.events.on( 'odd.iframe-error', ( payload ) => errors.push( payload ) );

		window.wpDesktopNativeWindows[ 'odd-app-demo' ]( body, {} );

		expect( body.querySelector( 'iframe.odd-app-frame' ) ).toBeNull();
		expect( body.textContent ).toContain( 'No serve URL is registered' );
		expect( errors.some( ( row ) => row.message === 'odd-apps: missing app serve URL' ) ).toBe( true );
		expect( window.__odd.diagnostics.metrics().counters[ 'app.iframe.skipped' ] ).toBe( 1 );
	} );
} );
