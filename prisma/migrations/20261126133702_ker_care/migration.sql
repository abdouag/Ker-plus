-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('CLIENT', 'PROVIDER');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('VILLA', 'MAISON', 'APPARTEMENT', 'IMMEUBLE', 'AUTRE');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('TODO', 'PLANNED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestKind" AS ENUM ('PLANNED', 'QUICK_REPAIR', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'SEARCHING', 'ASSIGNED', 'ACCEPTED', 'QUOTE_SENT', 'QUOTE_REFUSED', 'QUOTE_ACCEPTED', 'SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'WORK_DONE', 'VALIDATED', 'DISPUTED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('SENT', 'ACCEPTED', 'REFUSED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('DIAGNOSTIC', 'INTERVENTION');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'CANCELLED', 'DONE');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REFUSED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ClientDecision" AS ENUM ('PENDING', 'CONFIRMED', 'CONTESTED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('CLIENT', 'PROVIDER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('PHOTO', 'PHOTO_BEFORE', 'PHOTO_AFTER', 'PLAN', 'INVOICE', 'WARRANTY', 'OTHER');

-- CreateTable
CREATE TABLE "care_accounts" (
    "id" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL DEFAULT 'CLIENT',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_provider_profiles" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "businessName" TEXT,
    "bio" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "zones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workingHours" TEXT,
    "indicativeRates" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_provider_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_properties" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL DEFAULT 'MAISON',
    "commune" TEXT NOT NULL,
    "quartier" TEXT,
    "landmark" TEXT,
    "address" TEXT,
    "surface" INTEGER,
    "levels" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "yearBuilt" INTEGER,
    "linkedOrderReference" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "zones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "indicativePriceFrom" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_equipment_types" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "defaultFrequencyMonths" INTEGER,
    "recommendation" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_equipment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_equipments" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "typeId" TEXT,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "brand" TEXT,
    "model" TEXT,
    "installedAt" TIMESTAMP(3),
    "warrantyUntil" TIMESTAMP(3),
    "lastServiceAt" TIMESTAMP(3),
    "frequencyMonths" INTEGER,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_equipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_maintenance_tasks" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "title" TEXT NOT NULL,
    "frequencyMonths" INTEGER,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'TODO',
    "recommendation" TEXT,
    "completedAt" TIMESTAMP(3),
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_maintenance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_service_requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "description" TEXT NOT NULL,
    "kind" "RequestKind" NOT NULL DEFAULT 'QUICK_REPAIR',
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "preferredDate" TIMESTAMP(3),
    "preferredSlot" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_assignments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "care_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_quotes" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'SENT',
    "travelFee" INTEGER NOT NULL DEFAULT 0,
    "diagnosticFee" INTEGER NOT NULL DEFAULT 0,
    "laborAmount" INTEGER NOT NULL DEFAULT 0,
    "partsAmount" INTEGER NOT NULL DEFAULT 0,
    "otherFees" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "conditions" TEXT,
    "exclusions" TEXT,
    "note" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "refusedAt" TIMESTAMP(3),
    "refusalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_quote_lines" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "care_quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_appointments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "type" "AppointmentType" NOT NULL DEFAULT 'INTERVENTION',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PROPOSED',
    "note" TEXT,
    "cancelReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_intervention_reports" (
    "id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "requestId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "diagnostic" TEXT NOT NULL,
    "workDone" TEXT NOT NULL,
    "partsUsed" TEXT,
    "recommendations" TEXT,
    "durationMinutes" INTEGER,
    "approvedCost" INTEGER,
    "nextMaintenanceAt" TIMESTAMP(3),
    "clientDecision" "ClientDecision" NOT NULL DEFAULT 'PENDING',
    "clientComment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_intervention_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_status_events" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorAccountId" TEXT,
    "actorAdminId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_reviews" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "quality" INTEGER,
    "punctuality" INTEGER,
    "price" INTEGER,
    "behaviour" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_attachments" (
    "id" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL DEFAULT 'PHOTO',
    "propertyId" TEXT,
    "equipmentId" TEXT,
    "requestId" TEXT,
    "reportId" TEXT,
    "uploadedById" TEXT,
    "title" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPrice" INTEGER NOT NULL,
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subscribable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "care_accounts_email_key" ON "care_accounts"("email");

-- CreateIndex
CREATE INDEX "care_accounts_role_active_idx" ON "care_accounts"("role", "active");

-- CreateIndex
CREATE UNIQUE INDEX "care_provider_profiles_accountId_key" ON "care_provider_profiles"("accountId");

-- CreateIndex
CREATE INDEX "care_provider_profiles_verificationStatus_idx" ON "care_provider_profiles"("verificationStatus");

-- CreateIndex
CREATE INDEX "care_properties_ownerId_archivedAt_idx" ON "care_properties"("ownerId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "care_categories_slug_key" ON "care_categories"("slug");

-- CreateIndex
CREATE INDEX "care_categories_active_displayOrder_idx" ON "care_categories"("active", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "care_equipment_types_slug_key" ON "care_equipment_types"("slug");

-- CreateIndex
CREATE INDEX "care_equipments_propertyId_archivedAt_idx" ON "care_equipments"("propertyId", "archivedAt");

-- CreateIndex
CREATE INDEX "care_maintenance_tasks_propertyId_status_dueAt_idx" ON "care_maintenance_tasks"("propertyId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "care_maintenance_tasks_status_dueAt_idx" ON "care_maintenance_tasks"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "care_service_requests_reference_key" ON "care_service_requests"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "care_service_requests_idempotencyKey_key" ON "care_service_requests"("idempotencyKey");

-- CreateIndex
CREATE INDEX "care_service_requests_requesterId_createdAt_idx" ON "care_service_requests"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "care_service_requests_status_createdAt_idx" ON "care_service_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "care_service_requests_propertyId_idx" ON "care_service_requests"("propertyId");

-- CreateIndex
CREATE INDEX "care_assignments_providerId_status_idx" ON "care_assignments"("providerId", "status");

-- CreateIndex
CREATE INDEX "care_assignments_requestId_status_idx" ON "care_assignments"("requestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "care_quotes_reference_key" ON "care_quotes"("reference");

-- CreateIndex
CREATE INDEX "care_quotes_status_idx" ON "care_quotes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "care_quotes_requestId_version_key" ON "care_quotes"("requestId", "version");

-- CreateIndex
CREATE INDEX "care_appointments_providerId_startsAt_idx" ON "care_appointments"("providerId", "startsAt");

-- CreateIndex
CREATE INDEX "care_appointments_requestId_idx" ON "care_appointments"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "care_intervention_reports_requestId_revision_key" ON "care_intervention_reports"("requestId", "revision");

-- CreateIndex
CREATE INDEX "care_status_events_requestId_createdAt_idx" ON "care_status_events"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "care_reviews_requestId_key" ON "care_reviews"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "care_attachments_fileKey_key" ON "care_attachments"("fileKey");

-- CreateIndex
CREATE INDEX "care_attachments_propertyId_idx" ON "care_attachments"("propertyId");

-- CreateIndex
CREATE INDEX "care_attachments_requestId_idx" ON "care_attachments"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "care_plans_slug_key" ON "care_plans"("slug");

-- AddForeignKey
ALTER TABLE "care_provider_profiles" ADD CONSTRAINT "care_provider_profiles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "care_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_properties" ADD CONSTRAINT "care_properties_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "care_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_equipment_types" ADD CONSTRAINT "care_equipment_types_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "care_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_equipments" ADD CONSTRAINT "care_equipments_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "care_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_equipments" ADD CONSTRAINT "care_equipments_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "care_equipment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_maintenance_tasks" ADD CONSTRAINT "care_maintenance_tasks_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "care_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_maintenance_tasks" ADD CONSTRAINT "care_maintenance_tasks_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "care_equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_maintenance_tasks" ADD CONSTRAINT "care_maintenance_tasks_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "care_service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_service_requests" ADD CONSTRAINT "care_service_requests_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "care_properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_service_requests" ADD CONSTRAINT "care_service_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "care_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_service_requests" ADD CONSTRAINT "care_service_requests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "care_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_service_requests" ADD CONSTRAINT "care_service_requests_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "care_equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_assignments" ADD CONSTRAINT "care_assignments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "care_service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_assignments" ADD CONSTRAINT "care_assignments_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "care_provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_assignments" ADD CONSTRAINT "care_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_quotes" ADD CONSTRAINT "care_quotes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "care_service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_quotes" ADD CONSTRAINT "care_quotes_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "care_provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_quote_lines" ADD CONSTRAINT "care_quote_lines_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "care_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_appointments" ADD CONSTRAINT "care_appointments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "care_service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_appointments" ADD CONSTRAINT "care_appointments_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "care_provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_intervention_reports" ADD CONSTRAINT "care_intervention_reports_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "care_service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_intervention_reports" ADD CONSTRAINT "care_intervention_reports_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "care_provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_status_events" ADD CONSTRAINT "care_status_events_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "care_service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_status_events" ADD CONSTRAINT "care_status_events_actorAccountId_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "care_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_status_events" ADD CONSTRAINT "care_status_events_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_reviews" ADD CONSTRAINT "care_reviews_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "care_service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_reviews" ADD CONSTRAINT "care_reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "care_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_attachments" ADD CONSTRAINT "care_attachments_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "care_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_attachments" ADD CONSTRAINT "care_attachments_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "care_equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_attachments" ADD CONSTRAINT "care_attachments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "care_service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_attachments" ADD CONSTRAINT "care_attachments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "care_intervention_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_attachments" ADD CONSTRAINT "care_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "care_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
