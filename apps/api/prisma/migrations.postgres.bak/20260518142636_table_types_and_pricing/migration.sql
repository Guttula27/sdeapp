-- AlterTable
ALTER TABLE "tables" ADD COLUMN     "tableTypeId" TEXT;

-- CreateTable
CREATE TABLE "table_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0ea5e9',
    "outletId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_type_prices" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "variantId" TEXT,
    "tableTypeId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_type_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "table_types_outletId_name_key" ON "table_types"("outletId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "table_type_prices_itemId_variantId_tableTypeId_key" ON "table_type_prices"("itemId", "variantId", "tableTypeId");

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_tableTypeId_fkey" FOREIGN KEY ("tableTypeId") REFERENCES "table_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_types" ADD CONSTRAINT "table_types_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_type_prices" ADD CONSTRAINT "table_type_prices_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_type_prices" ADD CONSTRAINT "table_type_prices_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_type_prices" ADD CONSTRAINT "table_type_prices_tableTypeId_fkey" FOREIGN KEY ("tableTypeId") REFERENCES "table_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
