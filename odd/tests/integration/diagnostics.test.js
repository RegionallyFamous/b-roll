import { describe, expect, it, beforeEach } from 'vitest';
import { loadFoundation } from './harness.js';

describe( 'ODD diagnostics metrics', () => {
	beforeEach( () => {
		loadFoundation();
	} );

	it( 'records bounded local timing and counter metrics', () => {
		const d = window.__odd.diagnostics;
		d.count( 'catalog.fetch.failure' );
		d.count( 'catalog.fetch.failure', 2 );
		d.timing( 'panel.render', 12.4, { section: 'apps', ignored: { nested: true } } );
		const stop = d.time( 'iframe.load', { slug: 'demo' } );
		stop( { status: 'loaded' } );

		const snap = d.metrics();
		expect( snap.counters[ 'catalog.fetch.failure' ] ).toBe( 3 );
		expect( snap.timings.map( ( row ) => row.name ) ).toEqual( expect.arrayContaining( [ 'panel.render', 'iframe.load' ] ) );
		expect( snap.timings.find( ( row ) => row.name === 'panel.render' ).meta ).toEqual( { section: 'apps' } );
		expect( d.collect().metrics.counters[ 'catalog.fetch.failure' ] ).toBe( 3 );
		expect( d.collectMarkdown() ).toContain( '## Local Metrics' );
	} );
} );
