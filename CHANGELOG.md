# Changelog

All notable changes to ODD are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each release section includes an `<a id="vX.Y.Z"></a>` anchor so
`odd/bin/release-notes <version>` can publish the same customer-facing
notes to GitHub Releases.

<a id="unreleased"></a>
## [Unreleased]

No unreleased changes yet.

<a id="v1.0.0"></a>
## [1.0.0] — 2026-05-01

### Added
- **A complete desktop shop for WordPress.** ODD gives WP Desktop Mode a
  catalog-driven shop for wallpapers, icon sets, cursor sets, widgets, and
  small apps. New content ships through the remote catalog, so the store can
  be refreshed without a plugin release.
- **Unified store cards.** Catalog cards now behave like durable product
  cards: install, preview, apply, add, open, reload, repair, and diagnostics
  all flow from the same surface instead of separate one-off screens.
- **Starter content out of the box.** Fresh installs start with matching
  Oddling wallpaper, icons, and cursors so the desktop feels intentional
  immediately.
- **Desktop Mode v0.6 integration.** ODD targets WP Desktop Mode v0.6.0+ and
  integrates with its settings tab, command, title-bar, window, widget,
  iframe, dock, wallpaper, activity, and diagnostics hooks.

### Security
- **Hardened bundle installs.** Remote and uploaded `.wp` bundles are
  validated before extraction, checked against catalog identity and SHA256
  data, and kept behind capability checks.
- **Safer SVG and cursor assets.** Icon and cursor bundles are limited to
  passive SVG assets with validation in both author tooling and install-time
  paths.
- **Local-only diagnostics.** Copy Diagnostics assembles support information
  locally and only copies it when the user asks. ODD does not send telemetry,
  analytics, or error reports.

### Reliability
- **Visible recovery paths.** Shop, starter-pack, app, widget, and catalog
  failures surface actionable messages rather than silent blank states.
- **Catalog fallback and repair.** The Shop keeps a stale catalog available
  when the remote catalog cannot be reached, and diagnostics explain install
  or app drift clearly enough to repair.
- **Release-quality gates.** The 1.0 line is backed by catalog determinism,
  JavaScript integration tests, PHP coding standards, Plugin Check, zip
  contents checks, install smoke tests, blueprint validation, and docs/site
  validation.

### Compatibility
- Requires WordPress 6.0+, PHP 7.4+, and WP Desktop Mode 0.6.0+.

## Pre-1.0 History

Earlier public tags were development releases used to shape the catalog,
runtime, and Desktop Mode integration. They have been removed from the public
release line so `v1.0.0` is the clean baseline users should install and
reference going forward.
