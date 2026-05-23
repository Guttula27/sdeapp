-- CreateTable
CREATE TABLE "toppings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basePriceAdd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "outletId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "toppings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topping_options" (
    "id" TEXT NOT NULL,
    "toppingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceAdd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topping_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_toppings" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "toppingId" TEXT NOT NULL,
    "priceAdd" DECIMAL(10,2),
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_toppings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "toppings_outletId_name_key" ON "toppings"("outletId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "item_toppings_itemId_toppingId_key" ON "item_toppings"("itemId", "toppingId");

-- AddForeignKey
ALTER TABLE "toppings" ADD CONSTRAINT "toppings_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topping_options" ADD CONSTRAINT "topping_options_toppingId_fkey" FOREIGN KEY ("toppingId") REFERENCES "toppings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_toppings" ADD CONSTRAINT "item_toppings_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_toppings" ADD CONSTRAINT "item_toppings_toppingId_fkey" FOREIGN KEY ("toppingId") REFERENCES "toppings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
