-- Pay-later dues for tagged customers (typically employees getting
-- the amount deducted from salary). Forward-only, defaults make all
-- existing tags non-pay-later and the new ledger tables are empty —
-- so the rollout doesn't touch any existing flow until an admin
-- explicitly flips a tag's allowPayLater toggle.

-- 1) CustomerTag: pay-later flag + optional per-tag ceiling.
ALTER TABLE `paynpik_customer_tags`
  ADD COLUMN `allowPayLater` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `maxDueAmount`  DECIMAL(10, 2) NULL;

-- 2) Dues ledger — DEBIT (pay-later order) + CREDIT (settlement)
--    rows. Running balance = SUM(DEBIT) - SUM(CREDIT) over
--    voidedAt IS NULL.
CREATE TABLE `paynpik_customer_dues_ledger` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `businessId` VARCHAR(191) NOT NULL,
  `outletId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(10) NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `orderId` VARCHAR(191) NULL,
  `settlementId` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `voidedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `paynpik_customer_dues_ledger_userId_outletId_idx`(`userId`, `outletId`),
  INDEX `paynpik_customer_dues_ledger_outletId_createdAt_idx`(`outletId`, `createdAt`),
  INDEX `paynpik_customer_dues_ledger_orderId_idx`(`orderId`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3) Settlement parent — one row per "customer paid X". The CREDIT
--    ledger row(s) point back at it. paymentMode is a free-form
--    VARCHAR (not the PaymentMode enum) so OTHER / salary-deduct
--    settlements are first-class.
CREATE TABLE `paynpik_customer_dues_settlements` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `businessId` VARCHAR(191) NOT NULL,
  `outletId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `paymentMode` VARCHAR(20) NOT NULL,
  `reference` VARCHAR(120) NULL,
  `notes` TEXT NULL,
  `settledBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `paynpik_customer_dues_settlements_userId_outletId_idx`(`userId`, `outletId`),
  INDEX `paynpik_customer_dues_settlements_outletId_createdAt_idx`(`outletId`, `createdAt`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- FK wiring — onDelete CASCADE on the parent rels so a deleted user /
-- outlet / business takes its ledger trail with it. The order FK on
-- a DEBIT row is NOT cascaded (an order can be deleted? no — but the
-- void hook flips voidedAt, doesn't delete).
ALTER TABLE `paynpik_customer_dues_ledger`
  ADD CONSTRAINT `paynpik_customer_dues_ledger_userId_fkey`
    FOREIGN KEY (`userId`)     REFERENCES `paynpik_users`(`id`)      ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `paynpik_customer_dues_ledger_businessId_fkey`
    FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `paynpik_customer_dues_ledger_outletId_fkey`
    FOREIGN KEY (`outletId`)   REFERENCES `paynpik_outlets`(`id`)    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `paynpik_customer_dues_ledger_orderId_fkey`
    FOREIGN KEY (`orderId`)    REFERENCES `paynpik_orders`(`id`)     ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `paynpik_customer_dues_ledger_settlementId_fkey`
    FOREIGN KEY (`settlementId`) REFERENCES `paynpik_customer_dues_settlements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `paynpik_customer_dues_settlements`
  ADD CONSTRAINT `paynpik_customer_dues_settlements_userId_fkey`
    FOREIGN KEY (`userId`)     REFERENCES `paynpik_users`(`id`)      ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `paynpik_customer_dues_settlements_businessId_fkey`
    FOREIGN KEY (`businessId`) REFERENCES `paynpik_businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `paynpik_customer_dues_settlements_outletId_fkey`
    FOREIGN KEY (`outletId`)   REFERENCES `paynpik_outlets`(`id`)    ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Permission catalogue: SETTLE_CUSTOMER_DUES.
--    Idempotent so reapply (in dev) doesn't double-insert. Schema's
--    Responsibility model has just (id, name, description, module).
INSERT INTO `paynpik_responsibilities` (`id`, `name`, `module`, `description`)
SELECT
  CONCAT('seed-settle-dues-', UNIX_TIMESTAMP()),
  'SETTLE_CUSTOMER_DUES',
  'PAYMENTS',
  'Settle customer dues (pay-later balances) — cash / UPI / Razorpay / other'
WHERE NOT EXISTS (
  SELECT 1 FROM `paynpik_responsibilities` WHERE `name` = 'SETTLE_CUSTOMER_DUES'
);
