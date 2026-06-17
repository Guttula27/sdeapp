-- Per-(user, device) push subscription rows. Populated by
-- POST /push/register after the customer client gets an FCM
-- registration id (Capacitor PushNotifications.addListener) or a
-- Web Push subscription (browser PWA, follow-up patch).
--
-- The unique (userId, token) lets a re-installed app / refreshed
-- token upsert into the same row instead of accumulating dupes.
-- token is VARCHAR(500) to fit the FCM registration id ceiling.

CREATE TABLE `paynpik_push_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` ENUM('FCM', 'WEBPUSH') NOT NULL DEFAULT 'FCM',
    `token` VARCHAR(500) NOT NULL,
    `platform` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `paynpik_push_subscriptions_userId_token_key`(`userId`, `token`),
    INDEX `paynpik_push_subscriptions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `paynpik_push_subscriptions`
  ADD CONSTRAINT `paynpik_push_subscriptions_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `paynpik_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
