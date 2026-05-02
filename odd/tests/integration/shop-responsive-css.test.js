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

	it( 'ships a mobile escape hatch that pins the Shop to the browser viewport', () => {
		const css = readFileSync( STYLES_CSS, 'utf8' );

		// The escape hatch MUST be triggered by a JS-set attribute,
		// not a media query — container queries can't see past the
		// native window body, and `@media (pointer: coarse)` alone
		// would kick in on tablet landscape when we want the normal
		// windowed layout there.
		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-mobile="true"]{position:fixed!important;inset:0!important' );
		expect( css ).toContain( 'body.odd-shop-mobile-escape{overflow:hidden!important' );
		// Close handle is invisible outside escape mode and a real
		// 44px tap target inside it.
		expect( css ).toContain( '.odd-shop__mobile-close{display:none}' );
		expect( css ).toMatch( /odd-shop__mobile-close\{display:inline-flex;[^}]*width:44px;height:44px/ );
		// Coarse-pointer ergonomics — no hover lift, no scroll
		// arrows, taller tap targets for rail items + buttons.
		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-pointer="coarse"] .odd-shop__slider-btn{display:none!important}' );
		expect( css ).toMatch( /data-odd-pointer="coarse"\][^{]*odd-shop__rail-item\{min-height:48px/ );
	} );
} );
