-- Encrypted phone column + HMAC lookup column. Plaintext `phone` is
-- intentionally left in place for one deploy cycle as a safety net;
-- a follow-up migration drops it once phoneHash-driven lookups have
-- been verified in production. Backfill happens at app boot via the
-- PhoneBackfillService.
ALTER TABLE `paynpik_users`
  ADD COLUMN `phoneEnc`  TEXT NULL,
  ADD COLUMN `phoneHash` VARCHAR(64) NULL;

-- Unique-but-nullable index: MySQL treats multiple NULLs as distinct
-- so this constraint is satisfied until the backfill populates rows.
CREATE UNIQUE INDEX `paynpik_users_phoneHash_key` ON `paynpik_users`(`phoneHash`);
