/**
 * api-surface.test.js — guard the documented extension surface.
 *
 * The full contract lives in docs/api-versioning.md. This test is
 * intentionally narrow: it asserts that the version string is present
 * and SemVer-shaped, and that the documented top-level methods are
 * still reachable. Anything more nuanced (per-method behaviour) is
 * covered by the surface-specific tests elsewhere in this folder.
 *
 * When you intentionally remove/rename a method, update this list
 * AND bump the major in api.js's API_VERSION constant AND add a line
 * to the changelog under "API breaking changes". The three have to
 * move together — that's the point.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFoundation } from './harness.js';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const SHARED_DIR = resolve( __dirname, '../../src/shared' );

const EXPECTED_METHODS = [
	'scenes', 'sceneBySlug', 'currentScene',
	'iconSets', 'iconSetBySlug', 'currentIconSet',
	'savePrefs', 'setScene', 'setIconSet', 'shuffle',
	'toast', 'onSceneChange', 'onIconSetChange', 'openPanel',
];

const EXPECTED_CONSTANTS = [ 'HOOK_SCENE', 'HOOK_ICONSET', 'TOAST_TONE' ];

describe( 'window.__odd.api surface', () => {
	it( 'loads and exposes a SemVer version + documented methods', () => {
		loadFoundation();
		const src = readFileSync( resolve( SHARED_DIR, 'api.js' ), 'utf8' );
		const fn = new Function( `${ src }\n//# sourceURL=api.js` );
		fn.call( globalThis );

		const api = window.__odd.api;
		expect( api, 'window.__odd.api must be installed' ).toBeDefined();
		expect( typeof api.version, 'api.version must be a string' ).toBe( 'string' );
		expect( api.version ).toMatch( /^\d+\.\d+\.\d+$/ );

		for ( const method of EXPECTED_METHODS ) {
			expect( typeof api[ method ], `api.${ method } must be a function` ).toBe( 'function' );
		}
		for ( const k of EXPECTED_CONSTANTS ) {
			expect( typeof api[ k ], `api.${ k } must be a string constant` ).toBe( 'string' );
		}
	} );
} );
