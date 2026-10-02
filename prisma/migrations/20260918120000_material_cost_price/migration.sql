-- AlterTable: material cost price tracking.
-- costPricePerUnit is always normalized to KWD, per Material.unit. The
-- remaining columns are a point-in-time snapshot of how the price was
-- entered (currency, per-pack vs per-unit, raw amount, FX rate + date used)
-- kept for audit review of which conversion applied when it was recorded.
CREATE TYPE "CostCurrency" AS ENUM ('KWD', 'USD');
CREATE TYPE "CostEntryBasis" AS ENUM ('PER_UNIT', 'PER_PACK');

ALTER TABLE "Material" ADD COLUMN "costPricePerUnit" DECIMAL(14,2);
ALTER TABLE "Material" ADD COLUMN "costPriceCurrency" "CostCurrency";
ALTER TABLE "Material" ADD COLUMN "costPriceEntryBasis" "CostEntryBasis";
ALTER TABLE "Material" ADD COLUMN "costPriceOriginalAmount" DECIMAL(14,2);
ALTER TABLE "Material" ADD COLUMN "costPriceExchangeRate" DECIMAL(10,6);
ALTER TABLE "Material" ADD COLUMN "costPriceRateDate" TIMESTAMP(3);
