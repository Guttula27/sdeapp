# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

npm workspaces monorepo. Three deployable apps + one shared types package:

- `apps/api` — NestJS 10 backend (TypeScript). The whole business lives here.
- `apps/web` — Vite + React 18 admin SPA (Redux Toolkit, React Router, i18next).
- `apps/customer` — Vite + React 18 customer PWA (vite-plugin-pwa, html5-qrcode for table QR scan, no Redux — context + hooks).
- `packages/shared` — exported TypeScript types only (`src/index.ts`); consumed by source path, not built.

`paynpik_db.sql` / `paynpik_db.sql.gz` at the root are a captured DB dump; `app_desc.txt` is the long-form SRS; `changes.txt` and `docs/hardening-backlog.md` are living planning docs (the backlog is load-bearing — read it before touching payments or auditability).

## Common commands

Run from the repo root unless noted. The root `package.json` proxies to the workspaces, so prefer the root scripts over `cd apps/api && ...`.

```bash
npm install                  # install all workspaces
npm run docker:dev           # start MySQL + Postgres + Redis + Elasticsearch (docker-compose)
npm run dev                  # api + web + customer concurrently
npm run dev:api              # just the API   → :3001 (Swagger at /api/docs, prefix /api/v1)
npm run dev:web              # admin SPA      → :5173
npm run dev:customer         # customer PWA   → :5174
npm run build                # build every workspace
npm run lint                 # lint every workspace (api uses eslint, web uses vite's tsc + eslint)

# Prisma (proxied to apps/api)
npm run db:migrate           # prisma migrate dev
npm run db:seed              # ts-node prisma/seed.ts
npm run db:studio            # prisma studio
```

API-only tasks (run from `apps/api/`):

```bash
npm test                     # Jest (no tests are actually checked in yet — placeholder)
npm run db:migrate:prod      # prisma migrate deploy
npm run db:generate          # regenerate the Prisma client after schema edits
```

There is no project-wide test suite. CI (per `DEPLOYMENT.md`) only runs lint + type-check.

## Architecture — backend (`apps/api`)

NestJS modular monolith. `src/main.ts` boots one Nest app with:

- Global prefix `api/v1`, CORS limited to `FRONTEND_URL` + `CUSTOMER_URL`.
- Global `ValidationPipe` with `whitelist + forbidNonWhitelisted + transform` — DTOs are enforced, unknown fields rejected. Every controller body needs a DTO with `class-validator` decorators or it will 400.
- Global `HttpExceptionFilter` and `TransformInterceptor` (response envelope).
- Swagger at `/api/docs`, manual health route at `/api/v1/health`.

`AppModule` wires Prisma, `@nestjs/throttler` (100 req/min default), Bull (Redis-backed queues, URL from `REDIS_URL`), and ~40 feature modules under `src/modules/`. Each module is a domain slice (`orders`, `cluster-orders`, `payments`, `kitchen-stations`, `customer-alerts`, `printers`, `clusters`, …) with the standard controller/service/dto/module shape; `orders` also has a `gateway.ts` (Socket.IO) and a separate `orders-browse.controller.ts` for read paths.

### Auth & permissions — important to get right

- Auth is **not globally guarded**. `JwtAuthGuard` is applied per controller via `@UseGuards(JwtAuthGuard)`. The `@Public()` decorator from `src/common/decorators/public.decorator.ts` only has an effect when that guard is in scope. A new controller without `@UseGuards(JwtAuthGuard)` is wide open — don't assume.
- Tenant scoping lives in `src/common/permissions/scope.ts`. `scopeFor(user)` returns one of `platform | business | outlet` from the JWT payload (`businessId`, `outletId` presence). `PLATFORM_ONLY` and `BUSINESS_ONLY` sets gate which responsibilities can be granted at each tier — use `assertGrantable` when adding new permission-management endpoints.
- Two guards exist: `JwtAuthGuard` (required) and `OptionalJwtGuard` (for endpoints customers may hit unauthenticated, e.g. menu browse).

### Idempotency

