# ODD Shop Visual QA

The Luxe + Weird overhaul is checked at these breakpoints in both light and dark themes:

- 420 x 520: native-window minimum width stress case.
- 480 x 820: narrow portrait stress case.
- 720 x 520: compact tablet-ish window.
- 960 x 620: previous default footprint.
- 1080 x 720: new default footprint.
- 1280 x 800: wide desktop.
- 1920 x 1080: ultrawide-ish desktop.

Acceptance notes:

- Topbar search, rail, hero, editorial strip, cards, Settings, overlays, and preview bar must fit without horizontal overflow.
- Dark mode must flip every chrome and secondary surface while keeping ODD tints as accents.
- Reduced-motion mode must disable live hero motion, card tilt, chaos cast, and looping hero flourishes.
- Focus rings must remain visible and unclipped on rail items, cards, buttons, and Settings controls.

Screenshots should be captured before release and named `<theme>-<width>x<height>-<department>.png`.
