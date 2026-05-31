#!/usr/bin/env bash
# Builds the customer PWA into a self-contained deploy bundle at
# releases/customer/ and a tarball at releases/paynpik-customer-<version>.tar.gz.
#
# Pass VITE_API_URL / VITE_WS_URL before invoking to point the bundle
# at your production API.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CUST_SRC="$ROOT/apps/customer"
DEPLOY_TPL="$ROOT/deploy/customer"
OUT_DIR="$ROOT/releases/customer"
RELEASES="$ROOT/releases"

VERSION="$(node -p "require('$CUST_SRC/package.json').version")"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
TARBALL="$RELEASES/paynpik-customer-${VERSION}-${STAMP}.tar.gz"

echo "==> [customer] cleaning previous build"
rm -rf "$OUT_DIR" "$CUST_SRC/dist"
mkdir -p "$OUT_DIR" "$RELEASES"

echo "==> [customer] vite build (VITE_API_URL=${VITE_API_URL:-<unset>})"
(cd "$CUST_SRC" && npm run build)

echo "==> [customer] staging bundle at $OUT_DIR"
cp -R "$CUST_SRC/dist"          "$OUT_DIR/dist"
cp "$DEPLOY_TPL/server.cjs"     "$OUT_DIR/"
cp "$DEPLOY_TPL/package.json"   "$OUT_DIR/"
cp "$DEPLOY_TPL/ecosystem.config.cjs" "$OUT_DIR/"
cp "$DEPLOY_TPL/.env.example"   "$OUT_DIR/"
cp "$DEPLOY_TPL/README.md"      "$OUT_DIR/"

echo "==> [customer] creating tarball $TARBALL"
tar -czf "$TARBALL" -C "$RELEASES" "customer"

echo
echo "[customer] bundle ready:"
echo "  staged dir : $OUT_DIR"
echo "  tarball    : $TARBALL"
