-- AlterTable
ALTER TABLE `paynpik_order_items` ADD COLUMN `sequenceNumber` INTEGER NULL;

-- AlterTable
ALTER TABLE `paynpik_orders` ADD COLUMN `activeSequence` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `sequenceLabels` JSON NULL;
