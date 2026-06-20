-- Phase B fields for split bills.
--
-- SplitShare gains reminder + expiry tracking:
--   remindersSent  — caps the auto-resend loop
--   lastReminderAt — throttle anchor (resend only after gap elapses)
--   expiresAt      — calculated at create time; null for legacy rows
--
-- Outlet gains the Phase B knobs that drive those windows + the
-- SplitFeeAbsorption preference for who pays the Razorpay fee on
-- split-bill share payments.

ALTER TABLE `paynpik_split_shares`
  ADD COLUMN `remindersSent` INT NOT NULL DEFAULT 0,
  ADD COLUMN `lastReminderAt` DATETIME(3) NULL,
  ADD COLUMN `expiresAt` DATETIME(3) NULL;

CREATE INDEX `paynpik_split_shares_expiresAt_idx`
  ON `paynpik_split_shares`(`expiresAt`);

ALTER TABLE `paynpik_outlets`
  ADD COLUMN `splitReminderEveryMinutes` INT NOT NULL DEFAULT 60,
  ADD COLUMN `splitMaxReminders` INT NOT NULL DEFAULT 3,
  ADD COLUMN `splitExpireAfterMinutes` INT NOT NULL DEFAULT 1440,
  ADD COLUMN `splitFeesAbsorbedBy` ENUM('OUTLET', 'CUSTOMER') NOT NULL DEFAULT 'OUTLET';
