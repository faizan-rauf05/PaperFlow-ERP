-- Per-unit costs keep 6 decimals: a paper roll's cost per meter (e.g.
-- 0.036653 KWD) lost precision at 4, so per-kg and per-meter figures disagreed.
ALTER TABLE "Material" ALTER COLUMN "averageCostKwd" SET DATA TYPE DECIMAL(14,6);
ALTER TABLE "StockReceipt" ALTER COLUMN "unitCostKwd" SET DATA TYPE DECIMAL(14,6);
