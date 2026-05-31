# paynpik-api — deployment

Standalone Node.js bundle of the NestJS API. Run under PM2 on any Linux VPS
with Node 20+, MySQL, and Redis reachable from the host.

## One-time setup on the server

```bash
# 1. Extract the release tarball
mkdir -p /opt/paynpik/api && cd /opt/paynpik/api
tar xzf /tmp/paynpik-api-<version>.tar.gz --strip-components=1

# 2. Install production deps + generate the Prisma client
npm install --omit=dev
npx prisma generate

# 3. Configure env
cp .env.example .env
$EDITOR .env

# 4. Run pending migrations against the production DB
npx prisma migrate deploy

# 5. Boot under PM2
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup    # one-time, follow the printed instruction
```

API now listens on `PORT` (default `3001`) under prefix `/api/v1`.
Swagger UI is at `/api/docs`. Health check at `/api/v1/health`.

## Updating an existing deploy

```bash
cd /opt/paynpik/api
tar xzf /tmp/paynpik-api-<new-version>.tar.gz --strip-components=1
npm install --omit=dev
npx prisma generate
npx prisma migrate deploy
pm2 reload paynpik-api
```

## Notes

- `dist/`, `prisma/`, `package.json`, `ecosystem.config.cjs`, and
  `.env.example` are everything you need; no source TypeScript is shipped.
- The bundle does NOT include `node_modules` — install on the server so
  native modules (`bcryptjs` etc.) are built for the target architecture.
- Logs land in `./logs/`. Rotate with `pm2 install pm2-logrotate` if desired.
