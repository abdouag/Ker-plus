-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('NOT_STARTED', 'INFO_REQUIRED', 'IN_PROGRESS', 'DOCUMENT_AVAILABLE', 'COMPLETED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "requestedServices" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "order_services" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_services_orderId_serviceKey_key" ON "order_services"("orderId", "serviceKey");

-- AddForeignKey
ALTER TABLE "order_services" ADD CONSTRAINT "order_services_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
