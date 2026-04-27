import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright runs against a local WordPress+ODD install started by
 * `.github/workflows/e2e.yml`. We intentionally do NOT aim at
 * https://playground.wordpress.net — cold-boot there is 30-60s and
 * prone to WASM flakes in headless Chromium. The e2e workflow spins
 * up real WP under `wp server` on port 8080, then runs this suite.
 *
 * For local iteration: run WP via `wp server --host=0.0.0.0 --port=8080`
 * in a separate terminal, activate ODD + WP Desktop Mode, then
 * `BASE_URL=http://127.0.0.1:8080 npx playwright test`.
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8080';

export default defineConfig( {
	testDir: './e2e',
	fullyParallel: false,
	forbidOnly: !! process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: process.env.CI ? [ [ 'github' ], [ 'list' ] ] : 'list',
	timeout: 60_000,
	expect: { timeout: 15_000 },
	use: {
		baseURL: BASE_URL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices[ 'Desktop Chrome' ] },
		},
	],
} );
