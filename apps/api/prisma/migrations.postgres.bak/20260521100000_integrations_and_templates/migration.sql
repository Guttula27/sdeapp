-- Enums
CREATE TYPE "IntegrationChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'PAYMENT_GATEWAY');
CREATE TYPE "TemplateChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');
CREATE TYPE "TemplateScope" AS ENUM ('PLATFORM', 'BUSINESS', 'OUTLET');
CREATE TYPE "TemplateCategory" AS ENUM ('TRANSACTIONAL', 'PROMOTIONAL', 'UTILITY', 'AUTH');
CREATE TYPE "TemplateApprovalStatus" AS ENUM ('DRAFT', 'PENDING_PLATFORM', 'PENDING_PROVIDER', 'APPROVED', 'REJECTED');

-- IntegrationConfig
CREATE TABLE "integration_configs" (
  "id" TEXT NOT NULL,
  "channel" "IntegrationChannel" NOT NULL,
  "providerKey" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "integration_configs_channel_providerKey_key" ON "integration_configs"("channel", "providerKey");
CREATE INDEX "integration_configs_channel_isDefault_idx" ON "integration_configs"("channel", "isDefault");

-- MessageTemplate
CREATE TABLE "message_templates" (
  "id" TEXT NOT NULL,
  "scope" "TemplateScope" NOT NULL,
  "channel" "TemplateChannel" NOT NULL,
  "name" TEXT NOT NULL,
  "category" "TemplateCategory" NOT NULL DEFAULT 'TRANSACTIONAL',
  "trigger" TEXT,
  "language" TEXT NOT NULL DEFAULT 'en',
  "body" TEXT NOT NULL,
  "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "approvalStatus" "TemplateApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  "providerKey" TEXT,
  "providerTemplateId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "businessId" TEXT,
  "outletId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "message_templates_scope_channel_approvalStatus_idx" ON "message_templates"("scope", "channel", "approvalStatus");
CREATE INDEX "message_templates_businessId_idx" ON "message_templates"("businessId");
CREATE INDEX "message_templates_outletId_idx" ON "message_templates"("outletId");

ALTER TABLE "message_templates"
  ADD CONSTRAINT "message_templates_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_templates"
  ADD CONSTRAINT "message_templates_outletId_fkey"
  FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed Razorpay as the default platform-managed payment gateway provider.
INSERT INTO "integration_configs" ("id", "channel", "providerKey", "providerName", "isDefault", "isActive", "config", "createdAt", "updatedAt")
VALUES (
  'seed_razorpay_default',
  'PAYMENT_GATEWAY',
  'RAZORPAY',
  'Razorpay',
  true,
  true,
  '{"keyId":"","keySecret":""}',
  NOW(),
  NOW()
);
