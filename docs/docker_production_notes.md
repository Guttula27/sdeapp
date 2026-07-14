# Docker — Production-Grade Notes

## 0. Core concept

- **Image** = packaged environment (OS + runtime + deps + code), built once.
- **Container** = a running instance of that image, isolated from the host.
- Solves: "works on my machine" — ships the exact environment, not just the code.
- `Dockerfile` = its own instruction language (like git has its own vocabulary) — Docker reads it top to bottom, executes using Docker's own rules. `RUN` lines happen to contain bash, but the instructions themselves (`FROM`, `RUN`, `COPY`, `CMD`...) are Docker-specific.

---

## 1. `.dockerignore` (do this first)

```
node_modules
.git
.env
dist
*.md
```
Prevents junk / secrets / bloat from being copied into the build context. Same role as `.gitignore`, different consumer.

---

## 2. Multi-stage production Dockerfile

```dockerfile
# ---- Stage 1: Build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Stage 2: Production ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
```

| Instruction | Meaning |
|---|---|
| `FROM node:20-alpine AS builder` | Start from pre-built Node 20 image (Alpine = minimal Linux). `AS builder` names this stage for later reference |
| `WORKDIR /app` | Sets "current folder" inside container — same as `cd /app` |
| `npm ci` (not `npm install`) | Clean install, exact versions from `package-lock.json`, fails on mismatch — reproducibility for prod |
| `COPY --from=builder ...` | Pulls **only** compiled output from stage 1 into the fresh stage 2 — dev tools/source never reach final image |
| `--omit=dev` | Skips devDependencies (TypeScript, test libs) in the final image |
| `EXPOSE 3000` | Documentation only — doesn't open the port by itself |

> **Why multi-stage:** dev Dockerfile (`CMD ["npm","run","start:dev"]`) keeps everything — hot reload, devDeps, full source. Production wants only compiled JS + prod deps. Multi-stage can shrink image from ~1GB → ~150MB.

> Analogy: `.ts` source ≈ uncompiled program, `dist/*.js` ≈ the "finished executable" (same role as a compiled `.exe` — Node can't run TS directly, same as Windows can't run C++ source directly).

---

## 3. Run as non-root user

```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

- Containers run as `root` by default → if the app is exploited, attacker gets root **inside** the container.
- Create an unprivileged user + group, switch to it with `USER` **near the end**, after `npm install` / `COPY` (which often need root to set up the image).
- Principle of least privilege: your server doesn't need admin powers just to listen on a port.

---

## 4. Health checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
```

- Docker only knows the **process** is alive, not whether the app actually works (e.g. stuck in an infinite loop = process alive, app dead).
- Every 30s hits `/health`; after 3 consecutive failures → marked unhealthy.
- Orchestrators (Dokploy/K8s/ECS) watch this signal and auto-restart — no human needed at 2 AM.
- Requires a trivial route returning `200 OK`:
```ts
@Get("health")
health() { return { status: "ok" }; }
```

---

## 5. Build & tag properly

```bash
docker build -t yourapp-api:1.0.0 .
```

- `-t` = name:tag. **Never rely on `latest` alone for deploys** — it's a moving label, you lose track of what's actually running.
- Tie versions to git commits/tags → if `1.1.0` breaks, roll back to `1.0.1` instantly, and you know exactly which commit produced it.

---

## 6. Runtime config — never bake secrets into the image

```bash
docker run -d \
  --name yourapp-api \
  -p 3000:3000 \
  -e DATABASE_URL="mysql://user:pass@dbhost:3306/proddb" \
  -e NODE_ENV=production \
  yourapp-api:1.0.0
```

- `-d` = detached (background).
- `-p host:container` = port mapping.
- `-e` = inject env var at runtime (this is what Dokploy's dashboard secrets UI does under the hood).

---

## 7. Production `docker-compose.yml`

```yaml
version: '3.8'
services:
  api:
    image: yourapp-api:1.0.0
    restart: always
    ports: ["3000:3000"]
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
    depends_on: [mysql, redis]

  mysql:
    image: mysql:8.0
    restart: always
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    restart: always

volumes:
  mysql_data:
```

| Field | Why it matters in prod |
|---|---|
| `restart: always` | Auto-restart on crash/reboot — irrelevant in dev, non-negotiable in prod |
| `${VAR}` | Pulled from a `.env` next to the compose file, never committed to git |
| `volumes` | Containers are disposable — without a volume, deleting the MySQL container deletes its data too |
| `depends_on` | Controls start **order** only, not "wait until ready" — add healthcheck-based wait for strict correctness |

---

## Quick mental map for revision

```
FROM        → pick a pre-built base image
multi-stage → build fat, ship thin (compiled output only)
npm ci      → reproducible install (lockfile-exact)
USER        → drop root privileges before running app
HEALTHCHECK → "is my app actually responding," not just "is the process alive"
image tag   → version explicitly, never rely on `latest`
-e / env    → secrets injected at runtime, never baked into image
volumes     → persist data beyond a container's lifecycle
```

## Repo mapping (Dokploy-based, no k8s/terraform)
- Build: `nixpacks.toml` (Dokploy reads this instead of a manual `docker build`)
- Deploy trigger: GitHub push to `main` → webhook → Dokploy pulls + builds + runs migrations (`npx prisma migrate deploy`) + starts (`node dist/src/main.js`)
- Secrets: entered in Dokploy dashboard → injected as env vars at container boot
- Networking: Dokploy's built-in Traefik reverse proxy handles routing + free SSL (Let's Encrypt)
