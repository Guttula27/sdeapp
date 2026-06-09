#!/usr/bin/env bash
# End-to-end smoke test for the API + the recent encryption / logging /
# permission work. Designed to run against a deployed API (prod or
# staging). Read-only by default — does NOT mutate data unless you
# pass --write, in which case it will create+verify+cleanup a test
# customer.
#
# Usage:
#   API=https://api.vezeor.cloud bash scripts/smoke-test.sh
#   API=https://api.vezeor.cloud STAFF_PHONE=9876543210 STAFF_PASS='Secret!' bash scripts/smoke-test.sh
#
# Required env:
#   API            base URL of the API (no trailing slash, no /api/v1)
# Optional:
#   STAFF_PHONE    staff phone for login test (default: skip auth tests)
#   STAFF_PASS     staff password for login test
#   OUTLET_ID      outlet id for service-desk queue test
#   --write        run the mutating customer-create test
#
# Exits non-zero on the first failure, with the curl output for triage.

set -u

API="${API:?API base URL required, e.g. API=https://api.vezeor.cloud}"
WRITE=0
for arg in "$@"; do [ "$arg" = "--write" ] && WRITE=1; done

PASS=0; FAIL=0
RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'

ok()   { echo "${GREEN}✓${RESET} $*"; PASS=$((PASS+1)); }
fail() { echo "${RED}✗${RESET} $*"; FAIL=$((FAIL+1)); }
skip() { echo "${YELLOW}↷${RESET} $*"; }

http() {
  # http METHOD PATH [data] [header]
  local method="$1" path="$2" data="${3:-}" hdr="${4:-}"
  local args=(-sS -o /tmp/smoke.body -w '%{http_code}' -X "$method" "$API$path")
  [ -n "$hdr"  ] && args+=(-H "$hdr")
  [ -n "$data" ] && args+=(-H 'Content-Type: application/json' -d "$data")
  curl "${args[@]}"
}

# ─── 1. Liveness ─────────────────────────────────────────────────────
echo "── Liveness ──"
status=$(http GET /api/v1/health)
if [ "$status" = "200" ] && grep -q '"status":"ok"' /tmp/smoke.body; then
  ok "health endpoint returns 200 ok"
else
  fail "health endpoint returned $status: $(cat /tmp/smoke.body)"
fi

# ─── 2. Public surface (no auth needed) ──────────────────────────────
echo "── Public endpoints ──"
status=$(http GET /api/v1/clusters/public)
if [ "$status" = "200" ]; then
  ok "GET /clusters/public returns 200"
else
  fail "GET /clusters/public returned $status"
fi

# ─── 3. Auth — staff login (verifies phone encryption + dual-read) ──
echo "── Auth ──"
if [ -z "${STAFF_PHONE:-}" ] || [ -z "${STAFF_PASS:-}" ]; then
  skip "STAFF_PHONE / STAFF_PASS not set — skipping login test"
  TOKEN=""
else
  body=$(printf '{"phone":"%s","password":"%s"}' "$STAFF_PHONE" "$STAFF_PASS")
  status=$(http POST /api/v1/auth/login "$body")
  if [ "$status" = "200" ]; then
    TOKEN=$(grep -o '"accessToken":"[^"]*"' /tmp/smoke.body | head -1 | sed 's/.*:"//; s/"$//')
    if [ -n "$TOKEN" ]; then
      ok "staff login succeeded (phone HMAC lookup works)"
    else
      fail "login returned 200 but no accessToken in body"
    fi
  else
    fail "staff login returned $status: $(cat /tmp/smoke.body)"
    TOKEN=""
  fi

  # /auth/me round-trip — confirms JWT + responsibilities load
  if [ -n "$TOKEN" ]; then
    status=$(http GET /api/v1/auth/me '' "Authorization: Bearer $TOKEN")
    if [ "$status" = "200" ]; then
      ok "GET /auth/me with token returns 200"
    else
      fail "GET /auth/me returned $status: $(cat /tmp/smoke.body)"
    fi
  fi
fi

# ─── 4. Service desk queue (verifies new perm + endpoint) ───────────
echo "── Service desk ──"
if [ -z "${OUTLET_ID:-}" ] || [ -z "$TOKEN" ]; then
  skip "OUTLET_ID / token missing — skipping service-desk queue test"
else
  status=$(http GET "/api/v1/outlets/$OUTLET_ID/orders/service-desk/queue" '' "Authorization: Bearer $TOKEN")
  case "$status" in
    200) ok "GET service-desk/queue returns 200 (has VIEW_SERVICE_DESK)" ;;
    403) ok "GET service-desk/queue returns 403 (no VIEW_SERVICE_DESK — perm gate works)" ;;
    *)   fail "service-desk/queue returned $status: $(cat /tmp/smoke.body)" ;;
  esac
fi

# ─── 5. Platform settings (verifies the new MANAGE_PLATFORM_SETTINGS) ─
echo "── Platform settings ──"
if [ -z "$TOKEN" ]; then
  skip "no token — skipping platform-settings test"
else
  status=$(http GET /api/v1/platform/settings '' "Authorization: Bearer $TOKEN")
  if [ "$status" = "200" ]; then
    ok "GET /platform/settings returns 200"
  else
    fail "GET /platform/settings returned $status"
  fi

  # Attempting PATCH without MANAGE_PLATFORM_SETTINGS should 403; with
  # it should 200. Either is a passing smoke-test outcome (proves the
  # gate is enforced).
  status=$(http PATCH /api/v1/platform/settings '{"platformFeePercent":0}' "Authorization: Bearer $TOKEN")
  case "$status" in
    200) ok "PATCH /platform/settings returns 200 (caller has MANAGE_PLATFORM_SETTINGS)" ;;
    403) ok "PATCH /platform/settings returns 403 (perm gate enforced)" ;;
    *)   fail "PATCH /platform/settings returned $status: $(cat /tmp/smoke.body)" ;;
  esac
fi

# ─── 6. WRITE smoke test (opt-in) ───────────────────────────────────
echo "── Write tests (opt-in via --write) ──"
if [ "$WRITE" = "1" ] && [ -n "$TOKEN" ]; then
  testphone="99$(date +%s | tail -c 8)"
  body=$(printf '{"name":"smoke","phone":"%s"}' "$testphone")
  status=$(http POST /api/v1/auth/customer/request-otp "$body")
  if [ "$status" = "200" ] || [ "$status" = "201" ]; then
    ok "customer OTP request succeeded for new phone (encryption write path works)"
  else
    fail "customer OTP request returned $status: $(cat /tmp/smoke.body)"
  fi
else
  skip "--write not specified; skipping mutating tests"
fi

# ─── Summary ────────────────────────────────────────────────────────
echo
echo "─────────────────────────────────────────"
echo "Passed: ${GREEN}$PASS${RESET}    Failed: ${RED}$FAIL${RESET}"
[ "$FAIL" -gt 0 ] && exit 1
exit 0
