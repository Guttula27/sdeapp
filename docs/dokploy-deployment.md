# PayNPik — Dokploy Deployment Guide

End-to-end runbook for deploying the three-service PayNPik stack
(API + admin SPA + customer PWA) onto a Hostinger VPS (or any
Ubuntu VPS) running Dokploy.

Use this when:

- Standing up production for the first time
- Standing up a staging environment
- Recovering from a wipe / migrating servers

Reading time: ~15 min. Execution time: ~60–90 min for a fresh deploy.

---

## 0. Architecture overview

Three deployable services, one source repo, two managed databases:

```
                                     ┌─────────────────────┐
  admin.<domain>  ─── HTTPS ───►──── │  Traefik (Dokploy)  │
  order.<domain>  ─── HTTPS ───►──── │  reverse proxy +    │
  api.<domain>    ─── HTTPS ───►──── │  Let's Encrypt      │
                                     └──────────┬──────────┘
                                                │ (internal Docker network)
                          ┌─────────────────────┼─────────────────────┐
                          │                     │                     │
                ┌─────────▼─────────┐ ┌─────────▼─────────┐ ┌─────────▼─────────┐
                │  paynpik-admin    │ │  paynpik-customer │ │  paynpik-api      │
                │  nginx + React    │ │  nginx + React PWA│ │  NestJS + Prisma  │
                │  static bundle    │ │  static bundle    │ │  port 3001        │
                └───────────────────┘ └───────────────────┘ └─────────┬─────────┘
                                                                      │
                                                          ┌───────────┴───────────┐
                                                          │                       │
                                                ┌─────────▼─────────┐   ┌─────────▼─────────┐
                                                │  paynpik-mysql    │   │  paynpik-redis    │
                                                │  MySQL 8          │   │  Redis 7          │
                                                └───────────────────┘   └───────────────────┘
```

| Service | Public domain (example) | Internal port | Build type |
|---------|-------------------------|---------------|------------|
| paynpik-api | `api.example.com` | 3001 | Nixpacks (uses `nixpacks.toml` at repo root) |
| paynpik-admin | `admin.example.com` | 80 (nginx) | Dockerfile (`apps/web/Dockerfile`) |
| paynpik-customer | `order.example.com` | 80 (nginx) | Dockerfile (`apps/customer/Dockerfile`) |
| paynpik-mysql | internal only | 3306 | Dokploy managed service |
| paynpik-redis | internal only | 6379 | Dokploy managed service |

Frontends are React/Vite SPAs. The API URL is **baked into each SPA at
build time** via `VITE_API_URL` / `VITE_WS_URL` build args — these are
NOT runtime config.

---

## 1. Prerequisites

