-- CreateEnum
CREATE TYPE "OrderMaterialRole" AS ENUM ('ROLL', 'GLUE', 'ROPE', 'INK');

-- CreateTable
CREATE TABLE "OrderLineMaterial" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "role" "OrderMaterialRole" NOT NULL,
    "isBestMatch" BOOLEAN NOT NULL DEFAULT true,
    "suggestedQty" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "suggestedCost" DECIMAL(14,4) NOT NULL,
    "pickedQty" DECIMAL(14,4),
    "pickedAt" TIMESTAMP(3),
    "pickedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderLineMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderLineMaterial_orderLineId_idx" ON "OrderLineMaterial"("orderLineId");

-- CreateIndex
CREATE INDEX "OrderLineMaterial_materialId_idx" ON "OrderLineMaterial"("materialId");

-- AddForeignKey
ALTER TABLE "OrderLineMaterial" ADD CONSTRAINT "OrderLineMaterial_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineMaterial" ADD CONSTRAINT "OrderLineMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
