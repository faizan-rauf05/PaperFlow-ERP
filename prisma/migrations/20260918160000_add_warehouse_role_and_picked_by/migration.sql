-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'WAREHOUSE';

-- AddForeignKey
ALTER TABLE "OrderLineMaterial" ADD CONSTRAINT "OrderLineMaterial_pickedById_fkey" FOREIGN KEY ("pickedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

