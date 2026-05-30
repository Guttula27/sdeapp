-- AlterTable
ALTER TABLE `paynpik_outlets` ADD COLUMN `multipleMenusEnabled` BOOLEAN NOT NULL DEFAULT false;

-- ─── Data backfill ─────────────────────────────────────────────
-- Inherit the parent business's flag at rollout so the new outlet-level
-- gate doesn't unexpectedly hide menus that were previously visible.
UPDATE `paynpik_outlets` o
JOIN `paynpik_businesses` b ON b.`id` = o.`businessId`
SET o.`multipleMenusEnabled` = b.`multipleMenusEnabled`;
