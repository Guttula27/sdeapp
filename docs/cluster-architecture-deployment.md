# PayNPik — Cluster Architecture & Deployment

End-to-end reference for running PayNPik in a multi-node, multi-replica
cluster (Kubernetes-flavoured; the patterns translate to ECS / Nomad
with cosmetic changes). Read this alongside `docs/dokploy-deployment.md`
(single-VPS reference deploy) and `DEPLOYMENT.md` (quick-start) — this
doc fills the gap for production-grade clustering.

Audience: platform engineer responsible for prod uptime, not a
contributor learning the codebase.

Reading time: ~25 min.

---

## 1. What we are clustering — and what we are not

PayNPik ships as three independently deployable containers built from a
single npm-workspaces monorepo. Two managed data stores back them, plus
one object store. See `CLAUDE.md` for repository layout.

| Tier | Component | State | Clusters? |
|------|-----------|-------|-----------|
| Edge | nginx Ingress (or cloud LB) | none | yes — N replicas behind a VIP |
| App  | `paynpik-api` (NestJS) | none (besides in-process caches) | yes — but with caveats, see §4 |
| App  | `paynpik-admin` (React/Vite SPA, nginx) | none | yes — trivially |
| App  | `paynpik-customer` (React/Vite PWA, nginx) | none | yes — trivially |
| Data | MySQL 8 | durable | yes — primary + replicas (managed service strongly preferred) |
| Data | Redis 7 | durable + ephemeral | yes — Sentinel or managed (Bull + cache + idempotency + sessions) |
| Data | S3-compatible object store | durable | externally managed |

What we are NOT clustering on the application tier:
- No HSM/KMS sidecars (encryption uses env-injected key — see §11).
- No co-resident Elasticsearch (`docker-compose.yml` ships it for legacy,
  but it is not currently in the runtime path; do not deploy it to the
  cluster).
- No background-worker-only pods today — the Bull processor runs inside
  the API process. See §4.3 for when to split it out.

---

## 2. Reference topology

Two regions are out of scope for v1 — the data tier is single-region.
Within one region, run three AZs with anti-affinity on the API pods.

```
                                  ┌───────────────────────────┐
   Browser / PWA / staff portals  │   Cloud Load Balancer     │
   admin.example.com   ──────────►│   (L7, TLS termination,   │
   order.example.com   ──────────►│    HTTP/2 + WebSocket)    │
   api.example.com     ──────────►│                           │
                                  └─────────────┬─────────────┘
                                                │
                                  ┌─────────────▼─────────────┐
                                  │   Ingress Controller      │
                                  │   (nginx-ingress / ALB)   │
                                  │   sticky-sessions ON      │
                                  │     for /orders (Socket.IO)│
                                  └─────────────┬─────────────┘
                                                │
       ┌────────────────────────────────────────┼────────────────────────────────────────┐
       │                                        │                                        │
┌──────▼───────┐                        ┌───────▼────────┐                       ┌───────▼────────┐
│ admin-spa    │                        │ customer-pwa   │                       │ paynpik-api    │
│ Deployment   │                        │ Deployment     │                       │ Deployment     │
│ replicas: 2+ │                        │ replicas: 2+   │                       │ replicas: 3+   │
│ nginx static │                        │ nginx static + │                       │ Node 20 + Nest │
│              │                        │   PWA SW       │                       │ + Bull workers │
└──────────────┘                        └────────────────┘                       └───────┬────────┘
                                                                                         │
                              ┌──────────────────────────────────────────────────────────┼───────────────────┐
                              │                                                          │                   │
                       ┌──────▼───────────┐                          ┌───────────────────▼─────────┐ ┌───────▼──────────────┐
                       │ MySQL 8          │                          │ Redis 7 (Sentinel or       │ │ S3-compatible object │
                       │ Primary + 1-2    │                          │   managed cluster mode)    │ │ store (images,       │
                       │ async replicas   │                          │  - Bull queues             │ │   backups, exports)  │
                       │ (managed, RDS /  │                          │  - Menu cache + version    │ │                      │
                       │  Cloud SQL /     │                          │    counter (menu:ver:*)    │ │                      │
                       │  PlanetScale)    │                          │  - Idempotency keys        │ │                      │
                       │                  │                          │  - Throttler buckets       │ │                      │
                       │                  │                          │  - Socket.IO adapter pubsub│ │                      │
                       │                  │                          │    (REQUIRED — see §4.2)   │ │                      │
                       └──────────────────┘                          └────────────────────────────┘ └──────────────────────┘
```

