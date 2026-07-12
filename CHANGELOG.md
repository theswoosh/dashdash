# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning
follows [ZeroVer](https://0ver.org): major stays `0` indefinitely, minor bumps
for feature releases, patch bumps for fixes.

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
