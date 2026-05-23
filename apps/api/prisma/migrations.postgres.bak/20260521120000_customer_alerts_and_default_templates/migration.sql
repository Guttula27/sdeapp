-- CustomerAlert: the in-app fallback feed shown to a customer when WhatsApp
-- (or the chosen channel) is not configured/available. Always written by the
-- dispatcher even if WhatsApp succeeds, so the customer also sees an alert.
CREATE TABLE "customer_alerts" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "orderId" TEXT,
  "orderItemId" TEXT,
  "trigger" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "ringtone" TEXT,
  "sentVia" TEXT NOT NULL DEFAULT 'IN_APP',
  "whatsappError" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_alerts_customerId_idx" ON "customer_alerts"("customerId");
CREATE INDEX "customer_alerts_orderId_idx" ON "customer_alerts"("orderId");
CREATE INDEX "customer_alerts_isRead_idx" ON "customer_alerts"("isRead");

ALTER TABLE "customer_alerts"
  ADD CONSTRAINT "customer_alerts_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_alerts"
  ADD CONSTRAINT "customer_alerts_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default platform-wide WhatsApp templates for the customer order lifecycle.
-- Pre-approved (status = APPROVED) so businesses can use them immediately.
-- Stable IDs so re-running the migration on environments that already have
-- them is a no-op (ON CONFLICT DO NOTHING).
INSERT INTO "message_templates" (
  "id", "scope", "channel", "name", "category", "trigger", "language", "body",
  "variables", "approvalStatus", "createdAt", "updatedAt"
) VALUES
(
  'seed_tpl_order_placed_wa',
  'PLATFORM', 'WHATSAPP', 'order_placed_default', 'TRANSACTIONAL', 'ORDER_PLACED', 'en',
  E'Hi {{customer_name}}, your order *{{order_number}}* at {{outlet_name}} has been placed. We''ll let you know as soon as your items are ready.',
  ARRAY['customer_name','order_number','outlet_name']::TEXT[],
  'APPROVED', NOW(), NOW()
),
(
  'seed_tpl_payment_received_wa',
  'PLATFORM', 'WHATSAPP', 'payment_received_default', 'TRANSACTIONAL', 'PAYMENT_RECEIVED', 'en',
  E'Payment of ₹{{amount}} received for order *{{order_number}}*. Thank you for ordering at {{outlet_name}}!',
  ARRAY['amount','order_number','outlet_name']::TEXT[],
  'APPROVED', NOW(), NOW()
),
(
  'seed_tpl_item_ready_wa',
  'PLATFORM', 'WHATSAPP', 'item_ready_default', 'TRANSACTIONAL', 'ITEM_READY', 'en',
  E'Hi {{customer_name}}, your *{{item}}* (order {{order_number}}) is ready at {{outlet_name}}. Please collect it.',
  ARRAY['customer_name','item','order_number','outlet_name']::TEXT[],
  'APPROVED', NOW(), NOW()
),
(
  'seed_tpl_order_ready_wa',
  'PLATFORM', 'WHATSAPP', 'order_ready_default', 'TRANSACTIONAL', 'ORDER_READY', 'en',
  E'Hi {{customer_name}}, your full order *{{order_number}}* is ready at {{outlet_name}}.',
  ARRAY['customer_name','order_number','outlet_name']::TEXT[],
  'APPROVED', NOW(), NOW()
),
(
  'seed_tpl_order_served_wa',
  'PLATFORM', 'WHATSAPP', 'order_served_default', 'TRANSACTIONAL', 'ORDER_SERVED', 'en',
  E'Order *{{order_number}}* has been served. Enjoy your meal! — {{outlet_name}}',
  ARRAY['order_number','outlet_name']::TEXT[],
  'APPROVED', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;