DNS: three A records (or aliases to a cloud LB), each pointing at the
ingress. Customer PWA and admin SPA are split because they ship
different bundles and the customer PWA has different cache behaviour
(see §7).

---

## 3. Capacity sizing — starting points

These are *starting* numbers, not formulas. Re-derive from your
observability data after a week of real traffic.

| Service | Replicas (min) | Replicas (HPA max) | CPU req / lim | Mem req / lim |
|---------|----------------|---------------------|----------------|----------------|
| paynpik-api | 3 (one per AZ) | 20 | 250m / 1000m | 512 Mi / 1024 Mi |
| paynpik-admin (nginx) | 2 | 4 | 50m / 200m | 64 Mi / 128 Mi |
| paynpik-customer (nginx) | 2 | 6 (scales with QR scans during meal rush) | 50m / 200m | 64 Mi / 128 Mi |
| MySQL primary | 1 | n/a | 2 vCPU / 4 vCPU | 8 Gi / 16 Gi |
| MySQL read replica | 1–2 | n/a | same as primary | same as primary |
| Redis | 1 + 2 sentinels OR managed cluster | n/a | 500m / 1000m | 1 Gi / 2 Gi |

HPA targets: 70 % CPU, 80 % memory. Bumping `replicas` in the
existing `infrastructure/k8s/api-deployment.yaml` from 3 → 20 has
nothing else to do, BUT — see §4 first.

---

## 4. Clustering the API — the parts that need care

The API is *almost* stateless. Three concerns must be addressed before
scaling beyond one replica.

### 4.1 Idempotency replay

`src/common/interceptors/idempotency.interceptor.ts` keys retries by the
`Idempotency-Key` header and the route. Storage backs onto Redis (via
`RedisService`), so replays work across replicas automatically — no
sticky sessions required for this path.

Action required when scaling: nothing.

### 4.2 Socket.IO gateway — **the single most important clustering gotcha**

`apps/api/src/modules/orders/orders.gateway.ts` uses Socket.IO's
default in-process adapter. With N replicas, a `server.to('outlet:X').emit(...)`
call from pod A reaches **only** the clients connected to pod A.
Clients connected to pods B…N never see the event. Symptom: half the
kitchen displays stop updating after a deploy.

You have two ways to fix this. Pick one before exceeding one API replica.

**Option A — Socket.IO Redis adapter (recommended).**

Install `@socket.io/redis-adapter` and `ioredis`, then wire a custom
`IoAdapter` in `main.ts`. Sketch:

```ts
// apps/api/src/common/adapters/redis-io.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const pub = createClient({ url: process.env.REDIS_URL });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    this.adapterConstructor = createAdapter(pub, sub);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
```

Then in `main.ts`, after `NestFactory.create`:

```ts
const ioAdapter = new RedisIoAdapter(app);
await ioAdapter.connectToRedis();
app.useWebSocketAdapter(ioAdapter);
```

With this in place, any pod's `emit` fans out to clients on every pod.
Sticky sessions are still nice-to-have for connection reuse on
reconnect, but no longer required for correctness.

**Option B — sticky sessions only.**

Pin a client to a single pod via the ingress controller's cookie /
hash-by-source-IP feature. Annotations on `infrastructure/k8s/ingress.yaml`:

```yaml
nginx.ingress.kubernetes.io/affinity: "cookie"
nginx.ingress.kubernetes.io/session-cookie-name: "PNP_SOCKET"
nginx.ingress.kubernetes.io/session-cookie-max-age: "3600"
```

