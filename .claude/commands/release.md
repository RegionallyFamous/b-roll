---
description: Bump ODD's version pins, commit, and push a release tag. CI builds the zip and cuts the GitHub release.
argument-hint: <version>  e.g. 1.0.1
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Cut an ODD release

Parse `$ARGUMENTS` as `<version>` (bare, no leading `v`). If missing, read
the current `Version:` from `odd/odd.php` and ask the user what the next
version should be before continuing.

The release zip and GitHub release are produced by
[.github/workflows/release-odd.yml](../../.github/workflows/release-odd.yml)
when a `v*` tag is pushed. This command's job is to bump the version
strings, commit, push `main`, and push the tag.

## 1. Verify preconditions

```bash
git status --porcelain          # warn if uncommitted changes; ask user
git rev-parse --abbrev-ref HEAD # must be main
git log --oneline -5            # sanity check last commits
```

If on a different branch, stop and ask.

## 2. Bump version pins

Use the helper — it updates the `Version:` header and `ODDOUT_VERSION`
constant in `odd/odd.php`. Public Playground blueprints install the latest
approved ODD and Desktop Mode releases from WordPress.org, so the helper skips
those installs. Dev Playgrounds keep ODD on `main` and pin Desktop Mode via
`ODDOUT_DESKTOP_MODE_PLAYGROUND_VERSION` / the dev blueprint zip URL; if that
host baseline changes, update the constant and both dev blueprints together.

```bash
odd/bin/bump-version <version>   # updates odd.php; skips public wp.org Playground installs
```

Then confirm they agree:

```bash
odd/bin/check-version --expect <version>
odd/bin/check-plugin-metadata
odd/bin/validate-blueprint
```

Commit whatever changed. For a normal plugin release this is usually
`odd/odd.php` plus any deliberate changelog/readme/package metadata edits:

```bash
git add odd/odd.php odd/readme.txt CHANGELOG.md package.json package-lock.json blueprint*.json site/playground/blueprint*.json
git commit -m "chore: bump version to v<version>"
```

## 3. Push main and the tag

```bash
git push origin main
git tag "v<version>"
git push origin "v<version>"
```

Pushing the tag triggers
[.github/workflows/release-odd.yml](../../.github/workflows/release-odd.yml),
which:

1. Asserts the tag matches `odd/odd.php`'s committed version.
2. Runs the reusable CI quality gates, including PHPUnit, Plugin Check, and the catalog validators.
3. Builds and validates `dist/odd.zip`.
4. Runs `install-smoke.yml` against the built zip.
5. Creates the GitHub release, preferring `CHANGELOG.md` notes when present and falling back to generated notes.
6. Verifies `releases/latest/download/odd.zip` resolves via curl.

## 4. Watch the release

```bash
gh run watch
```

Or browse to the Actions tab in the repo.

## 5. Report back

Give the user:

- The release URL: `https://github.com/RegionallyFamous/odd/releases/tag/v<version>`
- The stable Playground URL: `https://odd.regionallyfamous.com/go/`
- The trunk/dev Playground URL for validating `main`: `https://odd.regionallyfamous.com/go/dev/`
- A one-line summary of what shipped

If the auto-generated release notes need editing, open the release in
GitHub and revise the body after it's been published. The zip is already
attached.
