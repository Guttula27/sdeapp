-- Expand the seeded ORDER_PLACED template into a receipt-style WhatsApp
-- message: order number, token, itemised lines (rendered by the dispatcher
-- from {{items_list}}), subtotal/tax/total, and a deep link to the in-app
-- receipt page. Variables list is updated to match.
--
-- The WHERE clause targets the stable seed ID so we never overwrite a
-- customised template that an admin may have edited.
UPDATE "message_templates"
SET
  "body" = E'Hi {{customer_name}}, your order *{{order_number}}* at {{outlet_name}} has been placed.\n\nToken: *{{token_number}}*\n\n*Items*\n{{items_list}}\n\nSubtotal: {{subtotal}}\nTax: {{tax}}\n*Total: {{total}}*\n\nTrack your order / view receipt:\n{{receipt_url}}',
  "variables" = ARRAY[
    'customer_name','order_number','outlet_name','token_number',
    'items_list','subtotal','tax','total','receipt_url'
  ]::TEXT[],
  "updatedAt" = NOW()
WHERE "id" = 'seed_tpl_order_placed_wa';
