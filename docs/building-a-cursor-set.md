# Building a Cursor Set

Cursor sets are `.wp` bundles that theme the pointer across ODD Desktop Mode surfaces and classic wp-admin chrome for the current user.

## Manifest

Create `_tools/catalog-sources/cursor-sets/<slug>/manifest.json`:

```json
{
  "type": "cursor-set",
  "slug": "example-cursors",
  "name": "Example Cursors",
  "label": "Example Cursors",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A short sentence for the ODD Shop.",
  "franchise": "Example",
  "accent": "#38e8ff",
  "preview": "preview.svg",
  "cursors": {
    "default": { "file": "default.svg", "hotspot": [2, 2] },
    "pointer": { "file": "pointer.svg", "hotspot": [9, 3] },
    "text": { "file": "text.svg", "hotspot": [16, 16] }
  }
}
```

`default` is required. Supported cursor kinds are `default`, `pointer`, `text`, `grab`, `grabbing`, `crosshair`, `not-allowed`, `wait`, `help`, and `progress`.

## Asset Rules

- Cursor files must be flat SVG files next to `manifest.json`.
- Hotspots are `[x, y]` integer pairs, measured from the SVG's top-left corner.
- Keep each cursor under 8 KB. Small, simple SVGs feel better and load faster.
- Do not include scripts, external images, `foreignObject`, or event attributes.
- Always provide a precise `text` cursor if your theme changes the default pointer heavily.

## Build And Validate

```bash
odd/bin/validate-cursor-sets
python3 _tools/build-catalog.py
odd/bin/validate-catalog
```

The builder emits `site/catalog/v1/bundles/cursor-set-<slug>.wp`, a Shop tile under `site/catalog/v1/icons/`, and the corresponding registry entry.
