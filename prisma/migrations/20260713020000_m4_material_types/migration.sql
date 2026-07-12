-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('PAPER_ROLL', 'GLUE', 'INK', 'ROPE', 'TAPE', 'SPONGE', 'CARTON');

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "materialType" "MaterialType" NOT NULL DEFAULT 'PAPER_ROLL',
ADD COLUMN     "supplier" TEXT,
ADD COLUMN     "paperType" TEXT,
ADD COLUMN     "paperLengthM" DECIMAL(14,4),
ADD COLUMN     "paperWidthMm" DECIMAL(10,2),
ADD COLUMN     "gsm" INTEGER,
ADD COLUMN     "glueType" TEXT,
ADD COLUMN     "inkColor" TEXT,
ADD COLUMN     "weightKg" DECIMAL(14,4),
ADD COLUMN     "ropeColor" TEXT,
ADD COLUMN     "ropeLengthM" DECIMAL(14,4),
ADD COLUMN     "ropeWeightKg" DECIMAL(14,4),
ADD COLUMN     "tapeType" TEXT,
ADD COLUMN     "sheetCount" INTEGER,
ADD COLUMN     "cartonSize" TEXT,
ADD COLUMN     "cartonLength" DECIMAL(10,2),
ADD COLUMN     "cartonWidth" DECIMAL(10,2),
ADD COLUMN     "cartonHeight" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "Material_materialType_idx" ON "Material"("materialType");
