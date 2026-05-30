-- AlterTable
ALTER TABLE `paynpik_kitchen_stations` ADD COLUMN `printerId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `paynpik_outlets` ADD COLUMN `kitchenAllowManualPrint` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `kitchenAutoPrint` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `paynpik_printers` (
    `id` VARCHAR(191) NOT NULL,
    `outletId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `connection` VARCHAR(20) NOT NULL DEFAULT 'BLUETOOTH',
    `address` VARCHAR(128) NULL,
    `model` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `paynpik_printers_outletId_idx`(`outletId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `paynpik_kitchen_stations` ADD CONSTRAINT `paynpik_kitchen_stations_printerId_fkey` FOREIGN KEY (`printerId`) REFERENCES `paynpik_printers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_printers` ADD CONSTRAINT `paynpik_printers_outletId_fkey` FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
