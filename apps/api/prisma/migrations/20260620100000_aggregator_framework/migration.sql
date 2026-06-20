-- Aggregator framework scaffolding (Zomato / Swiggy / Uber Eats).
-- Three new tables + a channel column on paynpik_orders. The actual
-- API integrations live behind a per-channel adapter on the API side;
-- this migration is just the data model so the operator can capture
-- credentials and inbound webhooks can persist before the live calls
-- are switched on.

-- Channel on every Order row. Existing data defaults to DIRECT.
ALTER TABLE `paynpik_orders`
  ADD COLUMN `channel` ENUM('DIRECT', 'ZOMATO', 'SWIGGY', 'UBER_EATS') NOT NULL DEFAULT 'DIRECT';

CREATE INDEX `paynpik_orders_channel_idx` ON `paynpik_orders`(`channel`);

-- Per-outlet integration config.
CREATE TABLE `paynpik_aggregator_integrations` (
  `id` VARCHAR(191) NOT NULL,
  `outletId` VARCHAR(191) NOT NULL,
  `channel` ENUM('DIRECT', 'ZOMATO', 'SWIGGY', 'UBER_EATS') NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT FALSE,
  `credentialsEnc` TEXT NULL,
  `externalRestaurantId` VARCHAR(191) NULL,
  `webhookSecretEnc` TEXT NULL,
  `lastMenuSyncAt` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `paynpik_aggregator_integrations_outletId_channel_key`(`outletId`, `channel`),
  INDEX `paynpik_aggregator_integrations_channel_isActive_idx`(`channel`, `isActive`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Per-order mapping. One-to-one with paynpik_orders.
CREATE TABLE `paynpik_aggregator_orders` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `channel` ENUM('DIRECT', 'ZOMATO', 'SWIGGY', 'UBER_EATS') NOT NULL,
  `externalOrderId` VARCHAR(191) NOT NULL,
  `status` ENUM('RECEIVED', 'ACCEPTED', 'REJECTED', 'PREPARING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'RECEIVED',
  `rawPayload` JSON NULL,
  `lastSyncError` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `paynpik_aggregator_orders_orderId_key`(`orderId`),
  UNIQUE INDEX `paynpik_aggregator_orders_channel_externalOrderId_key`(`channel`, `externalOrderId`),
  INDEX `paynpik_aggregator_orders_channel_status_idx`(`channel`, `status`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Per-item, per-channel external mapping for menu sync.
CREATE TABLE `paynpik_aggregator_item_mappings` (
  `id` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `channel` ENUM('DIRECT', 'ZOMATO', 'SWIGGY', 'UBER_EATS') NOT NULL,
  `externalItemId` VARCHAR(191) NOT NULL,
  `externalPrice` DECIMAL(10, 2) NULL,
  `isEnabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `paynpik_aggregator_item_mappings_itemId_channel_key`(`itemId`, `channel`),
  INDEX `paynpik_aggregator_item_mappings_channel_externalItemId_idx`(`channel`, `externalItemId`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys.
ALTER TABLE `paynpik_aggregator_integrations`
  ADD CONSTRAINT `paynpik_aggregator_integrations_outletId_fkey`
  FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `paynpik_aggregator_orders`
  ADD CONSTRAINT `paynpik_aggregator_orders_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `paynpik_orders`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `paynpik_aggregator_item_mappings`
  ADD CONSTRAINT `paynpik_aggregator_item_mappings_itemId_fkey`
  FOREIGN KEY (`itemId`) REFERENCES `paynpik_items`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
