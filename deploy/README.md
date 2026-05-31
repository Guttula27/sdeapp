# paynpik — VPS deployment bundles

The monorepo builds into three independent, deployable Node.js bundles
designed to run side-by-side on one cloud VPS (or split across three) under
PM2. Each bundle is a self-contained directory + tarball — no monorepo
plumbing leaks into production.

| Service             | Default port | What it is                              |
|---------------------|--------------|-----------------------------------------|
| `paynpik-api`       | `3001`       | NestJS API (Prisma → MySQL, Bull/Redis) |
| `paynpik-web`       | `5173`       | Admin SPA, served by tiny Express       |
| `paynpik-customer`  | `5174`       | Customer PWA, served by tiny Express    |

Ports are overridable via `PORT` in each service's `.env`.

## Build (on your dev box / CI)

```bash
npm install

# Frontends: bake the production API URL into the bundle at build time.
export VITE_API_URL=https://api.yourdomain.com/api/v1
export VITE_WS_URL=https://api.yourdomain.com

npm run build:api         # → releases/api/        + releases/paynpik-api-<ver>-<stamp>.tar.gz
npm run build:web         # → releases/web/        + releases/paynpik-web-<ver>-<stamp>.tar.gz
npm run build:customer    # → releases/customer/   + releases/paynpik-customer-<ver>-<stamp>.tar.gz

# or do all three:
npm run build:all
```

`releases/` is git-ignored. Each tarball is what you `scp` to the server.

## Deploy (on the VPS)

Each bundle has its own README inside it with full steps:

- `deploy/api/README.md`
- `deploy/web/README.md`
- `deploy/customer/README.md`

The common shape is:

```bash
mkdir -p /opt/paynpik/<service> && cd /opt/paynpik/<service>
tar xzf /tmp/paynpik-<service>-<version>.tar.gz --strip-components=1
npm install --omit=dev
cp .env.example .env && $EDITOR .env
pm2 start ecosystem.config.cjs
pm2 save
```

The API additionally needs `npx prisma generate && npx prisma migrate deploy`
after install — see `deploy/api/README.md`.

## Server prerequisites

- Node.js 20+
- PM2 (`npm i -g pm2`)
- MySQL 8 reachable from the API host
- Redis 7 reachable from the API host
- A reverse proxy (nginx / Caddy / Cloudflare Tunnel) terminating TLS in
  front of all three services — the customer PWA's service worker will not
  register over plain HTTP.

## Why three bundles, not one

- Each can be redeployed, restarted, and scaled independently.
- Frontends have no runtime Node deps beyond `express` (~1 MB install).
- The API bundle ships compiled JS + Prisma schema only — no source TS,
  no dev tooling, no monorepo workspace plumbing.
- A frontend rollback (`pm2 reload paynpik-web` on the previous tarball)
  never touches the API.
