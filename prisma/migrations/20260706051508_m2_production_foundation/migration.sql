-- CreateEnum
CREATE TYPE "MaterialUnit" AS ENUM ('KG', 'METER', 'BAG', 'CARTON', 'PCS');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'RETURN', 'WASTE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RollStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'FINISHED', 'WASTED');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DOWN');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('RAW_MATERIAL', 'PRINTING', 'PRINT_QC', 'SLITTING', 'BAG_MAKING', 'HANDLE_MAKING', 'HANDLE_PASTING', 'FINAL_QC', 'PACKING', 'DISPATCH');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('PENDING', 'READY', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unit" "MaterialUnit" NOT NULL,
    "minimumStock" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "kgPerMeter" DECIMAL(14,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperRoll" (
    "id" TEXT NOT NULL,
    "rollNo" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplier" TEXT,
    "batchLot" TEXT,
    "gsm" INTEGER,
    "widthMm" DECIMAL(10,2),
    "weightKg" DECIMAL(14,4) NOT NULL,
    "lengthM" DECIMAL(14,4) NOT NULL,
    "remainingLengthM" DECIMAL(14,4) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageLocation" TEXT,
    "status" "RollStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperRoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "rollId" TEXT,
    "transactionType" "InventoryTransactionType" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" "MaterialUnit" NOT NULL,
    "referenceId" TEXT,
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "machineCode" TEXT NOT NULL,
    "stageType" "StageType" NOT NULL,
    "status" "MachineStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineDowntime" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMin" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineDowntime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BagSpecification" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "bagWidthMm" DECIMAL(10,2),
    "repeatLengthMm" DECIMAL(10,2),
    "bagsPerMeter" DECIMAL(14,6),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BagSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "bagSpecId" TEXT NOT NULL,
    "plannedQty" DECIMAL(14,4) NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionStage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
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
    "rollId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefectType" (
    "id" TEXT NOT NULL,
    "stageType" "StageType" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "DefectType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QCRecord" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "passedQty" DECIMAL(14,4) NOT NULL,
    "rejectedQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "defectTypeId" TEXT,
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QCRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaperRoll_rollNo_key" ON "PaperRoll"("rollNo");

-- CreateIndex
CREATE INDEX "PaperRoll_materialId_idx" ON "PaperRoll"("materialId");

-- CreateIndex
CREATE INDEX "PaperRoll_status_idx" ON "PaperRoll"("status");

-- CreateIndex
CREATE INDEX "InventoryTransaction_materialId_idx" ON "InventoryTransaction"("materialId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_rollId_idx" ON "InventoryTransaction"("rollId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_createdAt_idx" ON "InventoryTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_machineCode_key" ON "Machine"("machineCode");

-- CreateIndex
CREATE INDEX "MachineDowntime_machineId_idx" ON "MachineDowntime"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "BagSpecification_code_key" ON "BagSpecification"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_orderNo_key" ON "ProductionOrder"("orderNo");

-- CreateIndex
CREATE INDEX "ProductionOrder_status_idx" ON "ProductionOrder"("status");

-- CreateIndex
CREATE INDEX "ProductionStage_orderId_idx" ON "ProductionStage"("orderId");

-- CreateIndex
CREATE INDEX "ProductionStage_workerId_idx" ON "ProductionStage"("workerId");

-- CreateIndex
CREATE INDEX "ProductionStage_status_idx" ON "ProductionStage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionStage_orderId_sequence_key" ON "ProductionStage"("orderId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "DefectType_stageType_code_key" ON "DefectType"("stageType", "code");

-- CreateIndex
CREATE INDEX "QCRecord_stageId_idx" ON "QCRecord"("stageId");

-- CreateIndex
CREATE UNIQUE INDEX "YieldRecord_stageId_key" ON "YieldRecord"("stageId");

-- CreateIndex
CREATE INDEX "YieldRecord_orderId_idx" ON "YieldRecord"("orderId");

-- AddForeignKey
ALTER TABLE "PaperRoll" ADD CONSTRAINT "PaperRoll_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "PaperRoll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineDowntime" ADD CONSTRAINT "MachineDowntime_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineDowntime" ADD CONSTRAINT "MachineDowntime_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_bagSpecId_fkey" FOREIGN KEY ("bagSpecId") REFERENCES "BagSpecification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStage" ADD CONSTRAINT "ProductionStage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStage" ADD CONSTRAINT "ProductionStage_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStage" ADD CONSTRAINT "ProductionStage_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStage" ADD CONSTRAINT "ProductionStage_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "PaperRoll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QCRecord" ADD CONSTRAINT "QCRecord_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QCRecord" ADD CONSTRAINT "QCRecord_defectTypeId_fkey" FOREIGN KEY ("defectTypeId") REFERENCES "DefectType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QCRecord" ADD CONSTRAINT "QCRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YieldRecord" ADD CONSTRAINT "YieldRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YieldRecord" ADD CONSTRAINT "YieldRecord_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
