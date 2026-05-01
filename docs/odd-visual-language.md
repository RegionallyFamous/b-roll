# ODD Visual Language

ODD graphics should feel like small collectible portals from the same strange desktop universe: handmade, luminous, slightly mischievous, and clearly useful.

## Core Style

- **Name:** ODD Diorama System
- **Mood:** cozy weird, polished toy-like, desktop surrealism, curious but not creepy
- **Shape language:** rounded squircle windows, soft bevels, layered paper/cardboard depth, tiny desktop props, subtle eye/portal motifs
- **Lighting:** dark plum base, warm peach highlights, cyan/magenta glow accents, rim-lit objects
- **Texture:** painted WebP card art with tactile grain, screen-glow bloom, soft shadows
- **Composition:** one central readable subject on a staged mini diorama, no literal UI chrome, no text inside images
- **Palette anchors:** ink plum `#12051f`, iris violet `#7a4cff`, electric cyan `#64f4ff`, peach `#ffb86b`, acid green `#b6ff6a`, paper cream `#fff4dc`

## Card Rules

Every catalog item gets a generated `card.webp` in its source folder. The catalog builder publishes these as `site/catalog/v1/cards/<type>-<slug>.webp` and exposes `card_url` in `registry.json`.

- **Scenes:** show the world as a destination poster without text. Keep the wallpaper subject recognizable, but frame it as a miniature desktop environment.
- **Icon sets:** show four or five physical icon tiles in that set's theme, staged on the same dark ODD surface.
- **Cursor sets:** show the cursor character as a glowing tool or creature, with motion hints and pointer trails.
- **Widgets:** show the widget as a tactile desktop object with one exaggerated feature.
- **Apps:** show the app's job as an object-based metaphor, not a screenshot.

## Negative Prompt

No text, no letters, no readable UI, no logos, no WordPress marks, no browser chrome, no photorealistic people, no horror, no gore, no weapons, no cluttered collage, no flat generic SaaS illustration, no off-brand pastel corporate gradients.
