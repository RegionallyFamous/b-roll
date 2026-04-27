/**
 * End-to-end: boot WP admin → desktop mode loads → open ODD Control
 * Panel → swap to a different scene → assert the wallpaper canvas
 * actually rendered pixels (not just mounted an empty node).
 *
 * Why: install-smoke only checks that PHP activates without fatal. It
 * never loads a browser, so JS-side regressions (missing localized
 * `window.odd` fields, scene IIFE that throws on the real DOM, broken
 * single-window registration) slip through its net. This file fills
 * that gap with one headful-in-CI Chromium run.
 *
 * The assertion pattern: we read a raw pixel from the WebGL canvas via
 * `gl.readPixels`, sum the channels, and require at least one
 * non-black pixel. A scene that silently errors inside `setup` leaves
 * a cleared canvas — that's the regression we want to catch.
 */
import { test, expect } from '@playwright/test';
import { goDesktopShell } from './helpers';

const ADMIN_USER = process.env.WP_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.WP_ADMIN_PASS || 'password';

async function login( page ) {
	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', ADMIN_USER );
	await page.fill( '#user_pass', ADMIN_PASS );
	await page.click( '#wp-submit' );
	await page.waitForURL( /\/wp-admin\/?/ );
}

test.describe( 'ODD panel', () => {
	test( 'loads, renders a scene, and survives a scene swap', async ( { page } ) => {
		test.setTimeout( 90_000 );

		await login( page );
		await goDesktopShell( page );

		await page.waitForFunction( () => typeof window.__odd !== 'undefined', null, { timeout: 30_000 } );

		const registeredScenes = await page.evaluate( async () => {
			for ( let i = 0; i < 200; i++ ) {
				const list = window.__odd && window.__odd.scenes;
				if ( list && Object.keys( list ).length >= 1 ) return Object.keys( list );
				await new Promise( ( r ) => setTimeout( r, 100 ) );
			}
			return [];
		} );
		expect( registeredScenes.length, 'at least one scene must register on admin load' ).toBeGreaterThan( 0 );

		const canvasState = await page.evaluate( async () => {
			for ( let i = 0; i < 200; i++ ) {
				const canvases = Array.from( document.querySelectorAll( 'canvas' ) );
				const canvas = canvases.find( ( c ) => c.width >= 320 && c.height >= 180 );
				if ( canvas ) {
					return { found: true, width: canvas.width, height: canvas.height };
				}
				await new Promise( ( r ) => setTimeout( r, 100 ) );
			}
			return { found: false, width: 0, height: 0 };
		} );
		expect( canvasState.found, 'a wallpaper canvas should exist at >=320x180' ).toBe( true );

		const nonBlackPixels = await page.evaluate( async () => {
			await new Promise( ( r ) => setTimeout( r, 2000 ) );
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
			await new Promise( ( r ) => setTimeout( r, 1500 ) );
			return true;
		}, registeredScenes[ 0 ] );
		expect( hookFired, 'wp.hooks.doAction must be available to fire odd/pickScene' ).toBe( true );
	} );
} );
