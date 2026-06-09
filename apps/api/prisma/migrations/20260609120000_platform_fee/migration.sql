-- Per-business override of the platform fee. Both nullable —
-- null means "use PlatformSettings default".
ALTER TABLE `paynpik_businesses`
  ADD COLUMN `platformFeePercent` DECIMAL(5, 2) NULL,
  ADD COLUMN `platformFeeMinimum` DECIMAL(10, 2) NULL;

-- Platform-wide settings singleton. Stored as id='singleton' so the
-- service always upserts the same row.
CREATE TABLE `paynpik_platform_settings` (
  `id`                  VARCHAR(191) NOT NULL DEFAULT 'singleton',
  `platformFeePercent`  DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `platformFeeMinimum`  DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `createdAt`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed the singleton row so the service never has to handle a missing
-- record on first read.
INSERT INTO `paynpik_platform_settings` (`id`, `platformFeePercent`, `platformFeeMinimum`)
VALUES ('singleton', 0.00, 0.00);
