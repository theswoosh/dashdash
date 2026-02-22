# dashdash

Self-hosted personal dashboard. YAML-first config, drag-and-drop grid, glassmorphism theme, server-side API proxy (keys never reach the browser), multi-user with OIDC.

## Quick start (Docker)

```bash
cp config/settings.yml.example config/settings.yml
cp config/services.yml.example config/services.yml
cp config/integrations.yml.example config/integrations.yml
docker compose up -d
```

Open `http://localhost:3000`.

## Development

Requires Node.js 20.

```bash
npm install
npm run dev
```

- Frontend: http://localhost:3000 (Vite dev server, proxies `/api` to backend)
- Backend: http://localhost:4000

## Config

All config lives in the `/config` volume (or `./config` in dev):

| File | Purpose |
|---|---|
| `settings.yml` | Theme, background, grid, auth |
| `services.yml` | Widget instances |
| `integrations.yml` | API sources (credentials via env vars) |
| `users.yml` | Local user accounts (optional) |

See `config/*.yml.example` for annotated examples.

## Credential management

API keys are **never stored in config files**. They are passed via environment variables:

```
DASHDASH_INTEGRATION_<ID_UPPERCASE>_KEY=your-api-key
```

See `.env.example` for all supported variables.

## Architecture

```
packages/
├── frontend/   # Vite + React 18 + react-grid-layout
├── backend/    # Node.js 20 + Fastify
└── types/      # Shared TypeScript types
```

See `PLAN.md` for the full architecture document.
