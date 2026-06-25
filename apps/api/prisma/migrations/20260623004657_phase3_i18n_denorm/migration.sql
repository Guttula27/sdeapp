-- Phase 3 of docs/performance-hardening-plan.md.
-- Adds per-business language config (primaryLanguage, eagerLanguages) +
-- per-entity JSON columns that hold translations for every previously
-- registered translatable field. Backfills the new columns from the
-- existing paynpik_translations rows so the read path can switch over
-- immediately. The legacy table stays as fallback / audit; a later
-- migration will drop it once dual-write has soaked.

-- ─── Schema: Business ─────────────────────────────────────────────
ALTER TABLE `paynpik_businesses`
  ADD COLUMN `primaryLanguage`     VARCHAR(8) NULL DEFAULT 'en',
  ADD COLUMN `eagerLanguages`      JSON       NULL,
  ADD COLUMN `name_i18n`           JSON       NULL,
  ADD COLUMN `description_i18n`    JSON       NULL,
  ADD COLUMN `address_i18n`        JSON       NULL,
  ADD COLUMN `addressLine1_i18n`   JSON       NULL,
  ADD COLUMN `addressLine2_i18n`   JSON       NULL;

-- ─── Schema: Outlet ───────────────────────────────────────────────
ALTER TABLE `paynpik_outlets`
  ADD COLUMN `name_i18n`           JSON NULL,
  ADD COLUMN `description_i18n`    JSON NULL,
  ADD COLUMN `address_i18n`        JSON NULL,
  ADD COLUMN `addressLine1_i18n`   JSON NULL,
  ADD COLUMN `addressLine2_i18n`   JSON NULL;

-- ─── Schema: Category / Subcategory ───────────────────────────────
ALTER TABLE `paynpik_categories`
  ADD COLUMN `name_i18n` JSON NULL;

ALTER TABLE `paynpik_subcategories`
  ADD COLUMN `name_i18n` JSON NULL;

-- ─── Schema: Item / Variant ───────────────────────────────────────
ALTER TABLE `paynpik_items`
  ADD COLUMN `name_i18n`             JSON NULL,
  ADD COLUMN `description_i18n`      JSON NULL,
  ADD COLUMN `shortDescription_i18n` JSON NULL;

ALTER TABLE `paynpik_variants`
  ADD COLUMN `name_i18n`             JSON NULL,
  ADD COLUMN `shortDescription_i18n` JSON NULL;

-- ─── Schema: Topping / ToppingOption / CustomerTag / Dispute ──────
ALTER TABLE `paynpik_toppings`
  ADD COLUMN `name_i18n` JSON NULL;

ALTER TABLE `paynpik_topping_options`
  ADD COLUMN `name_i18n` JSON NULL;

ALTER TABLE `paynpik_customer_tags`
  ADD COLUMN `name_i18n` JSON NULL;

ALTER TABLE `paynpik_disputes`
  ADD COLUMN `description_i18n` JSON NULL;

-- ─── Backfill: collapse paynpik_translations into the new cells ───
-- For each (entityType, entityId, fieldName) tuple, build a JSON map
-- of { languageCode: value } and write it into the corresponding
-- per-row JSON column. Each UPDATE is one statement per entity-field
-- pair — explicit so the column names stay readable.

UPDATE `paynpik_businesses` t
SET t.`name_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Business' AND tr.entityId=t.id AND tr.fieldName='name'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Business' AND tr.entityId=t.id AND tr.fieldName='name'
);

UPDATE `paynpik_businesses` t
SET t.`description_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Business' AND tr.entityId=t.id AND tr.fieldName='description'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Business' AND tr.entityId=t.id AND tr.fieldName='description'
);

UPDATE `paynpik_businesses` t
SET t.`address_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Business' AND tr.entityId=t.id AND tr.fieldName='address'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Business' AND tr.entityId=t.id AND tr.fieldName='address'
);

UPDATE `paynpik_businesses` t
SET t.`addressLine1_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Business' AND tr.entityId=t.id AND tr.fieldName='addressLine1'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Business' AND tr.entityId=t.id AND tr.fieldName='addressLine1'
);

