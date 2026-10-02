-- AlterTable: split "generated" (automatic, on approve) from "sent" (explicit, manual)
ALTER TABLE "CustomerQuoteApproval" ADD COLUMN "generatedAt" TIMESTAMP(3);
UPDATE "CustomerQuoteApproval" SET "generatedAt" = "sentAt";
ALTER TABLE "CustomerQuoteApproval" ALTER COLUMN "generatedAt" SET NOT NULL;
ALTER TABLE "CustomerQuoteApproval" ALTER COLUMN "generatedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "CustomerQuoteApproval" ALTER COLUMN "sentAt" DROP NOT NULL;
ALTER TABLE "CustomerQuoteApproval" ALTER COLUMN "sentAt" DROP DEFAULT;

ALTER TABLE "CustomerQuoteApproval" ALTER COLUMN "status" SET DEFAULT 'GENERATED';
