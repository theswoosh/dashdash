# dashdash

> A self-hosted personal dashboard. YAML-first, drag-and-drop, multi-user — designed for homelabs.

---

## Screenshots

<!-- TODO: add screenshots -->
*Screenshots coming soon.*

---

## Features

- **Drag-and-drop grid** — resize and reorder widgets freely, layout is saved per user
- **YAML-first config** — edit `services.yml` and changes appear instantly, no restart needed
- **Multiple themes** — Liquid Glass (default), Classic, ASCII; themes are pure CSS, fully extensible
- **Healthcheck widgets** — ping or TCP-check any host, status dot in the header bar or icon glow
- **Service icons** — 60+ curated Simple Icons with fuzzy search; set per widget
- **Server-side API proxy** — credentials stay on the server, never reach the browser
- **Multi-board** — multiple boards per user, switch like virtual desktops
- **Multi-user** — local accounts or SSO via OIDC (Authentik, Keycloak, any spec-compliant provider)
- **Admin panel** — manage users, search engines, and validate config from the UI
- **Widget types** — healthcheck, clock, stats, bookmarks, search bar, notepad, iframe

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite 8, SWR, Zustand |
| Grid | react-grid-layout |
| Backend | Node.js 20, Fastify |
| Database | SQLite (better-sqlite3) |
| Config | YAML + Zod 4, live reload via chokidar |
| Auth | Local + OIDC Authorization Code + PKCE (openid-client) |
| Packaging | pnpm workspaces, Docker multi-stage build |

---

## Installation

### Docker Compose (recommended)

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

Open `http://localhost:3000`. On first run the default admin account is created — change the password immediately in the admin panel.

### Config files

All configuration lives in the `/config` volume:

| File | Purpose |
|---|---|
| `settings.yml` | Theme, background, grid defaults, auth |
| `services.yml` | Widget instances |
| `integrations.yml` | Named API sources |
| `users.yml` | Local user accounts (optional, admin panel preferred) |

Annotated examples are in `config/*.yml.example`.

### API credentials

Credentials are passed via environment variables — never stored in config files:

```env
DASHDASH_INTEGRATION_<ID_UPPERCASE>_KEY=your-api-key
```

See `.env.example` for supported variables.

### SSO / OIDC

Set three environment variables and the "Sign in with SSO" button appears automatically:

```env
DASHDASH_OIDC_ISSUER=https://auth.example.com/application/o/dashdash/
DASHDASH_OIDC_CLIENT_ID=dashdash
DASHDASH_OIDC_SECRET=your-client-secret
```

---

## Development

Requires Node.js 20 and pnpm.

```bash
pnpm install
pnpm dev
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000`

---

## Support

If you find dashdash useful, consider buying me a coffee.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/welikecoffee)
