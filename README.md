# dashdash

[![CI](https://github.com/theswoosh/dashdash/actions/workflows/ci.yml/badge.svg)](https://github.com/theswoosh/dashdash/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/theswoosh/dashdash)](https://github.com/theswoosh/dashdash/releases)
[![License](https://img.shields.io/github/license/theswoosh/dashdash)](LICENSE)

> A self-hosted dashboard for homelabs. Your services, one board.

Full documentation: https://theswoosh.github.io/dashdash/

Configuration is plain YAML you can edit by hand, and a drag-and-drop UI that stays in sync with it — change either one and the other follows. Multiple users are supported, with local accounts or SSO via any OIDC provider.

## Screenshots

| Board (Liquid Glass theme) | Edit mode | Widget config |
|---|---|---|
| ![Board](.github/assets/board-liquid-glass.png) | ![Edit mode](.github/assets/edit-mode.png) | ![Widget config](.github/assets/widget-config-modal.png) |

## Features

- **Drag-and-drop grid** — arrange and resize widgets however you like; each user keeps their own layout
- **Live YAML config** — edit `services.yml` and the board updates instantly, no restart
- **Healthchecks that explain themselves** — a red tile tells you why a service is down (timeout, DNS, connection refused, ...), not just that it is
- **Themes** — Liquid Glass, Classic, and ASCII out of the box; ship your own with a single CSS file
- **Chat widget** — a built-in chat for the household, with channels, markdown, and its own skins
- **Notepad** — quick notes per board, markdown optional
- **Stats widget** — CPU, RAM, disk, and temperature with configurable warning thresholds
- **Service icons** — recognise every app at a glance from a built-in icon library
- **Frames** — group related services together on the grid
- **Multiple boards** — organise widgets across several boards and switch between them
- **Multi-user with SSO** — local accounts, or single sign-on via any OIDC provider (Authentik, Keycloak, ...)
- **Update indicator** — lights up in the UI when a new release is available
- **Credentials never reach the browser** — API keys stay server-side; the frontend never sees them

## Installation

```yaml
services:
  dashdash:
    image: ghcr.io/theswoosh/dashdash:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config:/config
      - ./data:/data
    restart: unless-stopped
```

```bash
# Copy example configs, then start
cp config/settings.yml.example config/settings.yml
cp config/services.yml.example config/services.yml
docker compose up -d
```

Open `http://localhost:3000` and register — the first account created becomes the admin.

All configuration lives in the `/config` volume (annotated examples in `config/*.yml.example`): `settings.yml` (theme, background, grid defaults, mail, auth), `services.yml` (widget instances), `integrations.yml` (named API sources). API credentials go in environment variables, never in config files — `BOARD_INTEGRATION_<ID_UPPERCASE>_KEY=your-api-key`, see `.env.example`.

LAN healthchecks work out of the box; set `allowPrivateNetworks: false` in `settings.yml` to re-enable the strict SSRF guard on internet-exposed deployments — see the [docs](https://theswoosh.github.io/dashdash/).

For SSO, set three environment variables and a "Sign in with SSO" button appears automatically — `BOARD_OIDC_ISSUER`, `BOARD_OIDC_CLIENT_ID`, `BOARD_OIDC_SECRET`. Group mapping, auto-linking, and logout behaviour: see the [docs](https://theswoosh.github.io/dashdash/).

<details>
<summary>Tech stack</summary>

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite 8, SWR, Zustand |
| Grid | react-grid-layout |
| Backend | Node.js 22, Fastify |
| Database | SQLite (better-sqlite3) |
| Config | YAML + Zod 4, live reload via chokidar |
| Auth | Local + OIDC Authorization Code + PKCE (openid-client) |
| Packaging | pnpm workspaces, Docker multi-stage build |

</details>

## Development

Requires Node.js 22 and pnpm.

```bash
pnpm install
pnpm dev
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000`

## Support

If you find dashdash useful, consider buying me a coffee.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/welikecoffee)
