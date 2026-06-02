# Multi-stage build for the paynpik admin SPA.
#
# Built with Build Context = / (repo root) so npm workspaces resolve
# correctly. Dokploy config:
#   Build Type:       Dockerfile
#   Build Context:    /
#   Dockerfile Path:  apps/web/Dockerfile
#   Build Args:       VITE_API_URL, VITE_WS_URL

# ─── builder ────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Vite bakes these into the JS bundle at build time. Dokploy passes
# them as Build Args / build-time env vars.
ARG VITE_API_URL=http://localhost:3001/api/v1
ARG VITE_WS_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Workspace install: root lockfile + every workspace's package.json,
# so npm ci resolves identically to a root install.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/customer/package.json apps/customer/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund

# Source for the web app + the shared types it imports.
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

RUN npm run build --workspace=apps/web

# ─── runtime ────────────────────────────────────────────────
FROM nginx:alpine AS production

# SPA fallback + cache-headers; replaces the default welcome page.
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# The built static bundle.
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
