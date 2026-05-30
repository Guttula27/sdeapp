-- AlterTable
ALTER TABLE `paynpik_order_items` ADD COLUMN `bundleId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `paynpik_order_items_bundleId_idx` ON `paynpik_order_items`(`bundleId`);

-- AddForeignKey
ALTER TABLE `paynpik_order_items` ADD CONSTRAINT `paynpik_order_items_bundleId_fkey` FOREIGN KEY (`bundleId`) REFERENCES `paynpik_bundles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
