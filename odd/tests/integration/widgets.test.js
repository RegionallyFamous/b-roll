/**
 * widgets.test.js — smoke-test the two stock ODD widget bundles.
 *
 * v3.0+ the widgets ship as separate catalog bundles under
 * `_tools/catalog-sources/widgets/sticky/` and `.../eight-ball/`.
 * Each bundle self-registers through `wp.desktop.registerWidget`;
 * this test loads both bundle sources, captures the registration
 * calls, then mounts each widget against a detached DOM container
 * and exercises the minimum interactions:
 *
 *   - Sticky: typing saves to localStorage after the debounce window.
 *   - Eight-ball: clicking adds `.is-shaking`, swaps the answer,
 *     and every decorative child has computed `pointer-events: none`.
 *
 * The pointer-events check is a direct regression guard for the
 * Magic 8-Ball fix in v1.4.3 — before the fix, clicks were eaten
 * by the shine/window/badge overlays and the ball never responded.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const WIDGETS_ROOT = resolve( __dirname, '../../../_tools/catalog-sources/widgets' );
const STICKY_JS    = resolve( WIDGETS_ROOT, 'sticky/widget.js' );
const STICKY_CSS   = resolve( WIDGETS_ROOT, 'sticky/widget.css' );
const EIGHTBALL_JS  = resolve( WIDGETS_ROOT, 'eight-ball/widget.js' );
const EIGHTBALL_CSS = resolve( WIDGETS_ROOT, 'eight-ball/widget.css' );

function installWpDesktop() {
	const calls = [];
	window.wp = window.wp || {};
	window.wp.desktop = {
		registerWidget: ( def ) => { calls.push( def ); },
		ready: ( cb ) => cb(),
	};
	return calls;
}

/**
 * Vitest's jsdom build ships without a complete Storage implementation.
 * Install a small in-memory shim before each test so the widgets can
 * read/write localStorage without blowing up.
 */
function clearStorage() {
	const store = new Map();
	const api = {
		getItem:    ( k ) => ( store.has( k ) ? store.get( k ) : null ),
		setItem:    ( k, v ) => { store.set( String( k ), String( v ) ); },
		removeItem: ( k ) => { store.delete( k ); },
		clear:      () => { store.clear(); },
		key:        ( i ) => Array.from( store.keys() )[ i ] ?? null,
		get length() { return store.size; },
	};
	Object.defineProperty( window, 'localStorage', {
		value: api,
		configurable: true,
		writable: true,
	} );
}

function injectWidgetStyles() {
	const css = readFileSync( STICKY_CSS, 'utf8' ) + '\n' + readFileSync( EIGHTBALL_CSS, 'utf8' );
	const style = document.createElement( 'style' );
	style.id = 'odd-widgets-style';
	style.textContent = css;
	document.head.appendChild( style );
}

function loadWidgets() {
	for ( const [ js, name ] of [
		[ STICKY_JS,    'widgets/sticky/widget.js' ],
		[ EIGHTBALL_JS, 'widgets/eight-ball/widget.js' ],
	] ) {
		const src = readFileSync( js, 'utf8' );
		const fn = new Function( `${ src }\n//# sourceURL=${ name }` );
		fn.call( globalThis );
	}
}

