-- Item-level default GST %, with optional overrides on customer-tag and
-- table-type prices. Plus snapshot fields on OrderItem and per-order
-- SGST/CGST totals so historical orders survive future config changes.

ALTER TABLE "items"
  ADD COLUMN "gstRate" DECIMAL(5, 2);

ALTER TABLE "customer_tag_prices"
  ADD COLUMN "gstRate" DECIMAL(5, 2);

ALTER TABLE "table_type_prices"
  ADD COLUMN "gstRate" DECIMAL(5, 2);

ALTER TABLE "order_items"
  ADD COLUMN "gstRate"   DECIMAL(5, 2)  NOT NULL DEFAULT 0,
  ADD COLUMN "gstAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE "orders"
  ADD COLUMN "sgstAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "cgstAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Back-fill historical orders: half of existing taxAmount each. Safe because
-- intra-state GST is the only mode currently supported, so 50/50 is correct.
UPDATE "orders"
   SET "sgstAmount" = "taxAmount" / 2,
       "cgstAmount" = "taxAmount" / 2
 WHERE "taxAmount" > 0;
