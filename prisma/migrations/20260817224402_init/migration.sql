-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'PAID', 'IN_PREPARATION', 'READY', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'IN_PREPARATION', 'READY', 'SENT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('NOT_SCHEDULED', 'PROPOSED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettingType" AS ENUM ('STRING', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'JSON', 'TEXT');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT NOT NULL,
    "city" TEXT,
    "internalNotes" TEXT,
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "coefficient" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "coefficient" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finish_levels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "pricePerSquareMeter" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finish_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulations" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT,
    "projectTypeId" TEXT,
    "projectTypeNameSnapshot" TEXT NOT NULL,
    "projectCoefficientSnapshot" INTEGER NOT NULL,
    "surface" INTEGER NOT NULL,
    "cityZoneId" TEXT,
    "cityNameSnapshot" TEXT NOT NULL,
    "cityCoefficientSnapshot" INTEGER NOT NULL,
    "finishLevelId" TEXT,
    "finishNameSnapshot" TEXT NOT NULL,
    "pricePerSquareMeterSnapshot" INTEGER NOT NULL,
    "rangePercentageSnapshot" INTEGER NOT NULL,
    "estimatedTotal" INTEGER NOT NULL,
    "estimatedMinimum" INTEGER NOT NULL,
    "estimatedMaximum" INTEGER NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "simulationId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "customerComment" TEXT,
    "desiredStartDate" TIMESTAMP(3),
    "internalNotes" TEXT,
    "paidAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "externalReference" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "assumptions" TEXT,
    "recommendations" TEXT,
    "exclusions" TEXT,
    "timeline" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileChecksum" TEXT,
    "secureTokenHash" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "preparedById" TEXT,
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_items" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "percentage" INTEGER,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_calls" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'NOT_SCHEDULED',
    "proposedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "meetingLink" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" "SettingType" NOT NULL DEFAULT 'STRING',
    "label" TEXT,
    "group" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_active_idx" ON "admin_users"("active");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_createdAt_idx" ON "customers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_phone_key" ON "customers"("email", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "project_types_slug_key" ON "project_types"("slug");

-- CreateIndex
CREATE INDEX "project_types_active_displayOrder_idx" ON "project_types"("active", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "city_zones_slug_key" ON "city_zones"("slug");

-- CreateIndex
CREATE INDEX "city_zones_active_displayOrder_idx" ON "city_zones"("active", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "finish_levels_slug_key" ON "finish_levels"("slug");

-- CreateIndex
CREATE INDEX "finish_levels_active_displayOrder_idx" ON "finish_levels"("active", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "simulations_reference_key" ON "simulations"("reference");

-- CreateIndex
CREATE INDEX "simulations_createdAt_idx" ON "simulations"("createdAt");

-- CreateIndex
CREATE INDEX "simulations_customerId_idx" ON "simulations"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_provider_providerTransactionId_idx" ON "payments"("provider", "providerTransactionId");

-- CreateIndex
CREATE INDEX "payment_events_paymentId_idx" ON "payment_events"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_eventId_key" ON "payment_events"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_orderId_key" ON "reports"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_secureTokenHash_key" ON "reports"("secureTokenHash");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "report_items_reportId_displayOrder_idx" ON "report_items"("reportId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_calls_orderId_key" ON "consultation_calls"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateIndex
CREATE INDEX "app_settings_group_idx" ON "app_settings"("group");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_projectTypeId_fkey" FOREIGN KEY ("projectTypeId") REFERENCES "project_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_cityZoneId_fkey" FOREIGN KEY ("cityZoneId") REFERENCES "city_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_finishLevelId_fkey" FOREIGN KEY ("finishLevelId") REFERENCES "finish_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "simulations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_items" ADD CONSTRAINT "report_items_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_calls" ADD CONSTRAINT "consultation_calls_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
