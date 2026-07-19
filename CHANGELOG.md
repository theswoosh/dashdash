# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning
follows [ZeroVer](https://0ver.org): major stays `0` indefinitely, minor bumps
for feature releases, patch bumps for fixes.

## [0.0.3] — 2026-07-19

**Breaking:** all `DASHDASH_*` environment variables are renamed to `BOARD_*`
(e.g. `DASHDASH_OIDC_ISSUER` → `BOARD_OIDC_ISSUER`). Update your compose/env
files before upgrading.

**Behavior change:** healthcheck `allowPrivateNetworks` now defaults to
`true` — dashboards probe LAN/private addresses out of the box. Set it to
`false` explicitly if you want the old SSRF-conservative default.

### Chat widget
- New chat widget: channels with tabs, message bubbles, endless scroll,
  search, and an inline emoji panel; WhatsApp-style and IRC/terminal skins
  besides the default look.
- Live message/channel/unread updates over websocket push, with polling as
  fallback only; unread dot on inactive tabs.
- Per-channel membership ACL (a channel is open until the first member is
  added), admin-managed member picker.
- Per-sender bubble colors with a profile picker (hash-based fallback), and
  an opt-in markdown subset (bold/italic/strike/code) per channel.
- Server-side retention purge; messages cannot be deleted from the UI.

### Themes, colors & wallpapers
- Built-in per-theme background wallpapers (webp), seeded on first run and
  selectable in a new picker section alongside uploads.
- Semantic theme-color tokens (`Accent`, `Muted`, `Surface`, …) usable as
  widget colors, resolving per theme; a contrast guard hides unreadable
  free-hex overrides under themes they weren't picked in.
- Trademark-free theme copy; the Classic theme is now displayed as
  **Color**, and per-widget background overrides render only under it.
- Login pages, modals, popups, pickers, admin panel, and the config
  side-panel moved onto a dedicated chrome variable set, decoupled from the
  board theme.

### Grid & widgets
- Uniform grid scaling: fixed logical columns with viewport-scaled cell
  size — narrow windows no longer overlap widgets.
- Frame children can be dragged out to the root grid or into another frame,
  with a live drag ghost; frame shrinking can't clip children anymore.
- Edit-controls pill anchors inside the card (bottom-left), so neighbors and
  the resize handle can't cover it; headers hide immediately in edit mode.
- Collapsible sidebar in edit mode; long widget titles wrap to two lines.

### Healthcheck
- Non-blocking stale-while-revalidate polling with a pending state — tiles
  render instantly.
- Machine-readable reason codes on down results (blocked-private, DNS
  failure, timeout, refused, …) surfaced on tile, dot, and config modal.
- Configurable font size, uniform icon scaling, icon hover spring effect,
  description tooltips.

### Stats & notepad
- System stats: disk usage % and best-effort Linux CPU temperature, each
  toggleable, with a disk threshold bar.
- Notepad: opt-in markdown rendering.

### Auth
- OIDC verified end-to-end against a real Keycloak IdP; fixed: plain-http
  issuers (explicit `BOARD_OIDC_ALLOW_HTTP` opt-in), a clear error when
  auto-link is off and the email already exists, and complete RP-initiated
  logout with `id_token_hint` and post-logout redirect.

### Config & i18n
- Locale files now refresh on startup: keys you never edited pick up new
  shipped text after an upgrade, while your edits and additions are
  preserved (previously locale files were frozen at first boot).
- Widget color pickers seed from the active theme instead of hardcoded
  defaults.

### Platform
- Version update indicator in the info popup with a link to the release
  page.
- Unmatched `/api/*` routes return JSON 404 instead of the SPA shell.
- Docker image publish is gated on the CI quality gates; end-user
  documentation site published via GitHub Pages; README rework.

## [0.0.2] — 2026-07-13

### Widgets
- Per-widget font color; combined color clipboard (background + font);
  narrow-widget edit flyout.
- Bookmarks: https fallback, list layout option, per-bookmark colors.
- Icon picker: full Simple Icons library (lazy-loaded) and colorful
  dashboard-icons via CDN.
- Healthcheck: frame-nested widgets receive batch results; show-name
  option; linked names; name scales with card size.
- First iteration of the chat widget (channels + append-only messages,
  REST API, retention purge).

### Fixes
- Frame background/font colors no longer cascade into child widgets.
- Board icon free-text input: 20-char cap and sanitization.

## [0.0.1] — first release

First official release of dashdash — a self-hosted, YAML-first personal
dashboard for homelabs.

### Grid / canvas
- Fixed fine grid (14px pitch), fill-to-width, drag-and-drop layout with
  per-user persistence.
- Overlap protection: dragging/resizing onto an occupied cell shows a red
  "invalid" ghost and reverts, including across consecutive invalid drags.
- Tiny-layout widgets keep a correct drag/collision footprint independent of
  their stored (full-size) height.
- Frame widgets group child services in an inner grid, with drag-reparenting
  and overlap-aware placement.

### Widgets
- Clock, healthcheck, system stats, bookmarks, search, notepad, iframe, and
  frame widgets.
- Healthcheck: ICMP or TCP checks with an honest "unknown" state for
  unconfigured/unresolvable targets (no false positives); optional
  `allowPrivateNetworks` for LAN targets; per-service app icon picker.
- Clock: searchable timezone combobox, optional "Show timezone" label with a
  DST-aware GMT offset.
- System Stats: template-level colour thresholds (CPU/RAM warn & critical),
  per-widget metric visibility toggles.
- Per-widget background colour + opacity, with a session-only copy/paste
  "clipboard" to reuse colour settings across widgets.
- Sidebar per-type default-config popup (default size, colour, and — for
  Stats — thresholds) for widgets dropped from the sidebar.
- Curated first-run starter board instead of arbitrary seed data.

### Auth
- Local email/password accounts and OIDC single sign-on (Authorization Code +
  PKCE) side by side; RP-initiated logout.
- Admin panel: user management, search-engine configuration, and live config
  validation.

### Theming
- Liquid Glass, Classic, and ASCII themes; add a custom theme with a single
  CSS file.
- Opaque, readable modal/popup surfaces on Liquid Glass; edit-mode-only grid
  dots; centered config popups.

### i18n
- English and German translations across the app, with sync tests enforcing
  new strings land in both languages.

### Other
- Multiple boards per user.
- Server-side API proxy — credentials and third-party calls never reach the
  browser.
- App version shown in the admin info popup.

[0.0.1]: https://github.com/theswoosh/dashdash/releases/tag/v0.0.1