Limitations:
- Only works while a given outlet's staff are all connected to the
  same pod. If two staff members hit different pods (different cookies),
  they cannot see each other's events. Mostly fine for staff-side rooms
  because per-outlet staff usually shares an origin, but breaks down
  under multi-device per outlet.
- Customer-side rooms (`joinTable`) generally don't suffer because a
  single customer is the only one in their table room.

Do Option A. It's a one-day change and removes a permanent
"why did this order not show up?" support category.

### 4.3 Bull queue workers

`@nestjs/bull` registers processors on whichever process loads the
module. Today the only processor (`translations.processor.ts`,
`@Process({ name: TRANSLATE_FIELD_JOB, concurrency: 5 })`) runs inside
the API process. Bull dedupes job execution via Redis-backed locks, so
running N replicas means up to (N × concurrency) jobs run in parallel
across the cluster — Bull handles correctness.

This is fine until queue load grows enough that translation jobs start
competing with request-handling CPU. When that happens, split workers
into their own Deployment:

```yaml
# Same image, different start command
command: ["node", "dist/src/main.js"]
env:
  - name: ROLE
    value: "worker"
  # plus the same DATABASE_URL, REDIS_URL, etc.
```

…and gate the HTTP listen / Bull processor by `process.env.ROLE` so
web pods don't register the processor (or, vice versa, worker pods
don't open port 3001). Not needed at launch.

### 4.4 In-process menu cache singleflight

`menu.service.ts:41` — `inFlightTreeLoads: Map<string, Promise<...>>` —
dedupes concurrent loads *within a single pod*. With N replicas a cold
key on every pod yields up to N concurrent loads, not 1. That's not a
correctness problem; it's a cost cap thing. If the API ever scales to
~50 replicas and you see the cold-load DB query showing up hot in
metrics, consider promoting the singleflight to Redis (SETNX on
`menu:lock:{key}` with a short TTL). Skip until you can measure it.

### 4.5 Throttler buckets

`@nestjs/throttler` uses an in-memory store by default. With N replicas
the configured 100 req/min becomes effectively N × 100 req/min from a
single attacker. For now this is a soft control; if you need a true
global cap, switch the throttler store to Redis. There's a community
adapter (`nestjs-throttler-storage-redis`) that drops in cleanly.

---

## 5. Stateful tier

### 5.1 MySQL

The single-VPS reference uses container MySQL with a PVC. **Do not do
that in a multi-node cluster.** A single-pod stateful workload defeats
the point of clustering and turns a node failure into a recovery
incident. Two production-acceptable options:

1. **Managed**: AWS RDS for MySQL, Cloud SQL, Aiven, PlanetScale (with
   foreign-key gotchas). Strongly recommended. The whole `postgres.yaml`
   manifest in `infrastructure/k8s/` is stale anyway — project moved to
   MySQL, see `CLAUDE.md`. Delete that file.
2. **Self-hosted HA**: Vitess, PerconaXtraDB Cluster, or
   group-replication on three VMs outside the cluster. Significant
   operational burden — only choose this if you have the bench.

Connection string sized for the cluster:
```
DATABASE_URL=mysql://paynpik:<pw>@<primary-host>:3306/paynpik_db?connection_limit=10&pool_timeout=20
```
`connection_limit=10` per replica × 20 replicas = 200 connections,
which a `db.r6g.large` RDS instance handles comfortably. Raise / lower
based on your max_connections budget.

Read replicas: not wired in the code today. Prisma supports replicas
via `replicas` in the datasource block; until reports start hitting
the primary hard, leave this alone.

### 5.2 Redis

Redis carries five jobs:

- Bull queues (`@nestjs/bull`, `BullModule.forRoot` in
  `app.module.ts:64`)
- Menu cache + version counter (`menu:ver:{outletId}` INCR pattern,
  `menu.service.ts:60-66`)
- Idempotency keys (`IdempotencyInterceptor`)
- Throttler buckets (when migrated, see §4.5)
- Socket.IO adapter pub/sub channel (when the adapter ships, see §4.2)

