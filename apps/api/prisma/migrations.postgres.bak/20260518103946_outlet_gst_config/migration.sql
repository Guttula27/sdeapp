-- AlterTable
ALTER TABLE "outlets" ADD COLUMN     "gstApplicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gstPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "priceIncludesGst" BOOLEAN NOT NULL DEFAULT false;
