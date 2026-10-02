-- Material catalog + stock receipts + stock locations (docs/INVENTORY_DESIGN.md).
--
-- The material/stock data at this point is not live and is re-entered after
-- this migration, so it is cleared rather than converted: materials, their
-- ledger, and everything that points at a specific material row (order-line
-- material suggestions/picks, stage consumptions, a stage's chosen material).
-- Orders, order lines and production stages themselves are kept.
DELETE FROM "StageConsumption";
DELETE FROM "OrderLineMaterial";
UPDATE "ProductionStage" SET "materialId" = NULL WHERE "materialId" IS NOT NULL;
DELETE FROM "InventoryTransaction";
DELETE FROM "Material";

-- CreateEnum
CREATE TYPE "StockLocation" AS ENUM ('WAREHOUSE', 'FACTORY');

-- AlterEnum
ALTER TYPE "MaterialUnit" ADD VALUE 'ROLL';

-- AlterEnum
BEGIN;
CREATE TYPE "InventoryTransactionType_new" AS ENUM ('RECEIPT', 'ISSUE', 'RESTOCK', 'TRANSFER', 'ADJUSTMENT');
ALTER TABLE "InventoryTransaction" ALTER COLUMN "transactionType" TYPE "InventoryTransactionType_new" USING ("transactionType"::text::"InventoryTransactionType_new");
ALTER TYPE "InventoryTransactionType" RENAME TO "InventoryTransactionType_old";
ALTER TYPE "InventoryTransactionType_new" RENAME TO "InventoryTransactionType";
DROP TYPE "InventoryTransactionType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Material" DROP CONSTRAINT "Material_supplierId_fkey";

-- DropIndex
DROP INDEX "Material_batchNo_receivingDate_key";

-- DropIndex
DROP INDEX "InventoryTransaction_materialId_idx";

-- AlterTable
ALTER TABLE "Material" DROP COLUMN "batchNo",
DROP COLUMN "bundleQty",
DROP COLUMN "cartonHeight",
DROP COLUMN "cartonLength",
DROP COLUMN "cartonQty",
DROP COLUMN "cartonWidth",
DROP COLUMN "cartonsPerBundle",
DROP COLUMN "costPriceCurrency",
DROP COLUMN "costPriceEntryBasis",
DROP COLUMN "costPriceExchangeRate",
DROP COLUMN "costPriceOriginalAmount",
DROP COLUMN "costPricePerUnit",
DROP COLUMN "costPriceRateDate",
DROP COLUMN "gluePacks",
DROP COLUMN "imageUrl",
DROP COLUMN "inkDrums",
DROP COLUMN "kgPerMeter",
DROP COLUMN "minimumStock",
DROP COLUMN "receivingDate",
DROP COLUMN "ropeLengthM",
DROP COLUMN "ropeRolls",
DROP COLUMN "ropeWeightKg",
DROP COLUMN "sheetCount",
DROP COLUMN "size",
ADD COLUMN     "averageCostKwd" DECIMAL(14,4),
ADD COLUMN     "catalogKey" TEXT,
ADD COLUMN     "stockGroup" TEXT NOT NULL,
ADD COLUMN     "tapeSize" TEXT,
ALTER COLUMN "supplierId" SET NOT NULL,
DROP COLUMN "unit",
ADD COLUMN     "unit" "MaterialUnit" NOT NULL;

-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "location" "StockLocation" NOT NULL,
ADD COLUMN     "receiptId" TEXT,
ADD COLUMN     "stageId" TEXT,
ADD COLUMN     "transferId" TEXT;

-- CreateTable
CREATE TABLE "StockReceipt" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "location" "StockLocation" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "packSize" DECIMAL(14,4),
    "packCount" INTEGER,
    "batchNo" TEXT,
    "batchDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "costCurrency" "CostCurrency" NOT NULL,
    "costEntryBasis" "CostEntryBasis" NOT NULL,
    "costAmount" DECIMAL(14,4) NOT NULL,
    "exchangeRate" DECIMAL(10,6),
    "rateDate" TIMESTAMP(3),
    "unitCostKwd" DECIMAL(14,4) NOT NULL,
    "totalCostKwd" DECIMAL(14,4) NOT NULL,
    "labelImageUrl" TEXT,
    "notes" TEXT,
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockReceipt_materialId_idx" ON "StockReceipt"("materialId");

-- CreateIndex
CREATE INDEX "StockReceipt_receivedAt_idx" ON "StockReceipt"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockReceipt_materialId_batchNo_batchDate_key" ON "StockReceipt"("materialId", "batchNo", "batchDate");

-- CreateIndex
CREATE INDEX "Material_stockGroup_idx" ON "Material"("stockGroup");

-- CreateIndex
CREATE UNIQUE INDEX "Material_supplierId_materialType_catalogKey_key" ON "Material"("supplierId", "materialType", "catalogKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_receiptId_key" ON "InventoryTransaction"("receiptId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_materialId_location_idx" ON "InventoryTransaction"("materialId", "location");

-- CreateIndex
CREATE INDEX "InventoryTransaction_transferId_idx" ON "InventoryTransaction"("transferId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_stageId_idx" ON "InventoryTransaction"("stageId");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