UPDATE `paynpik_businesses` t
SET t.`addressLine2_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Business' AND tr.entityId=t.id AND tr.fieldName='addressLine2'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Business' AND tr.entityId=t.id AND tr.fieldName='addressLine2'
);

-- Outlet (same five fields)
UPDATE `paynpik_outlets` t
SET t.`name_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Outlet' AND tr.entityId=t.id AND tr.fieldName='name'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Outlet' AND tr.entityId=t.id AND tr.fieldName='name'
);
UPDATE `paynpik_outlets` t
SET t.`description_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Outlet' AND tr.entityId=t.id AND tr.fieldName='description'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Outlet' AND tr.entityId=t.id AND tr.fieldName='description'
);
UPDATE `paynpik_outlets` t
SET t.`address_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Outlet' AND tr.entityId=t.id AND tr.fieldName='address'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Outlet' AND tr.entityId=t.id AND tr.fieldName='address'
);
UPDATE `paynpik_outlets` t
SET t.`addressLine1_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Outlet' AND tr.entityId=t.id AND tr.fieldName='addressLine1'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Outlet' AND tr.entityId=t.id AND tr.fieldName='addressLine1'
);
UPDATE `paynpik_outlets` t
SET t.`addressLine2_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Outlet' AND tr.entityId=t.id AND tr.fieldName='addressLine2'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Outlet' AND tr.entityId=t.id AND tr.fieldName='addressLine2'
);

-- Category / Subcategory (name only)
UPDATE `paynpik_categories` t
SET t.`name_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Category' AND tr.entityId=t.id AND tr.fieldName='name'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Category' AND tr.entityId=t.id AND tr.fieldName='name'
);
UPDATE `paynpik_subcategories` t
SET t.`name_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Subcategory' AND tr.entityId=t.id AND tr.fieldName='name'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Subcategory' AND tr.entityId=t.id AND tr.fieldName='name'
);

-- Item (name, description, shortDescription)
UPDATE `paynpik_items` t
SET t.`name_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Item' AND tr.entityId=t.id AND tr.fieldName='name'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Item' AND tr.entityId=t.id AND tr.fieldName='name'
);
UPDATE `paynpik_items` t
SET t.`description_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Item' AND tr.entityId=t.id AND tr.fieldName='description'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Item' AND tr.entityId=t.id AND tr.fieldName='description'
);
UPDATE `paynpik_items` t
SET t.`shortDescription_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Item' AND tr.entityId=t.id AND tr.fieldName='shortDescription'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Item' AND tr.entityId=t.id AND tr.fieldName='shortDescription'
);

-- Variant (name)
UPDATE `paynpik_variants` t
SET t.`name_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Variant' AND tr.entityId=t.id AND tr.fieldName='name'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Variant' AND tr.entityId=t.id AND tr.fieldName='name'
);

-- Topping / ToppingOption / CustomerTag / Dispute
UPDATE `paynpik_toppings` t
SET t.`name_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Topping' AND tr.entityId=t.id AND tr.fieldName='name'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Topping' AND tr.entityId=t.id AND tr.fieldName='name'
);
UPDATE `paynpik_topping_options` t
SET t.`name_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='ToppingOption' AND tr.entityId=t.id AND tr.fieldName='name'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='ToppingOption' AND tr.entityId=t.id AND tr.fieldName='name'
);
UPDATE `paynpik_customer_tags` t
SET t.`name_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='CustomerTag' AND tr.entityId=t.id AND tr.fieldName='name'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='CustomerTag' AND tr.entityId=t.id AND tr.fieldName='name'
);
UPDATE `paynpik_disputes` t
SET t.`description_i18n` = (
  SELECT JSON_OBJECTAGG(tr.languageCode, tr.value)
  FROM `paynpik_translations` tr
  WHERE tr.entityType='Dispute' AND tr.entityId=t.id AND tr.fieldName='description'
)
WHERE EXISTS (
  SELECT 1 FROM `paynpik_translations` tr
  WHERE tr.entityType='Dispute' AND tr.entityId=t.id AND tr.fieldName='description'
);
