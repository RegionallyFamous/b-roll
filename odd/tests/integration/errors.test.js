import { describe, expect, it, beforeEach } from 'vitest';
import { loadFoundation } from './harness.js';

describe( 'safeCall — error boundary contract', () => {
	beforeEach( () => {
		loadFoundation( { debug: true } );
	} );

	it( 'returns fn result on happy path', () => {
		const { safeCall } = window.__odd;
		expect( safeCall( ( a, b ) => a + b, 'test.sum', 'error', 2, 3 ) ).toBe( 5 );
	} );

	it( 'swallows thrown errors and emits odd/error on the bus', () => {
		const { safeCall, events } = window.__odd;
		const caught = [];
		events.on( 'odd.error', ( payload ) => caught.push( payload ) );

		const result = safeCall( () => { throw new Error( 'boom' ); }, 'test.throw' );
		expect( result ).toBeUndefined();
		expect( caught ).toHaveLength( 1 );
		expect( caught[ 0 ].source ).toBe( 'test.throw' );
		expect( caught[ 0 ].message ).toBe( 'boom' );
		expect( caught[ 0 ].severity ).toBe( 'error' );
	} );

	it( 'wrapMethod lifts an object method without losing `this`', () => {
		const { safeCall, events } = window.__odd;
		const caught = [];
		events.on( 'odd.error', ( payload ) => caught.push( payload ) );

		const scene = {
			slug: 'flux',
			setup() { return this.slug.toUpperCase(); },
			tick() { throw new Error( 'tick-bomb' ); },
		};
		safeCall.wrapMethod( scene, 'setup', 'scene.setup' );
		safeCall.wrapMethod( scene, 'tick',  'scene.tick' );

		expect( scene.setup() ).toBe( 'FLUX' );
		expect( scene.tick() ).toBeUndefined();
		expect( caught.map( ( e ) => e.source ) ).toEqual( [ 'scene.tick' ] );
	} );

	it( 'debug inspector surfaces bus events under events()', () => {
		const { safeCall, debug } = window.__odd;
		safeCall( () => { throw new Error( 'inspect-me' ); }, 'test.inspect' );
		const log = debug.events();
		expect( log.some( ( e ) => e.name === 'odd.error' ) ).toBe( true );
	} );
} );
