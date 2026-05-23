-- Persistent order sequence + configurable token counter per outlet.
-- nextOrderSequence is continuous (doesn't reset daily). tokenStartNumber is
-- the value that reset() returns to; nextTokenNumber is what the next order
-- will be tagged with.

ALTER TABLE "outlets"
  ADD COLUMN "nextOrderSequence" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "tokenStartNumber"  INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "nextTokenNumber"   INTEGER NOT NULL DEFAULT 1;

-- Seed each outlet's nextOrderSequence past its existing orders so future
-- orderNumbers don't collide. Token counter starts fresh at 1.
UPDATE "outlets" o
   SET "nextOrderSequence" = COALESCE(
        (SELECT COUNT(*) + 1 FROM "orders" WHERE "outletId" = o.id),
        1
   );
