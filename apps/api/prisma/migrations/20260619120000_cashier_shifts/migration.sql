-- End-of-day shift close + Z report foundation.
--
-- Hybrid model: an OutletShift is the per-outlet envelope ("today's
-- session"). Multiple CashierShifts live inside it, one per cashier
-- who opens their drawer during the envelope. Orders + payments
-- carry a cashierShiftId so reports can roll up either at the
-- cashier level (drawer reconciliation) or at the outlet envelope
-- level (end-of-day Z report).
--
-- Both FK columns on Order and Payment are nullable so existing
-- rows aren't affected — they're omitted from new Z reports, which
-- is the correct behaviour (those payments predate shift tracking).

CREATE TABLE `paynpik_outlet_shifts` (
  `id` VARCHAR(191) NOT NULL,
  `outletId` VARCHAR(191) NOT NULL,
  `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `closedAt` DATETIME(3) NULL,
  `openNote` TEXT NULL,
  `closeNote` TEXT NULL,
  `openedByUserId` VARCHAR(191) NOT NULL,
  `closedByUserId` VARCHAR(191) NULL,
  `status` ENUM('ACTIVE', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `paynpik_outlet_shifts_outletId_status_idx`(`outletId`, `status`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `paynpik_cashier_shifts` (
  `id` VARCHAR(191) NOT NULL,
  `outletShiftId` VARCHAR(191) NOT NULL,
  `outletId` VARCHAR(191) NOT NULL,
  `cashierId` VARCHAR(191) NOT NULL,
  `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `closedAt` DATETIME(3) NULL,
  `openingFloat` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `declaredCash` DECIMAL(10, 2) NULL,
  `expectedCash` DECIMAL(10, 2) NULL,
  `variance` DECIMAL(10, 2) NULL,
  `status` ENUM('ACTIVE', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
  `openNote` TEXT NULL,
  `closeNote` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `paynpik_cashier_shifts_cashierId_status_idx`(`cashierId`, `status`),
  INDEX `paynpik_cashier_shifts_outletShiftId_idx`(`outletShiftId`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Stamp orders and payments with the active cashier shift at create /
-- confirm time so the Z report can group by shift cleanly.
ALTER TABLE `paynpik_orders`
  ADD COLUMN `cashierShiftId` VARCHAR(191) NULL;

ALTER TABLE `paynpik_payments`
  ADD COLUMN `cashierShiftId` VARCHAR(191) NULL;

CREATE INDEX `paynpik_payments_cashierShiftId_status_idx`
  ON `paynpik_payments`(`cashierShiftId`, `status`);

-- Foreign keys.
ALTER TABLE `paynpik_outlet_shifts`
  ADD CONSTRAINT `paynpik_outlet_shifts_outletId_fkey`
  FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `paynpik_outlet_shifts`
  ADD CONSTRAINT `paynpik_outlet_shifts_openedByUserId_fkey`
  FOREIGN KEY (`openedByUserId`) REFERENCES `paynpik_users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `paynpik_outlet_shifts`
  ADD CONSTRAINT `paynpik_outlet_shifts_closedByUserId_fkey`
  FOREIGN KEY (`closedByUserId`) REFERENCES `paynpik_users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `paynpik_cashier_shifts`
  ADD CONSTRAINT `paynpik_cashier_shifts_outletShiftId_fkey`
  FOREIGN KEY (`outletShiftId`) REFERENCES `paynpik_outlet_shifts`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `paynpik_cashier_shifts`
  ADD CONSTRAINT `paynpik_cashier_shifts_cashierId_fkey`
  FOREIGN KEY (`cashierId`) REFERENCES `paynpik_users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `paynpik_orders`
  ADD CONSTRAINT `paynpik_orders_cashierShiftId_fkey`
  FOREIGN KEY (`cashierShiftId`) REFERENCES `paynpik_cashier_shifts`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `paynpik_payments`
  ADD CONSTRAINT `paynpik_payments_cashierShiftId_fkey`
  FOREIGN KEY (`cashierShiftId`) REFERENCES `paynpik_cashier_shifts`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
