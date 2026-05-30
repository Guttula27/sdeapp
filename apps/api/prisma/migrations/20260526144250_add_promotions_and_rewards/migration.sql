/*
  Warnings:

  - You are about to drop the column `couponCode` on the `paynpik_offers` table. All the data in the column will be lost.
  - You are about to drop the column `maxDiscount` on the `paynpik_offers` table. All the data in the column will be lost.
  - You are about to drop the column `minOrderValue` on the `paynpik_offers` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `paynpik_offers` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `paynpik_offers` table. All the data in the column will be lost.
  - Added the required column `businessId` to the `paynpik_offers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `triggerType` to the `paynpik_offers` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `paynpik_offers_couponCode_key` ON `paynpik_offers`;

-- AlterTable
ALTER TABLE `paynpik_offers` DROP COLUMN `couponCode`,
    DROP COLUMN `maxDiscount`,
    DROP COLUMN `minOrderValue`,
    DROP COLUMN `type`,
    DROP COLUMN `value`,
    ADD COLUMN `businessId` VARCHAR(191) NOT NULL,
    ADD COLUMN `buyItemId` VARCHAR(191) NULL,
    ADD COLUMN `buyQuantity` INTEGER NULL,
    ADD COLUMN `buyVariantId` VARCHAR(191) NULL,
    ADD COLUMN `daysOfWeek` VARCHAR(20) NULL,
    ADD COLUMN `endMinute` INTEGER NULL,
    ADD COLUMN `getItemId` VARCHAR(191) NULL,
    ADD COLUMN `getQuantity` INTEGER NULL,
    ADD COLUMN `getVariantId` VARCHAR(191) NULL,
    ADD COLUMN `minBillAmount` DECIMAL(10, 2) NULL,
    ADD COLUMN `startMinute` INTEGER NULL,
    ADD COLUMN `triggerType` VARCHAR(20) NOT NULL,
    MODIFY `validFrom` DATETIME(3) NULL,
    MODIFY `validUntil` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `paynpik_outlets` ADD COLUMN `acceptRewardRedemption` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `paynpik_coupons` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `outletId` VARCHAR(191) NULL,
    `discountType` VARCHAR(10) NOT NULL,
    `discountValue` DECIMAL(10, 2) NOT NULL,
    `minBillAmount` DECIMAL(10, 2) NULL,
    `maxDiscountAmount` DECIMAL(10, 2) NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `maxUsesPerCustomer` INTEGER NOT NULL DEFAULT 1,
    `maxTotalUses` INTEGER NULL,
    `usesCount` INTEGER NOT NULL DEFAULT 0,
    `targetType` VARCHAR(10) NOT NULL DEFAULT 'ALL',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `paynpik_coupons_businessId_idx`(`businessId`),
    INDEX `paynpik_coupons_outletId_idx`(`outletId`),
    INDEX `paynpik_coupons_code_idx`(`code`),
    INDEX `paynpik_coupons_isActive_validFrom_validUntil_idx`(`isActive`, `validFrom`, `validUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paynpik_coupon_customers` (
    `id` VARCHAR(191) NOT NULL,
    `couponId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `paynpik_coupon_customers_userId_idx`(`userId`),
    UNIQUE INDEX `paynpik_coupon_customers_couponId_userId_key`(`couponId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paynpik_coupon_usages` (
    `id` VARCHAR(191) NOT NULL,
    `couponId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `clusterOrderId` VARCHAR(191) NULL,
    `discountAmount` DECIMAL(10, 2) NOT NULL,
    `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `paynpik_coupon_usages_couponId_idx`(`couponId`),
    INDEX `paynpik_coupon_usages_userId_idx`(`userId`),
    INDEX `paynpik_coupon_usages_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paynpik_discounts` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `outletId` VARCHAR(191) NULL,
    `targetType` VARCHAR(20) NOT NULL,
    `categoryId` VARCHAR(191) NULL,
    `subcategoryId` VARCHAR(191) NULL,
    `itemId` VARCHAR(191) NULL,
    `discountType` VARCHAR(10) NOT NULL,
    `discountValue` DECIMAL(10, 2) NOT NULL,
    `minBillAmount` DECIMAL(10, 2) NULL,
    `maxDiscountAmount` DECIMAL(10, 2) NULL,
    `validFrom` DATETIME(3) NULL,
    `validUntil` DATETIME(3) NULL,
    `daysOfWeek` VARCHAR(20) NULL,
    `startMinute` INTEGER NULL,
    `endMinute` INTEGER NULL,
    `isManualOnly` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `paynpik_discounts_businessId_idx`(`businessId`),
    INDEX `paynpik_discounts_outletId_idx`(`outletId`),
    INDEX `paynpik_discounts_targetType_idx`(`targetType`),
    INDEX `paynpik_discounts_categoryId_idx`(`categoryId`),
    INDEX `paynpik_discounts_subcategoryId_idx`(`subcategoryId`),
    INDEX `paynpik_discounts_itemId_idx`(`itemId`),
    INDEX `paynpik_discounts_isActive_validFrom_validUntil_idx`(`isActive`, `validFrom`, `validUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paynpik_bundles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `imageUrl` TEXT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `outletId` VARCHAR(191) NULL,
    `foodGrade` ENUM('VEG', 'NON_VEG', 'VEGAN') NOT NULL DEFAULT 'VEG',
    `gstRate` DECIMAL(5, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDisplayed` BOOLEAN NOT NULL DEFAULT true,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `paynpik_bundles_businessId_idx`(`businessId`),
    INDEX `paynpik_bundles_outletId_idx`(`outletId`),
    INDEX `paynpik_bundles_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paynpik_bundle_items` (
    `id` VARCHAR(191) NOT NULL,
    `bundleId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    INDEX `paynpik_bundle_items_bundleId_idx`(`bundleId`),
    INDEX `paynpik_bundle_items_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paynpik_reward_config` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `earnRate` DECIMAL(8, 4) NOT NULL DEFAULT 0.1,
    `redeemRate` DECIMAL(8, 4) NOT NULL DEFAULT 1,
    `minRedemptionPoints` INTEGER NOT NULL DEFAULT 50,
    `maxRedemptionPercent` DECIMAL(5, 2) NOT NULL DEFAULT 50,
    `expiryDays` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paynpik_reward_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `balance` INTEGER NOT NULL DEFAULT 0,
    `lifetimeEarned` INTEGER NOT NULL DEFAULT 0,
    `lifetimeRedeemed` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `paynpik_reward_accounts_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paynpik_reward_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(10) NOT NULL,
    `points` INTEGER NOT NULL,
    `amountValue` DECIMAL(10, 2) NULL,
    `balanceAfter` INTEGER NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `clusterOrderId` VARCHAR(191) NULL,
    `outletId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `paynpik_reward_transactions_userId_idx`(`userId`),
    INDEX `paynpik_reward_transactions_accountId_idx`(`accountId`),
    INDEX `paynpik_reward_transactions_orderId_idx`(`orderId`),
    INDEX `paynpik_reward_transactions_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `paynpik_offers_businessId_idx` ON `paynpik_offers`(`businessId`);

-- CreateIndex
CREATE INDEX `paynpik_offers_outletId_idx` ON `paynpik_offers`(`outletId`);

-- CreateIndex
CREATE INDEX `paynpik_offers_isActive_idx` ON `paynpik_offers`(`isActive`);

-- AddForeignKey
ALTER TABLE `paynpik_offers` ADD CONSTRAINT `paynpik_offers_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_offers` ADD CONSTRAINT `paynpik_offers_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_offers` ADD CONSTRAINT `paynpik_offers_buyItemId_fkey` FOREIGN KEY (`buyItemId`) REFERENCES `paynpik_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_offers` ADD CONSTRAINT `paynpik_offers_getItemId_fkey` FOREIGN KEY (`getItemId`) REFERENCES `paynpik_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_coupons` ADD CONSTRAINT `paynpik_coupons_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_coupons` ADD CONSTRAINT `paynpik_coupons_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_coupon_customers` ADD CONSTRAINT `paynpik_coupon_customers_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `paynpik_coupons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_coupon_customers` ADD CONSTRAINT `paynpik_coupon_customers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_coupon_usages` ADD CONSTRAINT `paynpik_coupon_usages_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `paynpik_coupons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_coupon_usages` ADD CONSTRAINT `paynpik_coupon_usages_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_coupon_usages` ADD CONSTRAINT `paynpik_coupon_usages_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_discounts` ADD CONSTRAINT `paynpik_discounts_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_discounts` ADD CONSTRAINT `paynpik_discounts_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_discounts` ADD CONSTRAINT `paynpik_discounts_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `paynpik_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_discounts` ADD CONSTRAINT `paynpik_discounts_subcategoryId_fkey` FOREIGN KEY (`subcategoryId`) REFERENCES `paynpik_subcategories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_discounts` ADD CONSTRAINT `paynpik_discounts_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_bundles` ADD CONSTRAINT `paynpik_bundles_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_bundles` ADD CONSTRAINT `paynpik_bundles_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_bundle_items` ADD CONSTRAINT `paynpik_bundle_items_bundleId_fkey` FOREIGN KEY (`bundleId`) REFERENCES `paynpik_bundles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_bundle_items` ADD CONSTRAINT `paynpik_bundle_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_bundle_items` ADD CONSTRAINT `paynpik_bundle_items_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `paynpik_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_reward_accounts` ADD CONSTRAINT `paynpik_reward_accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_reward_transactions` ADD CONSTRAINT `paynpik_reward_transactions_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `paynpik_reward_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_reward_transactions` ADD CONSTRAINT `paynpik_reward_transactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `paynpik_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `paynpik_cluster_members` RENAME INDEX `paynpik_cluster_members_cluster_displayOrder_idx` TO `paynpik_cluster_members_clusterBusinessId_displayOrder_idx`;
