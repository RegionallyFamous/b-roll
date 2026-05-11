import { defineConfig } from 'vitest/config';

export default defineConfig( {
	test: {
		environment: 'jsdom',
		include: [
			'tests/integration/**/*.test.{js,mjs}',
			'packages/test-harness/test/**/*.test.{js,mjs}',
		],
		globals: false,
		setupFiles: [ './tests/integration/setup.js' ],
		reporters: 'default',
	},
} );
