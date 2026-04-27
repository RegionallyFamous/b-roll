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
	// Avoid `networkidle` — WordPress admin heartbeat / polling can prevent it
	// from ever settling. odd-store is enough to know ODD’s PHP enqueue ran.
	await page.waitForFunction( () => {
		const w = window as unknown as { __odd?: object };
		return typeof w.__odd !== 'undefined';
	}, { timeout: 60_000 } );
}

/**
 * Wallpaper IIFE can’t register scenes until Pixi is present and `mount` runs.
 * This mirrors what panel.spec was polling for, with one explicit contract.
 */
export async function waitForWallpaperScenes( page: Page ) {
	await page.waitForFunction( () => {
		return typeof ( window as unknown as { PIXI?: object } ).PIXI !== 'undefined';
	}, { timeout: 90_000 } );
	await page.waitForFunction( () => {
		const scenes = ( window as unknown as { __odd?: { scenes?: Record<string, object> } } ).__odd
			?.scenes;
		return !! scenes && Object.keys( scenes ).length > 0;
	}, { timeout: 90_000 } );
}

/**
 * Opens the ODD Shop the same way the Playground mu-plugin does: after
 * `wp.desktop.ready`, retry `api.openPanel()` so the native window
 * actually mounts (a single fire-and-forget call often no-ops in CI).
 */
export async function openOddShop( page: Page ) {
	await page.evaluate( () => {
		function tryOpen() {
			const api = ( window as unknown as { __odd?: { api?: { openPanel?: () => boolean } } } )
				.__odd?.api;
			if ( api && typeof api.openPanel === 'function' && api.openPanel() ) {
				return true;
			}
			const d = ( window as unknown as { wp?: { desktop?: { registerWindow?: ( o: { id: string } ) => void } } } )
				.wp?.desktop;
			if ( d && typeof d.registerWindow === 'function' ) {
				try {
					d.registerWindow( { id: 'odd' } );
					return true;
				} catch ( e ) {
					/* keep polling */
				}
			}
			return false;
		}
		const desktop = ( window as unknown as { wp?: { desktop?: { ready?: ( fn: () => void ) => void } } } )
			.wp?.desktop;
		const kick = () => {
			let n = 0;
			( function attempt() {
				if ( tryOpen() || n++ > 120 ) {
					return;
				}
				setTimeout( attempt, 250 );
			} )();
		};
		if ( desktop && typeof desktop.ready === 'function' ) {
			desktop.ready( kick );
		} else {
			setTimeout( kick, 500 );
		}
	} );
	await expect( page.locator( '[data-odd-panel], .odd-panel' ).first() ).toBeVisible( { timeout: 45_000 } );
}
