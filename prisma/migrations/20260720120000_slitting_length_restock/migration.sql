-- Optional length restock after slitting (usable = L×pieces − lengthRestock)
ALTER TABLE "ProductionStage" ADD COLUMN IF NOT EXISTS "lengthRestockQty" DECIMAL(14,4);
