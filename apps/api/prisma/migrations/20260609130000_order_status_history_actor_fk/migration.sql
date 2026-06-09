-- Wire the existing OrderStatusHistory.changedBy column to a real FK on
-- paynpik_users.id so the order-log view can join the actor's name.
-- Pre-clean any orphan changedBy values (users that were hard-deleted)
-- so the constraint can be added without failing the migration.
UPDATE `paynpik_order_status_history` AS h
LEFT JOIN `paynpik_users` AS u ON u.`id` = h.`changedBy`
SET h.`changedBy` = NULL
WHERE h.`changedBy` IS NOT NULL AND u.`id` IS NULL;

CREATE INDEX `paynpik_order_status_history_changedBy_idx`
  ON `paynpik_order_status_history`(`changedBy`);

ALTER TABLE `paynpik_order_status_history`
  ADD CONSTRAINT `paynpik_order_status_history_changedBy_fkey`
  FOREIGN KEY (`changedBy`) REFERENCES `paynpik_users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
