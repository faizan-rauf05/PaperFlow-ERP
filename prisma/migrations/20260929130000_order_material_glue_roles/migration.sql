-- Glue is now suggested as three kinds: hot melt (from stock, handle bags)
-- and cold/core glue (a per-bag cost, no stock item).
ALTER TYPE "OrderMaterialRole" RENAME VALUE 'GLUE' TO 'HOT_GLUE';
ALTER TYPE "OrderMaterialRole" ADD VALUE 'COLD_GLUE';
ALTER TYPE "OrderMaterialRole" ADD VALUE 'CORE_GLUE';

-- A suggestion row may have no material: a per-bag cost, or no stock matched.
ALTER TABLE "OrderLineMaterial" ALTER COLUMN "materialId" DROP NOT NULL;
