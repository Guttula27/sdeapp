-- Add PENDING_VERIFICATION to OrderItemStatus. Used as the initial state
-- for postpaid items so service desk can confirm with the customer before
-- kitchen sees them.
ALTER TABLE `paynpik_order_items`
  MODIFY COLUMN `status` ENUM(
    'PENDING_VERIFICATION',
    'PENDING',
    'PREPARING',
    'READY',
    'SERVED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'PENDING';
