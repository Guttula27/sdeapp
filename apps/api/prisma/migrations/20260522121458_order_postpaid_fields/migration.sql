-- AlterTable
ALTER TABLE `orders` ADD COLUMN `billRequestedAt` DATETIME(3) NULL,
    ADD COLUMN `isPostpaid` BOOLEAN NOT NULL DEFAULT false;
