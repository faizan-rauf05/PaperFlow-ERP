-- Orders sent to production wait here while the warehouse picks materials.
ALTER TYPE "ProductionOrderStatus" ADD VALUE 'AWAITING_MATERIALS' BEFORE 'READY_FOR_WORK';

ALTER TYPE "NotificationType" ADD VALUE 'ORDER_AWAITING_MATERIALS';
ALTER TYPE "NotificationType" ADD VALUE 'STOCK_TRANSFER_REQUIRED';

-- Where each suggested material comes from, and photo proof of picks.
ALTER TABLE "OrderLineMaterial" ADD COLUMN "source" "StockLocation";
ALTER TABLE "OrderLineMaterial" ADD COLUMN "pickProofUrls" JSONB;

-- Warehouse → factory transfer tasks raised when factory stock goes below zero.
CREATE TYPE "TransferTaskStatus" AS ENUM ('OPEN', 'COMPLETED');

CREATE TABLE "StockTransferTask" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "status" "TransferTaskStatus" NOT NULL DEFAULT 'OPEN',
    "shortfallQty" DECIMAL(14,4) NOT NULL,
    "orderId" TEXT,
    "transferredQty" DECIMAL(14,4),
    "transferId" TEXT,
    "proofUrls" JSONB,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransferTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockTransferTask_status_idx" ON "StockTransferTask"("status");
CREATE INDEX "StockTransferTask_materialId_idx" ON "StockTransferTask"("materialId");

ALTER TABLE "StockTransferTask" ADD CONSTRAINT "StockTransferTask_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransferTask" ADD CONSTRAINT "StockTransferTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockTransferTask" ADD CONSTRAINT "StockTransferTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
