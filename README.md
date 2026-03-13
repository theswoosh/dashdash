# dashdash

> A self-hosted personal dashboard. YAML-first, drag-and-drop, multi-user — designed for homelabs.

---

## Screenshots

<!-- TODO: add screenshots -->
*Screenshots coming soon.*

---

## Features

- **Drag-and-drop grid** — arrange and resize widgets however you like; layout is saved per user
- **Live YAML config** — add or change anything in a text file and it reloads instantly, no restart needed
- **Multiple themes** — Liquid Glass, Classic, and ASCII out of the box; add your own with a single CSS file
- **Service status monitoring** — know at a glance which of your self-hosted apps are online, with a subtle indicator right in the widget header
- **Service icons** — put a face to every app from a built-in icon library; recognise your services at a glance
- **Credentials stay on the server** — API keys are never exposed to the browser; all external calls go through the backend
- **Multiple boards** — organise widgets across several boards and switch between them in one click
- **Multi-user with SSO** — local accounts or single sign-on via any OIDC provider (Authentik, Keycloak, …)
- **Widgets** — service status, bookmarks, notepad, clock, search bar, embedded pages, and more

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
