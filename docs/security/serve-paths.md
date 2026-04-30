# Serve paths — security audit

> Scope: every code path that returns file bytes from `wp-content/odd-*/`
> on an authenticated or public request. Last reviewed after the
> reliability/security hardening pass (v3.6.7).

The universal `.wp` installer populates five per-type subtrees under
`wp-content/`:

| Subtree                          | Source              | Contents                       |
|----------------------------------|---------------------|--------------------------------|
| `wp-content/odd-apps/<slug>/`    | v0.16.0 (pre-`.wp`) | HTML/JS/CSS bundle + manifest  |
| `wp-content/odd-icon-sets/<slug>/` | v1.8.0            | SVG icons + `manifest.json`    |
| `wp-content/odd-cursor-sets/<slug>/` | v3.6.0          | SVG cursors + `manifest.json`  |
| `wp-content/odd-scenes/<slug>/`  | v1.8.0              | JS scene + preview + wallpaper |
| `wp-content/odd-widgets/<slug>/` | v1.8.0              | JS/CSS widget + `manifest.json`|

Under v3.x every bundle that lands in these subtrees is either (a)
uploaded by a logged-in admin through `POST /odd/v1/bundles/upload`
or (b) downloaded from the remote catalog at
`https://odd.regionallyfamous.com/catalog/v1/` and verified against
the registry's declared SHA256 before extraction. The downloaded archive
manifest must also match the catalog row's `slug` and `type`. A mismatch
aborts the install — the archive is never written to the final content
directory.

Only `odd-apps/` has a bespoke serve endpoint (`serve-cookieauth.php`).
The other four are served through standard WordPress infrastructure —
`content_url()` emits public URLs, the underlying HTTP server hands
bytes back directly, and no ODD code ever opens those files in response
to a per-request user input.

## Audit results

### `odd-apps/` — custom serve path

**File:** [`odd/includes/apps/serve-cookieauth.php`](../../odd/includes/apps/serve-cookieauth.php)

- [x] **Auth.** `wp_validate_auth_cookie` re-verifies the HMAC; no
      bare-cookie trust. `wp_set_current_user` + `current_user_can(
      normalized app capability )` enforces per-app capability, which
      defaults to `manage_options` and cannot be lowered by a bundle
      manifest unless the site opts in with filters.
- [x] **Path traversal.** The path component is regex-constrained to
      `[a-zA-Z0-9._/-]+`, `..` is rejected explicitly, leading `/` is
      rejected, null bytes are rejected. `realpath()` then anchors the
      resolved path under the app's own directory with a
      `strpos($full, $real_base) === 0` prefix check.
- [x] **Scope.** `odd_apps_dir_for( $slug )` points exclusively into
      `wp-content/odd-apps/`, so even a hypothetical slug-level escape
      cannot reach `odd-icon-sets/`, `odd-scenes/`, or `odd-widgets/`.
- [x] **Content-type confusion.** `odd_apps_mime_for()` picks MIME
      from extension; `X-Content-Type-Options: nosniff` is set. The
      forbidden-extension blocklist
      (`odd_apps_forbidden_extensions()`) rejects `php`, `phtml`,
      `phar`, `htaccess`, etc.
- [x] **Debug envelope leak.** `odd_apps_serve_cookieauth()` takes an
      explicit `null` default so stray callers can't accidentally
      trigger JSON output; it also re-checks `$_GET['odd_debug']
      === '1'` and `manage_options` before emitting.
- [x] **CSP.** HTML responses include a compatibility-safe CSP with
      `object-src 'none'`, same-origin framing, and explicit allowances
      for the static app patterns ODD supports.

### `odd-icon-sets/` and `odd-cursor-sets/` — static visual assets

**Files:**
[`odd/includes/content/iconsets.php`](../../odd/includes/content/iconsets.php),
[`odd/includes/content/cursor-sets.php`](../../odd/includes/content/cursor-sets.php),
[`odd/includes/icons/registry.php`](../../odd/includes/icons/registry.php),
`GET /odd/v1/icons/{set}/{key}` (tinted SVG), and the cursor CSS endpoint.

- [x] **Static URL = `content_url( 'odd-icon-sets/<slug>/<file>' )`.**
      No PHP handler; the web server serves SVGs directly. The universal
      archive validator rejects server-executable files and path traversal
      before extraction.
- [x] **Tinted-SVG REST route.** Slug + key are `sanitize_key`'d;
      lookups hit a whitelisted icon-set registry; no user path is
      joined into a filesystem path.
- [x] **Passive SVG validation.** Installed icon and cursor SVGs are
      parsed and rejected if they contain scriptable elements,
      `foreignObject`, embedded images, event handlers, external
      references, or scriptable URL values.
- [x] **No cross-subtree reads.** The registry only walks
      `wp-content/odd-icon-sets/<slug>/<file>`; `realpath()` confines
      the read.

### `odd-scenes/` — enqueue-only

**File:** [`odd/includes/content/scenes.php`](../../odd/includes/content/scenes.php)

- [x] **No serve path.** Scenes are registered via `wp_enqueue_script`
      pointing at `content_url('odd-scenes/<slug>/<entry>')`. The web
      server returns the JS; no PHP handler takes a per-request slug.
- [x] **Install-time scrubbing.** The archive installer validates
      `manifest.entry`, rejects symlinks, and rejects any file
      extension outside the scene allowlist
      (`js / css / webp / jpg / png / svg / json / md`).
- [x] **Runtime registration.** Scene JS registers onto
      `window.__odd.scenes` in an IIFE. No server-rendered markup.

### `odd-widgets/` — enqueue-only

**File:** [`odd/includes/content/widgets.php`](../../odd/includes/content/widgets.php)

- [x] **No serve path.** Same shape as scenes — `wp_enqueue_script`
      targets `content_url('odd-widgets/<slug>/<entry>')`, no PHP
      handler reads from the subtree.
- [x] **Admin-trust model.** Widget JS can't be installed without
      `manage_options` + the one-time "trust this JS" confirmation
      (`confirmJavaScriptInline()` in the Shop panel).
- [x] **Slug uniqueness.** Enforced globally across all content
      subtrees at install time, so a widget can't shadow an app slug
      (which could otherwise be routed via the cookie-auth endpoint).

## Conclusion

The universal `.wp` refactor and cursor-set work did **not** expand the
app serve attack surface. Icon sets, cursor sets, scenes, and widgets
are served by `content_url()` + the HTTP server and carry no custom PHP
handler that joins a slug into a filesystem path. Apps are the only
subtree with a bespoke serve endpoint, and that endpoint is scoped to
`odd-apps/` via `odd_apps_dir_for()` + `realpath()`.

## Follow-ups

- [x] Unit-test passive SVG validation against deliberately hostile SVG
      payloads.
- [x] Document that apps are trusted first-party code after install; the
      iframe sandbox and CSP are defense in depth, not hostile-code
      isolation.
