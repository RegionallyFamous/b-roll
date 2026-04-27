# ADR 0001: Server-canonical icon live-swap

- **Status:** Accepted
- **Date:** 2025
- **Context:** When a user picks a new icon set in the ODD panel, the dock icons + desktop shortcuts have to re-render. The first attempt did this purely client-side: patch the live DOM, swap `<img src>` attributes, restyle. This was flaky because `data-menu-slug` on the dock DOM is the sanitized CSS id (`menu-posts`), not the raw WordPress menu slug (`edit.php`), and several sets of edge cases kept leaking through (pages added by plugins, items the user had re-ordered, etc.).
- **Decision:** Icons are re-skinned on the server via the `desktop_mode_dock_item` and `desktop_mode_icons` filters at priority 20. When the user picks a new set, we save the preference and soft-reload the page. The dock filter runs on the next render, and the resulting DOM is canonical.
- **Consequences:** One round-trip per icon-set change, but zero state drift. DOM surgery code is deleted, not maintained. Client-side "preview" of a set is handled through the preview-and-confirm bar, which keeps both sides explicit.
- **Alternatives considered:**
  - *Pure client-side surgery.* Rejected: see context. Every mismatch means someone files a bug that only reproduces in their menu layout.
  - *Build a client mapping of `menu-X` → `menu slug`.* Rejected: requires a round-trip to populate, and the mapping is already computed server-side — might as well render there.
  - *Use `wp.data` stores to drive the dock.* Rejected: WP Desktop Mode doesn't expose a store for the dock items; bolting one on is a much larger scope change than one soft reload.
