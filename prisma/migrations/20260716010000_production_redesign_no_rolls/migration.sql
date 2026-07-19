-- Production redesign: drop rolls, customers/order lines, 8-stage pipeline
-- Destructive reset of production/inventory roll data (accepted)

-- Drop production pipeline tables first (they depend on StageType / PaperRoll)
DROP TABLE IF EXISTS "YieldRecord" CASCADE;
DROP TABLE IF EXISTS "StageConsumption" CASCADE;
DROP TABLE IF EXISTS "QCRecord" CASCADE;
DROP TABLE IF EXISTS "ProductionStage" CASCADE;

-- Inventory: remove roll linkage
ALTER TABLE "InventoryTransaction" DROP CONSTRAINT IF EXISTS "InventoryTransaction_rollId_fkey";
ALTER TABLE "InventoryTransaction" DROP COLUMN IF EXISTS "rollId";
DROP TABLE IF EXISTS "PaperRoll" CASCADE;
DROP TYPE IF EXISTS "RollStatus";

-- Customer
DO $$ BEGIN
  CREATE TYPE "CustomerKind" AS ENUM ('PERSON', 'COMPANY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CustomerKind" NOT NULL DEFAULT 'COMPANY',
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Customer_name_idx" ON "Customer"("name");

-- Rewrite StageType enum (Machine + DefectType only now that ProductionStage is gone)
ALTER TABLE "Machine" ALTER COLUMN "stageType" DROP DEFAULT;
DROP INDEX IF EXISTS "DefectType_stageType_code_key";

ALTER TABLE "Machine" ALTER COLUMN "stageType" TYPE TEXT USING ("stageType"::text);
ALTER TABLE "DefectType" ALTER COLUMN "stageType" TYPE TEXT USING ("stageType"::text);

DROP TYPE "StageType";
CREATE TYPE "StageType" AS ENUM (
  'RAW_MATERIAL',
  'SLITTING',
  'PRINTING',
  'PRINT_QC',
  'HANDLE_MAKING_PASTING',
  'QUALITY_CHECK',
  'PACKING',
  'DISPATCH'
);

ALTER TABLE "Machine" ALTER COLUMN "stageType" TYPE "StageType" USING (
  CASE
    WHEN "stageType" IN ('RAW_MATERIAL','SLITTING','PRINTING','PRINT_QC','PACKING','DISPATCH') THEN "stageType"::"StageType"
    WHEN "stageType" = 'FINAL_QC' THEN 'QUALITY_CHECK'::"StageType"
    WHEN "stageType" IN ('HANDLE_MAKING','HANDLE_PASTING','BAG_MAKING') THEN 'HANDLE_MAKING_PASTING'::"StageType"
    ELSE 'RAW_MATERIAL'::"StageType"
  END
);

ALTER TABLE "DefectType" ALTER COLUMN "stageType" TYPE "StageType" USING (
  CASE
    WHEN "stageType" IN ('RAW_MATERIAL','SLITTING','PRINTING','PRINT_QC','PACKING','DISPATCH') THEN "stageType"::"StageType"
    WHEN "stageType" = 'FINAL_QC' THEN 'QUALITY_CHECK'::"StageType"
    WHEN "stageType" IN ('HANDLE_MAKING','HANDLE_PASTING','BAG_MAKING') THEN 'HANDLE_MAKING_PASTING'::"StageType"
    ELSE 'PRINT_QC'::"StageType"
  END
);

CREATE UNIQUE INDEX "DefectType_stageType_code_key" ON "DefectType"("stageType", "code");

DO $$ BEGIN
  CREATE TYPE "RemainderAction" AS ENUM ('WASTE', 'RESTOCK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Replace ProductionOrder with customer-linked multi-line model
DROP TABLE IF EXISTS "ProductionOrder" CASCADE;

CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductionOrder_orderNo_key" ON "ProductionOrder"("orderNo");
CREATE INDEX "ProductionOrder_status_idx" ON "ProductionOrder"("status");
CREATE INDEX "ProductionOrder_customerId_idx" ON "ProductionOrder"("customerId");
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "bagSpecId" TEXT NOT NULL,
    "plannedQty" DECIMAL(14,4) NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderLine_orderId_lineNo_key" ON "OrderLine"("orderId", "lineNo");
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_bagSpecId_fkey"
  FOREIGN KEY ("bagSpecId") REFERENCES "BagSpecification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProductionStage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "stageType" "StageType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "inputQty" DECIMAL(14,4),
    "outputQty" DECIMAL(14,4),
    "wasteQty" DECIMAL(14,4),
    "inputUnit" "MaterialUnit",
    "outputUnit" "MaterialUnit",
    "status" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "workerId" TEXT,
    "machineId" TEXT,
    "materialId" TEXT,
    "cutWidthMm" DECIMAL(10,2),
    "pieceCount" INTEGER,
    "pieceWeightKg" DECIMAL(14,4),
    "remainderAction" "RemainderAction",
    "remainderQty" DECIMAL(14,4),
    "proofUrls" JSONB,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductionStage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductionStage_orderLineId_sequence_key" ON "ProductionStage"("orderLineId", "sequence");
CREATE INDEX "ProductionStage_orderId_idx" ON "ProductionStage"("orderId");
CREATE INDEX "ProductionStage_orderLineId_idx" ON "ProductionStage"("orderLineId");
CREATE INDEX "ProductionStage_workerId_idx" ON "ProductionStage"("workerId");
CREATE INDEX "ProductionStage_status_idx" ON "ProductionStage"("status");

ALTER TABLE "ProductionStage" ADD CONSTRAINT "ProductionStage_orderLineId_fkey"
  FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionStage" ADD CONSTRAINT "ProductionStage_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionStage" ADD CONSTRAINT "ProductionStage_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionStage" ADD CONSTRAINT "ProductionStage_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "QCRecord" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "passedQty" DECIMAL(14,4) NOT NULL,
    "rejectedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "defectTypeId" TEXT,
    "photoUrl" TEXT,
    "machineId" TEXT,
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QCRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QCRecord_stageId_idx" ON "QCRecord"("stageId");
ALTER TABLE "QCRecord" ADD CONSTRAINT "QCRecord_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QCRecord" ADD CONSTRAINT "QCRecord_defectTypeId_fkey"
  FOREIGN KEY ("defectTypeId") REFERENCES "DefectType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QCRecord" ADD CONSTRAINT "QCRecord_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QCRecord" ADD CONSTRAINT "QCRecord_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StageConsumption" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "consumptionKind" "ConsumptionKind" NOT NULL,
    "plannedQty" DECIMAL(14,4) NOT NULL,
    "actualQty" DECIMAL(14,4) NOT NULL,
    "unit" "MaterialUnit" NOT NULL,
    "variance" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StageConsumption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StageConsumption_stageId_consumptionKind_key" ON "StageConsumption"("stageId", "consumptionKind");
CREATE INDEX "StageConsumption_stageId_idx" ON "StageConsumption"("stageId");
ALTER TABLE "StageConsumption" ADD CONSTRAINT "StageConsumption_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageConsumption" ADD CONSTRAINT "StageConsumption_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "YieldRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "expectedQty" DECIMAL(14,4) NOT NULL,
    "actualQty" DECIMAL(14,4) NOT NULL,
    "yieldPercent" DECIMAL(8,4) NOT NULL,
    "variance" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YieldRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "YieldRecord_stageId_key" ON "YieldRecord"("stageId");
CREATE INDEX "YieldRecord_orderId_idx" ON "YieldRecord"("orderId");
ALTER TABLE "YieldRecord" ADD CONSTRAINT "YieldRecord_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YieldRecord" ADD CONSTRAINT "YieldRecord_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
