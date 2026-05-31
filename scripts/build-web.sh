#!/usr/bin/env bash
# Builds the admin SPA into a self-contained deploy bundle at
# releases/web/ and a tarball at releases/paynpik-web-<version>.tar.gz.
#
# Pass VITE_API_URL / VITE_WS_URL before invoking to point the bundle
# at your production API.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_SRC="$ROOT/apps/web"
DEPLOY_TPL="$ROOT/deploy/web"
OUT_DIR="$ROOT/releases/web"
RELEASES="$ROOT/releases"

VERSION="$(node -p "require('$WEB_SRC/package.json').version")"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
TARBALL="$RELEASES/paynpik-web-${VERSION}-${STAMP}.tar.gz"

echo "==> [web] cleaning previous build"
rm -rf "$OUT_DIR" "$WEB_SRC/dist"
mkdir -p "$OUT_DIR" "$RELEASES"

echo "==> [web] vite build (VITE_API_URL=${VITE_API_URL:-<unset>})"
(cd "$WEB_SRC" && npm run build)

echo "==> [web] staging bundle at $OUT_DIR"
cp -R "$WEB_SRC/dist"           "$OUT_DIR/dist"
cp "$DEPLOY_TPL/server.cjs"     "$OUT_DIR/"
cp "$DEPLOY_TPL/package.json"   "$OUT_DIR/"
cp "$DEPLOY_TPL/ecosystem.config.cjs" "$OUT_DIR/"
cp "$DEPLOY_TPL/.env.example"   "$OUT_DIR/"
cp "$DEPLOY_TPL/README.md"      "$OUT_DIR/"

echo "==> [web] creating tarball $TARBALL"
tar -czf "$TARBALL" -C "$RELEASES" "web"

echo
echo "[web] bundle ready:"
echo "  staged dir : $OUT_DIR"
echo "  tarball    : $TARBALL"
