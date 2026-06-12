-- Item-level quantity-unit flag + per-variant numeric size. Both
-- nullable so every existing item / variant keeps the legacy
-- count-based behaviour. The customer + admin UIs read
-- quantityUnit IS NULL as "NUMBER" and skip the unit suffix.
ALTER TABLE `paynpik_items`
  ADD COLUMN `quantityUnit` ENUM('NUMBER', 'GRAMS', 'MILLILITERS') NULL;

ALTER TABLE `paynpik_variants`
  ADD COLUMN `unitQuantity` INT NULL;
