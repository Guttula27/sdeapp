-- Multi-option freebie pool on Offer. getScope decides how the
-- customer's eligible "get" pool is derived:
--   ALL      → every active item at the outlet
--   CATEGORY → only items in getCategoryId
--   ITEMS    → only items whose id is in getItemIds JSON array
--   NULL     → legacy single-item path (uses getItemId already on the row)
-- Nullable so existing offers keep working without backfill.
ALTER TABLE `paynpik_offers`
  ADD COLUMN `getScope`      VARCHAR(10) NULL,
  ADD COLUMN `getCategoryId` VARCHAR(191) NULL,
  ADD COLUMN `getItemIds`    JSON NULL;

-- FK to Category for CATEGORY-scoped offers. SET NULL on delete so
-- removing a category doesn't cascade-delete the offer; the service
-- layer treats a null pool as "offer misconfigured" and refuses to fire.
ALTER TABLE `paynpik_offers`
  ADD CONSTRAINT `Offer_getCategoryId_fkey`
  FOREIGN KEY (`getCategoryId`) REFERENCES `paynpik_categories`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `Offer_getCategoryId_idx` ON `paynpik_offers`(`getCategoryId`);
