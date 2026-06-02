-- ─── Idempotency key cache ──────────────────────────────────
CREATE TABLE `paynpik_idempotency_keys` (
  `id`         VARCHAR(191) NOT NULL,
  `key`        VARCHAR(191) NOT NULL,
  `scope`      VARCHAR(191) NOT NULL,
  `statusCode` INT NOT NULL,
  `body`       JSON NOT NULL,
  `createdAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paynpik_idempotency_keys_key_key` (`key`),
  INDEX `paynpik_idempotency_keys_expiresAt_idx` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
