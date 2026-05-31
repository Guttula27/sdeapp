# paynpik-web — deployment

Standalone admin SPA bundle. A tiny Express server (`server.cjs`) serves the
built static assets on a configurable port, with SPA fallback so React Router
deep links work on hard reload.

## Build-time env (set BEFORE `npm run build:web` on your build machine)

The Vite bundle hardcodes the API URL — there is no runtime config.

```bash
export VITE_API_URL=https://api.yourdomain.com/api/v1
export VITE_WS_URL=https://api.yourdomain.com
npm run build:web
```

## One-time setup on the server

```bash
mkdir -p /opt/paynpik/web && cd /opt/paynpik/web
tar xzf /tmp/paynpik-web-<version>.tar.gz --strip-components=1
npm install --omit=dev
cp .env.example .env   # adjust PORT if needed
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
```

App now listens on `PORT` (default `5173`). Point your reverse proxy
(nginx / Caddy / Cloudflare) at it.

## Updating an existing deploy

```bash
cd /opt/paynpik/web
tar xzf /tmp/paynpik-web-<new-version>.tar.gz --strip-components=1
npm install --omit=dev
pm2 reload paynpik-web
```
