import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const STYLES_CSS = resolve( __dirname, '../../src/panel/styles.css' );

describe( 'ODD Shop responsive CSS contract', () => {
	it( 'uses the mobile store layout for native-window XS and S sizes', () => {
		const css = readFileSync( STYLES_CSS, 'utf8' );

		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-size="xs"],.odd-panel.odd-shop[data-odd-size="s"]{grid-template-rows:auto auto minmax(0,1fr)!important;grid-template-columns:1fr!important}' );
		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-size="xs"] .odd-shop__rail,.odd-panel.odd-shop[data-odd-size="s"] .odd-shop__rail{grid-column:1;grid-row:2;display:flex;flex-direction:row' );
		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-size="xs"] .odd-shop__content,.odd-panel.odd-shop[data-odd-size="s"] .odd-shop__content{grid-column:1;grid-row:3' );
		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-size="xs"] .odd-shop__install-type,.odd-panel.odd-shop[data-odd-size="s"] .odd-shop__install-type{min-height:0' );
	} );
} );
