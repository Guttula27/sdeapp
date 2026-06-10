# 17 — Encryption (data at rest)

Covers the APP_ENCRYPTION_KEY boot enforcement, the phone HMAC backfill,
the `enc:v1:` prefix scheme on encrypted columns, and decrypt-on-read at
the admin boundary.

### ENC-001 — APP_ENCRYPTION_KEY required in prod (P0)
**Steps:** Boot the API with `NODE_ENV=production` and no `APP_ENCRYPTION_KEY`.
**Expected:** Fatal error on boot.

### ENC-002 — Dev fallback warns loudly (P1)
**Steps:** Boot dev without the key.
**Expected:** Warn log "APP_ENCRYPTION_KEY not set — using a dev-only fallback key. DO NOT USE IN PRODUCTION."

### ENC-003 — Phone backfill populates on boot (P0)
**Pre:** users exist with `phoneHash IS NULL`.
**Steps:** Boot the API.
**Expected:** Log "phone backfill complete (N rows processed)". All rows now have phoneHash + phoneEnc.

### ENC-004 — Re-running backfill is a no-op (P1)
**Steps:** Restart API after ENC-003.
**Expected:** No rows updated; log line absent or N=0.

### ENC-005 — Encrypted columns hold `enc:v1:` (P0)
**Steps:** Query DB after a fresh write.
**Expected:** `user.phoneEnc`, `outlet.razorpayLinkedAccountId`, `payment.gatewayRef`, `payment.gatewayResponse.enc` all start with `enc:v1:`.

### ENC-006 — Legacy plaintext rows still readable (P0)
Already covered by AUTH-006.

### ENC-007 — Decrypt admin reads return plaintext (P0)
- Outlet admin form pre-fills with `acc_…` (OUT-004).
- Payment list shows plaintext `gatewayRef` (PAY-011).

### ENC-008 — Phone normalization yields a stable HMAC (P1)
**Steps:** Hash `"9876543210"`, `" 9876543210 "`, `"98765-43210"`.
**Expected:** All three produce the same hex.
