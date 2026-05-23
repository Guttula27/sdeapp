-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "address" TEXT,
ADD COLUMN     "description" VARCHAR(250),
ADD COLUMN     "primaryImageUrl" TEXT,
ADD COLUMN     "upiId" TEXT;

-- CreateTable
CREATE TABLE "business_images" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_images_businessId_displayOrder_idx" ON "business_images"("businessId", "displayOrder");

-- AddForeignKey
ALTER TABLE "business_images" ADD CONSTRAINT "business_images_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
