-- CreateEnum
CREATE TYPE "FoodGrade" AS ENUM ('VEG', 'NON_VEG', 'VEGAN');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "foodGrade" "FoodGrade" NOT NULL DEFAULT 'VEG',
ADD COLUMN     "longDescription" VARCHAR(250),
ADD COLUMN     "shortDescription" VARCHAR(50);

-- AlterTable
ALTER TABLE "variants" ADD COLUMN     "shortDescription" VARCHAR(80);
