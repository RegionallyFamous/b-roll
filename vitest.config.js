import { defineConfig } from 'vitest/config';

export default defineConfig( {
	test: {
		environment: 'jsdom',
		include: [ 'odd/tests/integration/**/*.test.{js,mjs}' ],
		globals: false,
		setupFiles: [ './odd/tests/integration/setup.js' ],
		reporters: 'default',
	},
} );
