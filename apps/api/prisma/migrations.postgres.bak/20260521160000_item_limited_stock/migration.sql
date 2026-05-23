-- Limited-stock toggle + counter on Item. Existing items default to
-- unlimited (hasLimitedStock=false), so no behaviour changes until an
-- outlet opts a specific item in.
ALTER TABLE "items"
  ADD COLUMN "hasLimitedStock"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "availableQuantity" INTEGER NOT NULL DEFAULT 0;
