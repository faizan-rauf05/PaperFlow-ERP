-- Slitting keeps the bag width, cuts the leftover width into recycled rolls
-- (8.5-9 cm, each its own paper roll) and records the rest as waste. Replaces
-- the cut-width/pieces/leftover-action model.
ALTER TABLE "Material" ADD COLUMN "parentRollId" TEXT,
ADD COLUMN "recycledAtStageId" TEXT;

ALTER TABLE "ProductionStage" DROP COLUMN "cutWidthMm",
DROP COLUMN "pieceCount",
DROP COLUMN "pieceWeightKg",
DROP COLUMN "remainderAction",
DROP COLUMN "remainderQty",
ADD COLUMN "bagWidthCm" DECIMAL(10,2),
ADD COLUMN "recycledRollCount" INTEGER,
ADD COLUMN "recycledWidthCm" DECIMAL(10,2),
ADD COLUMN "slitWasteKg" DECIMAL(14,4),
ADD COLUMN "slitWasteWidthCm" DECIMAL(10,2);

DROP TYPE "RemainderAction";

CREATE INDEX "Material_parentRollId_idx" ON "Material"("parentRollId");
ALTER TABLE "Material" ADD CONSTRAINT "Material_parentRollId_fkey" FOREIGN KEY ("parentRollId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_recycledAtStageId_fkey" FOREIGN KEY ("recycledAtStageId") REFERENCES "ProductionStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
