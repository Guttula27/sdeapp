-- CreateTable
CREATE TABLE `paynpik_table_type_menus` (
    `id` VARCHAR(191) NOT NULL,
    `tableTypeId` VARCHAR(191) NOT NULL,
    `menuId` VARCHAR(191) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `paynpik_table_type_menus_menuId_idx`(`menuId`),
    UNIQUE INDEX `paynpik_table_type_menus_tableTypeId_menuId_key`(`tableTypeId`, `menuId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `paynpik_table_type_menus` ADD CONSTRAINT `paynpik_table_type_menus_tableTypeId_fkey` FOREIGN KEY (`tableTypeId`) REFERENCES `paynpik_table_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paynpik_table_type_menus` ADD CONSTRAINT `paynpik_table_type_menus_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `paynpik_menus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Data backfill ─────────────────────────────────────────────
-- Create one (TableType × Menu) link with isEnabled=true for every existing
-- table-type and every menu in that table-type's outlet's business.
-- Preserves current behavior: nothing is hidden until an admin disables it.
INSERT INTO `paynpik_table_type_menus`
    (`id`, `tableTypeId`, `menuId`, `isEnabled`, `createdAt`, `updatedAt`)
SELECT CONCAT('ttm_', tt.`id`, '_', m.`id`), tt.`id`, m.`id`, 1, NOW(3), NOW(3)
FROM `paynpik_table_types` tt
JOIN `paynpik_outlets` o ON o.`id` = tt.`outletId`
JOIN `paynpik_menus` m   ON m.`businessId` = o.`businessId`
WHERE NOT EXISTS (
    SELECT 1 FROM `paynpik_table_type_menus` ttm
    WHERE ttm.`tableTypeId` = tt.`id` AND ttm.`menuId` = m.`id`
);
