<?php
/**
 * Bundle upload / catalog install rate limits (plan item 19).
 */
class Test_Odd_Rate_Limit_Bundles extends WP_UnitTestCase {

	public function setUp(): void {
		parent::setUp();
		$this->admin = $this->factory()->user->create( array( 'role' => 'administrator' ) );
		wp_set_current_user( $this->admin );
		require_once ODD_DIR . 'includes/content/rate-limit.php';
	}

	public function test_rate_limit_allows_first_requests_in_bucket() {
		delete_transient( 'odd_rl_v2_bundle_upload_' . $this->admin . '_' . (int) floor( time() / 60 ) );
		for ( $i = 0; $i < 5; $i++ ) {
			$r = odd_bundle_rate_limit_check( 'bundle_upload' );
			$this->assertNotInstanceOf( WP_Error::class, $r );
		}
	}

	public function test_rate_limit_hits_429_over_cap() {
		$bucket = (int) floor( time() / 60 );
		delete_transient( 'odd_rl_v2_bundle_upload_' . $this->admin . '_' . $bucket );
		$max   = 10;
		$round = 0;
		$err   = null;
		for ( $i = 0; $i < $max + 3; $i++ ) {
			$r = odd_bundle_rate_limit_check( 'bundle_upload' );
			if ( is_wp_error( $r ) ) {
				$err = $r;
				break;
			}
			++$round;
		}
		$this->assertInstanceOf( WP_Error::class, $err, 'expected 429 after ' . ( $max + 1 ) . ' attempts' );
		$this->assertSame( 'rest_too_many_requests', $err->get_error_code() );
	}
}