That is enough load that you cannot ride a single Redis instance in
production. Two acceptable shapes:

1. **Managed Redis** (ElastiCache, Memorystore, Upstash, etc.). Pick
   "Redis 7+" with auth enabled. One primary + one read replica.
2. **Self-hosted Redis Sentinel** if managed isn't available. Three
   sentinels, one primary, one replica. The `ioredis` client in
   `BullModule.forRoot` accepts a `sentinels` array; you'd need to swap
   the URL-based construction in `app.module.ts:71-82` for the sentinel
   shape — same env var, different code path.

Persistence: keep `appendonly yes` (AOF). Menu cache loss is
recoverable (next read rebuilds it), but losing Bull job state on
restart causes duplicate sends / missed lifecycle events. Idempotency
keys *also* live here — losing them means a customer retry that should
replay turns into a duplicate write.

### 5.3 Object storage

Images / exports / backups go to S3-compatible storage. The API uploads
inline base64-data-URL bodies up to 16 MB
(`main.ts:26-27` — `useBodyParser('json', { limit: '16mb' })`). The
write path then transcodes and persists; no local-FS writes in the API.
You don't need a PVC mounted to the API.

Backups (MySQL) go to a different bucket / different region from media.
Never the same VPS the DB runs on.

---

## 6. Networking — ingress, TLS, WebSocket

### 6.1 Hostnames

Three public-facing hosts, one cluster:

| Host | Routes to | Notes |
|------|-----------|-------|
| `admin.example.com` | admin-spa Service | Plain HTTPS. |
| `order.example.com` | customer-pwa Service | HTTPS + PWA cache headers (see §7). |
| `api.example.com` | paynpik-api Service | HTTPS + WebSocket upgrade (§6.3). |

Why split admin and customer onto separate hostnames: the customer PWA
ships a service worker that aggressively caches GET responses. Letting
that SW run on `admin.example.com` would freeze admin sessions to
yesterday's bundle. Same-origin is a feature you do not want here.

### 6.2 TLS

cert-manager + Let's Encrypt for the lazy path; ACM + cloud LB for the
enterprise path. Either way: HSTS is already on (`main.ts:42-45`,
`helmet()` default config), so first-touch clients lock to HTTPS for
six months.

Wildcards: `*.example.com` keeps cert ops boring if you add staging
subdomains later. Otherwise issue per-host.

### 6.3 WebSocket upgrade — required annotations

`infrastructure/k8s/ingress.yaml` already has:
```yaml
nginx.ingress.kubernetes.io/upgrade: websocket
nginx.ingress.kubernetes.io/connection: Upgrade
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```
Confirm these are propagated by `kubectl describe ingress`. Without the
60-minute read/send timeout, idle Socket.IO connections get killed at
the ingress on the default 60-second timeout, producing
phantom-disconnect alerts.

If you're on AWS ALB or GCP LB instead of nginx-ingress, the
equivalents are: ALB → `idle_timeout=3600` on the load balancer;
GCP HTTPS LB → `backend service` → `Timeout = 3600`. The Socket.IO
namespace is `/orders`, mounted on the same `api.example.com` host as
the REST API.

### 6.4 CORS

`main.ts:62-68` reads `FRONTEND_URL` and `CUSTOMER_URL` and does
exact-string match. In a multi-environment cluster (staging + prod in
the same cluster), each environment's API must be deployed with its
own pair of env vars — there is no wildcard / regex matching. Same
domain on different schemes (`http://` vs `https://`) is not the same
origin from the CORS code's perspective.

### 6.5 Body size

API accepts up to 16 MB JSON (`main.ts:26`). Ensure the ingress
controller's `proxy-body-size` is also at least 16 MB or large image
uploads 413 before reaching the API. nginx-ingress:
```yaml
nginx.ingress.kubernetes.io/proxy-body-size: "16m"
```

---

## 7. Building & deploying the SPAs

Both SPAs are static bundles served by nginx in a container. Tricky
parts are config-baked-in and the customer PWA's service worker.

