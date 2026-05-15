# Changelog

All notable changes to ODD are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each release section includes an `<a id="vX.Y.Z"></a>` anchor so
`odd/bin/release-notes <version>` can publish the same customer-facing
notes to GitHub Releases.

<a id="unreleased"></a>
## [Unreleased]

<a id="v1.0.0"></a>
## [1.0.0] — 2026-05-15

### Added
- **A complete desktop shop for WordPress.** ODD gives WP Desktop Mode a
  catalog-driven shop for wallpapers, icon sets, cursor sets, widgets, and
  small apps. New content ships through the remote catalog, so the store can
  be refreshed without a plugin release.
- **Unified store cards.** Catalog cards behave like durable product cards:
  install, preview, apply, add, open, reload, repair, and diagnostics all flow
  from the same surface instead of separate one-off screens.
- **Starter content out of the box.** Fresh installs start with matching
  Oddling wallpaper, icons, and cursors so the desktop feels intentional
  immediately.

### Fixed
- **WordPress.org review readiness.** The plugin uses the WordPress.org slug
  text domain, documents its external catalog service and generated React
  runtime source, stores installed content under uploads, avoids global PHP
  limit/user switching, and keeps development-only files out of the release
  zip.
- **Playground app loading.** Scoped app iframe, runtime import-map, rewritten
  React runtime, REST root, icon, and diagnostic URLs keep the active
  `/scope:<id>/` prefix so app requests stay inside the running Playground
  instance.
- **Custom cursors.** Installed cursor-set CSS uses a public ODD REST asset
  endpoint, wins against Desktop Mode's global cursor reset, and preserves
  themed pointer cursors when hovering desktop icons, icon children, dock
  items, and window controls.
- **Desktop rails and Shop layout.** Left/right Desktop Mode rails no longer
  pan sideways, vertical icon access remains available, and the ODD Shop clamps
  horizontal overflow.

### Changed
- **Magic 8-Ball widget.** The live widget skin has a polished abstract oracle
  texture, bundled widget assets, and updated widget packaging.
- **Stable Playground.** The public blueprint installs ODD **1.0.0** with WP
  Desktop Mode pinned to the official **0.8.2** release zip.
- **Catalog baseline.** First-party store downloads are normalized to version
  **1.0.0** so WordPress.org, GitHub, and the in-app Shop share one clean public
  baseline.

### Security
- **Hardened bundle installs.** Remote and uploaded `.wp` bundles are validated
  before extraction, checked against catalog identity and SHA256 data, and kept
  behind capability checks.
- **Safer SVG and cursor assets.** Icon and cursor bundles are limited to
  passive SVG assets with validation in both author tooling and install-time
  paths.
- **Local-only diagnostics.** Copy Diagnostics assembles support information
  locally and only copies it when the user asks. ODD does not send telemetry,
  analytics, or error reports.

### Compatibility
- Requires WordPress 6.0+, PHP 7.4+, and WP Desktop Mode 0.8.0+.
