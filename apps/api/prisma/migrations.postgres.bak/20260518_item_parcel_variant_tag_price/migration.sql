-- DropIndex
DROP INDEX "customer_tag_prices_itemId_customerTagId_key";

-- AlterTable
ALTER TABLE "customer_tag_prices" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "parcelAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "useCustomParcelCharge" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "customer_tag_prices_itemId_variantId_customerTagId_key" ON "customer_tag_prices"("itemId", "variantId", "customerTagId");

-- AddForeignKey
ALTER TABLE "customer_tag_prices" ADD CONSTRAINT "customer_tag_prices_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
