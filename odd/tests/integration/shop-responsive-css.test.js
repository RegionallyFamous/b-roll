import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const STYLES_CSS = resolve( __dirname, '../../src/panel/styles.css' );

describe( 'ODD Shop responsive CSS contract', () => {
	it( 'uses data-odd-layout as the structural responsive contract', () => {
		const css = readFileSync( STYLES_CSS, 'utf8' );

		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-layout="mobile"]{grid-template-rows:auto auto minmax(0,1fr)!important;grid-template-columns:1fr!important;overflow:hidden}' );
		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-layout="compact"]{grid-template-columns:64px minmax(0,1fr)!important}' );
		expect( css ).toContain( 'data-odd-pointer` owns touch ergonomics; `data-odd-mobile` only' );
	} );

	it( 'keeps mobile sticky chrome from overlapping', () => {
		const css = readFileSync( STYLES_CSS, 'utf8' );

		expect( css ).toContain( '--odd-shop-mobile-topbar-h:104px' );
		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-layout="mobile"] .odd-shop__topbar{grid-column:1;grid-row:1' );
		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-layout="mobile"] .odd-shop__rail{grid-column:1;grid-row:2' );
		expect( css ).toContain( 'top:var(--odd-shop-mobile-topbar-h)' );
		expect( css ).toContain( 'padding-right:max(68px,calc(14px + env(safe-area-inset-right) + 54px))' );
	} );

	it( 'stacks shelves and catalog rows in mobile layout', () => {
		const css = readFileSync( STYLES_CSS, 'utf8' );

		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-layout="mobile"] .odd-shop__shelf-track{display:grid;grid-template-columns:1fr;gap:12px;overflow:visible;scroll-snap-type:none;padding:0;margin:0}' );
		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-layout="mobile"] .odd-shop__shelf-track--tiles{grid-template-columns:repeat(auto-fill,minmax(min(100%,168px),1fr))}' );
		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-layout="mobile"] .odd-shop__shelf-track--list > .odd-catalog-row,.odd-panel.odd-shop[data-odd-layout="mobile"] .odd-catalog-row{display:grid;grid-template-columns:72px minmax(0,1fr)' );
		expect( css ).toContain( '.odd-panel.odd-shop[data-odd-layout="mobile"] .odd-catalog-row__actions{grid-column:1/-1' );
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
