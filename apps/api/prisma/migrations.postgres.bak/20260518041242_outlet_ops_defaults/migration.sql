-- AlterTable
ALTER TABLE "outlets" ADD COLUMN     "defaultParcelCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "defaultPrepTime" INTEGER,
ADD COLUMN     "parcelChargeEnabled" BOOLEAN NOT NULL DEFAULT false;
