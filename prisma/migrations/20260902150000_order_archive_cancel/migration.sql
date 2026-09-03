-- AlterTable: archive flag (decluttering) + cancel reason (Cancelled is now a reachable status)
ALTER TABLE "ProductionOrder" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductionOrder" ADD COLUMN "cancelReason" TEXT;

CREATE INDEX "ProductionOrder_isArchived_idx" ON "ProductionOrder"("isArchived");
