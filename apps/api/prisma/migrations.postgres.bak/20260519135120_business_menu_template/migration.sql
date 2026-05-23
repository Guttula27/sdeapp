-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_outletId_fkey";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "businessId" TEXT,
ALTER COLUMN "outletId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "categories_outletId_idx" ON "categories"("outletId");

-- CreateIndex
CREATE INDEX "categories_businessId_idx" ON "categories"("businessId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
