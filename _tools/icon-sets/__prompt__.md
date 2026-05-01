# LLM brief — regenerate one ODD icon set in iOS app icon style

You are an SVG icon designer. You will regenerate one **ODD icon set**
(13 icons) as iOS-style app icons that ship in the WP-Desktop dock.

Read this brief end-to-end before writing anything. The build-catalog
validator will reject any icon that breaks the hard constraints at the
bottom, so aim for them first and be creative inside the lines.

## 1. Canvas + shape (non-negotiable)

- Each icon is one SVG file, rendered on a 1024×1024 canvas
  (`viewBox="0 0 1024 1024"`).
- Every icon inherits the shape from the shared template at
  `_tools/icon-sets/_base.svg.tmpl`. You **must** keep the template's
  `<clipPath id="sq">` verbatim, and the main `<g>` must carry
  `clip-path="url(#sq)"`. Do not replace the squircle with `rx=N` or a
  circle — Apple's app icon is a continuous-curvature squircle and we
  bake that exact path.
- The background layer must fully cover the 1024×1024 rect. The
  squircle clip takes care of the silhouette.
- Keep meaningful subject content inside the centered **824×824** safe
  rect (`x=100, y=100` through `x=924, y=924`) so the squircle never
  clips a metaphor.

## 2. Style direction (iOS app icons)

- **One bold metaphor.** One centered symbol per icon. No
  compositions with more than three primary shapes. No text labels
  (the dock renders its own labels underneath).
- **Full-color.** Solid or simple gradient background plus a clearly
  contrasting subject. Use the set's accent as an anchor; pick
  supporting colors from the set description.
- **Hard edges.** Crisp silhouettes, no Gaussian blur on the subject.
  One `<feDropShadow>` is allowed on the subject group.
- **Optional Liquid Glass highlight.** Up to one
  `<radialGradient>`-based specular highlight in the top-left corner,
  opacity ≤ 0.35, if it suits the set.
- **Dock-safe.** Assume the icon will be scaled to 64 px. Strokes
  thinner than 6 at the 1024 scale disappear — use chunky shapes and
  thick strokes.

## 3. The 13 WP-Desktop metaphors (stable across all catalog sets)

Every set ships exactly these keys. The metaphor silhouette stays
constant across sets so users recognize each role after a set swap.
You can (and should) re-interpret the silhouette in the set's style,
but keep the archetype legible.

| key          | archetype                                          |
| ------------ | -------------------------------------------------- |
| `dashboard`  | 2×2 grid of squares (WP "blocks")                  |
| `posts`      | a page with stacked horizontal text lines          |
| `pages`      | a page with a folded top-right corner              |
| `media`      | a landscape frame: sun + horizon inside a border   |
| `comments`   | a speech bubble with a tail                        |
| `appearance` | a paint brush or roller (handle + tip)             |
| `plugins`    | an electrical plug (head + prongs + cord)          |
| `users`      | two overlapping head-and-shoulders silhouettes     |
| `tools`      | a wrench (open-ended head on a diagonal handle)    |
| `settings`   | a gear (8-tooth rosette with center hole)          |
| `profile`    | one head-and-shoulders inside a circular frame     |
| `links`      | two interlocking chain links at ~30°               |
| `recycle-bin`| a trash/recycle bin with lid and vertical ribs     |
| `fallback`   | three concentric pulses (used for unmapped roles)  |

Source of truth: the `ICON_KEYS` list and glyph helpers in
[`_tools/regen-icon-set.py`](../regen-icon-set.py).

## 4. Per-set theming

This brief is filled per run from the set's `manifest.json`. The
runner substitutes the following block before sending to the LLM:

```
SET_SLUG:     {{SLUG}}
SET_LABEL:    {{LABEL}}
SET_FRANCHISE: {{FRANCHISE}}
ACCENT:       {{ACCENT}}
DESCRIPTION:  {{DESCRIPTION}}
```

