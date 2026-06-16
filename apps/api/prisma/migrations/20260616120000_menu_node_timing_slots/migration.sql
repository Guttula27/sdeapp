-- Per-day availability slots at the category, subcategory, and item
-- levels. Same shape as paynpik_menu_timing_slots: dayOfWeek 1=Mon..7=Sun,
-- minutes-since-midnight 0..1440, multiple rows per (parent, dayOfWeek)
-- allowed for split shifts. Absent rows = no constraint at this level;
-- cascade evaluation (outlet → menu → category → sub → item) runs in
-- menu.service.getMenu.
--
-- Hand-rolled to match the prod schema produced by prisma migrate dev
-- against the dev DB. Online-safe: pure CREATE TABLE + CREATE INDEX +
-- ADD CONSTRAINT — no rewrites of existing tables.

CREATE TABLE `paynpik_category_timing_slots` (
    `id` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `startMinute` INTEGER NOT NULL,
    `endMinute` INTEGER NOT NULL,

    INDEX `paynpik_category_timing_slots_categoryId_dayOfWeek_idx`(`categoryId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `paynpik_subcategory_timing_slots` (
    `id` VARCHAR(191) NOT NULL,
    `subcategoryId` VARCHAR(191) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `startMinute` INTEGER NOT NULL,
    `endMinute` INTEGER NOT NULL,

    INDEX `paynpik_subcategory_timing_slots_subcategoryId_dayOfWeek_idx`(`subcategoryId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `paynpik_item_timing_slots` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `startMinute` INTEGER NOT NULL,
    `endMinute` INTEGER NOT NULL,

    INDEX `paynpik_item_timing_slots_itemId_dayOfWeek_idx`(`itemId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `paynpik_category_timing_slots`
  ADD CONSTRAINT `paynpik_category_timing_slots_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `paynpik_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `paynpik_subcategory_timing_slots`
  ADD CONSTRAINT `paynpik_subcategory_timing_slots_subcategoryId_fkey`
  FOREIGN KEY (`subcategoryId`) REFERENCES `paynpik_subcategories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `paynpik_item_timing_slots`
  ADD CONSTRAINT `paynpik_item_timing_slots_itemId_fkey`
  FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
