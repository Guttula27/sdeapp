-- Phase 1 of docs/performance-hardening-plan.md.
-- Adds the composite indexes the stress test flagged as missing on the
-- two hottest tables. All five are non-unique additive indexes, safe
-- to apply online with MySQL 8 InnoDB.

CREATE INDEX `idx_orders_outlet_created`
  ON `paynpik_orders` (`outletId`, `createdAt`);

CREATE INDEX `idx_orders_outlet_status_created`
  ON `paynpik_orders` (`outletId`, `status`, `createdAt`);

CREATE INDEX `idx_orders_status`
  ON `paynpik_orders` (`status`);

CREATE INDEX `idx_orderitems_order_status_item`
  ON `paynpik_order_items` (`orderId`, `status`, `itemId`);

CREATE INDEX `idx_orderitems_status`
  ON `paynpik_order_items` (`status`);
