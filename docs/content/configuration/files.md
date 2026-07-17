---
title: Config Files
weight: 10
---

Everything about your dashdash install lives in the `config/` volume as
plain YAML — diffable, versionable, hand-editable. On first start the
container seeds missing files from annotated examples, so there's always a
working baseline to edit from.

## settings.yml

System-wide settings: board title, background/wallpaper, the grid's cell
size, whether local login is enabled, the list of search engines available
across the dashboard, and whether healthchecks are allowed to probe private
network addresses (`allowPrivateNetworks`, on by default for homelab use).

```yaml
title: "Home"
theme: liquid-glass
allowPrivateNetworks: true
searchEngines:
  - id: duckduckgo
    label: DuckDuckGo
    url: https://duckduckgo.com/?q={query}
```

### Themes only style the board

The four built-in themes (`liquid-glass`, `classic`, `ascii`, `atom`) style
the **board** — widget cards, the topbar, the background canvas. Functional
"chrome" surfaces (login/reset-password, the config side-panel, the admin
panel, and every modal/popup/picker) use dashdash's own built-in styling
instead of the board theme, and only pick up two things from it: the accent
color and the corner radius.

> **Changed 2026-07-17:** before this date, some of those chrome surfaces
> partly inherited board-theme colors and radii (this is what caused the
> ASCII-theme modal legibility issues some users hit). That inheritance is
> gone now except for the accent-color/corner-radius pair above — if you
> were relying on a theme choice to change modal or admin-panel appearance
> beyond that, it no longer does.

## services.yml

Every widget on a board — its type, position and size on the grid, and its
own options. You can hand-edit this file directly, or manage everything
from the board's edit mode; both stay in sync with each other.

```yaml
- title: Clock
  widget: clock
  layout: { w: 14, h: 9, x: 0, y: 0 }
  options:
    format: 24h
```

## integrations.yml

Named references to other services you want to pull data from — a base
URL and a type per entry. Credentials are never written to this file; see
below.

```yaml
- id: pihole-main
  type: pihole
  url: http://pihole
```

## Credentials go in environment variables

API keys and secrets are never stored in YAML. Instead, each integration's
credential is set as an environment variable named after its ID:

```env
BOARD_INTEGRATION_PIHOLE_MAIN_KEY=your-api-key
```

This keeps secrets out of files you might back up, share, or commit to
version control alongside your config.

## Live reload

Editing `services.yml` (or the board layout through the UI) takes effect
immediately — no restart needed, and every connected browser picks up the
change right away.

Settings related to authentication and outgoing mail (`settings.yml`'s
`smtp:` section, and SSO environment variables) are read once at startup
only. Changing those requires restarting dashdash.
