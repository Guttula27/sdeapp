-- Add PACKED to the OrderItemStatus enum. Parcel desk uses this as the
-- intermediate state between READY (kitchen done) and SERVED (handed
-- to customer); once every live item is PACKED the order auto-rolls
-- to READY_FOR_PICKUP and the customer is notified.
ALTER TABLE `paynpik_order_items`
  MODIFY COLUMN `status` ENUM(
    'PENDING_VERIFICATION',
    'PENDING',
    'PREPARING',
    'READY',
    'PACKED',
    'SERVED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'PENDING';
