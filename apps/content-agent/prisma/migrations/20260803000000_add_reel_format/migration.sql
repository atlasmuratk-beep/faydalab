-- AlterEnum
ALTER TYPE "ContentFormat" ADD VALUE 'REEL';

-- AlterTable
ALTER TABLE "ContentItem" ADD COLUMN "videoUrl" TEXT;
