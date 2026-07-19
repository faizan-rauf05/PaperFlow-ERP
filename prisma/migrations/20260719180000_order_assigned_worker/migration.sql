-- Assign worker to production orders before work starts
ALTER TABLE "ProductionOrder" ADD COLUMN IF NOT EXISTS "assignedWorkerId" TEXT;
CREATE INDEX IF NOT EXISTS "ProductionOrder_assignedWorkerId_idx" ON "ProductionOrder"("assignedWorkerId");

DO $$ BEGIN
  ALTER TABLE "ProductionOrder"
    ADD CONSTRAINT "ProductionOrder_assignedWorkerId_fkey"
    FOREIGN KEY ("assignedWorkerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
