-- ALLOWANCE coupon kind — see docs/coupon-allowance-design.md.
-- Forward-only, backward-compatible: defaults make existing rows
-- behave as STANDARD coupons without backfill. Old API binaries
-- ignore the new columns.

-- 1) Coupon: new fields. Defaults handle the rollback / mixed-version
--    window — every existing row reads as kind='STANDARD' with NULL
--    period + quota, which is exactly the legacy behaviour.
ALTER TABLE `paynpik_coupons`
  ADD COLUMN `kind` VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN `resetPeriod` VARCHAR(10) NULL,
  ADD COLUMN `perPeriodQuota` INT NULL;

-- 2) CouponUsage: quota accounting + void/refund hook. itemUnits
--    defaults to 0 so legacy redemptions don't pollute the
--    period-consumed sum for a coupon later flipped to ALLOWANCE.
ALTER TABLE `paynpik_coupon_usages`
  ADD COLUMN `itemUnits` INT NOT NULL DEFAULT 0,
  ADD COLUMN `voidedAt` DATETIME(3) NULL;

-- Period-consumed sum: WHERE couponId=? AND userId=? AND appliedAt >= ?.
CREATE INDEX `paynpik_coupon_usages_couponId_userId_appliedAt_idx`
  ON `paynpik_coupon_usages`(`couponId`, `userId`, `appliedAt`);

-- 3) ALLOWANCE scope rows. Polymorphic refId pointing at Item /
--    Category / Subcategory, validated at the service layer (matches
--    Discount/Offer's pattern — see Discount.targetType).
CREATE TABLE `paynpik_coupon_scopes` (
  `id` VARCHAR(191) NOT NULL,
  `couponId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(20) NOT NULL,
  `refId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `paynpik_coupon_scopes_couponId_kind_refId_key`(`couponId`, `kind`, `refId`),
  INDEX `paynpik_coupon_scopes_kind_refId_idx`(`kind`, `refId`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `paynpik_coupon_scopes`
  ADD CONSTRAINT `paynpik_coupon_scopes_couponId_fkey`
  FOREIGN KEY (`couponId`) REFERENCES `paynpik_coupons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) TAG targeting. Coupons of any kind can use TAG; service layer
--    enforces that the coupon is outlet-scoped and that the chosen
--    tag belongs to the same outlet.
CREATE TABLE `paynpik_coupon_target_tags` (
  `id` VARCHAR(191) NOT NULL,
  `couponId` VARCHAR(191) NOT NULL,
  `customerTagId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `paynpik_coupon_target_tags_couponId_customerTagId_key`(`couponId`, `customerTagId`),
  INDEX `paynpik_coupon_target_tags_customerTagId_idx`(`customerTagId`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `paynpik_coupon_target_tags`
  ADD CONSTRAINT `paynpik_coupon_target_tags_couponId_fkey`
  FOREIGN KEY (`couponId`) REFERENCES `paynpik_coupons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `paynpik_coupon_target_tags`
  ADD CONSTRAINT `paynpik_coupon_target_tags_customerTagId_fkey`
  FOREIGN KEY (`customerTagId`) REFERENCES `paynpik_customer_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
