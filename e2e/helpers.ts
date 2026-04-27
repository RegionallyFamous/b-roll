import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Enters the WP Desktop Mode shell. ODD’s `wp-desktop` script dependency
 * only loads when the shell renders (`includes/render.php`); a bare
 * `/wp-admin/` request can look “classic” and skip the canvas + scenes.
 * The `/wp-desktop/` portal redirects into `wp-admin` with the shell.
 */
export async function goDesktopShell( page: Page ) {
	await page.goto( '/wp-desktop/' );
	await page.waitForURL( /\/wp-admin/, { timeout: 60_000 } );
	await expect( page.locator( '#wp-desktop-shell' ) ).toBeVisible( { timeout: 30_000 } );
	await page.waitForFunction( () => {
		const w = window as Window & { wp?: { desktop?: { registerWindow?: unknown } } };
		return Boolean(
			w.wp?.desktop && typeof w.wp.desktop.registerWindow === 'function',
		);
	}, { timeout: 30_000 } );
}
