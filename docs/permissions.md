# Permission Catalogue & Role Matrix

Single source of truth for what every responsibility means, which
endpoint enforces it, and which role gets it by default. Generated
2026-06-09.

If you grant a custom role through the Roles UI, this is the menu you
pick from. The seed file (`apps/api/prisma/seed.ts`) keeps the
bundles below in lock-step.

---

## Roles at a glance

| Role | Type | Default phone for demo seed | Bundle |
|---|---|---|---|
| **Platform Admin** | System (platform-scope) | `9000000000` / `Admin@123` | All non-CUSTOMER perms automatically |
| **Customer** | System (PWA users) | OTP-based | `PLACE_CUSTOMER_ORDER`, `VIEW_OWN_ORDERS`, `MANAGE_FAVORITES`, `RAISE_DISPUTE` |
| **Business Owner** | Template (per-business) | `9876543210` / `Owner@123` | `OUTLET_FULL` ∪ `{MANAGE_BUSINESSES, MANAGE_BUSINESS_IMAGES, MANAGE_SUBSCRIPTIONS}` |
| **Outlet Admin** | Per-business | `9999000000` / `Outlet@123` | `OUTLET_FULL` |
| **Kitchen Manager** | Per-business | — | `KITCHEN_MANAGER` |
| **Cashier** | Per-business | — | `CASHIER` |
| **Service Desk** | Per-business (new 2026-06-09) | — | `SERVICE_DESK` |
| **Store Manager** | Per-business | — | `STORE_MANAGER` |

---

## Module map — permission, default-granted roles, enforcement site

### Platform

| Permission | What it gates | Roles |
|---|---|---|
| `PLATFORM_ADMIN` | Catch-all label, mostly informational today | Platform Admin |
| `VIEW_PLATFORM_REPORTS` | `GET /reports/platform-summary` | Platform Admin |
| `MANAGE_PLATFORM_SETTINGS` | `PATCH /platform/settings` (Razorpay route fee defaults) | Platform Admin |
| `MANAGE_LEADS` | Leads CRUD | Platform Admin |
| `MANAGE_PLANS` | Subscription plans CRUD | Platform Admin |

### Businesses

| Permission | What it gates | Roles |
|---|---|---|
| `VIEW_BUSINESSES` | `GET /businesses[/...]` | Business Owner, Outlet Admin |
| `MANAGE_BUSINESSES` | `POST /businesses`, `PATCH /businesses/:id`, `PATCH /businesses/:id/toggle-status` (incl. per-business platform-fee override) | Business Owner |
| `MANAGE_BUSINESS_IMAGES` | Business image upload / delete | Business Owner |

### Outlets

| Permission | What it gates | Roles |
|---|---|---|
| `VIEW_OUTLETS` | `GET /outlets[/...]` | Business Owner, Outlet Admin |
| `MANAGE_OUTLETS` | `POST /outlets`, `PATCH /outlets/:id` (includes Razorpay Route ID save) | Business Owner, Outlet Admin |
| `MANAGE_OUTLET_IMAGES` | Outlet image upload / delete | Business Owner, Outlet Admin |
| `MANAGE_OUTLET_HOURS` | Outlet operating hours | Business Owner, Outlet Admin |
| `MANAGE_SECTIONS` | Section CRUD + section × menu availability toggles (`PATCH /outlets/sections/:sectionId/menus/:menuId`) | Business Owner, Outlet Admin |
| `MANAGE_TABLES` | Table CRUD | Business Owner, Outlet Admin |
| `MANAGE_TABLE_TYPES` | Table types + table-type pricing | Business Owner, Outlet Admin |

### Menu

| Permission | What it gates | Roles |
|---|---|---|
| `VIEW_MENU` | Menu read (incl. `GET /outlets/sections/:sectionId/menus`) | Most outlet-level roles |
| `MANAGE_MENU` | Category + subcategory CRUD | Business Owner, Outlet Admin |
| `MANAGE_MENU_ITEMS` | Items, variants, item images | Business Owner, Outlet Admin |
| `TOGGLE_ITEM_AVAILABILITY` | Quick availability toggle | Business Owner, Outlet Admin, Kitchen Manager |
| `IMPORT_MENU` | Cross-outlet menu import | Business Owner, Outlet Admin |
| `MANAGE_TOPPINGS` | Toppings + item-topping mapping | Business Owner, Outlet Admin |

