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

## SSO / OIDC

dashdash supports single-provider OIDC (OpenID Connect) using Authorization Code + PKCE. Works with Authentik, Keycloak, Dex, and any spec-compliant provider.

OIDC is configured entirely via environment variables — nothing in `settings.yml`. It auto-enables when all three required vars are set:

```env
DASHDASH_OIDC_ISSUER=https://auth.example.com/application/o/dashdash/
DASHDASH_OIDC_CLIENT_ID=dashdash
DASHDASH_OIDC_SECRET=your-client-secret
```

Optional vars:

| Variable | Default | Description |
|----------|---------|-------------|
| `DASHDASH_OIDC_SCOPES` | `openid profile email` | Scopes to request |
| `DASHDASH_OIDC_GROUPS_CLAIM` | _(none)_ | Token claim containing group names |
| `DASHDASH_OIDC_ADMIN_GROUP` | _(none)_ | Group that grants admin role |
| `DASHDASH_OIDC_AUTO_LINK` | `true` | Link OIDC identity to existing local account by verified email |

To disable local login entirely once OIDC is set up, add to `settings.yml`:

```yaml
auth:
  local:
    enabled: false
```

### Authentik setup

1. In Authentik admin: **Applications → Providers → Create → OAuth2/OpenID Provider**
   - Client type: `Confidential`
   - Redirect URI: `https://your-dashdash-host/api/auth/oidc/callback`
   - Copy the **Client ID** and **Client Secret**

2. Create an **Application** linked to that provider.

3. The issuer URL follows the pattern:
   ```
   https://your-authentik-host/application/o/<application-slug>/
   ```

4. Set the three env vars and restart dashdash. The "Sign in with SSO" button appears automatically.

## Architecture

```
packages/
├── frontend/   # Vite + React 18 + react-grid-layout
├── backend/    # Node.js 20 + Fastify
└── types/      # Shared TypeScript types
```

See `PLAN.md` for the full architecture document.
