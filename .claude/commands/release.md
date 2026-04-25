---
description: Bump the version, commit, and push a release tag. CI builds the zip and cuts the GitHub release.
argument-hint: <version>  e.g. 0.7.0
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Cut a B-Roll release

Parse `$ARGUMENTS` as `<version>` (bare, no leading `v`). If missing, read
the current `Version:` from `b-roll.php` and ask the user what the next
version should be before continuing.

The release zip and GitHub release are produced by
[.github/workflows/release.yml](../../.github/workflows/release.yml) when
a `v*` tag is pushed. This command's job is just to bump the version
strings, commit, push `main`, and push the tag.

## 1. Verify preconditions

```bash
git status --porcelain         # warn if uncommitted changes; ask user
git rev-parse --abbrev-ref HEAD  # must be main
git log --oneline -5           # sanity check last commits
```

If on a different branch, stop and ask.

## 2. Bump the version string in three places

In `b-roll.php`:

- The `* Version:` header
- The 4th arg of `wp_enqueue_script()` (`'0.X.0'`)
- The `'version'` entry in the `wp_localize_script()` array

Then confirm they all agree:

```bash
bin/check-version --expect <version>
```

Commit:

```bash
git add b-roll.php
git commit -m "chore: bump version to v<version>"
```

## 3. Push main and the tag

```bash
git push origin main
git tag "v<version>"
git push origin "v<version>"
```

Pushing the tag triggers
[.github/workflows/release.yml](../../.github/workflows/release.yml),
which:

1. Reruns the full `ci.yml` suite (scene validator, version check, PHP
   lint + PHPCS, JS lint, JSON validation, zip budget, Playground smoke
   test).
2. Asserts the tag matches `b-roll.php`'s committed version.
3. Runs `bin/build-zip` to produce `dist/b-roll.zip`.
4. Calls `gh release create "v<version>" dist/b-roll.zip --generate-notes`
   (auto-generates release notes from commits since the previous tag).
5. Verifies `releases/latest/download/b-roll.zip` resolves via curl.

## 4. Watch the release

```bash
gh run watch
```

Or browse to the Actions tab in the repo.

## 5. Report back

Give the user:

- The release URL: `https://github.com/RegionallyFamous/odd/releases/tag/v<version>`
- The Playground demo URL (unchanged - it's release-agnostic)
- A one-line summary of what shipped

If the release notes auto-generated from commits need editing, open the
release in GitHub and revise the body after it's been published. The
zip is already attached.
