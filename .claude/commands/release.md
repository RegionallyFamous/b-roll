---
description: Bump the version, commit, and push a release tag. CI builds the zip and cuts the GitHub release.
argument-hint: <version>  e.g. 0.2.0
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

## 2. Bump the version string in two places

In `odd/odd.php`:

- The `* Version:` header
- The `ODD_VERSION` constant

Then confirm they agree:

```bash
odd/bin/check-version --expect <version>
```

Commit:

```bash
git add odd/odd.php
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
2. Runs `odd/bin/validate-scenes` + `odd/bin/validate-icon-sets`.
3. Runs `odd/bin/build-zip` to produce `dist/odd.zip`.
4. Calls `gh release create "v<version>" dist/odd.zip --latest=true --generate-notes`
   (auto-generates release notes from commits since the previous tag).
5. Verifies `releases/latest/download/odd.zip` resolves via curl.

## 4. Watch the release

```bash
gh run watch
```

Or browse to the Actions tab in the repo.

## 5. Report back

Give the user:

- The release URL: `https://github.com/RegionallyFamous/odd/releases/tag/v<version>`
- The Playground demo URL (unchanged — it's release-agnostic)
- A one-line summary of what shipped

If the auto-generated release notes need editing, open the release in
GitHub and revise the body after it's been published. The zip is already
attached.
