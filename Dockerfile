# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/frontend/package.json ./packages/frontend/

RUN pnpm install --frozen-lockfile --filter @dashdash/frontend...

COPY tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/frontend ./packages/frontend

RUN pnpm --filter @dashdash/frontend build


# ── Stage 2: Build backend ────────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/backend/package.json ./packages/backend/

RUN pnpm install --frozen-lockfile --filter @dashdash/backend... --prod

COPY tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/backend ./packages/backend

RUN pnpm --filter @dashdash/backend build


# ── Stage 3: Runtime image ────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

COPY --from=backend-builder /app/packages/backend/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=frontend-builder /app/packages/frontend/dist ./public

VOLUME ["/config", "/data"]

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    CONFIG_DIR=/config

EXPOSE 3000

CMD ["node", "dist/server.js"]