describe( 'widgets registration', () => {
	let captured;

	beforeEach( () => {
		document.body.innerHTML = '';
		clearStorage();
		captured = installWpDesktop();
		loadWidgets();
	} );

	afterEach( () => {
		const s = document.getElementById( 'odd-widgets-style' );
		if ( s ) s.remove();
		vi.useRealTimers();
	} );

	it( 'registers two widgets with required fields', () => {
		expect( captured.length ).toBe( 2 );
		for ( const def of captured ) {
			expect( def.id ).toMatch( /^odd\// );
			expect( typeof def.label ).toBe( 'string' );
			expect( typeof def.icon ).toBe( 'string' );
			expect( typeof def.mount ).toBe( 'function' );
			expect( def.minWidth ).toBeGreaterThan( 0 );
			expect( def.minHeight ).toBeGreaterThan( 0 );
			expect( def.defaultWidth ).toBeGreaterThanOrEqual( def.minWidth );
			expect( def.defaultHeight ).toBeGreaterThanOrEqual( def.minHeight );
		}
		const ids = captured.map( ( d ) => d.id ).sort();
		expect( ids ).toEqual( [ 'odd/eight-ball', 'odd/sticky' ] );
	} );
} );

describe( 'sticky widget', () => {
	let captured;

	beforeEach( () => {
		document.body.innerHTML = '';
		clearStorage();
		captured = installWpDesktop();
		loadWidgets();
	} );

	it( 'mounts, auto-saves text after the debounce window, and cleans up', () => {
		vi.useFakeTimers();

		const def = captured.find( ( d ) => d.id === 'odd/sticky' );
		const container = document.createElement( 'div' );
		document.body.appendChild( container );

		const cleanup = def.mount( container, {} );

		expect( container.querySelector( '.odd-sticky__paper' ) ).toBeTruthy();
		const ta = container.querySelector( 'textarea.odd-sticky__text' );
		expect( ta ).toBeTruthy();

		ta.value = 'hello sticky';
		ta.dispatchEvent( new Event( 'input' ) );

		vi.advanceTimersByTime( 500 );
		expect( window.localStorage.getItem( 'odd:sticky' ) ).toBe( 'hello sticky' );

		expect( typeof cleanup ).toBe( 'function' );
		expect( () => cleanup() ).not.toThrow();
	} );

	it( 'restores prior content from localStorage on mount', () => {
		window.localStorage.setItem( 'odd:sticky', 'from before' );

		const def = captured.find( ( d ) => d.id === 'odd/sticky' );
		const container = document.createElement( 'div' );
		const cleanup = def.mount( container, {} );

		const ta = container.querySelector( 'textarea.odd-sticky__text' );
		expect( ta.value ).toBe( 'from before' );
		cleanup();
	} );
} );

describe( 'eight-ball widget', () => {
	let captured;

	beforeEach( () => {
		document.body.innerHTML = '';
		clearStorage();
		captured = installWpDesktop();
		injectWidgetStyles();
		loadWidgets();
	} );

	it( 'mounts, reacts to clicks, cycles the answer, and cleans up', () => {
		vi.useFakeTimers();

		const def = captured.find( ( d ) => d.id === 'odd/eight-ball' );
		const container = document.createElement( 'div' );
		document.body.appendChild( container );

		const cleanup = def.mount( container, {} );

		const stage  = container.querySelector( '.odd-eight__stage' );
		const ball   = container.querySelector( '.odd-eight__ball' );
		const answer = container.querySelector( '.odd-eight__answer' );

		expect( stage ).toBeTruthy();
		expect( ball ).toBeTruthy();
		expect( answer ).toBeTruthy();
		expect( answer.textContent ).toBe( 'Ask a question' );

		stage.dispatchEvent( new MouseEvent( 'click', { bubbles: true, cancelable: true } ) );

		expect( ball.classList.contains( 'is-shaking' ) ).toBe( true );

		vi.advanceTimersByTime( 600 );

		expect( ball.classList.contains( 'is-shaking' ) ).toBe( false );
		expect( answer.textContent ).not.toBe( 'Ask a question' );

		cleanup();
	} );

	it( 'pointer-events: none on every decorative child (regression guard)', () => {
		const def = captured.find( ( d ) => d.id === 'odd/eight-ball' );
		const container = document.createElement( 'div' );
		document.body.appendChild( container );
		def.mount( container, {} );

		const decorative = [
			'.odd-eight__shine',
			'.odd-eight__badge',
			'.odd-eight__window',
			'.odd-eight__triangle',
		];

		for ( const sel of decorative ) {
			const node = container.querySelector( sel );
			expect( node, `missing decorative element ${ sel }` ).toBeTruthy();
			const computed = window.getComputedStyle( node );
			expect( computed.pointerEvents, `${ sel } must have pointer-events: none` ).toBe( 'none' );
		}

		// The stage button itself must remain clickable.
		const stage = container.querySelector( '.odd-eight__stage' );
		const stageComputed = window.getComputedStyle( stage );
		expect( stageComputed.pointerEvents ).not.toBe( 'none' );
	} );
} );
