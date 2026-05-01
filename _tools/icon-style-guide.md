# ODD icon style guide — standalone desktop glyph spec

This is the canonical design brief for every ODD icon set. It distills
Apple's [Human Interface Guidelines for app icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
for canvas discipline, adds the exact continuous-curvature squircle path reverse-engineered by
[Liam Rosenfeld](https://liamrosenfeld.com/posts/apple_icon_quest/),
and pins down the rules the `build-catalog` validator enforces before a
bundle can ship. ODD's current catalog icons render as standalone glyphs
on a transparent canvas so they can sit inside WP Desktop Mode's own
tiles without fighting the wallpaper or active theme.

Every first-party icon that goes into the catalog sets under
`_tools/catalog-sources/icon-sets/` must follow this.

## Canvas + shape

- **Viewport.** `viewBox="0 0 1024 1024"`, `width="1024"`,
  `height="1024"`. A 1024² canvas matches Apple's master-icon size and
  scales down crisply to the 64 px dock tile and the 128 px Shop
  Discover tile without re-authoring.
- **Shape.** Continuous-curvature squircle, **not** a standard
  rounded-rect. Apple's icon silhouette is a 7-cubic-bezier path with
  45 % equivalent corner radius (≈ 22.37 % of the width — `r = 229` on
  a 1024 canvas). The shape is encoded once, in
  `_tools/icon-sets/_base.svg.tmpl`, and every icon reuses it via
  `<clipPath id="sq">`.
- **Transparent visible background.** The squircle clip — ours, baked
  in, not Apple's system mask — stays in every SVG for compatibility
  with the catalog validator and preview composer, but the visible icon
  art should be a standalone glyph without a full-canvas tile, plate, or
  backplate.

### The squircle path (drop-in)

```
M 350.06 0
L 673.94 0
C 774.74 0 825.13 0 879.39 17.15
L 879.39 17.15
C 938.62 38.71 985.29 85.38 1006.85 144.61
C 1024 198.87 1024 249.26 1024 350.06
L 1024 673.94
C 1024 774.74 1024 825.13 1006.85 879.39
L 1006.85 879.39
C 985.29 938.62 938.62 985.29 879.39 1006.85
C 825.13 1024 774.74 1024 673.94 1024
L 350.06 1024
C 249.26 1024 198.87 1024 144.61 1006.85
L 144.61 1006.85
C 85.38 985.29 38.71 938.62 17.15 879.39
C 0 825.13 0 774.74 0 673.94
L 0 350.06
C 0 249.26 0 198.87 17.15 144.61
L 17.15 144.61
C 38.71 85.38 85.38 38.71 144.61 17.15
C 198.87 0 249.26 0 350.06 0
Z
```

Derived from Rosenfeld's constants with `w = 1024`, `r = 229`. If you
need a different radius, re-run `_tools/compute-squircle.py` — the
constants stay the same, only the scaling changes.

## Content rules

- **One clear subject.** Per icon, one centered metaphor. No
  compositions with more than three primary shapes. No text unless the
  brand requires it.
- **Safe area.** Keep meaningful subject content inside a **824×824**
  rectangle centered on the 1024 canvas (Apple's "icon grid
  rectangle"). Margin is `(1024 − 824) / 2 = 100` on every edge.
- **Metaphor set.** The 13 WP-Desktop keys — `dashboard`, `posts`,
  `pages`, `media`, `comments`, `appearance`, `plugins`, `users`,
  `tools`, `settings`, `profile`, `links`, `fallback` — all share
  stable silhouettes across sets so the visual language differs but
  the metaphors stay consistent. The canonical silhouettes live in
  the `SYMBOLS` dict at the top of
  [`_tools/gen-icon-sets.py`](gen-icon-sets.py). Sets may embellish
  (add fills, gradients, textures, extra strokes) but must preserve
  the core metaphor so users can read the icon the same way after a
  set swap.

## Background Treatment

- **No app tile.** Do not draw a full-canvas `<rect>`, squircle, badge,
  medallion, or rounded-square background inside the icon itself. The
  desktop shell supplies the tile treatment.
- **Material belongs to the glyph.** Gradients, grain, stitches, foil,
  glow, and highlights are welcome when they are part of the symbol
  silhouette or tiny accents around it.
- **Preview backgrounds are separate.** Catalog cards may compose these
  glyphs on a shared stage, but the individual icon SVGs should remain
  transparent.

## Foreground treatment

- **Hard edges.** Subject silhouettes must have crisp edges. No
  `<feGaussianBlur>`, no `filter="url(#blur…)"` on the subject layer.
- **One drop shadow max.** A single `<feDropShadow>` on the subject
  group is allowed to lift it off the background. No stacked shadows,
  no inner shadows.
- **Stroke rules.** Strokes (when used) must be `stroke-width` ≥ 6 at
  the 1024 scale so they survive the downscale to 64 px. Thinner
  strokes alias to invisibility in the dock.

## File budget

- **≤ 10 240 bytes uncompressed** per SVG. First-party catalog icons
  should stay compact enough for the remote catalog budget, with room
  for the current scene catalog's painted backdrops.
- **No `<image>` tags.** All-vector. Keeps files compact and resolution-
  independent.
- **No `<script>`.** SVGs ship over WP-Desktop's sanitized pipeline
  which would strip it anyway, but authors shouldn't rely on that.

## The validator will reject

- Files that don't declare `viewBox="0 0 1024 1024"`.
- Files whose root `<svg>` doesn't contain the canonical
  `<clipPath id="sq">` from `_base.svg.tmpl`.
- Files over 10 240 bytes.
- Files containing control bytes outside `\t\n\r` (pre-existing rule
  from the old validator — keep not regressing it).
