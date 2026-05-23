-- Role templates: platform-scoped roles whose permissions are cloned into
-- each new business and whose edits cascade to existing per-business copies.

ALTER TABLE "roles" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;

-- Stable id lets the seed upsert this same row on re-runs.
INSERT INTO "roles" ("id", "name", "description", "isSystem", "isTemplate", "businessId", "outletId", "createdAt", "updatedAt")
VALUES (
  'business-owner-template',
  'Business Owner',
  'Template role. Permissions toggled here become defaults for every new business and cascade to existing ones.',
  false,
  true,
  NULL,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET "isTemplate" = true;

-- Attach the BUSINESS_OWNER responsibility set (= OUTLET_FULL + business-scoped extras).
INSERT INTO "role_responsibilities" ("roleId", "responsibilityId")
SELECT 'business-owner-template', r."id"
FROM "responsibilities" r
WHERE r."name" IN (
  'VIEW_BUSINESSES', 'VIEW_OUTLETS', 'MANAGE_OUTLETS', 'MANAGE_OUTLET_IMAGES', 'MANAGE_OUTLET_HOURS',
  'MANAGE_SECTIONS', 'MANAGE_TABLES', 'MANAGE_TABLE_TYPES',
  'VIEW_MENU', 'MANAGE_MENU', 'MANAGE_MENU_ITEMS', 'TOGGLE_ITEM_AVAILABILITY', 'IMPORT_MENU', 'MANAGE_TOPPINGS',
  'VIEW_ORDERS', 'CREATE_ORDER', 'UPDATE_ORDER_STATUS', 'CANCEL_ORDER', 'UPDATE_ITEM_STATUS',
  'COLLECT_PAYMENT', 'VIEW_PAYMENTS',
  'VIEW_KITCHEN', 'MANAGE_KITCHEN_STATIONS',
  'VIEW_INVENTORY', 'MANAGE_INVENTORY', 'MANAGE_PURCHASE_ORDERS', 'VIEW_VENDORS', 'MANAGE_VENDORS',
  'VIEW_REPORTS', 'VIEW_KITCHEN_REPORTS',
  'VIEW_STAFF', 'MANAGE_STAFF', 'MANAGE_ROLES',
  'VIEW_CUSTOMERS', 'MANAGE_CUSTOMERS', 'MANAGE_CUSTOMER_TAGS', 'ASSIGN_CUSTOMER_TAGS',
  'VIEW_QR_CODES', 'MANAGE_QR_CODES',
  'VIEW_DISPUTES', 'MANAGE_DISPUTES',
  'VIEW_INVOICES',
  'MANAGE_BUSINESSES', 'MANAGE_BUSINESS_IMAGES', 'MANAGE_SUBSCRIPTIONS'
)
ON CONFLICT DO NOTHING;

-- Backfill: copy the template's responsibilities into every existing per-business
-- Business Owner role. Cascade semantics — existing tenants are aligned to the template
-- as of this migration (any prior customization is overwritten by design).
DELETE FROM "role_responsibilities"
WHERE "roleId" IN (
  SELECT "id" FROM "roles"
  WHERE "name" = 'Business Owner'
    AND "businessId" IS NOT NULL
    AND "isTemplate" = false
);

INSERT INTO "role_responsibilities" ("roleId", "responsibilityId")
SELECT r."id", tr."responsibilityId"
FROM "roles" r
JOIN "role_responsibilities" tr ON tr."roleId" = 'business-owner-template'
WHERE r."name" = 'Business Owner'
  AND r."businessId" IS NOT NULL
  AND r."isTemplate" = false
ON CONFLICT DO NOTHING;
