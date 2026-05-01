import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const WALLPAPER_JS = resolve( __dirname, '../../src/wallpaper/index.js' );

describe( 'wallpaper desktop env contract', () => {
	it( 'seeds env.desktop from the shared desktopState reference', () => {
		const src = readFileSync( WALLPAPER_JS, 'utf8' );

		expect( src ).toContain( 'function desktopStateRef()' );
		expect( src ).toContain( 'desktop:  desktopStateRef()' );
	} );

	it( 'leaves odd.visibility-changed emission to the Desktop Mode hook bridge', () => {
		const src = readFileSync( WALLPAPER_JS, 'utf8' );

		expect( src ).not.toContain( "emitBus( 'odd.visibility-changed'" );
		expect( src ).not.toContain( 'emitBus( "odd.visibility-changed"' );
	} );
} );