Writes that customers can replay (place order, verify payment, etc.) wrap `IdempotencyInterceptor` from `src/common/interceptors/idempotency.interceptor.ts`. Opt in per route with `@UseInterceptors(IdempotencyInterceptor)`. The interceptor stores `{key, scope, response}` keyed on the `Idempotency-Key` header and replays the cached response on retry; it 409s if the same key is reused on a different route. The frontend `services/api.ts` stamps a UUID on every mutating request unless one is provided (outbox replays reuse the original key).

### Database

- Prisma, `mysql` provider, schema at `apps/api/prisma/schema.prisma` (~75 models). Migrations in `apps/api/prisma/migrations/` are MySQL-native.
- A Postgres-era snapshot is kept around — `schema.prisma.bak`, `migrations.postgres.bak/`, and `prisma/migrate-pg-to-mysql.ts` — for one-shot data migration from the legacy DB. Don't run those casually. `docker-compose.yml` still spins up Postgres on `:5433` for the same reason; treat it as legacy.
- After editing `schema.prisma`, run `npm run db:generate` (or `db:migrate` if it's a schema change) — the dist files won't compile against an out-of-date client.

### Realtime & background work

- Socket.IO gateway lives in `apps/api/src/modules/orders/orders.gateway.ts`. Clients `joinOutlet | joinKitchen | joinTable`; server emits `orderCreated`, `orderStatusUpdated`, `paymentConfirmed` (see `DEPLOYMENT.md` for the contract).
- Bull queues use Redis from `REDIS_URL`. `customer-alerts/lifecycle-dispatcher.service.ts` is the main consumer — order lifecycle → templated WhatsApp/SMS/email via the messaging integrations.

### Payments

- Razorpay glue is in `apps/api/src/modules/payments/razorpay.service.ts` (includes `verifyWebhookSignature` for the webhook hardening item) and `payments.controller.ts` exposes `razorpay/order`, `razorpay/verify`, and a `webhooks/razorpay` endpoint.
- `docs/hardening-backlog.md` §1 is unimplemented: there is currently **no** reconciliation job for payments stuck in `PENDING`. Don't trust the client `verify` call as source of truth when wiring new flows — prefer the webhook path.

## Architecture — frontend (`apps/web` + `apps/customer`)

Both SPAs use Vite + React 18 + TypeScript + Tailwind. They share no code beyond `@paynpik/shared` types.

- `apps/web` uses Redux Toolkit (`src/store/slices/{auth,orders}.ts`), React Router (top-level routing tree in `src/App.tsx`), and a single axios client at `src/services/api.ts` with built-in retry, an Idempotency-Key stamp on every mutation, and an offline outbox (`src/utils/outbox.ts`). On network failure, writes are queued and replayed when connectivity returns.
- `apps/customer` is a PWA — `vite.config.ts` configures `vite-plugin-pwa` with Workbox runtime caching: GETs are NetworkFirst with cache fallback, images are CacheFirst, **writes intentionally bypass the SW** so the in-app outbox owns retry + Idempotency-Key replay (the SW would lose auth context). Same outbox pattern as the web app, plus `src/utils/cachedGet.ts` for the customer menu / cluster bundle reads.
- Customer ordering flow is QR-driven (`html5-qrcode`). The customer never logs in in the traditional sense; the QR encodes the outlet/table identity.

When adding a write call on either client, set `__outboxLabel` on the request config so the offline toast/banner shows something meaningful instead of the raw URL.

## Repo state gotchas

- `apps/api/dist/` and root `node_modules/` are **tracked in git** despite `.gitignore` listing them. A clean `npm install` or `nest build` will dirty the tree. Don't include those changes in commits unless you specifically intend to — use targeted `git add <path>` rather than `git add -A`.
- `.DS_Store` files are tracked at multiple levels. Same advice.
- The default branch is `main`; nothing else exists. Work directly off `main` unless asked otherwise.
- There is no CI workflow file in the repo yet (despite the `DEPLOYMENT.md` reference to `.github/workflows/ci-cd.yml`). Don't assume PRs are gated.
