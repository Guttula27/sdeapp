-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "outletId" TEXT;

-- CreateIndex
CREATE INDEX "roles_businessId_idx" ON "roles"("businessId");

-- CreateIndex
CREATE INDEX "roles_outletId_idx" ON "roles"("outletId");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
