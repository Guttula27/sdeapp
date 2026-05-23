-- Rename old enum, create new one, migrate data
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

CREATE TYPE "OrderStatus" AS ENUM (
  'CREATED',
  'QUEUED',
  'PREPARING',
  'READY',
  'OUT_FOR_SERVICE',
  'SERVED',
  'CANCELLED',
  'DISPUTED',
  'RESOLVED',
  'FOR_REFUND',
  'REFUND_COMPLETE'
);

-- orders.status
ALTER TABLE "orders"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrderStatus" USING (
    CASE "status"::text
      WHEN 'NEW'       THEN 'CREATED'
      WHEN 'ACCEPTED'  THEN 'QUEUED'
      WHEN 'DELIVERED' THEN 'SERVED'
      WHEN 'CLOSED'    THEN 'SERVED'
      ELSE "status"::text
    END
  )::"OrderStatus",
  ALTER COLUMN "status" SET DEFAULT 'CREATED';

-- order_status_history.status (no default)
ALTER TABLE "order_status_history"
  ALTER COLUMN "status" TYPE "OrderStatus" USING (
    CASE "status"::text
      WHEN 'NEW'       THEN 'CREATED'
      WHEN 'ACCEPTED'  THEN 'QUEUED'
      WHEN 'DELIVERED' THEN 'SERVED'
      WHEN 'CLOSED'    THEN 'SERVED'
      ELSE "status"::text
    END
  )::"OrderStatus";

DROP TYPE "OrderStatus_old";
