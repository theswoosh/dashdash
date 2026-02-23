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

VOLUME ["/config", "/data"]

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    CONFIG_DIR=/config

EXPOSE 3000

CMD ["node", "dist/server.js"]
