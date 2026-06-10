# Functional Test Cases — Index

This folder is the split-by-section version of the catalogue. Each file
covers one functional area and is self-contained — pick the file that
matches the change you're making and run the cases inside it.

Companion docs:
- `docs/security-test-cases.md` — OWASP / abuse-path tests.
- `docs/permissions.md` — role-permission matrix that some files refer to.

## How to use a file

Every case has:

- **ID** — stable identifier (`AUTH-001`, `ORD-014`, …).
- **Priority** — P0 (blocker, run on every release), P1 (run before each
  feature deploy), P2 (full regression).
- **Pre-reqs** — what state the system must be in before the test runs.
- **Steps** — operator-facing actions.
- **Expected** — observable outcome.

Conventions used in the steps:

- `<staff>` = signed-in as a staff role (specified per case)
- `<customer>` = customer flow on the PWA (`apps/customer`)
- `<admin>` = signed-in as an admin tier on the admin web (`apps/web`)
- API endpoints use the `/api/v1/` prefix the API mounts globally.

## Files in this folder

| # | File | Section | IDs |
|---|---|---|---|
| 1  | [`01-auth.md`](./01-auth.md) | Authentication & session | AUTH-001..009 |
| 2  | [`02-permissions.md`](./02-permissions.md) | Permissions & roles | PERM-001..007 |
| 3  | [`03-platform-admin.md`](./03-platform-admin.md) | Platform admin | PLAT-001..009 |
| 4  | [`04-outlets.md`](./04-outlets.md) | Outlets, sections, tables | OUT-001..012 |
| 5  | [`05-menu.md`](./05-menu.md) | Menu management | MENU-001..008 |
| 6  | [`06-orders.md`](./06-orders.md) | Order placement (admin web) | ORD-001..012 |
| 7  | [`07-customer-pwa.md`](./07-customer-pwa.md) | Customer PWA | CUST-001..008 |
| 8  | [`08-kitchen.md`](./08-kitchen.md) | Kitchen workflow | KIT-001..007 |
| 9  | [`09-service-desk.md`](./09-service-desk.md) | Service Desk | SVC-001..008 |
| 10 | [`10-parcel-desk.md`](./10-parcel-desk.md) | Parcel Desk | PCL-001..006 |
| 11 | [`11-postpaid.md`](./11-postpaid.md) | Postpaid (dine-in) | PP-001..007 |
| 12 | [`12-payments.md`](./12-payments.md) | Payments | PAY-001..011 |
| 13 | [`13-cluster.md`](./13-cluster.md) | Cluster checkout | CLU-001..009 |
| 14 | [`14-offline-pos.md`](./14-offline-pos.md) | Offline POS | OFF-001..010 |
| 15 | [`15-receipts.md`](./15-receipts.md) | Receipt printing (customer bill) | REC-001..012 |
| 16 | [`16-audit-log.md`](./16-audit-log.md) | Audit log + per-order log | LOG-001..008 |
| 17 | [`17-encryption.md`](./17-encryption.md) | Encryption (data at rest) | ENC-001..008 |
| 18 | [`18-sockets.md`](./18-sockets.md) | Real-time sockets | SOC-001..005 |
| 19 | [`19-list-search-sort.md`](./19-list-search-sort.md) | Search + sort across lists | LIST-001..007 |
| 20 | [`20-ux.md`](./20-ux.md) | UX nice-to-haves | UX-001..005 |
| 21 | [`21-smoke.md`](./21-smoke.md) | Smoke + regression | SMK-001..003 |

**~165 cases total.** Run the P0 set on every release; P1 + P2 on
larger merges or before a customer-visible push.

## Recommended next step (turning this into automation)

The catalogue is the foundation; converting to executable Jest /
Playwright tests is a separate effort. A reasonable phasing:

1. **API contract tests** (Jest + supertest) — start with `02-permissions`,
   `01-auth`, `12-payments` since these define the security perimeter.
2. **Workflow integration tests** (Playwright) — cover the SMK-* paths
   in `21-smoke`.
3. **Component tests** (Vitest + Testing Library) — receipt rendering
   (`15-receipts`), list toolbar (`19-list-search-sort`), useFullscreen
   hook (`20-ux`).

For each test, paste the matching ID into the test description so the
implementation, this catalogue, and any defects stay traceable.