### Orders

| Permission | What it gates | Roles |
|---|---|---|
| `VIEW_ORDERS` | Order list + detail | Business Owner, Outlet Admin, Cashier, Kitchen Manager, Service Desk |
| `VIEW_ORDER_LOG` | `GET /outlets/:outletId/orders/:id/log` (stage / time / staff audit trail) | Business Owner, Outlet Admin, Kitchen Manager, Service Desk |
| `CREATE_ORDER` | `POST /outlets/:outletId/orders` | Business Owner, Outlet Admin, Cashier |
| `UPDATE_ORDER_STATUS` | `PATCH /outlets/:outletId/orders/:id/status` (incl. service-desk lane buttons) | Business Owner, Outlet Admin, Cashier, Kitchen Manager, Service Desk |
| `CANCEL_ORDER` | `PATCH /outlets/:outletId/orders/:id/cancel` | Business Owner, Outlet Admin, Cashier |
| `UPDATE_ITEM_STATUS` | `PATCH /outlets/:outletId/orders/:id/items/:itemId/status` (kitchen Start / Ready / Served per dish) | Business Owner, Outlet Admin, Kitchen Manager |

### Payments

| Permission | What it gates | Roles |
|---|---|---|
| `COLLECT_PAYMENT` | Initiate + confirm a payment | Business Owner, Outlet Admin, Cashier |
| `VIEW_PAYMENTS` | Payment history on order detail | Business Owner, Outlet Admin, Cashier |

### Kitchen

| Permission | What it gates | Roles |
|---|---|---|
| `VIEW_KITCHEN` | Kitchen display (KDS) page | Business Owner, Outlet Admin, Kitchen Manager |
| `MANAGE_KITCHEN_STATIONS` | Kitchen station CRUD + item routing | Business Owner, Outlet Admin, Kitchen Manager |
| `VIEW_SERVICE_DESK` | Service-desk dashboard read + `GET /orders/service-desk/queue` | Business Owner, Outlet Admin, Cashier, Kitchen Manager (read-only), Service Desk |
| `MANAGE_SERVICE_DESK` | Verify / strike postpaid items (`PATCH /orders/:id/verify-items`), release / mark on-its-way / mark served via the dashboard | Business Owner, Outlet Admin, Cashier, Service Desk |

### Inventory & vendors

| Permission | What it gates | Roles |
|---|---|---|
| `VIEW_INVENTORY` | Raw materials + stock levels | Business Owner, Outlet Admin, Kitchen Manager, Store Manager |
| `MANAGE_INVENTORY` | Material CRUD + consumption | Business Owner, Outlet Admin, Kitchen Manager, Store Manager |
| `MANAGE_PURCHASE_ORDERS` | PO create + receive | Business Owner, Outlet Admin, Store Manager |
| `VIEW_VENDORS` | Vendor list | Business Owner, Outlet Admin, Store Manager |
| `MANAGE_VENDORS` | Vendor CRUD | Business Owner, Outlet Admin, Store Manager |

### Reports

| Permission | What it gates | Roles |
|---|---|---|
| `VIEW_REPORTS` | Revenue, item-sales, hourly reports | Business Owner, Outlet Admin |
| `VIEW_KITCHEN_REPORTS` | Kitchen efficiency reports | Business Owner, Outlet Admin, Kitchen Manager |

### Staff & roles

| Permission | What it gates | Roles |
|---|---|---|
| `VIEW_STAFF` | Staff list | Business Owner, Outlet Admin |
| `MANAGE_STAFF` | Invite + update + toggle staff | Business Owner, Outlet Admin |
| `MANAGE_ROLES` | Custom roles + responsibility assignment | Business Owner, Outlet Admin |

### Customers

