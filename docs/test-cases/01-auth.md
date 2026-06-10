# 01 — Authentication & session

Covers staff password login, customer OTP, refresh, force-reset, and the
HMAC phone-lookup path that landed with the encryption work.

### AUTH-001 — Staff login by phone + password (P0)
**Pre:** staff user exists with phone `9876543210` / pw `Owner@123`.
**Steps:** `POST /auth/login { phone, password }`.
**Expected:** 200, body has `accessToken` + `user.role.responsibilities[]`.

### AUTH-002 — Staff login with wrong password (P0)
**Steps:** `POST /auth/login` with bad password.
**Expected:** 401 `Invalid credentials`. No session row created.

### AUTH-003 — Customer OTP request → verify happy path (P0)
**Steps:** `POST /auth/customer/request-otp { phone }` → `POST /auth/customer/verify-otp { phone, otp: '123789' }`.
**Expected:** Both 200/201. Verify returns `accessToken`. New `User` row created if phone didn't exist.

### AUTH-004 — Customer OTP request with staff phone (P0)
**Pre:** the phone is attached to a staff user (`businessId` not null).
**Steps:** `POST /auth/customer/request-otp { phone: <staffPhone> }`.
**Expected:** 401 `Use the staff portal to sign in with this number`.

### AUTH-005 — Phone lookup via HMAC (P0)
**Pre:** phone-encryption deploy completed; `PhoneBackfillService` ran.
**Steps:** Login with the same phone the user registered with.
**Expected:** Login succeeds. `paynpik_users.phoneHash` row matches `phoneHmac(phone)`.

### AUTH-006 — Stale plaintext phone fallback (P1)
**Pre:** a user row exists with `phoneHash IS NULL` (legacy).
**Steps:** Login with that phone.
**Expected:** Login succeeds via the plaintext-column fallback in `findByPhone`. Subsequent boots backfill `phoneHash`.

### AUTH-007 — Refresh token rotation (P1)
**Steps:** Login → use refresh token to get a new access token.
**Expected:** New access token. Old one continues to work until expiry.

### AUTH-008 — Force-password-reset on first login (P1)
**Pre:** outlet admin user with `mustChangePassword=true`.
**Steps:** Login → assert redirect to `/force-password-reset`.
**Expected:** Login OK; main app routes redirect until password is changed.

### AUTH-009 — Logout invalidates session (P1)
**Steps:** Login → `POST /auth/logout` with token → call `/auth/me`.
**Expected:** First call 200; second call 401.
