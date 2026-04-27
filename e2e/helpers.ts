import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Enters the WP Desktop Mode shell. ODD’s `wp-desktop` script dependency
 * only loads when the shell renders (`includes/render.php`); a bare
 * `/wp-admin/` request can look “classic” and skip the canvas + scenes.
 * The `/wp-desktop/` portal redirects into `wp-admin` with the shell.
 */
export async function goDesktopShell( page: Page ) {
	await page.goto( '/wp-desktop/', { waitUntil: 'load', timeout: 60_000 } );
	await page.waitForURL( /\/wp-admin/, { timeout: 60_000 } );
	await expect( page.locator( '#wp-desktop-shell' ) ).toBeVisible( { timeout: 30_000 } );
	await page.waitForLoadState( 'networkidle' );
	// ODD’s odd-store install runs after desktop scripts; this is a cheap
	// proxy for “ODD’s admin script chain has started (not a classic page)”.
	await page.waitForFunction( () => {
		const w = window as unknown as { __odd?: object };
		return typeof w.__odd !== 'undefined';
	}, { timeout: 60_000 } );
}
