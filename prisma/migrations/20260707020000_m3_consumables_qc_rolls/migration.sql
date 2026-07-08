-- CreateEnum
CREATE TYPE "ConsumptionKind" AS ENUM ('GLUE_SIDE', 'GLUE_BOTTOM', 'HANDLE_ROPE');

-- AlterTable BagSpecification
ALTER TABLE "BagSpecification" ADD COLUMN "handlesPerBag" DECIMAL(8,4) NOT NULL DEFAULT 2;
ALTER TABLE "BagSpecification" ADD COLUMN "sideGlueKgPerBag" DECIMAL(14,6);
ALTER TABLE "BagSpecification" ADD COLUMN "bottomGlueKgPerBag" DECIMAL(14,6);

-- AlterTable PaperRoll (add nullable first, backfill, then NOT NULL)
ALTER TABLE "PaperRoll" ADD COLUMN "barcode" TEXT;
ALTER TABLE "PaperRoll" ADD COLUMN "remainingWeightKg" DECIMAL(14,4);

UPDATE "PaperRoll" SET "barcode" = "rollNo" WHERE "barcode" IS NULL;
UPDATE "PaperRoll" SET "remainingWeightKg" = "weightKg" WHERE "remainingWeightKg" IS NULL;

ALTER TABLE "PaperRoll" ALTER COLUMN "barcode" SET NOT NULL;
ALTER TABLE "PaperRoll" ALTER COLUMN "remainingWeightKg" SET NOT NULL;

CREATE UNIQUE INDEX "PaperRoll_barcode_key" ON "PaperRoll"("barcode");
CREATE INDEX "PaperRoll_barcode_idx" ON "PaperRoll"("barcode");

-- CreateTable DefectCategory
CREATE TABLE "DefectCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefectCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DefectCategory_code_key" ON "DefectCategory"("code");

-- AlterTable DefectType
ALTER TABLE "DefectType" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "DefectType" ADD CONSTRAINT "DefectType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DefectCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable QCRecord
ALTER TABLE "QCRecord" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "QCRecord" ADD COLUMN "machineId" TEXT;
ALTER TABLE "QCRecord" ADD COLUMN "rollId" TEXT;
ALTER TABLE "QCRecord" ADD CONSTRAINT "QCRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QCRecord" ADD CONSTRAINT "QCRecord_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "PaperRoll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable StageConsumption
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

ALTER TABLE "StageConsumption" ADD CONSTRAINT "StageConsumption_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageConsumption" ADD CONSTRAINT "StageConsumption_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
