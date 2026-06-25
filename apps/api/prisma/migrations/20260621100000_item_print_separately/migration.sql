-- Per-item kitchen-slip flag. When true, each OrderItem row for this
-- item prints its own slip (token + variant + toppings + qty + notes)
-- instead of being bundled into the station's combined kitchen ticket.
-- Default FALSE so existing items keep the current grouped behaviour.

ALTER TABLE `paynpik_items`
  ADD COLUMN `printSeparately` BOOLEAN NOT NULL DEFAULT FALSE;
