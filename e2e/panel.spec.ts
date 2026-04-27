/**
 * End-to-end: one browser session — login → desktop shell → wallpaper
 * scenes + canvas pixel check → optional scene hook → ODD Shop + axe.
 *
 * Kept in a *single* test so CI does not pay login/shell/PIXI waits twice
 * (that was the main driver of 15m+ job times).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { goDesktopShell, openOddShop, waitForWallpaperScenes } from './helpers';

const ADMIN_USER = process.env.WP_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.WP_ADMIN_PASS || 'password';

async function login( page ) {
	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', ADMIN_USER );
	await page.fill( '#user_pass', ADMIN_PASS );
	await page.click( '#wp-submit' );
	await page.waitForURL( /\/wp-admin\/?/ );
}

test.describe( 'ODD admin smoke', () => {
	test( 'wallpaper + scene hook, then shop has no serious/critical axe issues', async ( { page } ) => {
		// ~3–6m cold CI; one combined flow, not two full boots.
		test.setTimeout( 150_000 );

		page.on( 'console', ( msg ) => {
			const type = msg.type();
			if ( type === 'error' || type === 'warning' ) {
				// eslint-disable-next-line no-console
				console.log( `[page:${ type }]`, msg.text(), '@', page.url() );
			}
		} );
		page.on( 'pageerror', ( err ) => {
			// eslint-disable-next-line no-console
			console.log( '[page:pageerror]', err.message, '@', page.url() );
		} );
		page.on( 'response', async ( response ) => {
			if ( response.status() >= 400 ) {
				const url = response.url();
				// eslint-disable-next-line no-console
				console.log( `[page:${ response.status() }]`, url );
			}
		} );
		page.on( 'requestfailed', ( request ) => {
			// eslint-disable-next-line no-console
			console.log( '[page:requestfailed]', request.url(), request.failure()?.errorText );
		} );

		await login( page );
		await goDesktopShell( page );
		await waitForWallpaperScenes( page );

		const registeredScenes = await page.evaluate( () => {
			const list = window.__odd && window.__odd.scenes;
			return list ? Object.keys( list ) : [];
		} );
		expect( registeredScenes.length, 'at least one scene must register' ).toBeGreaterThan( 0 );

		const canvasState = await page.evaluate( async () => {
			for ( let i = 0; i < 60; i++ ) {
				const canvases = Array.from( document.querySelectorAll( 'canvas' ) );
				const c = canvases.find( ( el ) => el.width >= 320 && el.height >= 180 );
				if ( c ) {
					return { found: true, width: c.width, height: c.height };
				}
				await new Promise( ( r ) => setTimeout( r, 100 ) );
			}
			return { found: false, width: 0, height: 0 };
		} );
		expect( canvasState.found, 'a wallpaper canvas should exist at >=320x180' ).toBe( true );

		const nonBlackPixels = await page.evaluate( async () => {
			await new Promise( ( r ) => setTimeout( r, 800 ) );
			const canvas = Array.from( document.querySelectorAll( 'canvas' ) ).find(
				( c ) => c.width >= 320 && c.height >= 180,
			);
			if ( ! canvas ) return 0;
			const gl = canvas.getContext( 'webgl2' ) || canvas.getContext( 'webgl' );
			if ( gl ) {
				const pixels = new Uint8Array( 4 );
				gl.readPixels( canvas.width / 2, canvas.height / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels );
				return pixels[ 0 ] + pixels[ 1 ] + pixels[ 2 ];
			}
			const ctx2d = canvas.getContext( '2d' );
			if ( ! ctx2d ) return 0;
			const d = ctx2d.getImageData( canvas.width / 2, canvas.height / 2, 1, 1 ).data;
			return d[ 0 ] + d[ 1 ] + d[ 2 ];
		} );
		expect( nonBlackPixels, 'centre pixel must be non-black after scene boot' ).toBeGreaterThan( 0 );

		const hookFired = await page.evaluate( async ( targetSlug ) => {
			if ( ! ( window.wp && window.wp.hooks && window.wp.hooks.doAction ) ) return false;
			window.wp.hooks.doAction( 'odd/pickScene', targetSlug );
			await new Promise( ( r ) => setTimeout( r, 800 ) );
			return true;
		}, registeredScenes[ 0 ] );
		expect( hookFired, 'wp.hooks must fire odd/pickScene' ).toBe( true );

		await openOddShop( page );
		const results = await new AxeBuilder( { page } )
			.include( '.odd-panel' )
			.withTags( [ 'wcag2a', 'wcag2aa' ] )
			.analyze();
		const bad = results.violations.filter(
			( v ) => v.impact === 'critical' || v.impact === 'serious',
		);
		expect( bad, JSON.stringify( bad, null, 2 ) ).toEqual( [] );
	} );
} );
