-- AlterTable
ALTER TABLE "outlets" ADD COLUMN     "description" VARCHAR(250),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "primaryImageUrl" TEXT,
ADD COLUMN     "upiId" TEXT;

-- CreateTable
CREATE TABLE "outlet_images" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlet_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_hours" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlet_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outlet_images_outletId_displayOrder_idx" ON "outlet_images"("outletId", "displayOrder");

-- CreateIndex
CREATE INDEX "outlet_hours_outletId_dayOfWeek_idx" ON "outlet_hours"("outletId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "outlet_images" ADD CONSTRAINT "outlet_images_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_hours" ADD CONSTRAINT "outlet_hours_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
