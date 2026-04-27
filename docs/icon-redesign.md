# Icon redesign — iOS app icon style

Side-by-side review of all 17 ODD icon sets before the rebuilt catalog
ships. Every icon is now a 1024×1024 SVG with the iOS continuous-
curvature squircle baked in (`<clipPath id="sq">`), a full-bleed
background, and one bold centered subject inside the 824×824 safe
rect. Spec: [`../_tools/icon-style-guide.md`](../_tools/icon-style-guide.md).

The "before" thumbnails come from the first 1.1.0 iOS pass. That pass
used the same glyphs across all 17 sets with different colors, which
made the sets feel too similar. The "after" thumbnails are the 1.1.1
regeneration: same 13 metaphors, but distinct set-specific visual
treatments (coin relief, blueprint strokes, PCB traces, cross-stitch,
riso offset, stadium patch stitching, carved wood, and more). GitHub
renders both inline.

> These SVGs ship verbatim in each set's `.wp` bundle. What you see is
> what lands on users' WP-Desktop docks and in the Shop Discover tile.

## Reading the grid

Each row is one role. 13 roles per set:

`dashboard · posts · pages · media · comments · appearance · plugins · users · tools · settings · profile · links · fallback`

Click through to `_tools/catalog-sources/icon-sets/<slug>/` to open
the raw SVG and inspect the source.

---

