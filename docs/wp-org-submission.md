# WordPress.org plugin directory submission

This doc records the steps and the current state of ODD's submission to https://wordpress.org/plugins/.

## Status

- [x] Slug chosen: `odd` (requested on submit form)
- [x] `readme.txt` written per plugin directory conventions ([`odd/readme.txt`](../odd/readme.txt))
- [x] Plugin header fields are complete and match the readme (verified by `odd/bin/check-version`)
- [x] Text domain declared and wired to `load_plugin_textdomain` + `wp_set_script_translations`
- [x] `languages/odd.pot` regenerated at release time
- [x] Zero external runtime dependencies shipped in the zip beyond Pixi (loaded from CDN by scenes, not bundled)
- [x] Licensing of every bundled asset recorded in [`LICENSES.md`](../LICENSES.md), all CC0-1.0 or GPL-compatible
- [x] No server-side telemetry ([ADR 0004](adr/0004-zero-server-side-telemetry.md))
- [ ] Submitted to the plugin directory for review (manual step, done via https://wordpress.org/plugins/developers/add/)
- [ ] SVN trunk seeded once the submission is approved (manual, see below)
- [ ] Screenshots captured and uploaded to `assets/` in SVN (5 screenshots listed in readme.txt)

## Screenshot checklist

Screenshots live in `/assets/` on the SVN side (sibling of `/trunk/`, `/tags/`, `/branches/`), not inside the plugin zip. Required sizes:

| File                  | Size             | What it shows                                          |
|-----------------------|------------------|--------------------------------------------------------|
| `screenshot-1.png`    | 1280×720 (or 1544×500) | ODD Control Panel — Wallpaper tab                |
| `screenshot-2.png`    | 1280×720         | ODD Shop — tiles with hero graphics                     |
| `screenshot-3.png`    | 1280×720         | Aurora + Hologram icon combination                      |
| `screenshot-4.png`    | 1280×720         | Origami + Fold icon combination                         |
| `screenshot-5.png`    | 1280×720         | Rainfall scene avoiding desktop icons                   |
| `banner-1544x500.png` | 1544×500         | Directory header banner                                 |
| `banner-772x250.png`  | 772×250          | Low-DPI banner fallback                                 |
| `icon-256x256.png`    | 256×256          | Directory icon                                          |
| `icon-128x128.png`    | 128×128          | Directory icon (low-DPI)                                |

All screenshots are captured in the live demo (https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/RegionallyFamous/odd/main/blueprint.json) at 1× zoom, cropped to the desktop surface, saved as PNG through `cmd-shift-4` + OSX screenshot viewer "Export" (use PNG — the directory rejects JPEG).

## SVN workflow

Once the plugin submission is approved:

```sh
# Check out the SVN repo the directory publishes.
svn co https://plugins.svn.wordpress.org/odd ~/plugins-svn/odd

# Stage the trunk.
cd ~/plugins-svn/odd
rsync -a --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='vendor' \
  --exclude='packages' \
  --exclude='examples' \
  --exclude='e2e' \
  --exclude='playwright*' \
  --exclude='.github' \
  --exclude='_tools' \
  --exclude='docs' \
  --exclude='ci' \
  /path/to/odd-repo/odd/ trunk/

# Copy readme.txt up to the expected location (WordPress.org reads it
# from trunk/readme.txt, which rsync from odd/ already puts there).

# Screenshots + banners live in assets/, not trunk/.
cp /path/to/screenshots/*.png assets/

# Version-tag this release.
svn cp trunk tags/1.10.0

# Review the diff, then commit.
svn status
svn add --force .
svn ci -m "Release 1.10.0"
```

Automating this would require a WP.org-specific workflow and secrets; we keep it manual until the plugin has enough release velocity to justify the setup.

## Plugin review feedback

Common feedback from the WP.org plugin review team + how ODD answers it:

- **"Don't bundle frameworks you load from CDN."** We don't bundle Pixi; scenes load it via `wp_enqueue_script` against jsdelivr, and the plugin zip is ~350 KB, well under the 35 MB `zip-budget` cap.
- **"Escape everything."** See PHPCS-enforced WordPress-Extra ruleset in `phpcs.xml`; the `phpcs` CI job blocks unescaped output.
- **"Call `load_plugin_textdomain` on `init` and pass the `languages/` folder."** Added in 1.10.0; see `odd/odd.php`.
- **"No opaque remote calls."** We make none. The only outbound HTTP from ODD is triggered by the user uploading a `.wp` — and even then it's on their own server.

## After approval

- Ship each subsequent release by copying `trunk/` → `tags/<version>/` and committing, then tag a GitHub release to keep both publishing channels in sync.
- Keep the changelog in `odd/readme.txt` short — point at `CHANGELOG.md` on GitHub for the long-form history.
