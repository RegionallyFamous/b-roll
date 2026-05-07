import { test } from '@playwright/test';
import { attachOddDiagnostics } from './diagnostics';

/**
 * Registers an afterEach hook that dumps server + browser diagnostics when a
 * test fails or times out. Import and call once at e2e module top-level:
 *
 *   import { installOddFailureDiagnostics } from './diagnostics-hooks';
 *   installOddFailureDiagnostics();
 */
export function installOddFailureDiagnostics() {
	test.afterEach( async ( { page }, testInfo ) => {
		if ( testInfo.status !== 'failed' && testInfo.status !== 'timedOut' ) {
			return;
		}
		await attachOddDiagnostics( page, testInfo );
	} );
}
