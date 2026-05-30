/*
  Warnings:

  - You are about to drop the `paynpik_bundle_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `paynpik_bundles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `paynpik_bundle_items` DROP FOREIGN KEY `paynpik_bundle_items_bundleId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_bundle_items` DROP FOREIGN KEY `paynpik_bundle_items_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_bundle_items` DROP FOREIGN KEY `paynpik_bundle_items_variantId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_bundles` DROP FOREIGN KEY `paynpik_bundles_businessId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_bundles` DROP FOREIGN KEY `paynpik_bundles_outletId_fkey`;

-- DropForeignKey
ALTER TABLE `paynpik_order_items` DROP FOREIGN KEY `paynpik_order_items_bundleId_fkey`;

-- AlterTable
ALTER TABLE `paynpik_items` ADD COLUMN `isBundle` BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE `paynpik_bundle_items`;

-- DropTable
DROP TABLE `paynpik_bundles`;

-- CreateTable
CREATE TABLE `paynpik_item_bundle_children` (
    `id` VARCHAR(191) NOT NULL,
    `parentItemId` VARCHAR(191) NOT NULL,
    `childItemId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `paynpik_item_bundle_children_parentItemId_idx`(`parentItemId`),
    INDEX `paynpik_item_bundle_children_childItemId_idx`(`childItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `paynpik_order_items` ADD CONSTRAINT `paynpik_order_items_bundleId_fkey` FOREIGN KEY (`bundleId`) REFERENCES `paynpik_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_item_bundle_children` ADD CONSTRAINT `paynpik_item_bundle_children_parentItemId_fkey` FOREIGN KEY (`parentItemId`) REFERENCES `paynpik_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_item_bundle_children` ADD CONSTRAINT `paynpik_item_bundle_children_childItemId_fkey` FOREIGN KEY (`childItemId`) REFERENCES `paynpik_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_item_bundle_children` ADD CONSTRAINT `paynpik_item_bundle_children_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `paynpik_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
