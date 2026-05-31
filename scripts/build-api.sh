#!/usr/bin/env bash
# Builds the NestJS API into a self-contained deploy bundle at
# releases/api/ and a tarball at releases/paynpik-api-<version>.tar.gz.
#
# What lands in the bundle:
#   dist/                  compiled JS
#   prisma/                schema + migrations (no .bak files)
#   package.json           prod-only deps (devDeps stripped, prisma kept)
#   package-lock.json      lockfile from apps/api
#   ecosystem.config.cjs   PM2 process config
#   .env.example           env template
#   README.md              deploy steps
#
# The bundle does NOT include node_modules — install on the server with
# `npm install --omit=dev` so native modules build for the target arch.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_SRC="$ROOT/apps/api"
DEPLOY_TPL="$ROOT/deploy/api"
OUT_DIR="$ROOT/releases/api"
RELEASES="$ROOT/releases"

VERSION="$(node -p "require('$API_SRC/package.json').version")"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
TARBALL="$RELEASES/paynpik-api-${VERSION}-${STAMP}.tar.gz"

echo "==> [api] cleaning previous build"
rm -rf "$OUT_DIR" "$API_SRC/dist"
mkdir -p "$OUT_DIR" "$RELEASES"

echo "==> [api] prisma generate"
(cd "$API_SRC" && npx --no-install prisma generate)

echo "==> [api] nest build"
(cd "$API_SRC" && npm run build)

echo "==> [api] staging bundle at $OUT_DIR"
cp -R "$API_SRC/dist" "$OUT_DIR/dist"

# Prisma: copy schema + migrations, skip the legacy .bak snapshots
mkdir -p "$OUT_DIR/prisma/migrations"
cp "$API_SRC/prisma/schema.prisma" "$OUT_DIR/prisma/schema.prisma"
cp -R "$API_SRC/prisma/migrations/." "$OUT_DIR/prisma/migrations/"

# Production package.json: strip devDeps, but keep `prisma` so the server
# can run `prisma generate` and `prisma migrate deploy` without devDeps.
node -e "
  const fs = require('fs');
  const path = require('path');
  const src = require(path.join('$API_SRC', 'package.json'));
  const deps = { ...src.dependencies };
  if (src.devDependencies && src.devDependencies.prisma) {
    deps.prisma = src.devDependencies.prisma;
  }
  const out = {
    name: src.name,
    version: src.version,
    private: true,
    description: 'paynpik API — production bundle',
    main: 'dist/src/main.js',
    scripts: {
      start: 'node dist/src/main.js',
      'db:migrate:deploy': 'prisma migrate deploy',
      'prisma:generate': 'prisma generate'
    },
    dependencies: deps
  };
  fs.writeFileSync(path.join('$OUT_DIR', 'package.json'), JSON.stringify(out, null, 2) + '\n');
"

# Lockfile: prefer the root one (npm workspaces hoists deps there).
if [ -f "$ROOT/package-lock.json" ]; then
  cp "$ROOT/package-lock.json" "$OUT_DIR/package-lock.json"
fi

cp "$DEPLOY_TPL/ecosystem.config.cjs" "$OUT_DIR/"
cp "$DEPLOY_TPL/.env.example"         "$OUT_DIR/"
cp "$DEPLOY_TPL/README.md"            "$OUT_DIR/"

echo "==> [api] creating tarball $TARBALL"
tar -czf "$TARBALL" -C "$RELEASES" "api"

echo
echo "[api] bundle ready:"
echo "  staged dir : $OUT_DIR"
echo "  tarball    : $TARBALL"
