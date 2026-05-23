-- AlterTable
ALTER TABLE "users" ADD COLUMN     "alertRingtone" TEXT DEFAULT 'chime',
ADD COLUMN     "alertVolume" INTEGER DEFAULT 70,
ADD COLUMN     "profileImageUrl" TEXT;
