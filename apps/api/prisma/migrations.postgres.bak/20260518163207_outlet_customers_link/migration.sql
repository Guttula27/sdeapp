-- CreateTable
CREATE TABLE "outlet_customers" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlet_customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outlet_customers_outletId_idx" ON "outlet_customers"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_customers_outletId_userId_key" ON "outlet_customers"("outletId", "userId");

-- AddForeignKey
ALTER TABLE "outlet_customers" ADD CONSTRAINT "outlet_customers_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_customers" ADD CONSTRAINT "outlet_customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
