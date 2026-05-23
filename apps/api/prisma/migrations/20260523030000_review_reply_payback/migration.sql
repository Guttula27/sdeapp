-- AlterTable
ALTER TABLE `order_item_reviews` ADD COLUMN `paybackAmount` DECIMAL(10, 2) NULL,
    ADD COLUMN `paybackPaymentId` VARCHAR(191) NULL,
    ADD COLUMN `repliedAt` DATETIME(3) NULL,
    ADD COLUMN `replyByUserId` VARCHAR(191) NULL,
    ADD COLUMN `replyText` TEXT NULL;

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `isRefund` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX `order_item_reviews_paybackPaymentId_key` ON `order_item_reviews`(`paybackPaymentId`);

-- AddForeignKey
ALTER TABLE `order_item_reviews` ADD CONSTRAINT `order_item_reviews_replyByUserId_fkey` FOREIGN KEY (`replyByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_reviews` ADD CONSTRAINT `order_item_reviews_paybackPaymentId_fkey` FOREIGN KEY (`paybackPaymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
