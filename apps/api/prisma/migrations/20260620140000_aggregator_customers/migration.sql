-- Separate per-marketplace customer table. The User table isn't a good
-- fit because aggregators mask phone numbers — joining direct and
-- marketplace customers by phone would either miss matches or create
-- false ones. The aggregator's stable customer_id (when exposed) is a
-- far better identity anchor.
--
-- Scoped per-outlet so the recognition counters stay local to where
-- the customer orders. A chain customer ordering at three outlets
-- under one Swiggy account gets three rows — correct, because the
-- recognition is "you're a regular HERE", not "you're a regular at
-- the chain".

CREATE TABLE `paynpik_aggregator_customers` (
  `id` VARCHAR(191) NOT NULL,
  `outletId` VARCHAR(191) NOT NULL,
  `channel` ENUM('DIRECT', 'ZOMATO', 'SWIGGY', 'UBER_EATS') NOT NULL,
  `externalCustomerId` VARCHAR(191) NOT NULL,
  `displayName` VARCHAR(191) NULL,
  `maskedPhone` VARCHAR(191) NULL,
  `firstOrderAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastOrderAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `orderCount` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `paynpik_aggregator_customers_outletId_channel_externalCustomerId_key`(`outletId`, `channel`, `externalCustomerId`),
  INDEX `paynpik_aggregator_customers_channel_externalCustomerId_idx`(`channel`, `externalCustomerId`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `paynpik_aggregator_customers`
  ADD CONSTRAINT `paynpik_aggregator_customers_outletId_fkey`
  FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Link AggregatorOrder rows to the customer. Nullable so historical
-- aggregator orders (before this column existed) keep working.
ALTER TABLE `paynpik_aggregator_orders`
  ADD COLUMN `aggregatorCustomerId` VARCHAR(191) NULL;

CREATE INDEX `paynpik_aggregator_orders_aggregatorCustomerId_idx`
  ON `paynpik_aggregator_orders`(`aggregatorCustomerId`);

ALTER TABLE `paynpik_aggregator_orders`
  ADD CONSTRAINT `paynpik_aggregator_orders_aggregatorCustomerId_fkey`
  FOREIGN KEY (`aggregatorCustomerId`) REFERENCES `paynpik_aggregator_customers`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
