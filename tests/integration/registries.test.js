import { describe, expect, it, beforeEach } from 'vitest';
import { loadFoundation } from './harness.js';

describe( 'registries — filter-aware readers', () => {
	beforeEach( () => {
		loadFoundation( {
			config: {
				scenes:   [ { slug: 'flux', label: 'Flux' } ],
				iconSets: [ { slug: 'filament', label: 'Filament' } ],
			},
		} );
	} );

	it( 'returns the seed list when no filters are registered', () => {
		const { registries } = window.__odd;
		expect( registries.readScenes() ).toHaveLength( 1 );
		expect( registries.readIconSets()[ 0 ].slug ).toBe( 'filament' );
		expect( registries.readMuses() ).toEqual( [] );
	} );

	it( 'applies JS filter hooks in priority order', () => {
		const { registries } = window.__odd;
		window.wp.hooks.addFilter( 'odd.scenes', 'plugin-a', ( list ) => {
			return list.concat( [ { slug: 'aurora', label: 'Aurora' } ] );
		}, 10 );
		window.wp.hooks.addFilter( 'odd.scenes', 'plugin-b', ( list ) => {
			return list.concat( [ { slug: 'origami', label: 'Origami' } ] );
		}, 20 );

		const result = registries.readScenes();
		expect( result.map( ( s ) => s.slug ) ).toEqual( [ 'flux', 'aurora', 'origami' ] );
	} );

	it( 'findScene() looks up a descriptor by slug', () => {
		const { registries } = window.__odd;
		expect( registries.findScene( 'flux' ).label ).toBe( 'Flux' );
		expect( registries.findScene( 'missing' ) ).toBeNull();
	} );
} );
