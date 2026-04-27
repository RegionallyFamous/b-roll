/**
 * Harness self-test. Runs against the example-scene and example-widget
 * bundles in this repo so we catch regressions before they reach
 * downstream authors.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountScene, mountWidget, makeEnv, createPixiStub, reset } from '../index.js';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const REPO_ROOT = resolve( __dirname, '../../..' );

describe( '@odd/test-harness', () => {
	afterEach( () => reset() );

	it( 'mounts the example-rainbow scene and runs ticks', async () => {
		const src = readFileSync( resolve( REPO_ROOT, 'examples/example-scene/scene.js' ), 'utf8' );
		const scene = await mountScene( { slug: 'example-rainbow', source: src } );
		expect( typeof scene.setup ).toBe( 'function' );
		expect( typeof scene.tick ).toBe( 'function' );

		const env = makeEnv( { tier: 'normal' } );
		const state = scene.setup( env );
		for ( let i = 0; i < 30; i++ ) scene.tick( state, env );
	} );

	it( 'mounts the example-hello widget', async () => {
		const src = readFileSync( resolve( REPO_ROOT, 'examples/example-widget/widget.js' ), 'utf8' );
		const widget = await mountWidget( { id: 'odd/example-hello', source: src } );
		expect( typeof widget.mount ).toBe( 'function' );

		const root = document.createElement( 'div' );
		const unmount = widget.mount( root );
		expect( root.children.length ).toBe( 1 );
		if ( typeof unmount === 'function' ) unmount();
		expect( root.children.length ).toBe( 0 );
	} );

	it( 'createPixiStub returns a chainable proxy', () => {
		const PIXI = createPixiStub();
		const g = new PIXI.Graphics();
		g.rect( 0, 0, 10, 10 ).fill( { color: 0xff0000 } ).stroke( { width: 2 } );
		expect( PIXI.__counters ).toBeDefined();
	} );
} );
