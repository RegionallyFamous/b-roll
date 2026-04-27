/**
 * Axe-core: zero serious/critical on the ODD Shop once the panel is open
 * (world-class menu item 20).
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

test.describe( 'ODD panel a11y', () => {
	test( 'no critical or serious axe violations in .odd-panel', async ( { page } ) => {
		test.setTimeout( 240_000 );
		await login( page );
		await goDesktopShell( page );
		await waitForWallpaperScenes( page );
		await openOddShop( page );
		const panel = page.locator( '.odd-panel' ).first();

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
