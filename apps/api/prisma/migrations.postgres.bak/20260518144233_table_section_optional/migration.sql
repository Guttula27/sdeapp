-- DropForeignKey
ALTER TABLE "tables" DROP CONSTRAINT "tables_sectionId_fkey";

-- AlterTable
ALTER TABLE "tables" ALTER COLUMN "sectionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
