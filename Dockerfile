# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install deps (monorepo root + frontend + types)
COPY package.json package-lock.json* ./
COPY packages/types/package.json ./packages/types/
COPY packages/frontend/package.json ./packages/frontend/
RUN npm ci --workspace=@dashdash/frontend --workspace=@dashdash/types

# Copy source and build
COPY tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/frontend ./packages/frontend

RUN npm run build --workspace=@dashdash/frontend


# ── Stage 2: Build backend ────────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/types/package.json ./packages/types/
COPY packages/backend/package.json ./packages/backend/
RUN npm ci --workspace=@dashdash/backend --workspace=@dashdash/types --omit=dev

COPY tsconfig.base.json ./
COPY packages/types ./packages/types
COPY packages/backend ./packages/backend

RUN npm run build --workspace=@dashdash/backend


# ── Stage 3: Runtime image ────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy backend dist + node_modules
COPY --from=backend-builder /app/packages/backend/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules

# Copy compiled frontend into backend static dir
COPY --from=frontend-builder /app/packages/frontend/dist ./public

# Volumes
VOLUME ["/config", "/data"]

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    CONFIG_DIR=/config

EXPOSE 3000

CMD ["node", "dist/server.js"]
