-- Clichés are chosen in the order proposal (before the quote), not after
-- customer confirmation. A cliché purchased for a line is billed at cost.
ALTER TABLE "OrderLine" ADD COLUMN "clicheCharge" DECIMAL(14,4);

ALTER TABLE "Cliche" ADD COLUMN "originOrderId" TEXT;
CREATE INDEX "Cliche_originOrderId_idx" ON "Cliche"("originOrderId");
ALTER TABLE "Cliche" ADD CONSTRAINT "Cliche_originOrderId_fkey" FOREIGN KEY ("originOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
