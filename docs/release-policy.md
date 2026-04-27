# ODD Release Policy

This document describes when to bump which version number and how to
cut a release. Read alongside [`api-versioning.md`](api-versioning.md) —
they track different numbers on different cadences.

## Two version numbers

| Number | Source of truth | Bumped when |
|--------|-----------------|-------------|
| `ODD_VERSION` (plugin) | `odd/odd.php` header + constant (kept in sync by `odd/bin/check-version`) | Any release — new scene, new icon set, bug fix, API change, anything at all. |
| `window.__odd.api.version` (extension surface) | `API_VERSION` constant in `odd/src/shared/api.js` | Only when the surface described in [api-versioning.md](api-versioning.md) changes. |

A minor plugin release that only adds scenes doesn't touch
`api.version`. A plugin release that adds a new `window.__odd.api`
method bumps both — plugin minor (new feature) and API minor (new
surface).

## Plugin SemVer rules

- **Patch** (`1.9.0` → `1.9.1`): bug fixes, internal refactors, docs. No new scenes, no new icon sets, no new APIs.
- **Minor** (`1.9.0` → `1.10.0`): new scenes, new icon sets, new widgets, new Shop tiles, new panel features, new API methods (also bumps `api.version` minor). No breaking changes.
- **Major** (`1.9.0` → `2.0.0`): removes or renames anything downstream can observe. Always accompanied by a major bump in `api.version`.

Prereleases follow `1.10.0-rc.1`, `1.10.0-rc.2`, etc. They're tagged and attached to a GitHub release marked **pre-release** but `latest=false`.

## Cutting a release

Automated in `odd/bin/bump-version`:

```sh
odd/bin/bump-version 1.10.0
# edits odd/odd.php header + ODD_VERSION constant
odd/bin/check-version --expect 1.10.0
# updates CHANGELOG.md scaffold
git diff
# review, then:
git commit -m "release: 1.10.0"
git tag v1.10.0
git push origin main v1.10.0
```

The `.github/workflows/release-odd.yml` workflow fires on the tag: runs `check-version`, the scene/icon-set validators, `odd/bin/build-zip`, and `gh release create --latest=true` with a post-upload HTTP probe. Retries the upload once on the 409 "Error creating policy" flake.

## CHANGELOG

We maintain `CHANGELOG.md` in the keep-a-changelog format. Each release entry calls out:

- Breaking changes at the top.
- `api.version` bumps (if any) and which methods/events/routes moved.
- New content (scenes / icon sets / widgets) with thumbnail captions.
- Bug fixes.

Keep the change-log user-readable. Don't list every "fix typo" commit — summarise.

## Hotfixes

For a security or correctness bug that blocks production:

1. Branch from the most recent release tag (not `main`).
2. Apply the fix + a regression test.
3. Tag as a patch (`v1.10.1`).
4. Cherry-pick to `main` in a follow-up PR.

If `main` has already moved on with incompatible changes, the hotfix branch may need to lag behind — that's fine, the point is to get a release out that unblocks users.

## When in doubt

- Err on the side of a bigger bump. Nobody's ever regretted a too-cautious SemVer. They regret the reverse.
- If the release touches both content and API, call out the API change in the changelog headline, even if it's small.
- If you're not sure whether a PR is breaking, open the [api-versioning](api-versioning.md) document, scan the surface list, and ask the reviewer.
