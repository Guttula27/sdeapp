# paynpik-customer — deployment

Standalone customer PWA bundle. A tiny Express server (`server.cjs`) serves
the built static assets on a configurable port, with SPA fallback and
PWA-aware cache headers (sw.js / manifest are no-cache so updates roll
out cleanly).

## Build-time env (set BEFORE `npm run build:customer` on your build machine)

The Vite bundle hardcodes the API URL — there is no runtime config.

```bash
export VITE_API_URL=https://api.yourdomain.com/api/v1
export VITE_WS_URL=https://api.yourdomain.com
npm run build:customer
```

## One-time setup on the server

```bash
mkdir -p /opt/paynpik/customer && cd /opt/paynpik/customer
tar xzf /tmp/paynpik-customer-<version>.tar.gz --strip-components=1
npm install --omit=dev
cp .env.example .env   # adjust PORT if needed
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
```

App now listens on `PORT` (default `5174`). Point your reverse proxy
at it (terminate TLS upstream — the SW will not register over plain HTTP).

## Updating an existing deploy

```bash
cd /opt/paynpik/customer
tar xzf /tmp/paynpik-customer-<new-version>.tar.gz --strip-components=1
npm install --omit=dev
pm2 reload paynpik-customer
```