Use `DESCRIPTION` as your style direction. It's the one-line pitch
from the Shop Discover tile. Match every icon in this set to that
pitch so the 14 files feel like a family.

## 5. SVG skeleton to start from

```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"
     width="1024" height="1024" role="img"
     aria-label="{{ICON_LABEL}} — {{SET_LABEL}}">
  <defs>
    <clipPath id="sq"><path d="M 350.06 0 L 673.94 0 C 774.74 0 825.13 0 879.39 17.15 L 879.39 17.15 C 938.62 38.71 985.29 85.38 1006.85 144.61 C 1024 198.87 1024 249.26 1024 350.06 L 1024 673.94 C 1024 774.74 1024 825.13 1006.85 879.39 L 1006.85 879.39 C 985.29 938.62 938.62 985.29 879.39 1006.85 C 825.13 1024 774.74 1024 673.94 1024 L 350.06 1024 C 249.26 1024 198.87 1024 144.61 1006.85 L 144.61 1006.85 C 85.38 985.29 38.71 938.62 17.15 879.39 C 0 825.13 0 774.74 0 673.94 L 0 350.06 C 0 249.26 0 198.87 17.15 144.61 L 17.15 144.61 C 38.71 85.38 85.38 38.71 144.61 17.15 C 198.87 0 249.26 0 350.06 0 Z"/></clipPath>
    <!-- optional <linearGradient>/<radialGradient>/<filter> here -->
  </defs>
  <g clip-path="url(#sq)">
    <!-- BACKGROUND: full-bleed fill or gradient -->
    <rect x="0" y="0" width="1024" height="1024" fill="..."/>
    <!-- SUBJECT: one centered metaphor inside the 824×824 safe rect -->
    <g transform="translate(100 100)"> ... </g>
    <!-- SPECULAR: optional Liquid-Glass radial highlight, top-left -->
  </g>
</svg>
```

## 6. Output format

Respond with a **JSON object** — no prose, no markdown fences, no
commentary. Exactly this shape:

```
{
  "dashboard":  "<svg ...>...</svg>",
  "posts":      "<svg ...>...</svg>",
  "pages":      "<svg ...>...</svg>",
  "media":      "<svg ...>...</svg>",
  "comments":   "<svg ...>...</svg>",
  "appearance": "<svg ...>...</svg>",
  "plugins":    "<svg ...>...</svg>",
  "users":      "<svg ...>...</svg>",
  "tools":      "<svg ...>...</svg>",
  "settings":   "<svg ...>...</svg>",
  "profile":    "<svg ...>...</svg>",
  "links":      "<svg ...>...</svg>",
  "recycle-bin": "<svg ...>...</svg>",
  "fallback":   "<svg ...>...</svg>"
}
```

Every value is one complete, standalone SVG source string (start with
`<svg`, end with `</svg>`, no XML prolog).

## 7. Hard constraints — the validator will reject the batch otherwise

For every icon in the batch:

- Root element is `<svg>` with `xmlns="http://www.w3.org/2000/svg"`,
  `viewBox="0 0 1024 1024"`, and `width="1024"`, `height="1024"`.
- Contains a `<clipPath id="sq">` whose `<path d=...>` matches the
  squircle path from the template byte-for-byte.
- Contains at least one element with `clip-path="url(#sq)"` wrapping
  the visible content.
- Background layer covers the full 1024² rect and is not transparent
  (no `opacity` or `fill-opacity` below 0.15 on the first background
  fill).
- No `<image>` tags, no `<script>`, no `<foreignObject>`.
- File size ≤ 10 240 bytes when serialized as UTF-8.
- Well-formed XML (parses without errors).
- No control bytes outside `\t \n \r` — those fail the validator's
  byte scan.

Work through all 14 icons in one pass so they share a single palette
and feel like a family. Aim for distinctive, tasteful iOS-style app
icons — think App Store Editor's Choice, not stock iconography.
