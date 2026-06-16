-- Widen every base64-data-URL-bearing image column from TEXT (64 KB) to
-- MEDIUMTEXT (16 MB). Phone photos passed through the admin's resize
-- helper still routinely cross 64 KB once base64-expanded, which trips
-- "data too long for column" on the existing TEXT type. MEDIUMTEXT
-- handles anything a sane resize step can produce with room to spare.
-- Item.thumbnailUrl was VARCHAR(191) by Prisma default — same bump.
--
-- All targeted columns are nullable; the widen is a pure superset of the
-- existing storage, so this is online-safe under MySQL's online DDL.

ALTER TABLE `paynpik_users`
  MODIFY `profileImageUrl` MEDIUMTEXT NULL;

ALTER TABLE `paynpik_businesses`
  MODIFY `logoUrl`         MEDIUMTEXT NULL,
  MODIFY `thumbnailUrl`    MEDIUMTEXT NULL,
  MODIFY `primaryImageUrl` MEDIUMTEXT NULL;

ALTER TABLE `paynpik_outlets`
  MODIFY `logoUrl`         MEDIUMTEXT NULL,
  MODIFY `primaryImageUrl` MEDIUMTEXT NULL;

ALTER TABLE `paynpik_qr_codes`
  MODIFY `imageUrl` MEDIUMTEXT NULL;

ALTER TABLE `paynpik_categories`
  MODIFY `imageUrl` MEDIUMTEXT NULL;

ALTER TABLE `paynpik_subcategories`
  MODIFY `imageUrl` MEDIUMTEXT NULL;

ALTER TABLE `paynpik_items`
  MODIFY `thumbnailUrl` MEDIUMTEXT NULL,
  MODIFY `imageUrl`     MEDIUMTEXT NULL;

ALTER TABLE `paynpik_item_images`
  MODIFY `url` MEDIUMTEXT NOT NULL;

ALTER TABLE `paynpik_business_images`
  MODIFY `url` MEDIUMTEXT NOT NULL;

ALTER TABLE `paynpik_outlet_images`
  MODIFY `url` MEDIUMTEXT NOT NULL;