### 7.1 Vite env vars are build-time

`VITE_API_URL` and `VITE_WS_URL` are inlined into the JS bundle by Vite
during build. They are NOT runtime config. Two consequences:

- **You cannot reuse one image across environments.** Build a distinct
  image per environment with the correct env baked in. In CI:
  ```bash
  docker build \
    --build-arg VITE_API_URL=https://api.prod.example.com/api/v1 \
    --build-arg VITE_WS_URL=https://api.prod.example.com \
    -t registry/paynpik-admin:${SHA}-prod ./apps/web
  ```
- **Changing the env requires a redeploy that rebuilds, not just a
  container restart.** Rolling out a config-only change is a full
  build.

### 7.2 Customer PWA — service worker cache headers

The customer app registers a service worker. The worker file
(`sw.js`) and the web manifest (`manifest.webmanifest`) MUST be served
with `Cache-Control: no-cache, no-store, must-revalidate` — otherwise
PWA users get stuck on whichever SW the CDN cached and never see new
deploys.

`apps/customer/nginx.conf` in the repo handles this. Verify
post-deploy:
```bash
curl -I https://order.example.com/sw.js
# Expect: Cache-Control: no-cache, no-store, must-revalidate
```

Hashed assets (`/assets/index-*.js`) get the opposite treatment —
immutable, far-future `max-age`. Vite hashes filenames on build, so a
new deploy serves new hashes and old assets stay cacheable.

### 7.3 Outbox replay across deploys

Both SPAs maintain an offline outbox (`utils/outbox.ts`) keyed by an
`Idempotency-Key` stamped per write. After a deploy that changes a
write's URL or payload shape, queued writes from before the deploy
still replay — the API's idempotency interceptor 409s if a key replays
on a different route. This is intentional (prevents accidental double
writes after a breaking change) but worth knowing: customers caught
mid-deploy may see "operation replay rejected" toasts. Cleanly versioned
write paths avoid this.

---

## 8. Rolling deploys & migrations

### 8.1 API rolling deploy

The Deployment uses `maxSurge: 1, maxUnavailable: 0`
(`api-deployment.yaml:14`). That's correct for zero-downtime — N + 1
pods exist briefly during a roll.

Health probes:
- `livenessProbe` on `/api/v1/health` every 10 s. The route is wired
  inline in `main.ts:106` and always responds `{status: "ok"}` once
  Nest has finished bootstrap. It does not check Redis / DB — a healthy
  liveness response just means the process is alive.
- `readinessProbe` on the same path every 5 s. Same caveat — readiness
  passing is not a guarantee that DB / Redis / queues are healthy. If
  you want true readiness, add a `/api/v1/ready` route that pings
  Prisma + Redis (a separate ticket; not blocking cluster rollout).

### 8.2 Database migrations

The Nixpacks-style start command in `nixpacks.toml`:
```
cd apps/api && npx prisma migrate deploy && node dist/src/main.js
```
runs `migrate deploy` on every boot. If you keep that in K8s, **the
first pod to start during a deploy applies the migration**; subsequent
pods see "already applied" and start normally.

Risk: two pods start at the same instant and both try to apply the
migration. Prisma's `_prisma_migrations` table has unique constraints
that turn one of them into an error, crash-loop, give-up — but you can
see a brief 503 spike in the second pod.

Two cleaner options:

1. **Init container.** Move `prisma migrate deploy` into an init
   container on the API Deployment so it runs once per pod before the
   app starts. Same race but less surface area.
2. **One-shot migration Job.** Apply migrations from a `kind: Job`
   in CI, BEFORE rolling the API Deployment. Pre-create
   `paynpik-api-migrate` with a hook that waits for completion before
   `kubectl rollout restart`. This is the production-grade answer.

If a migration fails partway, MySQL DDL is not transactional — see
`docs/dokploy-deployment.md` §12 for the recovery dance
(`_prisma_migrations` table cleanup + manual undo of partial DDL).

### 8.3 Forward-compat constraints

