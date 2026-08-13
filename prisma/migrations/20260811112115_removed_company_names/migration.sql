/*
  Warnings:

  - You are about to drop the column `companyName` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `kind` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `companyName` on the `Supplier` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "companyName",
DROP COLUMN "kind";

-- AlterTable
ALTER TABLE "Supplier" DROP COLUMN "companyName";

-- DropEnum
DROP TYPE "CustomerKind";
