---
description: Build, commit, push, and cut a new B-Roll release on GitHub
argument-hint: <version>  e.g. 0.4.0
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Cut a B-Roll release

Parse `$ARGUMENTS` as `<version>` (bare, no leading `v`). If missing, read the current `Version:` from `b-roll.php` and ask the user what the next version should be before continuing.

## 1. Verify preconditions

```bash
git status --porcelain  # warn if uncommitted changes; ask user
git rev-parse --abbrev-ref HEAD  # must be main
git log --oneline -5  # sanity check last commits
```

If on a different branch, stop and ask.

## 2. Bump the version string in three places

In `b-roll.php`:
- The `* Version:` header
- The 4th arg of `wp_enqueue_script()` (`'0.X.0'`)
- The `'version'` entry in the `wp_localize_script()` array

Then stage and commit:

```bash
git add b-roll.php
git commit -m "chore: bump version to v<version>"
```

## 3. Build the zip

Rebuild `b-roll.zip` at the repo parent (not inside the repo):

```bash
cd ..
python3 - <<'PY'
import zipfile, os, pathlib
src = pathlib.Path("b-roll")
with zipfile.ZipFile("b-roll.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(src.rglob("*")):
        if ".git" in p.parts: continue
        if p.is_file(): z.write(p, arcname=str(p.relative_to(".")))
print("wrote b-roll.zip", os.path.getsize("b-roll.zip"), "bytes")
PY
cd b-roll
```

## 4. Push `main`

```bash
git push origin main
```

## 5. Create the release + upload the zip

Prefer `gh` if installed:

```bash
gh release create v<version> ../b-roll.zip \
  --title "v<version> — <short summary>" \
  --notes-file <(cat <<'NOTES'
## What's new in v<version>

- <bullet 1>
- <bullet 2>
...

**Live demo:** https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/RegionallyFamous/b-roll/main/blueprint.json
NOTES
)
```

The release notes body should list actual changes since the previous release — summarize recent commits with `git log v<prev>..HEAD --oneline` first and build the bullet list from that. Ask the user to approve the notes before creating the release unless they've explicitly said to just do it.

If `gh` is not installed, fall back to the REST API using `$GH_TOKEN` (must be set in the environment):

```bash
RELEASE_JSON=$(curl -sS -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/RegionallyFamous/b-roll/releases \
  -d @<(python3 -c '
import json, os
print(json.dumps({
    "tag_name": "v<version>",
    "target_commitish": "main",
    "name": "v<version> — <short summary>",
    "body": "<release notes>",
    "draft": False, "prerelease": False
}))
'))
RELEASE_ID=$(echo "$RELEASE_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
sleep 2  # asset upload sometimes 409s immediately after creation
curl -sS -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary @../b-roll.zip \
  "https://uploads.github.com/repos/RegionallyFamous/b-roll/releases/$RELEASE_ID/assets?name=b-roll.zip"
```

## 6. Verify

```bash
curl -sI -L https://github.com/RegionallyFamous/b-roll/releases/latest/download/b-roll.zip | head -4
```

Should show `HTTP/2 302` redirects eventually landing on a `release-assets.githubusercontent.com` URL containing `v<version>`.

## 7. Report back

Give the user:
- The release URL: `https://github.com/RegionallyFamous/b-roll/releases/tag/v<version>`
- The Playground demo URL (unchanged — it's release-agnostic)
- A one-line summary of what shipped
