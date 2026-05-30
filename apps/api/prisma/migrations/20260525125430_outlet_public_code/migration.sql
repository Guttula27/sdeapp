-- AlterTable
ALTER TABLE `paynpik_outlets` ADD COLUMN `publicCode` VARCHAR(20) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `paynpik_outlets_publicCode_key` ON `paynpik_outlets`(`publicCode`);

-- ─── Data backfill ─────────────────────────────────────────────
-- Deterministic 8-char code from MD5(id) so the same outlet always gets the
-- same publicCode if the migration is ever re-run. Uniqueness follows from
-- the underlying id being unique.
UPDATE `paynpik_outlets`
SET `publicCode` = CONCAT('OL-', UPPER(SUBSTRING(MD5(`id`), 1, 8)))
WHERE `publicCode` IS NULL;