### Accounts
- Hostinger account (or any Ubuntu 22.04/24.04 VPS provider — DigitalOcean, Linode, Hetzner all work)
- GitHub account with admin access to the `paynpik_v2` repository (for installing the Dokploy GitHub App)
- Domain you control with DNS management (in this guide: `example.com`)
- Razorpay account (only when you're ready for payments)

### VPS specs
- **Minimum**: 2 vCPU, 4 GB RAM, 40 GB SSD
- **Recommended**: 4 vCPU, 8 GB RAM, 80 GB SSD
- Ubuntu 22.04 LTS or 24.04 LTS
- Static public IPv4

### Local tools (for testing + seeding)
- `curl`
- `dig`
- `nc` (netcat — for port checks)
- `ssh`

---

## 2. Phase 1 — VPS + DNS setup

### 2.1 Provision the VPS

In Hostinger / your VPS provider:

1. Create a VPS with Ubuntu 24.04
2. Note the public IPv4 (e.g., `31.97.236.112` — used as `<vps-ip>` in the rest of this doc)
3. Add your SSH public key during creation (preferred) or set a root password

### 2.2 First-time SSH + firewall

```bash
ssh root@<vps-ip>

# Update + install firewall
apt update && apt upgrade -y

# Restrict inbound — only SSH and HTTPS-serving ports
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp        # SSH
ufw allow 80/tcp        # HTTP — required for Let's Encrypt ACME challenge
ufw allow 443/tcp       # HTTPS
ufw enable
ufw status
```

Do NOT open 3001, 3306, 6379, or 5173/5174. Those are internal-only.

### 2.3 DNS records

In your DNS provider (Hostinger DNS panel, Cloudflare, etc.), add four
A records all pointing at the same VPS IP:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | `api` | `<vps-ip>` | 300 |
| A | `admin` | `<vps-ip>` | 300 |
| A | `order` | `<vps-ip>` | 300 |
| A | `dokploy` (optional, for Dokploy UI) | `<vps-ip>` | 300 |

Verify propagation from your laptop:

```bash
for h in api admin order; do
  echo -n "$h.example.com → "
  dig +short "$h.example.com"
done
# Each should print <vps-ip>. If empty, wait a few more minutes.
```

Do NOT proceed until all three A records resolve — Let's Encrypt
issuance fails otherwise.

---

## 3. Phase 2 — Install Dokploy

```bash
ssh root@<vps-ip>
curl -sSL https://dokploy.com/install.sh | sh
```

When the script finishes:

- Dokploy UI: `http://<vps-ip>:3000`
- (Optional) point `dokploy.example.com` at the VPS and configure Dokploy to serve its own UI over HTTPS

In the Dokploy UI:

1. Create the admin account (first user)
2. **Settings → Server** → set your **Let's Encrypt email** — this is REQUIRED for Traefik to auto-issue certs
3. (Optional) Update Dokploy if there's a banner showing a new version

---

## 4. Phase 3 — Create the project + databases

### 4.1 Project

Dokploy UI → **Projects → + Create Project** → name it `paynpik`.

All services below live inside this project so they share an internal
Docker network and can reach each other by service name.

### 4.2 MySQL service

Inside the `paynpik` project: **+ Create Service → Database → MySQL**.

| Field | Value |
|-------|-------|
| Name | `paynpik-mysql` |
| Image / Version | `mysql:8.0` |
| Database Name | `paynpik_db` |
| User | `paynpik` |
| Password | (generate a strong one — copy it) |
| Root Password | (generate a strong one — copy it) |
| External Port | **disabled** (keep internal-only) |

After deploy, note the **Internal Connection URL** Dokploy shows. It
will look like:

```
mysql://paynpik:<pw>@paynpik-paynpikmysql-<hash>:3306/paynpik_db
                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                    this is the internal hostname — different from
                    the service name "paynpik-mysql"! Use this exact
                    string in the API's DATABASE_URL.
```

> ⚠️ **GOTCHA**: Dokploy generates internal hostnames with random
> suffixes (e.g., `paynpik-paynpikmysql-rmdyuw`). Don't assume the
> hostname is just `paynpik-mysql` — copy what Dokploy displays.

> ⚠️ **GOTCHA**: avoid the `@` character in your MySQL password.
> Connection URLs parse on the first `@`, so a password containing
> one breaks Prisma's URL parser (`P1001 can't reach server`).
> Use letters, digits, `-`, `_`, `.`, `~` only.

### 4.3 Redis service

Same project: **+ Create Service → Database → Redis**.

| Field | Value |
|-------|-------|
| Name | `paynpik-redis` |
| Image / Version | `redis:7` |
| External Port | **disabled** |

Note the internal URL (same pattern — has a hash suffix):

```
redis://paynpik-paynpikredis-<hash>:6379
```

---

## 5. Phase 4 — Connect the Git repo

### 5.1 GitHub App (recommended)

Dokploy UI → **Settings → Git Providers → + Add → GitHub**.

1. Click **Install Dokploy GitHub App**
2. In GitHub: select **Only select repositories** → choose `paynpik_v2`
3. Authorize. GitHub redirects back to Dokploy with the integration saved.

This gives Dokploy:
- Read access to clone the repo
- Webhook delivery on every push to `main` (auto-deploys)

### 5.2 Alternative — SSH deploy key

If your repo is on GitLab/Bitbucket/self-hosted or you don't want a
GitHub App:

1. Dokploy → **Settings → Git Providers → + Add → Deploy Key**
2. Copy the generated public key
3. In your Git host: add it as a **read-only** deploy key on the repo
4. Save the SSH clone URL in Dokploy (`git@github.com:org/paynpik_v2.git`)

Auto-deploy in this mode requires manually adding a webhook in your
Git host pointing at Dokploy's webhook URL.

---

## 6. Phase 5 — Deploy `paynpik-api`

### 6.1 Create the Application

Inside `paynpik` project: **+ Create Service → Application**.

Set name: `paynpik-api`.

### 6.2 Provider section

| Field | Value |
|-------|-------|
| Source Type | Git |
| Git Provider | (the one from Phase 5) |
| Repository | `paynpik_v2` |
| Branch | `main` |
| **Build Path** | `/` ← single slash, NOT `/apps/api` |
| Trigger Type | On Push |
| Watch Paths | `apps/api/**`, `packages/shared/**`, `package.json`, `package-lock.json`, `nixpacks.toml` |
| Enable Submodules | off |

Save.

> ⚠️ **GOTCHA**: "Build Path" is the working directory Dokploy `cd`s
> into BEFORE running anything. Set it to `/` (repo root) so npm
> workspaces resolve. A wrong Build Path causes errors like
> `cd: can't cd to .../apps/api/Dockerfile` or
> `Directory nonexistent` errors when Dokploy combines paths.

### 6.3 Build section

| Field | Value |
|-------|-------|
| Build Type | **Nixpacks** |
| (Other fields) | leave blank — `nixpacks.toml` at repo root drives the build |

The `nixpacks.toml` in the repo:

```toml
[phases.setup]
nixPkgs = ["nodejs_20", "openssl"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = [
  "npm run build --workspace=apps/api",
  "cd apps/api && npx prisma generate",
]

[start]
cmd = "cd apps/api && npx prisma migrate deploy && node dist/src/main.js"
```

Notes:
- `openssl` in `nixPkgs` is mandatory — Prisma's query engine needs `libssl.so.3` at runtime.
- `prisma migrate deploy` runs every boot. It's idempotent so it's safe.
- The start command uses `dist/src/main.js` (not `dist/main.js`) because Nest emits with a `src/` subdirectory by default.

### 6.4 Environment

In the **Environment** tab, set these (use the internal hostnames you noted in Phase 4):

```env
NODE_ENV=production
PORT=3001
API_PREFIX=api/v1

DATABASE_URL=mysql://paynpik:<your-mysql-pw>@paynpik-paynpikmysql-<hash>:3306/paynpik_db
REDIS_URL=redis://paynpik-paynpikredis-<hash>:6379

JWT_SECRET=<run: openssl rand -base64 48>
JWT_REFRESH_SECRET=<run: openssl rand -base64 48>
JWT_EXPIRES_IN=7d

FRONTEND_URL=https://admin.example.com
CUSTOMER_URL=https://order.example.com

# Razorpay — drop in real keys when ready
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Swagger — keep disabled in prod (the code defaults it off when NODE_ENV=production)
# ENABLE_SWAGGER=true  # uncomment temporarily for debugging
```

> ⚠️ **GOTCHA**: `FRONTEND_URL` and `CUSTOMER_URL` must be **exact**
> origins — `https://`, no trailing slash, no subpath. The API's CORS
> does string-equality matching. `http://admin.example.com` ≠
> `https://admin.example.com`.

> ⚠️ **GOTCHA**: replace `<hash>` in DATABASE_URL and REDIS_URL with
> the actual values from Phase 4. Internal Docker DNS does NOT resolve
> the friendly name (`paynpik-mysql`) — it only resolves the full
> generated hostname.

### 6.5 Domains

In the **Domains** tab → **+ Add Domain**:

| Field | Value |
|-------|-------|
| Host | `api.example.com` |
| Port | `3001` |
| HTTPS | **On** |
| Certificate Provider | Let's Encrypt |

Save. Dokploy/Traefik triggers ACME issuance in the background — wait
~30 seconds.

### 6.6 Deploy

Click **Deploy**. Watch the build log. Expected:

```
==> Setup
Adding nixPkgs: nodejs_20 openssl
==> Install
$ npm ci
added N packages in Ns
==> Build
$ npm run build --workspace=apps/api
(nest build output)
$ cd apps/api && npx prisma generate
Generated Prisma Client (vX.X.X)
==> Start
$ cd apps/api && npx prisma migrate deploy && node dist/src/main.js
N migrations found in prisma/migrations
Applying migration `...`
... (router map)
PayNPik API running on: http://localhost:3001/api/v1
Nest application successfully started
```

### 6.7 Verify

```bash
curl -i https://api.example.com/api/v1/health
# → HTTP/2 200, {"status":"ok",...}
```

If you see a cert warning instead of 200, Let's Encrypt failed.
Toggle HTTPS off → save → on → save in the Domains tab to retry.

---

## 7. Phase 6 — Deploy `paynpik-admin` (admin SPA)

### 7.1 Create the Application

Inside `paynpik` project: **+ Create Service → Application** → name `paynpik-admin`.

### 7.2 Provider section

Same Git source as the API.

| Field | Value |
|-------|-------|
| Repository | `paynpik_v2` |
| Branch | `main` |
| **Build Path** | `/` |
| Trigger Type | On Push |
| Watch Paths | `apps/web/**`, `packages/shared/**`, `package.json`, `package-lock.json` |

### 7.3 Build section

| Field | Value |
|-------|-------|
| Build Type | **Dockerfile** |
| Docker File | `apps/web/Dockerfile` |
| Docker Context Path | `.` |
| Docker Build Stage | (blank) |

> ⚠️ **GOTCHA**: do NOT pick "Static" for the SPAs. In our testing,
> Dokploy's Static build type silently skipped the `vite build` step
> in monorepo setups, serving only the committed (stale) `index.html`
> without the `assets/` folder. The Dockerfile approach builds inside
> an explicit `RUN npm run build` step that can't be skipped.

The `apps/web/Dockerfile` (already in the repo) is a multi-stage build:

```dockerfile
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ARG VITE_API_URL=http://localhost:3001/api/v1
ARG VITE_WS_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/customer/package.json apps/customer/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
RUN npm run build --workspace=apps/web

FROM nginx:alpine AS production
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
```

### 7.4 Build Args (NOT runtime env)

Find the **Build Arguments** section (separate from runtime env vars
in some Dokploy versions; in others, marked with a "Build Time"
toggle next to each variable).

Add:

```env
VITE_API_URL=https://api.example.com/api/v1
VITE_WS_URL=https://api.example.com
```

> ⚠️ **GOTCHA**: Vite bakes these into the JS bundle at build time.
> They are MEANINGLESS at runtime. Set them as **Build Args**, not
> runtime env. If you change them later, you must **redeploy**
> (not just restart) — Vite has to rebuild the bundle.

### 7.5 Domains

| Field | Value |
|-------|-------|
| Host | `admin.example.com` |
| Port | `80` |
| HTTPS | On |

### 7.6 Deploy

Click **Deploy**. Expected build log:

```
Step 1/13 : FROM node:20-bookworm-slim AS builder
...
Step 11/13 : RUN npm run build --workspace=apps/web
> @paynpik/web@1.0.0 build
> tsc && vite build
✓ N modules transformed.
dist/index.html                  0.74 kB
dist/assets/index-XXXXX.css      63 kB
dist/assets/index-XXXXX.js    2,400 kB
✓ built in N.NN s
Step 12/13 : FROM nginx:alpine AS production
Step 13/13 : COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
```

### 7.7 Verify

```bash
# Should return real PayNPik HTML, NOT "Welcome to nginx!"
curl -s https://admin.example.com/ | grep -oE '<title>[^<]+</title>'
# → <title>PayNPik — Run your restaurant on one screen</title>

# Hashed asset reachable
curl -s https://admin.example.com/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1
# Then fetch that asset:
curl -I https://admin.example.com/assets/index-XXXXX.js
# → 200, Cache-Control: public, immutable
```

If you see the nginx welcome page, the build skipped `vite build` —
check the build log and confirm Build Type = Dockerfile (not Static).

---

## 8. Phase 7 — Deploy `paynpik-customer` (customer PWA)

Same pattern as admin, with PWA-aware nginx headers.

### 8.1 Provider + Build settings

Same Git source, same Build Path, same Build Type (Dockerfile).

| Field | Value |
|-------|-------|
| Name | `paynpik-customer` |
| Docker File | `apps/customer/Dockerfile` |
| Docker Context Path | `.` |
| Watch Paths | `apps/customer/**`, `packages/shared/**`, `package.json`, `package-lock.json` |

### 8.2 Build Args

```env
VITE_API_URL=https://api.example.com/api/v1
VITE_WS_URL=https://api.example.com
```

### 8.3 Domain

| Field | Value |
|-------|-------|
| Host | `order.example.com` |
| Port | `80` |
| HTTPS | On |

### 8.4 Deploy + verify

After build, additional PWA-specific checks:

```bash
# Service worker MUST have no-cache (else PWA updates get stuck)
curl -I https://order.example.com/sw.js
# → 200, Cache-Control: no-cache, no-store, must-revalidate

# PWA manifest reachable + no-cache
curl -I https://order.example.com/manifest.webmanifest
# → 200, Cache-Control: no-cache, Content-Type: application/manifest+json
```

Open `https://order.example.com` on a phone — Chrome should offer
"Install PayNPik..." in the address bar menu.

---

## 9. Phase 8 — Seed the database

The schema is in place after migrations but no users exist yet.

### 9.1 From the API container's terminal

Dokploy → `paynpik-api` → **Terminal** tab:

```bash
cd /app/apps/api && DATABASE_URL="$DATABASE_URL" \
  node -e "require('child_process').execSync('npx ts-node prisma/seed.ts', {stdio: 'inherit', env: process.env});"
```

Expected output:

```
Seeding database...
Seeding complete!
─────────────────────────────────────
Responsibilities loaded → 53
Platform Admin  → 9000000000 / Admin@123
Business Owner  → 9876543210 / Owner@123
Outlet Admin    → 9999000000 / Outlet@123
Kitchen Manager → 9111000001 / Chef@123
Cashier         → 9111000002 / Cash@123
Store Manager   → 9111000003 / Store@123
Demo outlet ID  → demo-outlet
─────────────────────────────────────
```

### 9.2 Verify seed worked

```bash
curl -s -X POST https://api.example.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"9000000000","password":"Admin@123"}'
# → {"success":true,"data":{"user":{...},"accessToken":"..."}}
```

### 9.3 Log in to the admin SPA

Open `https://admin.example.com` → log in with `9000000000 / Admin@123`.
Dashboard should render.

---

## 10. Phase 9 — Post-deploy hardening (do BEFORE sharing URLs)

These items don't block usage but every one of them is a real security
exposure if you skip it.

### 10.1 Rotate seeded passwords

The seed creates accounts with documented weak passwords (`Admin@123`,
`Owner@123`, etc.). They are reachable on the public internet the
moment you deploy.

Log in as each seeded role via the admin SPA and change their password.
At minimum rotate `Platform Admin` immediately.

### 10.2 Confirm `JWT_SECRET` is real

```bash
ssh root@<vps-ip>
docker exec $(docker ps --filter "name=paynpikapi" -q | head -1) \
  printenv JWT_SECRET | wc -c
# → should be 60+ characters. If it's < 30 chars or looks like the
#   placeholder text, generate a real one:
openssl rand -base64 48
# Then update in Dokploy → paynpik-api → Environment → restart.
```

### 10.3 Confirm `REDIS_URL` uses the real hostname

```bash
docker exec $(docker ps --filter "name=paynpikapi" -q | head -1) \
  printenv REDIS_URL
# → should be redis://paynpik-paynpikredis-<hash>:6379
# If it says paynpik-redis (no hash), Bull queues silently fail.
# Fix in Dokploy → paynpik-api → Environment → restart.
```

### 10.4 Confirm databases are NOT exposed externally

From your laptop:

```bash
for port in 3306 6379; do
  echo -n "Port $port: "
  nc -zv -w 3 <vps-ip> $port 2>&1 | grep -oE "(succeeded|refused|timed out|No route)"
done
# → "refused" or "timed out" for both. "succeeded" means exposed → fix in Dokploy.
```

If "succeeded" — disable External Port on the database service in
Dokploy → `paynpik-mysql` / `paynpik-redis` → General.

### 10.5 Confirm Swagger is disabled

```bash
curl -I https://api.example.com/api/docs
# → HTTP/2 404 (the code disables it when NODE_ENV=production)
```

If Swagger is reachable, check that `NODE_ENV=production` is set on the
API service and that `ENABLE_SWAGGER` is NOT set to `true`.

### 10.6 Razorpay webhook

When you set real Razorpay keys, configure the webhook in your
Razorpay dashboard:

```
URL:    https://api.example.com/api/v1/payments/webhooks/razorpay
Secret: <value of RAZORPAY_WEBHOOK_SECRET on the API>
Events: payment.captured, payment.failed, order.paid
```

Send a test event. The API responds 200 on a valid signature; 401 if
the signature is wrong (verifies the webhook is correctly verifying).

### 10.7 MySQL backups

Dokploy → `paynpik-mysql` → **Backups**:

- Schedule: daily (e.g., 03:00 UTC)
- Destination: S3, Backblaze B2, or DigitalOcean Spaces (NOT the same VPS)
- Retention: 30 days minimum

Test restore quarterly.

### 10.8 Firewall final check

```bash
ssh root@<vps-ip>
ufw status numbered
# Should show only 22/tcp, 80/tcp, 443/tcp ALLOW. Nothing else.
```

---

## 11. Phase 10 — Final verification checklist

Run from your laptop:

```bash
# All three services reachable + healthy
for u in api.example.com/api/v1/health admin.example.com order.example.com; do
  printf "%-50s " "https://$u"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" "https://$u"
done

# Real cert (no -k flag)
curl -s -o /dev/null -w "%{http_code}\n" https://api.example.com/api/v1/health

# CORS preflight works from admin origin
curl -sI -X OPTIONS https://api.example.com/api/v1/health \
  -H "Origin: https://admin.example.com" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control-allow-origin

# Login works
curl -s -X POST https://api.example.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"9000000000","password":"<your-rotated-pw>"}' \
  | head -c 80

# Swagger blocked
curl -s -o /dev/null -w "%{http_code}\n" https://api.example.com/api/docs
# Should be 404

# Databases not exposed
for port in 3306 6379; do
  echo -n "Port $port: "
  nc -zv -w 3 <vps-ip> $port 2>&1 | grep -oE "(succeeded|refused|timed out)"
done
```

Expected results:

- `https://api.example.com/api/v1/health` → 200
- `https://admin.example.com/` → 200
- `https://order.example.com/` → 200
- CORS preflight → `access-control-allow-origin: https://admin.example.com`
- Login → `{"success":true,...`
- `/api/docs` → 404
- Ports 3306/6379 → refused or timed out

---

## 12. Troubleshooting — issues we hit and how we fixed them

### "No start command could be found" on API deploy

Cause: Dokploy's Nixpacks auto-detection looks for `npm start` in the
root `package.json` of a monorepo, doesn't find one.

Fix: ensure `nixpacks.toml` exists at the repo root with an explicit
`[start] cmd = "..."` block (already committed).

### "Can't reach database server at paynpik-mysql:3306" (P1001)

Cause: `DATABASE_URL` uses the friendly service name instead of
Dokploy's generated internal hostname.

Fix: copy the **Internal Connection URL** from Dokploy →
`paynpik-mysql` → General. Use that exact hostname in `DATABASE_URL`.

### Login URL parses incorrectly because password contains `@`

Cause: `mysql://user:pa@ss@host` → parser splits on first `@`,
"password" becomes `pa`, "host" becomes `ss@host`.

Fix: regenerate the MySQL password without `@`, `:`, `/`, `?`, `#`,
or other URL-reserved characters. Use letters, digits, `-`, `_`, `.`,
`~` only.

### Migration failed mid-way, P3009 on next deploy

Cause: Prisma's `_prisma_migrations` table has a failed record;
new migrations can't apply until it's resolved. MySQL DDL is NOT
transactional, so prior ALTERs in the same migration DID persist.

Fix: undo the partial changes manually, then clear the migration record:

```sql
-- Run via Dokploy → paynpik-mysql → Terminal:
-- Undo whatever the failed migration partially applied (specific to the migration)
-- Then:
DELETE FROM _prisma_migrations WHERE migration_name = '<failed-migration>';
```

Then redeploy.

### FK collation mismatch (error 3780) during migration

Cause: New table created without explicit `COLLATE` clause inherits
the MySQL server's default. Stock MySQL 8 defaults to
`utf8mb4_0900_ai_ci`; older tables were created with
`utf8mb4_unicode_ci`. FKs across mismatched collations are rejected.

Fix: in the migration's `CREATE TABLE` statements, append:

```sql
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Or set the MySQL server-wide collation to `utf8mb4_unicode_ci`:

```
docker exec ... mysql -uroot -p<root-pw> -e \
  "ALTER DATABASE paynpik_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### "Self-signed certificate" on a *.example.com domain

Cause: Let's Encrypt issuance failed. Common reasons:
- DNS hadn't propagated when Dokploy first tried
- Port 80 was blocked by the VPS firewall
- ACME email was missing in Dokploy → Settings → Server
- Rate-limited (Let's Encrypt allows 5 failures/hour per domain)

Fix:
1. Verify DNS: `dig +short <subdomain>.example.com` returns the VPS IP
2. Verify port 80: `curl -I http://<subdomain>.example.com/` returns SOMETHING (404 from app is fine — it proves Traefik is routing)
3. Verify ACME email is set in Dokploy server settings
4. In Dokploy → service → Domains → toggle HTTPS off → save → on → save (forces re-issuance)
5. If rate-limited, wait 1 hour

### "502 Bad Gateway" from Traefik on a Static-built SPA

Cause: Dokploy built the image but the container exited / never started, OR Domain port misconfigured.

Fix:
- Check Application status in Dokploy (must be "Running")
- `docker ps -a --filter "name=<app-name>"` on the VPS — if Exited, `docker logs <name> --tail 50` shows why
- In Domains: Port must be `80` for Static/nginx-based deploys

### SPA serves "Welcome to nginx!" instead of the React app

Cause: build skipped `vite build`, OR a stale committed `dist/`
file is being served. We hit this when Dokploy's Static build type
didn't actually run the build step in our monorepo setup.

Fix: switch to Build Type = Dockerfile using the in-repo Dockerfile.
Also untrack any accidentally-committed `dist/` files:

```bash
git ls-files apps/web/dist/ apps/customer/dist/ apps/api/dist/
git rm --cached -r apps/web/dist/ apps/customer/dist/ apps/api/dist/
git commit -m "chore: untrack committed dist/ artifacts"
git push
```

### SPA calls `localhost:3001` instead of the production API

Cause: `VITE_API_URL` wasn't passed as a Build Arg, so Vite fell back
to the default in `vite.config.ts`.

Fix: in Dokploy → SPA app → Environment, mark `VITE_API_URL` and
`VITE_WS_URL` as **Build Args** (or "Build Time" toggle ON). Redeploy
(not restart — needs full Vite rebuild).

### CORS error in browser despite right values

Cause: browser is loading the SPA over HTTP (Origin: `http://...`)
but API allows only `https://...`. Schemes don't match.

Fix: load the SPA via `https://`. If you keep ending up on HTTP, clear
the browser's HSTS state for the domain (Chrome:
`chrome://net-internals/#hsts` → Delete domain security policies).

### Offline outbox banner stays forever after login

Cause: stale queued writes (from earlier CORS failures) can't drain
cleanly. Fixed in commit `bb047496` — auto-purges zombie entries +
adds a Dismiss button. For pre-fix instances, clear it manually:

```js
// In browser console on the SPA:
localStorage.removeItem('paynpik-outbox-v1');
location.reload();
```

---

## 13. Operational reference

### Service inventory

```bash
# All containers
ssh root@<vps-ip>
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

# Resource usage
docker stats --no-stream
```

### Logs

```bash
# API logs
docker logs $(docker ps --filter "name=paynpikapi" -q | head -1) --tail 100 -f

# Admin SPA (nginx access logs)
docker logs $(docker ps --filter "name=paynpik-admin" -q | head -1) --tail 50

# MySQL slow queries / errors
docker logs $(docker ps --filter "name=paynpikmysql" -q | head -1) --tail 100
```

### Manual redeploy

Dokploy → service → **Deploy** button.

Or push to `main` — auto-deploy triggers via webhook.

### Force no-cache rebuild

Dokploy → service → check "Clean Cache" before clicking Deploy. Or:

```bash
ssh root@<vps-ip>
docker rmi -f $(docker images --filter "reference=paynpik-*" -q) 2>/dev/null
docker builder prune -af
```

Then deploy normally.

### Manual database access

```bash
ssh root@<vps-ip>
docker exec -it $(docker ps --filter "name=paynpikmysql" -q | head -1) \
  mysql -upaynpik -p paynpik_db
# Enter your password when prompted.
```

### Apply a hotfix env var without redeploying

Dokploy → service → Environment → edit → save → click **Restart**
(not Deploy). Faster — skips the build.

Exception: SPA `VITE_*` vars REQUIRE a redeploy because they're baked
at build time.

---

## 14. New-environment checklist (one-page summary)

Use this when deploying to a fresh VPS (staging, second region, etc.):

- [ ] VPS provisioned, Ubuntu 22.04/24.04, ≥4 GB RAM
- [ ] UFW configured: only 22, 80, 443 inbound
- [ ] DNS A records: `api.*`, `admin.*`, `order.*` → VPS IP, propagated
- [ ] Dokploy installed
- [ ] ACME email set in Dokploy → Settings → Server
- [ ] Project `paynpik` created
- [ ] MySQL service deployed, internal hostname noted, password URL-safe
- [ ] Redis service deployed, internal hostname noted
- [ ] GitHub App installed on the repo
- [ ] `paynpik-api` deployed (Nixpacks, Build Path=`/`)
- [ ] API env vars set (real JWT_SECRET, correct DATABASE_URL/REDIS_URL hostnames)
- [ ] API health check passing (`/api/v1/health` returns 200)
- [ ] `paynpik-admin` deployed (Dockerfile, Build Args for VITE_API_URL/VITE_WS_URL)
- [ ] Admin SPA renders + login works
- [ ] `paynpik-customer` deployed (Dockerfile, Build Args set)
- [ ] Customer PWA renders + service worker registers
- [ ] DB seeded
- [ ] All seeded passwords rotated
- [ ] Razorpay keys + webhook configured (when ready)
- [ ] MySQL backups scheduled
- [ ] External ports on databases confirmed disabled
- [ ] Swagger confirmed 404 in production
- [ ] CORS preflight test passes from both SPA origins

---

## Appendix A — Important file locations in the repo

| Path | What it is |
|------|-----------|
| `nixpacks.toml` | Build config for the API (Nixpacks). |
| `apps/web/Dockerfile` | Multi-stage build for the admin SPA. |
| `apps/web/nginx.conf` | nginx config served alongside the admin SPA. |
| `apps/customer/Dockerfile` | Multi-stage build for the customer PWA. |
| `apps/customer/nginx.conf` | PWA-aware nginx config (no-cache for sw.js, manifest). |
| `apps/api/prisma/schema.prisma` | DB schema — drives migrations. |
| `apps/api/prisma/migrations/` | Migration history. |
| `apps/api/prisma/seed.ts` | Initial data seed (roles, demo accounts, business). |
| `apps/api/src/main.ts` | API bootstrap, CORS, ValidationPipe, Swagger gate. |
| `apps/api/src/common/permissions/scope.ts` | JWT-scope-based access control. |
| `docker-compose.yml` | Local dev infrastructure (MySQL/Redis/etc.). Not used by Dokploy. |

---

## Appendix B — Glossary of Dokploy quirks

- **"Build Path"** in the Provider section is the working directory
  Dokploy `cd`s into before any build step. Set to `/` for monorepos
  so workspaces resolve.
- **"Docker Context Path"** in the Build section (Dockerfile builds)
  is what Docker uses as the build context for `COPY` commands.
  Set to `.` (the Build Path's contents).
- **"Dockerfile Path"** is the file location relative to the Docker
  Context Path. Set to `apps/web/Dockerfile` etc.
- **"Publish Directory"** is only meaningful for Static builds. Leave
  blank for Dockerfile builds.
- **Internal hostnames** are NOT the friendly service name. They have
  a random hash suffix Dokploy assigns at create time
  (e.g., `paynpik-paynpikmysql-rmdyuw`).
- **Build Args vs Environment Variables**: Build Args are passed to
  `docker build --build-arg`, available during the build only.
  Environment Variables are passed at container start, available at
  runtime. Vite needs Build Args; Nest needs runtime env vars.
- **"Clean Cache"** wipes BuildKit's layer cache. Default OFF for
  speed; turn ON when you've changed a Build Arg and suspect Docker
  is reusing a stale layer.
