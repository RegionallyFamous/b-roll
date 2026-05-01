# ODD Release Runbook

> Status: 1.0.0 baseline. Mirrored to the wiki after release.

## Cut A Plugin Release

1. Update `odd/odd.php`, `odd/readme.txt`, `CHANGELOG.md`, and package metadata.
2. Run `odd/bin/check-version --expect <version>` and `odd/bin/check-plugin-metadata`.
3. Run the validation suite listed below.
4. Commit with a release-focused message.
5. Tag `v<version>` and push `main` plus the tag.
6. Confirm `.github/workflows/release-odd.yml` passes `quality-gates`, install smoke, Plugin Check, and publish.
7. Verify `https://github.com/RegionallyFamous/odd/releases/latest/download/odd.zip` resolves to the new release.

## Validation Suite

Run locally before tagging:

```sh
odd/bin/check-version --expect 1.0.0
odd/bin/check-plugin-metadata
python3 _tools/build-catalog.py
ODD_VALIDATE_REBUILD=1 odd/bin/validate-catalog
odd/bin/validate-blueprint
npm test -- --run
composer phpcs
odd/bin/check-licenses
odd/bin/make-pot --out odd/languages/odd.pot
odd/bin/build-zip
odd/bin/check-zip-contents --list
```

Run PHPUnit locally when the WordPress test environment is configured.
Otherwise, the release workflow must keep PHPUnit and install-smoke as blocking
checks before publishing.

## Plugin Check

CI runs the official `WordPress/plugin-check-action` against the expanded
contents of `dist/odd.zip`. To run the same shape locally, build the zip,
expand it into a temporary plugin directory, and run Plugin Check against that
directory from a WordPress test install.

Plugin Check errors block release. Warnings block release unless the warning is
documented in the release issue with a concrete reason it is acceptable.

## Catalog-Only Updates

Use a catalog-only update when the change is limited to first-party content
under `_tools/catalog-sources/` or generated files under `site/catalog/v1/`.

1. Edit catalog source files.
2. Run `python3 _tools/build-catalog.py`.
3. Run `ODD_VALIDATE_REBUILD=1 odd/bin/validate-catalog`.
4. Commit and push to `main`.
5. Confirm `.github/workflows/pages.yml` publishes the catalog.

Do not bump `ODD_VERSION`, tag a GitHub release, or edit `CHANGELOG.md` for
catalog-only changes.

## Playground Smoke

1. Open `https://odd.regionallyfamous.com/playground/`.
2. Confirm WordPress Playground loads Desktop Mode v0.6.0 and ODD.
3. Confirm the ODD Shop opens.
4. Confirm the starter wallpaper, icon set, and cursor set install or show a
   visible retry state.
5. Install one app, one widget, one wallpaper, one icon set, and one cursor set.
6. Open the app, add the widget, preview/apply the visual content, then copy
   diagnostics from About.

## Security And Privacy Signoff

- Mutating REST routes use capability checks and nonces/cookie-auth explicitly.
- Bundle extraction blocks traversal, symlinks, unexpected file types, and slug
  or type mismatches.
- Catalog downloads verify SHA256 before install.
- SVG and cursor assets are passive and validated.
- Diagnostics are local-only, user initiated, and redact secrets/nonces.
- ODD makes no telemetry, analytics, beacon, or remote error-reporting calls.
- `odd/uninstall.php` clearly controls which options, user meta, and content
  folders are removed.

## Accessibility And Performance Signoff

- Shop cards, dialogs, controls, and settings are keyboard reachable with
  visible focus.
- Buttons and inputs have accessible names.
- Status changes use visible text and `aria-live` where appropriate.
- Reduced-motion preferences are respected by scenes and UI transitions.
- `dist/odd.zip` stays below the 2 MB budget.
- The Shop first paint uses localized state and does not block on remote
  catalog refresh.
- Scenes, widgets, apps, and iframes clean up timers, listeners, and resources.
- The static marketing site remains low-dependency and passes `site-lint`.

## Rollback

The 1.0 reset backup lives outside the plugin tree in the local release backup
created before deleting old tags/releases. To recover a deleted historical tag:

```sh
git tag <old-tag> <recorded-sha>
git push origin <old-tag>
gh release create <old-tag> --generate-notes
```

For a bad 1.0.0 release, prefer a quick `v1.0.1` hotfix:

1. Branch from `v1.0.0`.
2. Apply the fix and regression test.
3. Run the validation suite.
4. Commit, tag `v1.0.1`, push, and verify the latest download URL.

## Wiki Sync

After release, mirror these repo docs into the GitHub wiki:

- `docs/architecture.md`
- `docs/building-on-odd.md`
- `docs/store-state-machine.md`
- `docs/release-policy.md`
- `docs/release-runbook.md`
- `docs/security/serve-paths.md`
