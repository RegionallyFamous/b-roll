<?php
/**
 * PHPUnit bootstrap for the ODD plugin.
 *
 * Expects two environment variables set by CI (or locally):
 *
 *   WP_PHPUNIT__DIR    path to wp-phpunit/wp-phpunit (provided by composer)
 *   WP_PHPUNIT__TESTS_CONFIG optional path to a wp-tests-config.php; if not set,
 *                            we fall back to vendor/wp-phpunit/wp-phpunit/wp-tests-config-sample.php
 *                            with env-supplied DB credentials.
 *
 * This runs the plugin inside a real WordPress install under wp-phpunit so
 * REST, filters, and user-meta all behave exactly like production.
 */

$_tests_dir = getenv( 'WP_PHPUNIT__DIR' );
if ( false === $_tests_dir ) {
	$_tests_dir = __DIR__ . '/../../../vendor/wp-phpunit/wp-phpunit';
}

if ( ! file_exists( $_tests_dir . '/includes/functions.php' ) ) {
	fwrite( STDERR, "Could not locate wp-phpunit at {$_tests_dir}.\n" );
	fwrite( STDERR, "Run `composer install` first, or set WP_PHPUNIT__DIR.\n" );
	exit( 1 );
}

require_once dirname( __DIR__, 3 ) . '/vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php';
require_once $_tests_dir . '/includes/functions.php';

/**
 * Load the ODD plugin before tests run so its hooks + REST routes
 * register on `plugins_loaded`.
 */
tests_add_filter(
	'muplugins_loaded',
	static function () {
		require dirname( __DIR__, 3 ) . '/odd/odd.php';
	}
);

require $_tests_dir . '/includes/bootstrap.php';

/**
 * Shared test helpers for ODD tests.
 */
require_once __DIR__ . '/includes/class-odd-rest-test-case.php';
