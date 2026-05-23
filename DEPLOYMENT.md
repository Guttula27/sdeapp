# PayNPik — Deployment Guide

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Git

### 1. Clone & Setup

```bash
git clone <repo-url> paynpik
cd paynpik
cp .env.example .env          # edit with your values
npm install                   # install all workspace deps
```

### 2. Start Infrastructure

```bash
docker-compose up -d postgres redis elasticsearch
# Wait ~15s for services to be healthy
```

### 3. Database Setup

```bash
cd apps/api
npx prisma migrate dev --name init   # run migrations
npm run db:seed                       # seed demo data
cd ../..
```

### 4. Start All Apps

```bash
# Option A — all at once
npm run dev

# Option B — individually (in separate terminals)
npm run dev:api        # API → http://localhost:3001
npm run dev:web        # Admin → http://localhost:5173
npm run dev:customer   # Customer PWA → http://localhost:5174
```

### Demo Credentials

| Portal | URL | Phone | Password |
|--------|-----|-------|----------|
| Admin Portal | http://localhost:5173 | 9000000000 | Admin@123 |
| Business Owner | http://localhost:5173 | 9876543210 | Owner@123 |
| Customer PWA | http://localhost:5174 | — | — |
| API Docs | http://localhost:3001/api/docs | — | — |
| Prisma Studio | (run `npm run db:studio`) | — | — |

### QR Demo Flow
1. Open http://localhost:5174
2. Click "Demo Order (Table T01)"
3. Browse menu, add items to cart
4. Place order
5. In Admin Portal → Orders, mark the order through status transitions
6. Watch real-time updates on the tracking page

---

## Production Deployment (Kubernetes)

### Prerequisites
- Kubernetes cluster (EKS / GKE / AKS)
- kubectl configured
- Container registry access
- Domain names with DNS configured
- cert-manager installed (for TLS)

### 1. Build & Push Docker Images

```bash
# API
docker build -t <registry>/paynpik-api:latest --target production ./apps/api
docker push <registry>/paynpik-api:latest

# Admin Web
docker build -t <registry>/paynpik-web:latest --target production ./apps/web
docker push <registry>/paynpik-web:latest

# Customer PWA
docker build -t <registry>/paynpik-customer:latest --target production ./apps/customer
docker push <registry>/paynpik-customer:latest
```

### 2. Configure Secrets

```bash
# Edit infrastructure/k8s/secrets.yaml with real values, then:
kubectl apply -f infrastructure/k8s/secrets.yaml
```

### 3. Deploy Infrastructure

```bash
kubectl apply -f infrastructure/k8s/namespace.yaml
kubectl apply -f infrastructure/k8s/postgres.yaml
kubectl apply -f infrastructure/k8s/redis.yaml
```

### 4. Run Database Migrations

```bash
kubectl run db-migrate \
  --image=<registry>/paynpik-api:latest \
  --restart=Never --rm -i \
  --namespace=paynpik \
  --env-from=secret/paynpik-secrets \
  -- npx prisma migrate deploy
```

### 5. Deploy Applications

```bash
kubectl apply -f infrastructure/k8s/api-deployment.yaml
kubectl apply -f infrastructure/k8s/web-deployment.yaml
kubectl apply -f infrastructure/k8s/ingress.yaml

# Watch rollout
kubectl rollout status deployment/paynpik-api -n paynpik
```

### 6. Seed Production Data (first deploy only)

```bash
kubectl run seed \
  --image=<registry>/paynpik-api:latest \
  --restart=Never --rm -i \
  --namespace=paynpik \
  --env-from=secret/paynpik-secrets \
  -- npx ts-node prisma/seed.ts
```

---

## CI/CD (GitHub Actions)

The pipeline at `.github/workflows/ci-cd.yml` automatically:

1. **On every push/PR** → lint + type-check
2. **On `main` push** → build Docker images + deploy to Kubernetes

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `KUBECONFIG` | Base64-encoded kubeconfig |

---

## Environment Variables Reference

See `.env.example` for all required variables.

Critical ones for production:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Strong random string (32+ chars) |
| `JWT_REFRESH_SECRET` | Different strong random string |
| `REDIS_URL` | Redis connection string |
| `RAZORPAY_KEY_ID` | Razorpay payment key |
| `RAZORPAY_KEY_SECRET` | Razorpay secret |
| `TWILIO_ACCOUNT_SID` | Twilio for SMS/WhatsApp |
| `SENDGRID_API_KEY` | Email notifications |
| `S3_BUCKET` | Media file storage |

---

## Architecture Overview

```
                        ┌─────────────────────────────────────┐
                        │           Load Balancer             │
                        └─────────────┬───────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                         │
       admin.paynpik.com       order.paynpik.com        api.paynpik.com
              │                        │                         │
     ┌────────▼───────┐    ┌──────────▼────────┐   ┌──────────▼─────────┐
     │  React Admin   │    │  Customer PWA      │   │  NestJS API        │
     │  (Port 80)     │    │  (Port 80, PWA)    │   │  (Port 3001)       │
     └────────────────┘    └───────────────────┘   └──────────┬─────────┘
                                                               │
                                         ┌─────────────────────┼──────────┐
                                         │                     │          │
                                  ┌──────▼──────┐    ┌────────▼───┐  ┌───▼──────┐
                                  │ PostgreSQL  │    │   Redis    │  │  Socket  │
                                  │ (Primary)   │    │  (Cache+   │  │  .IO     │
                                  │             │    │   Queue)   │  │ Gateway  │
                                  └─────────────┘    └────────────┘  └──────────┘
```

## Key API Endpoints

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me

GET    /api/v1/outlets/:id/menu          # Public — customer menu
POST   /api/v1/outlets/:id/orders        # Public — place order
GET    /api/v1/outlets/:id/orders        # Staff — order list
PATCH  /api/v1/outlets/:id/orders/:id/status

POST   /api/v1/payments/initiate
GET    /api/v1/reports/revenue
GET    /api/v1/reports/hourly

GET    /api/v1/qr/validate/:code         # QR scan validation
POST   /api/v1/qr/table/:tableId         # Generate table QR
```

## WebSocket Events

Connect to: `ws://api.paynpik.com/orders`

| Event (emit) | Payload | Description |
|---|---|---|
| `joinOutlet` | `outletId` | Subscribe to outlet updates |
| `joinKitchen` | `outletId` | Subscribe to kitchen updates |
| `joinTable` | `{outletId, tableId}` | Subscribe to table updates |

| Event (on) | Description |
|---|---|
| `orderCreated` | New order placed |
| `orderStatusUpdated` | Order status changed |
| `paymentConfirmed` | Payment completed |
