# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

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
FROM node:20-alpine AS backend-builder

RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

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
FROM node:20-alpine AS runtime

WORKDIR /app

# Self-contained backend: compiled JS + flat prod node_modules
COPY --from=backend-builder /deploy .

# Frontend SPA served by the backend at /
COPY --from=frontend-builder /app/packages/frontend/dist ./public

# Default config files — copied to /config on first run (never overwrite)
COPY config/*.example /app/config-defaults/
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    CONFIG_DIR=/config

# Create non-root user and own all app directories before declaring volumes
# (chown after VOLUME is discarded by Docker)
RUN addgroup -S dashdash && adduser -S dashdash -G dashdash \
    && mkdir -p /config /data \
    && chown -R dashdash:dashdash /app /config /data

USER dashdash

VOLUME ["/config", "/data"]

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
