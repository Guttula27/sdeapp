-- Snapshot the item / variant name on every OrderItem so historical
-- receipts keep printing what the customer actually ordered even after
-- the item is renamed or deleted.
ALTER TABLE `paynpik_order_items`
  ADD COLUMN `itemNameSnapshot`    VARCHAR(255) NULL,
  ADD COLUMN `variantNameSnapshot` VARCHAR(255) NULL;

-- Snapshot the outlet's receipt-header fields on every Order. JSON keeps
-- the shape extensible (we can add e.g. licenseNumber later without
-- another migration). Receipt code falls back to the live outlet
-- relation when this column is NULL (legacy rows).
ALTER TABLE `paynpik_orders` ADD COLUMN `outletSnapshot` JSON NULL;
