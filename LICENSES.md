# ODD asset licensing

ODD itself is [GPL-2.0-or-later](LICENSE), matching WordPress.

**As of v3.0 the plugin zip ships no wallpapers, previews, icon sets,
widgets, or apps.** Every piece of first-party content lives in the
remote catalog at `https://odd.regionallyfamous.com/catalog/v1/`
(source of truth: `_tools/catalog-sources/` in this repo, published to
GitHub Pages under `site/catalog/v1/`). This file records the license
and provenance of every catalog asset — a third party who mirrors the
catalog, forks the repo, or redistributes a host blueprint needs this
list to know what's theirs to redistribute.

Everything below is either:

- **Original to ODD**, authored by the maintainer or generated via
  OpenAI's image API with the "assignable rights" terms in effect at
  creation time. Released under **CC0-1.0** so hosts and downstream
  forks can redistribute without attribution.
- **Programmatically generated** from Pixi primitives at runtime (most
  scenes). No static asset is shipped — nothing to license.

No third-party stock photos, proprietary fonts, or trademarked
iconography are published in the first-party catalog. Third-party
bundles the user installs at runtime are subject to their own license
terms, recorded in the bundle's own `manifest.json` + `LICENSE` file
(if provided). The single built-in `odd-pending` fallback scene shipped
inside the plugin zip (a static gradient painted in
`odd/src/wallpaper/index.js`) is original code, covered by the plugin's
GPL-2.0-or-later license.

## Wallpapers — `_tools/catalog-sources/scenes/<slug>/wallpaper.webp`

All 19 files. 1920×1080, WebP q82. Painted via a single pass with
OpenAI's image API from neutral atmospheric prompts, then retouched to
remove any accidental text / logo drift. Released **CC0-1.0**.

| Slug                 | Provenance                                    |
|----------------------|-----------------------------------------------|
| abyssal-aquarium     | GPT Image 2 + hand retouch                    |
| aurora               | GPT Image 2                                   |
| balcony-noon         | GPT Image 2                                   |
| beach-umbrellas      | GPT Image 2                                   |
| big-sky              | GPT Image 2                                   |
| circuit-garden       | GPT Image 2                                   |
| cloud-city           | GPT Image 2                                   |
| flux                 | GPT Image 2                                   |
| iris-observatory     | GPT Image 2                                   |
| mercado              | GPT Image 2                                   |
| origami              | GPT Image 2                                   |
| pocket-dimension     | GPT Image 2                                   |
| rainfall             | GPT Image 2                                   |
| sun-print            | GPT Image 2                                   |
| terrazzo             | GPT Image 2                                   |
| tide-pool            | GPT Image 2                                   |
| tropical-greenhouse  | GPT Image 2                                   |
| weather-factory      | GPT Image 2                                   |
| wildflower-meadow    | GPT Image 2                                   |

## Previews — `_tools/catalog-sources/scenes/<slug>/preview.webp`

19 thumbnails, 640×360. Produced by `odd/bin/build-previews`, which
boots Chromium, runs the matching Pixi scene for ~2 s, and snapshots
the canvas. Derived from the wallpapers above; same **CC0-1.0** license.

## Icon sets — `_tools/catalog-sources/icon-sets/<slug>/`

17 sets × 13 SVGs each. Every SVG is authored from a shared symbol
catalog at `_tools/gen-icon-sets.py`. All hand-authored paths and
programmatic primitives, no traced stock artwork. Released
**CC0-1.0**.

| Set                 | Files                                     |
|---------------------|-------------------------------------------|
| arcade-tokens       | 13 SVGs + manifest.json                   |
| arctic              | 13 SVGs + manifest.json                   |
| blueprint           | 13 SVGs + manifest.json                   |
| botanical-plate     | 13 SVGs + manifest.json                   |
| brutalist-stencil   | 13 SVGs + manifest.json                   |
| circuit-bend        | 13 SVGs + manifest.json                   |
| claymation          | 13 SVGs + manifest.json                   |
| cross-stitch        | 13 SVGs + manifest.json                   |
| eyeball-avenue      | 13 SVGs + manifest.json                   |
| filament            | 13 SVGs + manifest.json                   |
| fold                | 13 SVGs + manifest.json                   |
| hologram            | 13 SVGs + manifest.json                   |
| lemonade-stand      | 13 SVGs + manifest.json                   |
| monoline            | 13 SVGs + manifest.json                   |
| risograph           | 13 SVGs + manifest.json                   |
| stadium             | 13 SVGs + manifest.json                   |
| tiki                | 13 SVGs + manifest.json                   |

## Widgets — `_tools/catalog-sources/widgets/<slug>/`

Two widgets: `sticky` (Sticky Note) and `eight-ball` (Magic 8-Ball).
Both are original hand-authored JavaScript + CSS. Released under
**GPL-2.0-or-later** to match the plugin.

## Apps — `_tools/catalog-sources/apps/<slug>/`

Seven apps: `board`, `flow`, `ledger`, `mosaic`, `sine`, `swatch`,
`tome`. All original work. Each app's internal dependencies (if any)
are licensed and recorded inside its own bundle's `LICENSE` file.
First-party apps are **GPL-2.0-or-later** unless their bundle's
`LICENSE` says otherwise.

## Fonts

ODD ships no custom fonts. The panel, widgets, and first-party bundles
rely on the OS system font stack (`-apple-system, BlinkMacSystemFont,
"Segoe UI", sans-serif`). Third-party apps that bundle their own fonts
must include the applicable font license inside their `.wp` archive.

## Third-party libraries (runtime)

Loaded via `wp_enqueue_script` / `wp_enqueue_style` from WordPress core
or jsdelivr at runtime, never bundled inside this repo:

- **PixiJS v8** — MIT. Loaded from
  `https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.js`
  by scenes that use Pixi; we don't bundle it.
- **@wordpress/hooks** — GPL-2.0. Enqueued via `wp-hooks` by WordPress
  core.

Build-time dev dependencies (vitest, playwright, phpunit, phpcs, etc.)
are listed in `package.json` and `composer.json` and ship nothing to
production users.

## Examples — `examples/`

The in-tree example bundles (scene / icon set / widget / app) are
released **CC0-1.0**. Everything under `examples/` can be used as a
starting template without attribution.

## How to audit this list

Any time a new wallpaper, preview, icon set, widget, or app lands in
`_tools/catalog-sources/`:

1. Add a row to the relevant section above.
2. Record the provenance (GPT Image 2 / hand-authored / generated from
   `_tools/...`).
3. If the provenance is anything other than the two categories above,
   STOP and open a discussion — the project is GPL-compatible-only by
   policy.

Run `odd/bin/check-licenses` (if present) before a release to
sanity-check that every asset under `_tools/catalog-sources/` is
mentioned here.
