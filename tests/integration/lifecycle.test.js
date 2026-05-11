import { describe, expect, it, beforeEach } from 'vitest';
import { loadFoundation, sleep } from './harness.js';

describe( 'lifecycle — monotonic phase progression', () => {
	beforeEach( () => {
		loadFoundation();
	} );

	it( 'advances through the documented phase order', async () => {
		const { lifecycle, events } = window.__odd;
		const fired = [];
		events.on( 'odd.configured',       () => fired.push( 'configured' ) );
		events.on( 'odd.registries-ready', () => fired.push( 'registries-ready' ) );
		events.on( 'odd.mounted',          () => fired.push( 'mounted' ) );
		events.on( 'odd.ready',            () => fired.push( 'ready' ) );

		expect( lifecycle.phase() ).toBe( 'boot' );
		lifecycle.advance( 'configured' );
		lifecycle.advance( 'registries-ready' );
		lifecycle.advance( 'mounted' );
		lifecycle.advance( 'ready' );
		expect( lifecycle.phase() ).toBe( 'ready' );
		expect( fired ).toEqual( [ 'configured', 'registries-ready', 'mounted', 'ready' ] );
	} );

	it( 'whenPhase resolves once the phase has been reached', async () => {
		const { lifecycle } = window.__odd;
		let resolved = false;
		const pending = lifecycle.whenPhase( 'mounted' ).then( () => { resolved = true; } );

		expect( resolved ).toBe( false );
		lifecycle.advance( 'configured' );
		await sleep( 1 );
		expect( resolved ).toBe( false );

		lifecycle.advance( 'registries-ready' );
		lifecycle.advance( 'mounted' );
		await pending;
		expect( resolved ).toBe( true );
	} );

	it( 'refuses to go backwards but always accepts teardown', () => {
		const { lifecycle } = window.__odd;
		lifecycle.advance( 'configured' );
		lifecycle.advance( 'registries-ready' );
		const back = lifecycle.advance( 'configured' );
		expect( back ).toBe( false );
		expect( lifecycle.phase() ).toBe( 'registries-ready' );

		lifecycle.advance( 'teardown' );
		expect( lifecycle.phase() ).toBe( 'teardown' );
	} );

	it( 'syncs the current phase into the store under runtime.phase', () => {
		const { lifecycle, store } = window.__odd;
		lifecycle.advance( 'configured' );
		expect( store.get( 'runtime.phase' ) ).toBe( 'configured' );
	} );
} );
