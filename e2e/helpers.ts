import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Enters the WP Desktop Mode shell. ODD’s `wp-desktop` script dependency
 * only loads when the shell renders (`includes/render.php`); a bare
 * `/wp-admin/` request can look “classic” and skip the canvas + scenes.
 * The `/wp-desktop/` portal redirects into `wp-admin` with the shell.
 */
export async function goDesktopShell( page: Page ) {
	await page.goto( '/wp-desktop/', { waitUntil: 'load', timeout: 45_000 } );
	await page.waitForURL( /\/wp-admin/, { timeout: 45_000 } );
	await expect( page.locator( '#wp-desktop-shell' ) ).toBeVisible( { timeout: 20_000 } );
	await page.waitForFunction( () => {
		const w = window as unknown as { __odd?: object };
		return typeof w.__odd !== 'undefined';
	}, { timeout: 30_000 } );
}

/**
 * Wallpaper IIFE can’t register scenes until Pixi is present and `mount` runs.
 * This mirrors what panel.spec was polling for, with one explicit contract.
 *
 * Under a fresh `wp server` boot the host shell renders with the user's
 * saved wallpaper but the `odd` wallpaper def doesn't register until
 * ODD's JS bundle parses — so the first `osSettings.apply()` falls back
 * to the built-in default and PIXI never gets requested. Nudge the shell
 * to re-apply once ODD has registered itself.
 */
export async function waitForWallpaperScenes( page: Page ) {
	await page.waitForFunction( () => {
		const wp = ( window as unknown as {
			wp?: { desktop?: { registerWallpaper?: unknown } };
		} ).wp;
		return !! wp?.desktop && typeof wp.desktop.registerWallpaper === 'function';
	}, { timeout: 20_000 } );
	await page.evaluate( () => {
		const config = ( window as unknown as {
			wpDesktopConfig?: { osSettings?: { wallpaper?: string } };
		} ).wpDesktopConfig;
		if ( config?.osSettings ) {
			config.osSettings.wallpaper = 'odd';
		}
		const ls = window.localStorage;
		try {
			const raw = ls.getItem( 'wp-desktop-os-settings' );
			const parsed = raw ? JSON.parse( raw ) : {};
			parsed.wallpaper = 'odd';
			ls.setItem( 'wp-desktop-os-settings', JSON.stringify( parsed ) );
		} catch ( _e ) {
			/* localStorage disabled — fine */
		}
	} );
	try {
		await page.waitForFunction( () => {
			return typeof ( window as unknown as { PIXI?: object } ).PIXI !== 'undefined';
		}, { timeout: 40_000 } );
	} catch ( err ) {
		const diag = await page.evaluate( () => {
			const wp = ( window as unknown as {
				wp?: { desktop?: { config?: { osSettings?: unknown } } };
			} ).wp;
			const wallpapers = ( window as unknown as {
				wpDesktopWallpapers?: Record<string, unknown>;
			} ).wpDesktopWallpapers;
			const odd = ( window as unknown as {
				__odd?: { scenes?: Record<string, object>; api?: object };
			} ).__odd;
			return {
				hasWpDesktop: !! wp?.desktop,
				osSettings: wp?.desktop?.config?.osSettings ?? null,
				wallpaperKeys: wallpapers ? Object.keys( wallpapers ) : null,
				oddScenes: odd?.scenes ? Object.keys( odd.scenes ) : null,
				oddApi: !! odd?.api,
			};
		} );
		// eslint-disable-next-line no-console
		console.log( 'waitForWallpaperScenes diagnostics:', JSON.stringify( diag, null, 2 ) );
		throw err;
	}
	await page.waitForFunction( () => {
		const scenes = ( window as unknown as { __odd?: { scenes?: Record<string, object> } } ).__odd
			?.scenes;
		return !! scenes && Object.keys( scenes ).length > 0;
	}, { timeout: 40_000 } );
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
				if ( tryOpen() || n++ > 40 ) {
					return;
				}
				setTimeout( attempt, 200 );
			} )();
		};
		if ( desktop && typeof desktop.ready === 'function' ) {
			desktop.ready( kick );
		} else {
			setTimeout( kick, 500 );
		}
	} );
	await expect( page.locator( '[data-odd-panel], .odd-panel' ).first() ).toBeVisible( { timeout: 20_000 } );
}