<style>
.icon-grid { display:grid; grid-template-columns:repeat(13, 1fr); gap:4px; margin:8px 0 20px; }
.icon-grid img { width:100%; aspect-ratio:1/1; background:#1a1a1a; border-radius:14px; }
.set-head { display:flex; align-items:center; gap:14px; margin:28px 0 6px; }
.set-swatch { width:18px; height:18px; border-radius:6px; display:inline-block; border:1px solid rgba(0,0,0,.2); }
.set-meta { color:#888; font-size:12px; }
</style>

<!-- generator:icon-redesign — rebuild by running `python3 _tools/make-icon-redesign.py` -->


## Arcade Tokens

<div class="set-head"><span class="set-swatch" style="background:#b07a2a"></span><strong>Arcade Tokens</strong><span class="set-meta">Retro · accent <code>#b07a2a</code> · v1.1.1</span></div>

_Embossed bronze-and-gold coin icons with every glyph pressed in as a relief. Jingles in your pocket._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/arcade-tokens/dashboard.svg" alt="arcade-tokens dashboard before">
  <img src="icon-redesign-assets/before/arcade-tokens/posts.svg" alt="arcade-tokens posts before">
  <img src="icon-redesign-assets/before/arcade-tokens/pages.svg" alt="arcade-tokens pages before">
  <img src="icon-redesign-assets/before/arcade-tokens/media.svg" alt="arcade-tokens media before">
  <img src="icon-redesign-assets/before/arcade-tokens/comments.svg" alt="arcade-tokens comments before">
  <img src="icon-redesign-assets/before/arcade-tokens/appearance.svg" alt="arcade-tokens appearance before">
  <img src="icon-redesign-assets/before/arcade-tokens/plugins.svg" alt="arcade-tokens plugins before">
  <img src="icon-redesign-assets/before/arcade-tokens/users.svg" alt="arcade-tokens users before">
  <img src="icon-redesign-assets/before/arcade-tokens/tools.svg" alt="arcade-tokens tools before">
  <img src="icon-redesign-assets/before/arcade-tokens/settings.svg" alt="arcade-tokens settings before">
  <img src="icon-redesign-assets/before/arcade-tokens/profile.svg" alt="arcade-tokens profile before">
  <img src="icon-redesign-assets/before/arcade-tokens/links.svg" alt="arcade-tokens links before">
  <img src="icon-redesign-assets/before/arcade-tokens/fallback.svg" alt="arcade-tokens fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/arcade-tokens/dashboard.svg" alt="arcade-tokens dashboard after">
  <img src="icon-redesign-assets/after/arcade-tokens/posts.svg" alt="arcade-tokens posts after">
  <img src="icon-redesign-assets/after/arcade-tokens/pages.svg" alt="arcade-tokens pages after">
  <img src="icon-redesign-assets/after/arcade-tokens/media.svg" alt="arcade-tokens media after">
  <img src="icon-redesign-assets/after/arcade-tokens/comments.svg" alt="arcade-tokens comments after">
  <img src="icon-redesign-assets/after/arcade-tokens/appearance.svg" alt="arcade-tokens appearance after">
  <img src="icon-redesign-assets/after/arcade-tokens/plugins.svg" alt="arcade-tokens plugins after">
  <img src="icon-redesign-assets/after/arcade-tokens/users.svg" alt="arcade-tokens users after">
  <img src="icon-redesign-assets/after/arcade-tokens/tools.svg" alt="arcade-tokens tools after">
  <img src="icon-redesign-assets/after/arcade-tokens/settings.svg" alt="arcade-tokens settings after">
  <img src="icon-redesign-assets/after/arcade-tokens/profile.svg" alt="arcade-tokens profile after">
  <img src="icon-redesign-assets/after/arcade-tokens/links.svg" alt="arcade-tokens links after">
  <img src="icon-redesign-assets/after/arcade-tokens/fallback.svg" alt="arcade-tokens fallback after">
</div>


## Arctic

<div class="set-head"><span class="set-swatch" style="background:#7ddcff"></span><strong>Arctic</strong><span class="set-meta">Crystal OS · accent <code>#7ddcff</code> · v1.1.1</span></div>

_Full-color frosted-glass app tiles with icy gradients, snow highlights, and saturated role glyphs built for high contrast on busy wallpapers._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/arctic/dashboard.svg" alt="arctic dashboard before">
  <img src="icon-redesign-assets/before/arctic/posts.svg" alt="arctic posts before">
  <img src="icon-redesign-assets/before/arctic/pages.svg" alt="arctic pages before">
  <img src="icon-redesign-assets/before/arctic/media.svg" alt="arctic media before">
  <img src="icon-redesign-assets/before/arctic/comments.svg" alt="arctic comments before">
  <img src="icon-redesign-assets/before/arctic/appearance.svg" alt="arctic appearance before">
  <img src="icon-redesign-assets/before/arctic/plugins.svg" alt="arctic plugins before">
  <img src="icon-redesign-assets/before/arctic/users.svg" alt="arctic users before">
  <img src="icon-redesign-assets/before/arctic/tools.svg" alt="arctic tools before">
  <img src="icon-redesign-assets/before/arctic/settings.svg" alt="arctic settings before">
  <img src="icon-redesign-assets/before/arctic/profile.svg" alt="arctic profile before">
  <img src="icon-redesign-assets/before/arctic/links.svg" alt="arctic links before">
  <img src="icon-redesign-assets/before/arctic/fallback.svg" alt="arctic fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/arctic/dashboard.svg" alt="arctic dashboard after">
  <img src="icon-redesign-assets/after/arctic/posts.svg" alt="arctic posts after">
  <img src="icon-redesign-assets/after/arctic/pages.svg" alt="arctic pages after">
  <img src="icon-redesign-assets/after/arctic/media.svg" alt="arctic media after">
  <img src="icon-redesign-assets/after/arctic/comments.svg" alt="arctic comments after">
  <img src="icon-redesign-assets/after/arctic/appearance.svg" alt="arctic appearance after">
  <img src="icon-redesign-assets/after/arctic/plugins.svg" alt="arctic plugins after">
  <img src="icon-redesign-assets/after/arctic/users.svg" alt="arctic users after">
  <img src="icon-redesign-assets/after/arctic/tools.svg" alt="arctic tools after">
  <img src="icon-redesign-assets/after/arctic/settings.svg" alt="arctic settings after">
  <img src="icon-redesign-assets/after/arctic/profile.svg" alt="arctic profile after">
  <img src="icon-redesign-assets/after/arctic/links.svg" alt="arctic links after">
  <img src="icon-redesign-assets/after/arctic/fallback.svg" alt="arctic fallback after">
</div>


## Blueprint

<div class="set-head"><span class="set-swatch" style="background:#4da3ff"></span><strong>Blueprint</strong><span class="set-meta">Drafting · accent <code>#4da3ff</code> · v1.1.1</span></div>

_Full-color blueprint tiles: cobalt glass, cyan construction lines, brass labels, and dimensional admin glyphs._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/blueprint/dashboard.svg" alt="blueprint dashboard before">
  <img src="icon-redesign-assets/before/blueprint/posts.svg" alt="blueprint posts before">
  <img src="icon-redesign-assets/before/blueprint/pages.svg" alt="blueprint pages before">
  <img src="icon-redesign-assets/before/blueprint/media.svg" alt="blueprint media before">
  <img src="icon-redesign-assets/before/blueprint/comments.svg" alt="blueprint comments before">
  <img src="icon-redesign-assets/before/blueprint/appearance.svg" alt="blueprint appearance before">
  <img src="icon-redesign-assets/before/blueprint/plugins.svg" alt="blueprint plugins before">
  <img src="icon-redesign-assets/before/blueprint/users.svg" alt="blueprint users before">
  <img src="icon-redesign-assets/before/blueprint/tools.svg" alt="blueprint tools before">
  <img src="icon-redesign-assets/before/blueprint/settings.svg" alt="blueprint settings before">
  <img src="icon-redesign-assets/before/blueprint/profile.svg" alt="blueprint profile before">
  <img src="icon-redesign-assets/before/blueprint/links.svg" alt="blueprint links before">
  <img src="icon-redesign-assets/before/blueprint/fallback.svg" alt="blueprint fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/blueprint/dashboard.svg" alt="blueprint dashboard after">
  <img src="icon-redesign-assets/after/blueprint/posts.svg" alt="blueprint posts after">
  <img src="icon-redesign-assets/after/blueprint/pages.svg" alt="blueprint pages after">
  <img src="icon-redesign-assets/after/blueprint/media.svg" alt="blueprint media after">
  <img src="icon-redesign-assets/after/blueprint/comments.svg" alt="blueprint comments after">
  <img src="icon-redesign-assets/after/blueprint/appearance.svg" alt="blueprint appearance after">
  <img src="icon-redesign-assets/after/blueprint/plugins.svg" alt="blueprint plugins after">
  <img src="icon-redesign-assets/after/blueprint/users.svg" alt="blueprint users after">
  <img src="icon-redesign-assets/after/blueprint/tools.svg" alt="blueprint tools after">
  <img src="icon-redesign-assets/after/blueprint/settings.svg" alt="blueprint settings after">
  <img src="icon-redesign-assets/after/blueprint/profile.svg" alt="blueprint profile after">
  <img src="icon-redesign-assets/after/blueprint/links.svg" alt="blueprint links after">
  <img src="icon-redesign-assets/after/blueprint/fallback.svg" alt="blueprint fallback after">
</div>


## Botanical Plate

<div class="set-head"><span class="set-swatch" style="background:#6a8f3b"></span><strong>Botanical Plate</strong><span class="set-meta">Illustrated · accent <code>#6a8f3b</code> · v1.1.1</span></div>

_Copperplate ink + soft green watercolor wash on aged paper, like a naturalist's field guide._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/botanical-plate/dashboard.svg" alt="botanical-plate dashboard before">
  <img src="icon-redesign-assets/before/botanical-plate/posts.svg" alt="botanical-plate posts before">
  <img src="icon-redesign-assets/before/botanical-plate/pages.svg" alt="botanical-plate pages before">
  <img src="icon-redesign-assets/before/botanical-plate/media.svg" alt="botanical-plate media before">
  <img src="icon-redesign-assets/before/botanical-plate/comments.svg" alt="botanical-plate comments before">
  <img src="icon-redesign-assets/before/botanical-plate/appearance.svg" alt="botanical-plate appearance before">
  <img src="icon-redesign-assets/before/botanical-plate/plugins.svg" alt="botanical-plate plugins before">
  <img src="icon-redesign-assets/before/botanical-plate/users.svg" alt="botanical-plate users before">
  <img src="icon-redesign-assets/before/botanical-plate/tools.svg" alt="botanical-plate tools before">
  <img src="icon-redesign-assets/before/botanical-plate/settings.svg" alt="botanical-plate settings before">
  <img src="icon-redesign-assets/before/botanical-plate/profile.svg" alt="botanical-plate profile before">
  <img src="icon-redesign-assets/before/botanical-plate/links.svg" alt="botanical-plate links before">
  <img src="icon-redesign-assets/before/botanical-plate/fallback.svg" alt="botanical-plate fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/botanical-plate/dashboard.svg" alt="botanical-plate dashboard after">
  <img src="icon-redesign-assets/after/botanical-plate/posts.svg" alt="botanical-plate posts after">
  <img src="icon-redesign-assets/after/botanical-plate/pages.svg" alt="botanical-plate pages after">
  <img src="icon-redesign-assets/after/botanical-plate/media.svg" alt="botanical-plate media after">
  <img src="icon-redesign-assets/after/botanical-plate/comments.svg" alt="botanical-plate comments after">
  <img src="icon-redesign-assets/after/botanical-plate/appearance.svg" alt="botanical-plate appearance after">
  <img src="icon-redesign-assets/after/botanical-plate/plugins.svg" alt="botanical-plate plugins after">
  <img src="icon-redesign-assets/after/botanical-plate/users.svg" alt="botanical-plate users after">
  <img src="icon-redesign-assets/after/botanical-plate/tools.svg" alt="botanical-plate tools after">
  <img src="icon-redesign-assets/after/botanical-plate/settings.svg" alt="botanical-plate settings after">
  <img src="icon-redesign-assets/after/botanical-plate/profile.svg" alt="botanical-plate profile after">
  <img src="icon-redesign-assets/after/botanical-plate/links.svg" alt="botanical-plate links after">
  <img src="icon-redesign-assets/after/botanical-plate/fallback.svg" alt="botanical-plate fallback after">
</div>


## Brutalist Stencil

<div class="set-head"><span class="set-swatch" style="background:#ff5f4f"></span><strong>Brutalist Stencil</strong><span class="set-meta">Concrete Arcade · accent <code>#ff5f4f</code> · v1.1.1</span></div>

_Chunky full-color stencil badges with concrete shadows, hazard accents, and bold shapes that read clearly at dock size._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/brutalist-stencil/dashboard.svg" alt="brutalist-stencil dashboard before">
  <img src="icon-redesign-assets/before/brutalist-stencil/posts.svg" alt="brutalist-stencil posts before">
  <img src="icon-redesign-assets/before/brutalist-stencil/pages.svg" alt="brutalist-stencil pages before">
  <img src="icon-redesign-assets/before/brutalist-stencil/media.svg" alt="brutalist-stencil media before">
  <img src="icon-redesign-assets/before/brutalist-stencil/comments.svg" alt="brutalist-stencil comments before">
  <img src="icon-redesign-assets/before/brutalist-stencil/appearance.svg" alt="brutalist-stencil appearance before">
  <img src="icon-redesign-assets/before/brutalist-stencil/plugins.svg" alt="brutalist-stencil plugins before">
  <img src="icon-redesign-assets/before/brutalist-stencil/users.svg" alt="brutalist-stencil users before">
  <img src="icon-redesign-assets/before/brutalist-stencil/tools.svg" alt="brutalist-stencil tools before">
  <img src="icon-redesign-assets/before/brutalist-stencil/settings.svg" alt="brutalist-stencil settings before">
  <img src="icon-redesign-assets/before/brutalist-stencil/profile.svg" alt="brutalist-stencil profile before">
  <img src="icon-redesign-assets/before/brutalist-stencil/links.svg" alt="brutalist-stencil links before">
  <img src="icon-redesign-assets/before/brutalist-stencil/fallback.svg" alt="brutalist-stencil fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/brutalist-stencil/dashboard.svg" alt="brutalist-stencil dashboard after">
  <img src="icon-redesign-assets/after/brutalist-stencil/posts.svg" alt="brutalist-stencil posts after">
  <img src="icon-redesign-assets/after/brutalist-stencil/pages.svg" alt="brutalist-stencil pages after">
  <img src="icon-redesign-assets/after/brutalist-stencil/media.svg" alt="brutalist-stencil media after">
  <img src="icon-redesign-assets/after/brutalist-stencil/comments.svg" alt="brutalist-stencil comments after">
  <img src="icon-redesign-assets/after/brutalist-stencil/appearance.svg" alt="brutalist-stencil appearance after">
  <img src="icon-redesign-assets/after/brutalist-stencil/plugins.svg" alt="brutalist-stencil plugins after">
  <img src="icon-redesign-assets/after/brutalist-stencil/users.svg" alt="brutalist-stencil users after">
  <img src="icon-redesign-assets/after/brutalist-stencil/tools.svg" alt="brutalist-stencil tools after">
  <img src="icon-redesign-assets/after/brutalist-stencil/settings.svg" alt="brutalist-stencil settings after">
  <img src="icon-redesign-assets/after/brutalist-stencil/profile.svg" alt="brutalist-stencil profile after">
  <img src="icon-redesign-assets/after/brutalist-stencil/links.svg" alt="brutalist-stencil links after">
  <img src="icon-redesign-assets/after/brutalist-stencil/fallback.svg" alt="brutalist-stencil fallback after">
</div>


## Circuit Bend

<div class="set-head"><span class="set-swatch" style="background:#2fb37a"></span><strong>Circuit Bend</strong><span class="set-meta">Technical · accent <code>#2fb37a</code> · v1.1.1</span></div>

_PCB-green tiles with gold traces, solder pads, and a tiny red LED in the corner. Pairs with Circuit Garden._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/circuit-bend/dashboard.svg" alt="circuit-bend dashboard before">
  <img src="icon-redesign-assets/before/circuit-bend/posts.svg" alt="circuit-bend posts before">
  <img src="icon-redesign-assets/before/circuit-bend/pages.svg" alt="circuit-bend pages before">
  <img src="icon-redesign-assets/before/circuit-bend/media.svg" alt="circuit-bend media before">
  <img src="icon-redesign-assets/before/circuit-bend/comments.svg" alt="circuit-bend comments before">
  <img src="icon-redesign-assets/before/circuit-bend/appearance.svg" alt="circuit-bend appearance before">
  <img src="icon-redesign-assets/before/circuit-bend/plugins.svg" alt="circuit-bend plugins before">
  <img src="icon-redesign-assets/before/circuit-bend/users.svg" alt="circuit-bend users before">
  <img src="icon-redesign-assets/before/circuit-bend/tools.svg" alt="circuit-bend tools before">
  <img src="icon-redesign-assets/before/circuit-bend/settings.svg" alt="circuit-bend settings before">
  <img src="icon-redesign-assets/before/circuit-bend/profile.svg" alt="circuit-bend profile before">
  <img src="icon-redesign-assets/before/circuit-bend/links.svg" alt="circuit-bend links before">
  <img src="icon-redesign-assets/before/circuit-bend/fallback.svg" alt="circuit-bend fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/circuit-bend/dashboard.svg" alt="circuit-bend dashboard after">
  <img src="icon-redesign-assets/after/circuit-bend/posts.svg" alt="circuit-bend posts after">
  <img src="icon-redesign-assets/after/circuit-bend/pages.svg" alt="circuit-bend pages after">
  <img src="icon-redesign-assets/after/circuit-bend/media.svg" alt="circuit-bend media after">
  <img src="icon-redesign-assets/after/circuit-bend/comments.svg" alt="circuit-bend comments after">
  <img src="icon-redesign-assets/after/circuit-bend/appearance.svg" alt="circuit-bend appearance after">
  <img src="icon-redesign-assets/after/circuit-bend/plugins.svg" alt="circuit-bend plugins after">
  <img src="icon-redesign-assets/after/circuit-bend/users.svg" alt="circuit-bend users after">
  <img src="icon-redesign-assets/after/circuit-bend/tools.svg" alt="circuit-bend tools after">
  <img src="icon-redesign-assets/after/circuit-bend/settings.svg" alt="circuit-bend settings after">
  <img src="icon-redesign-assets/after/circuit-bend/profile.svg" alt="circuit-bend profile after">
  <img src="icon-redesign-assets/after/circuit-bend/links.svg" alt="circuit-bend links after">
  <img src="icon-redesign-assets/after/circuit-bend/fallback.svg" alt="circuit-bend fallback after">
</div>


## Claymation

<div class="set-head"><span class="set-swatch" style="background:#ffb84d"></span><strong>Claymation</strong><span class="set-meta">Handmade · accent <code>#ffb84d</code> · v1.1.1</span></div>

_Puffy stop-motion clay sculpts with soft speculars on warm primaries. Feels pressed by hand._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/claymation/dashboard.svg" alt="claymation dashboard before">
  <img src="icon-redesign-assets/before/claymation/posts.svg" alt="claymation posts before">
  <img src="icon-redesign-assets/before/claymation/pages.svg" alt="claymation pages before">
  <img src="icon-redesign-assets/before/claymation/media.svg" alt="claymation media before">
  <img src="icon-redesign-assets/before/claymation/comments.svg" alt="claymation comments before">
  <img src="icon-redesign-assets/before/claymation/appearance.svg" alt="claymation appearance before">
  <img src="icon-redesign-assets/before/claymation/plugins.svg" alt="claymation plugins before">
  <img src="icon-redesign-assets/before/claymation/users.svg" alt="claymation users before">
  <img src="icon-redesign-assets/before/claymation/tools.svg" alt="claymation tools before">
  <img src="icon-redesign-assets/before/claymation/settings.svg" alt="claymation settings before">
  <img src="icon-redesign-assets/before/claymation/profile.svg" alt="claymation profile before">
  <img src="icon-redesign-assets/before/claymation/links.svg" alt="claymation links before">
  <img src="icon-redesign-assets/before/claymation/fallback.svg" alt="claymation fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/claymation/dashboard.svg" alt="claymation dashboard after">
  <img src="icon-redesign-assets/after/claymation/posts.svg" alt="claymation posts after">
  <img src="icon-redesign-assets/after/claymation/pages.svg" alt="claymation pages after">
  <img src="icon-redesign-assets/after/claymation/media.svg" alt="claymation media after">
  <img src="icon-redesign-assets/after/claymation/comments.svg" alt="claymation comments after">
  <img src="icon-redesign-assets/after/claymation/appearance.svg" alt="claymation appearance after">
  <img src="icon-redesign-assets/after/claymation/plugins.svg" alt="claymation plugins after">
  <img src="icon-redesign-assets/after/claymation/users.svg" alt="claymation users after">
  <img src="icon-redesign-assets/after/claymation/tools.svg" alt="claymation tools after">
  <img src="icon-redesign-assets/after/claymation/settings.svg" alt="claymation settings after">
  <img src="icon-redesign-assets/after/claymation/profile.svg" alt="claymation profile after">
  <img src="icon-redesign-assets/after/claymation/links.svg" alt="claymation links after">
  <img src="icon-redesign-assets/after/claymation/fallback.svg" alt="claymation fallback after">
</div>


## Cross-Stitch

<div class="set-head"><span class="set-swatch" style="background:#e87ca7"></span><strong>Cross-Stitch</strong><span class="set-meta">Craft · accent <code>#e87ca7</code> · v1.1.1</span></div>

_Rose cross-stitch pixel art on linen, each glyph rendered in tiny x-shaped thread stamps._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/cross-stitch/dashboard.svg" alt="cross-stitch dashboard before">
  <img src="icon-redesign-assets/before/cross-stitch/posts.svg" alt="cross-stitch posts before">
  <img src="icon-redesign-assets/before/cross-stitch/pages.svg" alt="cross-stitch pages before">
  <img src="icon-redesign-assets/before/cross-stitch/media.svg" alt="cross-stitch media before">
  <img src="icon-redesign-assets/before/cross-stitch/comments.svg" alt="cross-stitch comments before">
  <img src="icon-redesign-assets/before/cross-stitch/appearance.svg" alt="cross-stitch appearance before">
  <img src="icon-redesign-assets/before/cross-stitch/plugins.svg" alt="cross-stitch plugins before">
  <img src="icon-redesign-assets/before/cross-stitch/users.svg" alt="cross-stitch users before">
  <img src="icon-redesign-assets/before/cross-stitch/tools.svg" alt="cross-stitch tools before">
  <img src="icon-redesign-assets/before/cross-stitch/settings.svg" alt="cross-stitch settings before">
  <img src="icon-redesign-assets/before/cross-stitch/profile.svg" alt="cross-stitch profile before">
  <img src="icon-redesign-assets/before/cross-stitch/links.svg" alt="cross-stitch links before">
  <img src="icon-redesign-assets/before/cross-stitch/fallback.svg" alt="cross-stitch fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/cross-stitch/dashboard.svg" alt="cross-stitch dashboard after">
  <img src="icon-redesign-assets/after/cross-stitch/posts.svg" alt="cross-stitch posts after">
  <img src="icon-redesign-assets/after/cross-stitch/pages.svg" alt="cross-stitch pages after">
  <img src="icon-redesign-assets/after/cross-stitch/media.svg" alt="cross-stitch media after">
  <img src="icon-redesign-assets/after/cross-stitch/comments.svg" alt="cross-stitch comments after">
  <img src="icon-redesign-assets/after/cross-stitch/appearance.svg" alt="cross-stitch appearance after">
  <img src="icon-redesign-assets/after/cross-stitch/plugins.svg" alt="cross-stitch plugins after">
  <img src="icon-redesign-assets/after/cross-stitch/users.svg" alt="cross-stitch users after">
  <img src="icon-redesign-assets/after/cross-stitch/tools.svg" alt="cross-stitch tools after">
  <img src="icon-redesign-assets/after/cross-stitch/settings.svg" alt="cross-stitch settings after">
  <img src="icon-redesign-assets/after/cross-stitch/profile.svg" alt="cross-stitch profile after">
  <img src="icon-redesign-assets/after/cross-stitch/links.svg" alt="cross-stitch links after">
  <img src="icon-redesign-assets/after/cross-stitch/fallback.svg" alt="cross-stitch fallback after">
</div>


## Eyeball Avenue

<div class="set-head"><span class="set-swatch" style="background:#b35cff"></span><strong>Eyeball Avenue</strong><span class="set-meta">ODD Original · accent <code>#b35cff</code> · v1.1.1</span></div>

_Full-color surreal eyeball tiles: glossy pupils, neon lids, little role props, and enough contrast to stare back from the desktop._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/eyeball-avenue/dashboard.svg" alt="eyeball-avenue dashboard before">
  <img src="icon-redesign-assets/before/eyeball-avenue/posts.svg" alt="eyeball-avenue posts before">
  <img src="icon-redesign-assets/before/eyeball-avenue/pages.svg" alt="eyeball-avenue pages before">
  <img src="icon-redesign-assets/before/eyeball-avenue/media.svg" alt="eyeball-avenue media before">
  <img src="icon-redesign-assets/before/eyeball-avenue/comments.svg" alt="eyeball-avenue comments before">
  <img src="icon-redesign-assets/before/eyeball-avenue/appearance.svg" alt="eyeball-avenue appearance before">
  <img src="icon-redesign-assets/before/eyeball-avenue/plugins.svg" alt="eyeball-avenue plugins before">
  <img src="icon-redesign-assets/before/eyeball-avenue/users.svg" alt="eyeball-avenue users before">
  <img src="icon-redesign-assets/before/eyeball-avenue/tools.svg" alt="eyeball-avenue tools before">
  <img src="icon-redesign-assets/before/eyeball-avenue/settings.svg" alt="eyeball-avenue settings before">
  <img src="icon-redesign-assets/before/eyeball-avenue/profile.svg" alt="eyeball-avenue profile before">
  <img src="icon-redesign-assets/before/eyeball-avenue/links.svg" alt="eyeball-avenue links before">
  <img src="icon-redesign-assets/before/eyeball-avenue/fallback.svg" alt="eyeball-avenue fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/eyeball-avenue/dashboard.svg" alt="eyeball-avenue dashboard after">
  <img src="icon-redesign-assets/after/eyeball-avenue/posts.svg" alt="eyeball-avenue posts after">
  <img src="icon-redesign-assets/after/eyeball-avenue/pages.svg" alt="eyeball-avenue pages after">
  <img src="icon-redesign-assets/after/eyeball-avenue/media.svg" alt="eyeball-avenue media after">
  <img src="icon-redesign-assets/after/eyeball-avenue/comments.svg" alt="eyeball-avenue comments after">
  <img src="icon-redesign-assets/after/eyeball-avenue/appearance.svg" alt="eyeball-avenue appearance after">
  <img src="icon-redesign-assets/after/eyeball-avenue/plugins.svg" alt="eyeball-avenue plugins after">
  <img src="icon-redesign-assets/after/eyeball-avenue/users.svg" alt="eyeball-avenue users after">
  <img src="icon-redesign-assets/after/eyeball-avenue/tools.svg" alt="eyeball-avenue tools after">
  <img src="icon-redesign-assets/after/eyeball-avenue/settings.svg" alt="eyeball-avenue settings after">
  <img src="icon-redesign-assets/after/eyeball-avenue/profile.svg" alt="eyeball-avenue profile after">
  <img src="icon-redesign-assets/after/eyeball-avenue/links.svg" alt="eyeball-avenue links after">
  <img src="icon-redesign-assets/after/eyeball-avenue/fallback.svg" alt="eyeball-avenue fallback after">
</div>


## Filament

<div class="set-head"><span class="set-swatch" style="background:#ffb000"></span><strong>Filament</strong><span class="set-meta">Lightbox · accent <code>#ffb000</code> · v1.1.1</span></div>

_Glowing full-color neon tubes over dark glass, with warm highlights and layered app symbols instead of hairline monochrome strokes._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/filament/dashboard.svg" alt="filament dashboard before">
  <img src="icon-redesign-assets/before/filament/posts.svg" alt="filament posts before">
  <img src="icon-redesign-assets/before/filament/pages.svg" alt="filament pages before">
  <img src="icon-redesign-assets/before/filament/media.svg" alt="filament media before">
  <img src="icon-redesign-assets/before/filament/comments.svg" alt="filament comments before">
  <img src="icon-redesign-assets/before/filament/appearance.svg" alt="filament appearance before">
  <img src="icon-redesign-assets/before/filament/plugins.svg" alt="filament plugins before">
  <img src="icon-redesign-assets/before/filament/users.svg" alt="filament users before">
  <img src="icon-redesign-assets/before/filament/tools.svg" alt="filament tools before">
  <img src="icon-redesign-assets/before/filament/settings.svg" alt="filament settings before">
  <img src="icon-redesign-assets/before/filament/profile.svg" alt="filament profile before">
  <img src="icon-redesign-assets/before/filament/links.svg" alt="filament links before">
  <img src="icon-redesign-assets/before/filament/fallback.svg" alt="filament fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/filament/dashboard.svg" alt="filament dashboard after">
  <img src="icon-redesign-assets/after/filament/posts.svg" alt="filament posts after">
  <img src="icon-redesign-assets/after/filament/pages.svg" alt="filament pages after">
  <img src="icon-redesign-assets/after/filament/media.svg" alt="filament media after">
  <img src="icon-redesign-assets/after/filament/comments.svg" alt="filament comments after">
  <img src="icon-redesign-assets/after/filament/appearance.svg" alt="filament appearance after">
  <img src="icon-redesign-assets/after/filament/plugins.svg" alt="filament plugins after">
  <img src="icon-redesign-assets/after/filament/users.svg" alt="filament users after">
  <img src="icon-redesign-assets/after/filament/tools.svg" alt="filament tools after">
  <img src="icon-redesign-assets/after/filament/settings.svg" alt="filament settings after">
  <img src="icon-redesign-assets/after/filament/profile.svg" alt="filament profile after">
  <img src="icon-redesign-assets/after/filament/links.svg" alt="filament links after">
  <img src="icon-redesign-assets/after/filament/fallback.svg" alt="filament fallback after">
</div>


## Fold

<div class="set-head"><span class="set-swatch" style="background:#7c5cff"></span><strong>Fold</strong><span class="set-meta">Paper Arcade · accent <code>#7c5cff</code> · v1.1.1</span></div>

_Origami-inspired full-color tiles with folded paper facets, inked role glyphs, and playful dimensional shadows._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/fold/dashboard.svg" alt="fold dashboard before">
  <img src="icon-redesign-assets/before/fold/posts.svg" alt="fold posts before">
  <img src="icon-redesign-assets/before/fold/pages.svg" alt="fold pages before">
  <img src="icon-redesign-assets/before/fold/media.svg" alt="fold media before">
  <img src="icon-redesign-assets/before/fold/comments.svg" alt="fold comments before">
  <img src="icon-redesign-assets/before/fold/appearance.svg" alt="fold appearance before">
  <img src="icon-redesign-assets/before/fold/plugins.svg" alt="fold plugins before">
  <img src="icon-redesign-assets/before/fold/users.svg" alt="fold users before">
  <img src="icon-redesign-assets/before/fold/tools.svg" alt="fold tools before">
  <img src="icon-redesign-assets/before/fold/settings.svg" alt="fold settings before">
  <img src="icon-redesign-assets/before/fold/profile.svg" alt="fold profile before">
  <img src="icon-redesign-assets/before/fold/links.svg" alt="fold links before">
  <img src="icon-redesign-assets/before/fold/fallback.svg" alt="fold fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/fold/dashboard.svg" alt="fold dashboard after">
  <img src="icon-redesign-assets/after/fold/posts.svg" alt="fold posts after">
  <img src="icon-redesign-assets/after/fold/pages.svg" alt="fold pages after">
  <img src="icon-redesign-assets/after/fold/media.svg" alt="fold media after">
  <img src="icon-redesign-assets/after/fold/comments.svg" alt="fold comments after">
  <img src="icon-redesign-assets/after/fold/appearance.svg" alt="fold appearance after">
  <img src="icon-redesign-assets/after/fold/plugins.svg" alt="fold plugins after">
  <img src="icon-redesign-assets/after/fold/users.svg" alt="fold users after">
  <img src="icon-redesign-assets/after/fold/tools.svg" alt="fold tools after">
  <img src="icon-redesign-assets/after/fold/settings.svg" alt="fold settings after">
  <img src="icon-redesign-assets/after/fold/profile.svg" alt="fold profile after">
  <img src="icon-redesign-assets/after/fold/links.svg" alt="fold links after">
  <img src="icon-redesign-assets/after/fold/fallback.svg" alt="fold fallback after">
</div>


## Hologram

<div class="set-head"><span class="set-swatch" style="background:#9fd0ff"></span><strong>Hologram</strong><span class="set-meta">Synthetic · accent <code>#9fd0ff</code> · v1.1.1</span></div>

_Iridescent foil-sticker glyphs with a pastel-rainbow gradient and a peel corner. Sparkly without being dark._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/hologram/dashboard.svg" alt="hologram dashboard before">
  <img src="icon-redesign-assets/before/hologram/posts.svg" alt="hologram posts before">
  <img src="icon-redesign-assets/before/hologram/pages.svg" alt="hologram pages before">
  <img src="icon-redesign-assets/before/hologram/media.svg" alt="hologram media before">
  <img src="icon-redesign-assets/before/hologram/comments.svg" alt="hologram comments before">
  <img src="icon-redesign-assets/before/hologram/appearance.svg" alt="hologram appearance before">
  <img src="icon-redesign-assets/before/hologram/plugins.svg" alt="hologram plugins before">
  <img src="icon-redesign-assets/before/hologram/users.svg" alt="hologram users before">
  <img src="icon-redesign-assets/before/hologram/tools.svg" alt="hologram tools before">
  <img src="icon-redesign-assets/before/hologram/settings.svg" alt="hologram settings before">
  <img src="icon-redesign-assets/before/hologram/profile.svg" alt="hologram profile before">
  <img src="icon-redesign-assets/before/hologram/links.svg" alt="hologram links before">
  <img src="icon-redesign-assets/before/hologram/fallback.svg" alt="hologram fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/hologram/dashboard.svg" alt="hologram dashboard after">
  <img src="icon-redesign-assets/after/hologram/posts.svg" alt="hologram posts after">
  <img src="icon-redesign-assets/after/hologram/pages.svg" alt="hologram pages after">
  <img src="icon-redesign-assets/after/hologram/media.svg" alt="hologram media after">
  <img src="icon-redesign-assets/after/hologram/comments.svg" alt="hologram comments after">
  <img src="icon-redesign-assets/after/hologram/appearance.svg" alt="hologram appearance after">
  <img src="icon-redesign-assets/after/hologram/plugins.svg" alt="hologram plugins after">
  <img src="icon-redesign-assets/after/hologram/users.svg" alt="hologram users after">
  <img src="icon-redesign-assets/after/hologram/tools.svg" alt="hologram tools after">
  <img src="icon-redesign-assets/after/hologram/settings.svg" alt="hologram settings after">
  <img src="icon-redesign-assets/after/hologram/profile.svg" alt="hologram profile after">
  <img src="icon-redesign-assets/after/hologram/links.svg" alt="hologram links after">
  <img src="icon-redesign-assets/after/hologram/fallback.svg" alt="hologram fallback after">
</div>


## Lemonade Stand

<div class="set-head"><span class="set-swatch" style="background:#ffd64b"></span><strong>Lemonade Stand</strong><span class="set-meta">Summer · accent <code>#ffd64b</code> · v1.1.1</span></div>

_Crayon-stroke glyphs on a sunny yellow gingham backplate. Kid-drawn, summer-bright._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/lemonade-stand/dashboard.svg" alt="lemonade-stand dashboard before">
  <img src="icon-redesign-assets/before/lemonade-stand/posts.svg" alt="lemonade-stand posts before">
  <img src="icon-redesign-assets/before/lemonade-stand/pages.svg" alt="lemonade-stand pages before">
  <img src="icon-redesign-assets/before/lemonade-stand/media.svg" alt="lemonade-stand media before">
  <img src="icon-redesign-assets/before/lemonade-stand/comments.svg" alt="lemonade-stand comments before">
  <img src="icon-redesign-assets/before/lemonade-stand/appearance.svg" alt="lemonade-stand appearance before">
  <img src="icon-redesign-assets/before/lemonade-stand/plugins.svg" alt="lemonade-stand plugins before">
  <img src="icon-redesign-assets/before/lemonade-stand/users.svg" alt="lemonade-stand users before">
  <img src="icon-redesign-assets/before/lemonade-stand/tools.svg" alt="lemonade-stand tools before">
  <img src="icon-redesign-assets/before/lemonade-stand/settings.svg" alt="lemonade-stand settings before">
  <img src="icon-redesign-assets/before/lemonade-stand/profile.svg" alt="lemonade-stand profile before">
  <img src="icon-redesign-assets/before/lemonade-stand/links.svg" alt="lemonade-stand links before">
  <img src="icon-redesign-assets/before/lemonade-stand/fallback.svg" alt="lemonade-stand fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/lemonade-stand/dashboard.svg" alt="lemonade-stand dashboard after">
  <img src="icon-redesign-assets/after/lemonade-stand/posts.svg" alt="lemonade-stand posts after">
  <img src="icon-redesign-assets/after/lemonade-stand/pages.svg" alt="lemonade-stand pages after">
  <img src="icon-redesign-assets/after/lemonade-stand/media.svg" alt="lemonade-stand media after">
  <img src="icon-redesign-assets/after/lemonade-stand/comments.svg" alt="lemonade-stand comments after">
  <img src="icon-redesign-assets/after/lemonade-stand/appearance.svg" alt="lemonade-stand appearance after">
  <img src="icon-redesign-assets/after/lemonade-stand/plugins.svg" alt="lemonade-stand plugins after">
  <img src="icon-redesign-assets/after/lemonade-stand/users.svg" alt="lemonade-stand users after">
  <img src="icon-redesign-assets/after/lemonade-stand/tools.svg" alt="lemonade-stand tools after">
  <img src="icon-redesign-assets/after/lemonade-stand/settings.svg" alt="lemonade-stand settings after">
  <img src="icon-redesign-assets/after/lemonade-stand/profile.svg" alt="lemonade-stand profile after">
  <img src="icon-redesign-assets/after/lemonade-stand/links.svg" alt="lemonade-stand links after">
  <img src="icon-redesign-assets/after/lemonade-stand/fallback.svg" alt="lemonade-stand fallback after">
</div>


## Monoline

<div class="set-head"><span class="set-swatch" style="background:#00c2ff"></span><strong>Monoline</strong><span class="set-meta">Pop UI · accent <code>#00c2ff</code> · v1.1.1</span></div>

_No longer monochrome: glossy full-color UI stickers with thick glyphs, candy gradients, and readable dark backing plates._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/monoline/dashboard.svg" alt="monoline dashboard before">
  <img src="icon-redesign-assets/before/monoline/posts.svg" alt="monoline posts before">
  <img src="icon-redesign-assets/before/monoline/pages.svg" alt="monoline pages before">
  <img src="icon-redesign-assets/before/monoline/media.svg" alt="monoline media before">
  <img src="icon-redesign-assets/before/monoline/comments.svg" alt="monoline comments before">
  <img src="icon-redesign-assets/before/monoline/appearance.svg" alt="monoline appearance before">
  <img src="icon-redesign-assets/before/monoline/plugins.svg" alt="monoline plugins before">
  <img src="icon-redesign-assets/before/monoline/users.svg" alt="monoline users before">
  <img src="icon-redesign-assets/before/monoline/tools.svg" alt="monoline tools before">
  <img src="icon-redesign-assets/before/monoline/settings.svg" alt="monoline settings before">
  <img src="icon-redesign-assets/before/monoline/profile.svg" alt="monoline profile before">
  <img src="icon-redesign-assets/before/monoline/links.svg" alt="monoline links before">
  <img src="icon-redesign-assets/before/monoline/fallback.svg" alt="monoline fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/monoline/dashboard.svg" alt="monoline dashboard after">
  <img src="icon-redesign-assets/after/monoline/posts.svg" alt="monoline posts after">
  <img src="icon-redesign-assets/after/monoline/pages.svg" alt="monoline pages after">
  <img src="icon-redesign-assets/after/monoline/media.svg" alt="monoline media after">
  <img src="icon-redesign-assets/after/monoline/comments.svg" alt="monoline comments after">
  <img src="icon-redesign-assets/after/monoline/appearance.svg" alt="monoline appearance after">
  <img src="icon-redesign-assets/after/monoline/plugins.svg" alt="monoline plugins after">
  <img src="icon-redesign-assets/after/monoline/users.svg" alt="monoline users after">
  <img src="icon-redesign-assets/after/monoline/tools.svg" alt="monoline tools after">
  <img src="icon-redesign-assets/after/monoline/settings.svg" alt="monoline settings after">
  <img src="icon-redesign-assets/after/monoline/profile.svg" alt="monoline profile after">
  <img src="icon-redesign-assets/after/monoline/links.svg" alt="monoline links after">
  <img src="icon-redesign-assets/after/monoline/fallback.svg" alt="monoline fallback after">
</div>


## Risograph

<div class="set-head"><span class="set-swatch" style="background:#ff4fa8"></span><strong>Risograph</strong><span class="set-meta">Print · accent <code>#ff4fa8</code> · v1.1.1</span></div>

_Two-color riso print look — fluorescent pink and cyan off-register on dust-grit paper. Loud and cheerful._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/risograph/dashboard.svg" alt="risograph dashboard before">
  <img src="icon-redesign-assets/before/risograph/posts.svg" alt="risograph posts before">
  <img src="icon-redesign-assets/before/risograph/pages.svg" alt="risograph pages before">
  <img src="icon-redesign-assets/before/risograph/media.svg" alt="risograph media before">
  <img src="icon-redesign-assets/before/risograph/comments.svg" alt="risograph comments before">
  <img src="icon-redesign-assets/before/risograph/appearance.svg" alt="risograph appearance before">
  <img src="icon-redesign-assets/before/risograph/plugins.svg" alt="risograph plugins before">
  <img src="icon-redesign-assets/before/risograph/users.svg" alt="risograph users before">
  <img src="icon-redesign-assets/before/risograph/tools.svg" alt="risograph tools before">
  <img src="icon-redesign-assets/before/risograph/settings.svg" alt="risograph settings before">
  <img src="icon-redesign-assets/before/risograph/profile.svg" alt="risograph profile before">
  <img src="icon-redesign-assets/before/risograph/links.svg" alt="risograph links before">
  <img src="icon-redesign-assets/before/risograph/fallback.svg" alt="risograph fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/risograph/dashboard.svg" alt="risograph dashboard after">
  <img src="icon-redesign-assets/after/risograph/posts.svg" alt="risograph posts after">
  <img src="icon-redesign-assets/after/risograph/pages.svg" alt="risograph pages after">
  <img src="icon-redesign-assets/after/risograph/media.svg" alt="risograph media after">
  <img src="icon-redesign-assets/after/risograph/comments.svg" alt="risograph comments after">
  <img src="icon-redesign-assets/after/risograph/appearance.svg" alt="risograph appearance after">
  <img src="icon-redesign-assets/after/risograph/plugins.svg" alt="risograph plugins after">
  <img src="icon-redesign-assets/after/risograph/users.svg" alt="risograph users after">
  <img src="icon-redesign-assets/after/risograph/tools.svg" alt="risograph tools after">
  <img src="icon-redesign-assets/after/risograph/settings.svg" alt="risograph settings after">
  <img src="icon-redesign-assets/after/risograph/profile.svg" alt="risograph profile after">
  <img src="icon-redesign-assets/after/risograph/links.svg" alt="risograph links after">
  <img src="icon-redesign-assets/after/risograph/fallback.svg" alt="risograph fallback after">
</div>


## Stadium

<div class="set-head"><span class="set-swatch" style="background:#d73a3a"></span><strong>Stadium</strong><span class="set-meta">Sport · accent <code>#d73a3a</code> · v1.1.1</span></div>

_Chenille varsity-patch icons on crimson backing with dashed stitched outlines and a pennant corner._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/stadium/dashboard.svg" alt="stadium dashboard before">
  <img src="icon-redesign-assets/before/stadium/posts.svg" alt="stadium posts before">
  <img src="icon-redesign-assets/before/stadium/pages.svg" alt="stadium pages before">
  <img src="icon-redesign-assets/before/stadium/media.svg" alt="stadium media before">
  <img src="icon-redesign-assets/before/stadium/comments.svg" alt="stadium comments before">
  <img src="icon-redesign-assets/before/stadium/appearance.svg" alt="stadium appearance before">
  <img src="icon-redesign-assets/before/stadium/plugins.svg" alt="stadium plugins before">
  <img src="icon-redesign-assets/before/stadium/users.svg" alt="stadium users before">
  <img src="icon-redesign-assets/before/stadium/tools.svg" alt="stadium tools before">
  <img src="icon-redesign-assets/before/stadium/settings.svg" alt="stadium settings before">
  <img src="icon-redesign-assets/before/stadium/profile.svg" alt="stadium profile before">
  <img src="icon-redesign-assets/before/stadium/links.svg" alt="stadium links before">
  <img src="icon-redesign-assets/before/stadium/fallback.svg" alt="stadium fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/stadium/dashboard.svg" alt="stadium dashboard after">
  <img src="icon-redesign-assets/after/stadium/posts.svg" alt="stadium posts after">
  <img src="icon-redesign-assets/after/stadium/pages.svg" alt="stadium pages after">
  <img src="icon-redesign-assets/after/stadium/media.svg" alt="stadium media after">
  <img src="icon-redesign-assets/after/stadium/comments.svg" alt="stadium comments after">
  <img src="icon-redesign-assets/after/stadium/appearance.svg" alt="stadium appearance after">
  <img src="icon-redesign-assets/after/stadium/plugins.svg" alt="stadium plugins after">
  <img src="icon-redesign-assets/after/stadium/users.svg" alt="stadium users after">
  <img src="icon-redesign-assets/after/stadium/tools.svg" alt="stadium tools after">
  <img src="icon-redesign-assets/after/stadium/settings.svg" alt="stadium settings after">
  <img src="icon-redesign-assets/after/stadium/profile.svg" alt="stadium profile after">
  <img src="icon-redesign-assets/after/stadium/links.svg" alt="stadium links after">
  <img src="icon-redesign-assets/after/stadium/fallback.svg" alt="stadium fallback after">
</div>


## Tiki

<div class="set-head"><span class="set-swatch" style="background:#c47a3c"></span><strong>Tiki</strong><span class="set-meta">Lounge · accent <code>#c47a3c</code> · v1.1.1</span></div>

_Mid-century tiki lounge — warm wood-grain backplate with a rattan weave frame and cocoa-engraved glyphs._

**Before (v1.1.0, same-glyph iOS pass)**

<div class="icon-grid">
  <img src="icon-redesign-assets/before/tiki/dashboard.svg" alt="tiki dashboard before">
  <img src="icon-redesign-assets/before/tiki/posts.svg" alt="tiki posts before">
  <img src="icon-redesign-assets/before/tiki/pages.svg" alt="tiki pages before">
  <img src="icon-redesign-assets/before/tiki/media.svg" alt="tiki media before">
  <img src="icon-redesign-assets/before/tiki/comments.svg" alt="tiki comments before">
  <img src="icon-redesign-assets/before/tiki/appearance.svg" alt="tiki appearance before">
  <img src="icon-redesign-assets/before/tiki/plugins.svg" alt="tiki plugins before">
  <img src="icon-redesign-assets/before/tiki/users.svg" alt="tiki users before">
  <img src="icon-redesign-assets/before/tiki/tools.svg" alt="tiki tools before">
  <img src="icon-redesign-assets/before/tiki/settings.svg" alt="tiki settings before">
  <img src="icon-redesign-assets/before/tiki/profile.svg" alt="tiki profile before">
  <img src="icon-redesign-assets/before/tiki/links.svg" alt="tiki links before">
  <img src="icon-redesign-assets/before/tiki/fallback.svg" alt="tiki fallback before">
</div>

**After (v1.1.1, distinct set-specific style)**

<div class="icon-grid">
  <img src="icon-redesign-assets/after/tiki/dashboard.svg" alt="tiki dashboard after">
  <img src="icon-redesign-assets/after/tiki/posts.svg" alt="tiki posts after">
  <img src="icon-redesign-assets/after/tiki/pages.svg" alt="tiki pages after">
  <img src="icon-redesign-assets/after/tiki/media.svg" alt="tiki media after">
  <img src="icon-redesign-assets/after/tiki/comments.svg" alt="tiki comments after">
  <img src="icon-redesign-assets/after/tiki/appearance.svg" alt="tiki appearance after">
  <img src="icon-redesign-assets/after/tiki/plugins.svg" alt="tiki plugins after">
  <img src="icon-redesign-assets/after/tiki/users.svg" alt="tiki users after">
  <img src="icon-redesign-assets/after/tiki/tools.svg" alt="tiki tools after">
  <img src="icon-redesign-assets/after/tiki/settings.svg" alt="tiki settings after">
  <img src="icon-redesign-assets/after/tiki/profile.svg" alt="tiki profile after">
  <img src="icon-redesign-assets/after/tiki/links.svg" alt="tiki links after">
  <img src="icon-redesign-assets/after/tiki/fallback.svg" alt="tiki fallback after">
</div>