Two patterns to maintain so rolling deploys don't break:

- **No breaking column drops in a single migration.** New code adds a
  column. Old code stays compatible because it ignores unknown
  columns. Old code is rolled out. Subsequent migration drops the
  column. Two-deploy contract.
- **No breaking message-shape changes on the orders socket.** The
  customer PWA reconnects with the previous code while the API rolls
  forward. Add new fields, don't rename them.

These are guidelines, not enforced — be deliberate during deploys.

---

## 9. Secrets management

`infrastructure/k8s/secrets.yaml` shows the surface area. In a real
cluster, do not commit this. Two patterns:

1. **External Secrets Operator** pulling from AWS Secrets Manager /
   GCP Secret Manager / HashiCorp Vault. Best long-term.
2. **Sealed Secrets** (Bitnami) committing encrypted YAML. Lower
   operational burden, fewer moving parts.

The high-value secrets, ordered by blast radius:

| Secret | Blast radius if leaked | Rotate cadence |
|--------|------------------------|----------------|
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | full impersonation of any user | 90 days; immediate on suspicion |
| `DATABASE_URL` (with password) | full read/write of all tenant data | 180 days |
| `ENCRYPTION_KEY` | decrypt PII at rest (see §11) | 365 days (rotation requires re-encrypt; non-trivial) |
| `RAZORPAY_KEY_SECRET` + webhook | money | yearly + immediate on suspicion |
| `REDIS_URL` (with auth) | cache + queue access; not data exfil | 180 days |
| Messaging provider keys (Twilio, SendGrid, Bhashini) | spend + impersonation | 180 days |

`JWT_SECRET` rotation needs a brief window where the API accepts BOTH
old and new — implement a two-key verify path before the rotation, or
accept a brief signed-out-everyone hit. Tied to user-session UX; not
blocking cluster setup.

---

## 10. Observability

The codebase ships Winston-formatted logs through nest-winston
(`main.ts:18-19`, `winstonAppConfig`). For cluster operations you want
three independent signals:

| Signal | Source | Suggested stack |
|--------|--------|-----------------|
| Logs | stdout, JSON | Loki + Grafana, or CloudWatch / Stackdriver |
| Metrics | RED + USE on the API + system | Prometheus + Grafana; HPA already consumes them |
| Traces | none today | OpenTelemetry SDK if you instrument; not wired yet |

Pre-flight dashboards worth building before launch:
- Per-route request rate, p50/p95/p99 latency, error rate.
- Bull queue depth + processing rate per queue.
- Socket.IO connected clients per pod (catches the §4.2 imbalance).
- MySQL connection-pool usage. Cluster-wide.
- Redis ops/sec, evicted keys, AOF rewrite count.
- HPA decisions (scale up/down events, target metric values).

Alerts to wire first:
- API 5xx rate > 1 % for 5 min.
- API p95 latency > 500 ms for 10 min.
- Bull queue depth > 1000 for 15 min.
- Redis or MySQL connectivity loss from any API pod for >30 s.
- Razorpay webhook 4xx/5xx for two consecutive deliveries (signature
  drift catches this).

---

## 11. Encryption at rest — sidecar or env-key

`apps/api/src/modules/.../encryption.service.ts` reads
`ENCRYPTION_KEY` from env and hard-fails on missing
(see `docs/hardening-backlog.md` P0.3). In a cluster:

- **Stay with env-injected key** (simplest): mount via the same
  Secrets pipeline as everything else. Rotation is invasive — every
  encrypted column must be re-encrypted, which is a one-off batch job.
- **Move to KMS** (better long-term): swap the local key for an envelope
  encryption pattern (KMS decrypts the data-key on demand). Latency
  bump, but the master key never leaves KMS and rotation is clean.

If you go KMS, run the KMS client with IRSA / workload identity so the
API pods get scoped IAM without a hard-coded credential.

---

## 12. Disaster recovery — what survives what

