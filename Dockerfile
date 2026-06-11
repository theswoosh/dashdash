# ── Stage 0: Shared base with pnpm ────────────────────────────────────────────
# node:22-alpine (Node 20 EOL 2026-04-30); digest-pinned for reproducible builds
FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS base
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate


# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM base AS frontend-builder

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types/package.json       ./packages/types/
COPY packages/frontend/package.json    ./packages/frontend/

RUN pnpm install --frozen-lockfile --filter @dashdash/frontend...

COPY tsconfig.base.json          ./
COPY packages/types              ./packages/types
COPY packages/frontend           ./packages/frontend

RUN pnpm --filter @dashdash/frontend build


# ── Stage 2: Build backend ────────────────────────────────────────────────────
FROM base AS backend-builder

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types/package.json    ./packages/types/
COPY packages/backend/package.json  ./packages/backend/

# Full install (devDeps needed for tsc)
RUN pnpm install --frozen-lockfile --filter @dashdash/backend...

COPY tsconfig.base.json      ./
COPY packages/types          ./packages/types
COPY packages/backend        ./packages/backend

# Compile TypeScript → dist/
RUN pnpm --filter @dashdash/backend build

# Bundle into a self-contained deployment directory:
# - flat node_modules (no virtual-store symlinks) with production deps only
# - dist/ included via "files": ["dist"] in package.json
RUN pnpm --filter @dashdash/backend --prod deploy --legacy /deploy


# ── Stage 3: Runtime image ────────────────────────────────────────────────────
FROM node:22-alpine@sha256:968df39aedcea65eeb078fb336ed7191baf48f972b4479711397108be0966920 AS runtime

# su-exec: lightweight privilege-drop utility (replaces gosu for alpine)
RUN apk add --no-cache su-exec

# Create non-root user — entrypoint fixes /data and /config ownership at runtime
# so upgrades from root-owned volumes work without manual intervention.
RUN addgroup -S dashdash && adduser -S dashdash -G dashdash

WORKDIR /app

# Self-contained backend: compiled JS + flat prod node_modules
COPY --from=backend-builder /deploy .

# Frontend SPA served by the backend at /
COPY --from=frontend-builder /app/packages/frontend/dist ./public

# Default config files — seeded into /config on first run (never overwrite)
COPY config/*.example /app/config-defaults/
COPY --chmod=755 docker/entrypoint.sh /app/entrypoint.sh

# OCI image labels (CI overlays version/revision/created on top)
LABEL org.opencontainers.image.title="dashdash" \
      org.opencontainers.image.description="Self-hosted personal dashboard with drag-and-drop grid, YAML config, and live integrations" \
      org.opencontainers.image.url="https://github.com/theswoosh/dashdash" \
      org.opencontainers.image.source="https://github.com/theswoosh/dashdash" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    CONFIG_DIR=/config

VOLUME ["/config", "/data"]

# --spider fails on any non-2xx status (plain -qO- succeeds on some error responses).
# 127.0.0.1, not localhost: busybox wget resolves localhost to ::1 first and the
# server binds IPv4 0.0.0.0 — the ::1 connection is refused with no IPv4 fallback.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

EXPOSE 3000

# Entrypoint runs as root; fixes volume ownership then drops to dashdash via su-exec.
ENTRYPOINT ["/app/entrypoint.sh"]
