-- CreateEnum
CREATE TYPE "ContentPillar" AS ENUM ('AI_AUTOMATION', 'WEB_QR_CASE_STUDY');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('STATIC');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SCHEDULED', 'PUBLISHED', 'GENERATION_FAILED', 'PUBLISH_FAILED');

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "pillar" "ContentPillar" NOT NULL,
    "format" "ContentFormat" NOT NULL DEFAULT 'STATIC',
    "topic" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[],
    "imageUrl" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "telegramChatId" TEXT,
    "telegramMessageId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "instagramMediaId" TEXT,
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationToken" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentItem_pillar_createdAt_idx" ON "ContentItem"("pillar", "createdAt");

-- CreateIndex
CREATE INDEX "ContentItem_status_scheduledFor_idx" ON "ContentItem"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationToken_provider_key" ON "IntegrationToken"("provider");
