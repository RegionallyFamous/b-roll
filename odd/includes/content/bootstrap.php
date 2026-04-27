<?php
/**
 * ODD — universal `.wp` content installer bootstrap.
 *
 * Loaded from odd/odd.php after the Apps include so
 * {@see odd_bundle_app_validate()} can delegate to the existing
 * Apps validator/installer without forward-declaration gymnastics.
 *
 * Load order:
 *
 *   archive.php   shared ZIP + manifest primitives
 *   bundle.php    odd_bundle_install() / odd_bundle_uninstall()
 *   iconsets.php  type: icon-set
 *   scenes.php    type: scene
 *   widgets.php   type: widget
 *   rest.php      POST /odd/v1/bundles/upload + DELETE /.../<slug>
 */

defined( 'ABSPATH' ) || exit;

require_once ODD_DIR . 'includes/content/archive.php';
require_once ODD_DIR . 'includes/content/bundle.php';
require_once ODD_DIR . 'includes/content/iconsets.php';
require_once ODD_DIR . 'includes/content/scenes.php';
require_once ODD_DIR . 'includes/content/widgets.php';
require_once ODD_DIR . 'includes/content/rest.php';
require_once ODD_DIR . 'includes/content/catalog.php';
