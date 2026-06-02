-- ─── Business: cluster fields ────────────────────────────────
ALTER TABLE `paynpik_businesses`
  ADD COLUMN `thumbnailUrl` TEXT NULL,
  ADD COLUMN `publicCode` VARCHAR(20) NULL,
  ADD COLUMN `isCluster` BOOLEAN NOT NULL DEFAULT FALSE;

-- Deterministic backfill — same business always resolves to the same code.
UPDATE `paynpik_businesses`
SET `publicCode` = CONCAT('BIZ-', UPPER(SUBSTRING(MD5(`id`), 1, 8)))
WHERE `publicCode` IS NULL;

CREATE UNIQUE INDEX `paynpik_businesses_publicCode_key`
  ON `paynpik_businesses`(`publicCode`);

-- ─── Outlet: Razorpay Linked Account for Route ───────────────
ALTER TABLE `paynpik_outlets`
  ADD COLUMN `razorpayLinkedAccountId` VARCHAR(191) NULL;

-- ─── Order: cluster parent FK (nullable) ─────────────────────
ALTER TABLE `paynpik_orders`
  ADD COLUMN `clusterOrderId` VARCHAR(191) NULL;

CREATE INDEX `paynpik_orders_clusterOrderId_idx`
  ON `paynpik_orders`(`clusterOrderId`);

-- ─── ClusterMember (join: cluster ↔ member outlet) ───────────
-- outletId is UNIQUE because an outlet can only be in one cluster at a
-- time — "cluster-exclusive while linked" semantics.
CREATE TABLE `paynpik_cluster_members` (
  `id`                VARCHAR(191) NOT NULL,
  `clusterBusinessId` VARCHAR(191) NOT NULL,
  `outletId`          VARCHAR(191) NOT NULL,
  `displayOrder`      INT NOT NULL DEFAULT 0,
  `joinedAt`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_cluster_members_outletId_key` (`outletId`),
  INDEX `paynpik_cluster_members_cluster_displayOrder_idx` (`clusterBusinessId`, `displayOrder`),
  CONSTRAINT `paynpik_cluster_members_clusterBusinessId_fkey`
    FOREIGN KEY (`clusterBusinessId`) REFERENCES `paynpik_businesses`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `paynpik_cluster_members_outletId_fkey`
    FOREIGN KEY (`outletId`) REFERENCES `paynpik_outlets`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── ClusterOrder (parent record for cluster checkout) ───────
CREATE TABLE `paynpik_cluster_orders` (
  `id`                  VARCHAR(191) NOT NULL,
  `clusterOrderNumber`  VARCHAR(191) NOT NULL,
  `clusterBusinessId`   VARCHAR(191) NOT NULL,
  `customerId`          VARCHAR(191) NULL,
  `tableId`             VARCHAR(191) NULL,
  `subtotal`            DECIMAL(10, 2) NOT NULL,
  `taxAmount`           DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `parcelAmount`        DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `totalAmount`         DECIMAL(10, 2) NOT NULL,
  `paymentMethod`       VARCHAR(20) NULL,
  `paymentStatus`       ENUM('PENDING','SUCCESS','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  `razorpayOrderId`     VARCHAR(191) NULL,
  `razorpayPaymentId`   VARCHAR(191) NULL,
  `razorpaySignature`   TEXT NULL,
  `routeTransfers`      JSON NOT NULL,
  `createdAt`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`           DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_cluster_orders_clusterOrderNumber_key` (`clusterOrderNumber`),
  INDEX `paynpik_cluster_orders_clusterBusinessId_idx` (`clusterBusinessId`),
  INDEX `paynpik_cluster_orders_customerId_idx` (`customerId`),
  CONSTRAINT `paynpik_cluster_orders_clusterBusinessId_fkey`
    FOREIGN KEY (`clusterBusinessId`) REFERENCES `paynpik_businesses`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `paynpik_cluster_orders_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `paynpik_users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Order → ClusterOrder FK (added after both tables exist) ──
ALTER TABLE `paynpik_orders`
  ADD CONSTRAINT `paynpik_orders_clusterOrderId_fkey`
  FOREIGN KEY (`clusterOrderId`) REFERENCES `paynpik_cluster_orders`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
