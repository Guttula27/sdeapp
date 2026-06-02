# Multi-stage build for the paynpik customer PWA.
#
# Dokploy config:
#   Build Type:        Dockerfile
#   Build Path:        /        (Provider section)
#   Docker Context:    .        (Build section)
#   Dockerfile Path:   apps/customer/Dockerfile
#   Build Args:        VITE_API_URL, VITE_WS_URL

# ─── builder ────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Vite bakes these into the bundle at build time.
ARG VITE_API_URL=http://localhost:3001/api/v1
ARG VITE_WS_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Workspace install: root lockfile + every workspace's package.json.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/customer/package.json apps/customer/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund

# Source for the customer app + shared types.
COPY apps/customer ./apps/customer
COPY packages/shared ./packages/shared

RUN npm run build --workspace=apps/customer

# ─── runtime ────────────────────────────────────────────────
FROM nginx:alpine AS production

# PWA-aware nginx config (no-cache on sw.js + manifest + index.html).
COPY apps/customer/nginx.conf /etc/nginx/conf.d/default.conf

# Built static bundle (includes sw.js, manifest.webmanifest, assets/).
COPY --from=builder /app/apps/customer/dist /usr/share/nginx/html

EXPOSE 80
