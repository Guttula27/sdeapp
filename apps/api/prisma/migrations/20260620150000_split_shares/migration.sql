-- Split-bill shares — each row is one diner's sub-bill of a parent Order.
-- Operator creates N rows via the OrdersPage split modal, WhatsApp fires
-- to each diner's phone, diner pays through the existing customer PWA
-- payment page. On payment, Payment.splitShareId points at the share row
-- and Order's denormalised splitPaidShares / splitPaidAmount counters
-- bump in the same transaction.
--
-- All identifier names kept under MySQL's 64-char cap (last time we tripped
-- on this; lesson learned).

CREATE TABLE `paynpik_split_shares` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `customerPhone` VARCHAR(191) NOT NULL,
  `customerName` VARCHAR(191) NULL,
  `customerId` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'SENT', 'VIEWED', 'PAID', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
  `paymentId` VARCHAR(191) NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `sentAt` DATETIME(3) NULL,
  `viewedAt` DATETIME(3) NULL,
  `paidAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `paynpik_split_shares_paymentId_key`(`paymentId`),
  INDEX `paynpik_split_shares_orderId_idx`(`orderId`),
  INDEX `paynpik_split_shares_phone_idx`(`customerPhone`),
  INDEX `paynpik_split_shares_customerId_idx`(`customerId`),
  INDEX `paynpik_split_shares_status_idx`(`status`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Denormalised counters on the parent Order. Existing rows default to 0
-- — those aren't split bills.
ALTER TABLE `paynpik_orders`
  ADD COLUMN `splitTotalShares` INT NOT NULL DEFAULT 0,
  ADD COLUMN `splitPaidShares`  INT NOT NULL DEFAULT 0,
  ADD COLUMN `splitPaidAmount`  DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- Reverse FK from Payment to the share it settles. Nullable so direct
-- (non-split) payments stay clean.
ALTER TABLE `paynpik_payments`
  ADD COLUMN `splitShareId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `paynpik_payments_splitShareId_key`(`splitShareId`);

-- Foreign keys.
ALTER TABLE `paynpik_split_shares`
  ADD CONSTRAINT `paynpik_split_shares_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `paynpik_split_shares`
  ADD CONSTRAINT `paynpik_split_shares_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `paynpik_users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `paynpik_split_shares`
  ADD CONSTRAINT `paynpik_split_shares_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `paynpik_users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `paynpik_split_shares`
  ADD CONSTRAINT `paynpik_split_shares_paymentId_fkey`
  FOREIGN KEY (`paymentId`) REFERENCES `paynpik_payments`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `paynpik_payments`
  ADD CONSTRAINT `paynpik_payments_splitShareId_fkey`
  FOREIGN KEY (`splitShareId`) REFERENCES `paynpik_split_shares`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
