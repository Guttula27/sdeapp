-- Refund workflow table. Drives the initiate → approve → complete
-- pipeline and serves as the audit trail. Settlement-side bookkeeping
-- still happens against paynpik_payments (a Payment row with
-- isRefund=true is minted on completion so reports and the Z report
-- stay correct).

CREATE TABLE `paynpik_refunds` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `paymentId` VARCHAR(191) NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `mode` ENUM('UPI', 'CARD', 'CASH', 'WALLET', 'NET_BANKING') NOT NULL,
  `reason` TEXT NULL,
  `status` ENUM('INITIATED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'INITIATED',
  `gatewayRef` TEXT NULL,
  `gatewayResponse` JSON NULL,
  `initiatedById` VARCHAR(191) NOT NULL,
  `approvedById` VARCHAR(191) NULL,
  `cashierShiftId` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `approvedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `paynpik_refunds_orderId_idx`(`orderId`),
  INDEX `paynpik_refunds_status_idx`(`status`),
  INDEX `paynpik_refunds_cashierShiftId_idx`(`cashierShiftId`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `paynpik_refunds`
  ADD CONSTRAINT `paynpik_refunds_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `paynpik_refunds`
  ADD CONSTRAINT `paynpik_refunds_paymentId_fkey`
  FOREIGN KEY (`paymentId`) REFERENCES `paynpik_payments`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `paynpik_refunds`
  ADD CONSTRAINT `paynpik_refunds_initiatedById_fkey`
  FOREIGN KEY (`initiatedById`) REFERENCES `paynpik_users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `paynpik_refunds`
  ADD CONSTRAINT `paynpik_refunds_approvedById_fkey`
  FOREIGN KEY (`approvedById`) REFERENCES `paynpik_users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `paynpik_refunds`
  ADD CONSTRAINT `paynpik_refunds_cashierShiftId_fkey`
  FOREIGN KEY (`cashierShiftId`) REFERENCES `paynpik_cashier_shifts`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