| Permission | What it gates | Roles |
|---|---|---|
| `VIEW_CUSTOMERS` | Customer list | Business Owner, Outlet Admin, Cashier, Service Desk |
| `MANAGE_CUSTOMERS` | Customer CRUD | Business Owner, Outlet Admin |
| `MANAGE_CUSTOMER_TAGS` | Tag definitions + tag-based pricing | Business Owner, Outlet Admin |
| `ASSIGN_CUSTOMER_TAGS` | Apply tags to customer profiles | Business Owner, Outlet Admin, Cashier |

### QR codes

| Permission | What it gates | Roles |
|---|---|---|
| `VIEW_QR_CODES` | QR list for outlet + tables | Business Owner, Outlet Admin, Cashier |
| `MANAGE_QR_CODES` | Generate / regenerate QRs | Business Owner, Outlet Admin |

### Disputes

| Permission | What it gates | Roles |
|---|---|---|
| `VIEW_DISPUTES` | Disputes list + detail | Business Owner, Outlet Admin |
| `MANAGE_DISPUTES` | Respond / resolve | Business Owner, Outlet Admin |

### Subscriptions / billing

| Permission | What it gates | Roles |
|---|---|---|
| `MANAGE_SUBSCRIPTIONS` | Subscribe a business to a plan | Business Owner |
| `VIEW_INVOICES` | View invoices | Business Owner, Outlet Admin |

### Customer (PWA) capabilities

| Permission | What it gates | Roles |
|---|---|---|
| `PLACE_CUSTOMER_ORDER` | Customer-side order placement | Customer |
| `VIEW_OWN_ORDERS` | Customer's own history | Customer |
| `MANAGE_FAVORITES` | Add / remove favourite items | Customer |
| `RAISE_DISPUTE` | Customer-initiated dispute | Customer |

---

## How to add a new permission

1. Add an entry to `RESPONSIBILITY_DEFS` in `apps/api/prisma/seed.ts`
   (alphabetical within its module section).
2. Add it to whichever role bundles should get it by default
   (`OUTLET_FULL`, `KITCHEN_MANAGER`, etc.).
3. In the controller that exposes the endpoint, call
   `assertResponsibility(user, 'NAME')` from
   `src/common/permissions/responsibility.ts`.
4. Update this matrix (table row in the right module + Roles column).
5. Run `npm run db:seed` after deploying — the seed is idempotent so
   re-runs cleanly refresh role bundles for existing tenants.

---

## How to check what perms a user has

In the API (controller / service):

```ts
import { hasResponsibility, assertResponsibility } from '../../common/permissions/responsibility';

// Soft check — branch logic on it
if (hasResponsibility(user, 'VIEW_ORDER_LOG')) { ... }

// Hard gate — throws 403 on failure
assertResponsibility(user, 'MANAGE_PLATFORM_SETTINGS');
```

On the admin web (React):

```ts
const { has } = useUserRole();
if (has('VIEW_SERVICE_DESK')) { /* render sidebar item */ }
```

---

## What's deliberately not enforced server-side

Many endpoints are gated only by `@UseGuards(JwtAuthGuard)` (any
authenticated user). Permissions for those are enforced at the UI by
hiding the menu entries / buttons. This is fine for low-risk reads
but means a determined user with a token *could* hit the URL.

If you flip an endpoint into "always-enforce-server-side" mode, add
the matching `assertResponsibility` call and update this document.

Endpoints with explicit server-side gates today (2026-06-09):

- `PATCH /platform/settings` → `MANAGE_PLATFORM_SETTINGS`
- `GET /outlets/sections/:sectionId/menus` → `VIEW_MENU`
- `PATCH /outlets/sections/:sectionId/menus/:menuId` → `MANAGE_SECTIONS`
- `GET /outlets/:outletId/orders/:id/log` → `VIEW_ORDER_LOG`
- `PATCH /outlets/:outletId/orders/:id/verify-items` → `MANAGE_SERVICE_DESK`
- `GET /outlets/:outletId/orders/service-desk/queue` → `VIEW_SERVICE_DESK`

A more aggressive rollout (every endpoint hard-gated) is a separate
hardening pass — see `docs/hardening-backlog.md` if you want to plan it.