| Failure | Survives? | Recovery |
|---------|-----------|----------|
| Single API pod crash | yes | Replicas absorb. ReplicaSet replaces. |
| Single node loss | yes if pods across nodes | K8s reschedules; HPA may briefly add capacity. |
| AZ loss | yes if pods across AZs + multi-AZ MySQL | Read-replica promotion may be needed depending on managed-DB SLA. |
| Region loss | NO (v1) | Out of scope. v2: cross-region async MySQL replica + S3 cross-region replication + DNS failover. |
| Redis loss (managed) | partial | New empty Redis = lost in-flight Bull jobs + idempotency keys until TTL. Menu cache rebuilds on next read (cheap). Bull job loss = some retry-able messages drop. Acceptable for v1. |
| MySQL primary loss | depends | Managed: failover ~30 s. Self-hosted: depends on your HA setup. |
| Object storage loss | depends | Managed S3 SLA. Backups are in a different bucket / region — daily, 30-day retention minimum. |
| Region-wide ingress outage | NO | Same as region loss for v1. |

Backup discipline (already in `docs/dokploy-deployment.md` §10.7, lifted
here for parity):

- MySQL: daily full backup to a *different* bucket / region. Retain
  ≥ 30 days. Test restore quarterly. Verify the restore by booting a
  copy of the API against the restored DB and running the seed-login
  smoke test.
- Object storage: enable versioning + lifecycle to a cold tier; cross-
  region replication if compliance requires it.
- Redis: not backed up. Treat the data as replay-able from MySQL.

---

## 13. CI/CD pipeline — what to build

There is no `.github/workflows/ci-cd.yml` in the repo today, despite
`DEPLOYMENT.md` referencing one. Build one with these stages:

```
on: [pull_request, push to main]

lint+typecheck:
  - npm ci
  - npm run lint
  - cd apps/api && npx tsc --noEmit
  - cd apps/web && npx tsc --noEmit
  - cd apps/customer && npx tsc --noEmit

build-images (push to main only):
  - matrix over [api, web, customer]
  - docker buildx build with the right --build-args
  - push registry/paynpik-${service}:${SHA}

migrate:
  - one-shot Job applying prisma migrations against the target env
  - blocks deploy until success

deploy (per env):
  - kubectl set image deployment/paynpik-${service} ${service}=registry/paynpik-${service}:${SHA}
  - kubectl rollout status (timeout 10 min)
  - smoke test: hit /api/v1/health, /admin, /order; assert 200
```

For multi-environment, build twice (different `VITE_*` build args per
env) or use the same image tag with `:${SHA}-prod` and `:${SHA}-staging`
suffixes.

Required secrets in GitHub Actions:
- `REGISTRY_USER` / `REGISTRY_TOKEN`
- `KUBECONFIG_PROD` / `KUBECONFIG_STAGING` (base64-encoded scoped service-account configs, NOT cluster-admin)

---

## 14. Pre-flight checklist — going from single-replica to clustered

Use this when promoting from the Dokploy single-VPS reference to a
real cluster.

- [ ] Managed MySQL provisioned. Connection string verified from inside
      the cluster. Delete `infrastructure/k8s/postgres.yaml` — stale.
- [ ] Managed Redis (or Sentinel) provisioned. Persistence
      (AOF) enabled. AUTH on.
- [ ] Object storage provisioned. IAM role for API pods scoped to that
      bucket only.
- [ ] **Socket.IO Redis adapter merged and deployed.** See §4.2.
      Without this, multi-replica is broken.
- [ ] Ingress controller with WebSocket upgrade + 3600 s read/send
      timeout + 16 MB body size.
- [ ] TLS issued for all three hostnames. HSTS lock confirmed by browser
      test.
- [ ] CORS env (`FRONTEND_URL`, `CUSTOMER_URL`) set to exact production
      origins.
- [ ] `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` provisioned
      via External Secrets / Sealed Secrets. No placeholders.
- [ ] Vite SPAs built with the *correct* `VITE_API_URL` for the
      environment.
- [ ] Customer PWA `sw.js` and `manifest.webmanifest` confirmed
      `Cache-Control: no-cache`.
- [ ] Prisma migrations applied via Job (not first-pod race).
- [ ] HPAs in place with sensible min/max.
- [ ] Pod anti-affinity across AZs on the API Deployment
      (`topology.kubernetes.io/zone`).
- [ ] Logs flowing into the central log store, with the `app` and
      `pod` labels visible.
- [ ] Metrics scraped + dashboards for §10's six panels exist.
- [ ] Alerts wired for the five items in §10.
- [ ] Backups scheduled + quarterly restore drill on the calendar.
- [ ] Smoke-test runbook: login as platform admin, place an order via
      the customer PWA, mark it through statuses in admin, observe
      real-time updates land — across pods.
- [ ] Razorpay webhook URL configured + signature verification
      confirmed working.
- [ ] Swagger confirmed 404 in production
      (`/api/docs` should not be reachable).

---

## 15. Known clustering gaps in the current code — pre-merge backlog

These are exposed by the multi-replica deployment and worth fixing
before going live, in rough priority order. Numbered so you can copy
them into the issue tracker.

1. **No Socket.IO Redis adapter** — §4.2. Highest priority. Without
   this, multi-replica = broken realtime.
2. **Stale `infrastructure/k8s/postgres.yaml`** — project moved to
   MySQL but the manifest still provisions PostgreSQL. Delete or
   replace with a MySQL StatefulSet (do not use either in real cluster
   — use managed).
3. **Migrations run on API boot** — §8.2. Replace with init container
   or pre-deploy Job.
4. **Throttler is per-pod in-memory** — §4.5. Real global cap requires
   the Redis-backed store.
5. **No `/ready` route that pings dependencies** — §8.1. Today's
   readiness probe only confirms Nest booted, not that DB/Redis are
   reachable.
6. **No CI/CD workflow** — §13. Today nothing gates merges. At minimum
   wire lint + typecheck on PRs before scaling team contributors.
7. **`dist/` + `node_modules/` tracked in git** — `CLAUDE.md` calls
   this out. In a CI-driven build pipeline this is harmless once you
   stop committing artefacts, but the legacy state will keep
   re-dirtying trees during deploys until untracked.
8. **`OrdersGateway` has `cors: { origin: '*' }`** — `orders.gateway.ts:14`.
   Tighten to the CORS env origins before exposing publicly, matching
   the REST CORS config.

---

## Appendix A — Glossary

- **Sticky session**: ingress-level cookie / hash routing that pins a
  client's TCP connections to a single backend pod. Required by
  default Socket.IO; *not* required when the Redis adapter is in
  place (§4.2).
- **Idempotency replay**: a write retried with the same
  `Idempotency-Key` returns the original response instead of executing
  twice. Backed by Redis in this codebase.
- **Menu version counter**: a Redis key (`menu:ver:{outletId}`)
  INCR'd on any menu mutation. The cache key embeds it, so a bump
  effectively invalidates the cache for that outlet without an
  explicit delete.
- **Single-flight**: in-process map that dedupes concurrent loads of
  the same key. Per-pod in this codebase (§4.4).

## Appendix B — Files this doc points into

| Concern | Path |
|---------|------|
| API bootstrap, CORS, body size, helmet, Swagger gate | `apps/api/src/main.ts` |
| Bull queue config | `apps/api/src/app.module.ts` |
| Socket.IO gateway (needs Redis adapter) | `apps/api/src/modules/orders/orders.gateway.ts` |
| Menu cache + version counter + singleflight | `apps/api/src/modules/menu/menu.service.ts` |
| Idempotency interceptor | `apps/api/src/common/interceptors/idempotency.interceptor.ts` |
| Translations Bull processor | `apps/api/src/modules/translations/translations.processor.ts` |
| K8s manifests (some stale) | `infrastructure/k8s/` |
| Single-VPS reference (Dokploy) | `docs/dokploy-deployment.md` |
| Repo overview + clustering caveats | `CLAUDE.md` |
| Hardening items pending | `docs/hardening-backlog.md` |
