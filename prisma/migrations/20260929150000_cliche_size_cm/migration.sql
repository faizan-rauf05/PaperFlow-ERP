-- Cliche size is entered and shown in cm (was mm): rename and convert.
ALTER TABLE "Cliche" RENAME COLUMN "widthMm" TO "widthCm";
ALTER TABLE "Cliche" RENAME COLUMN "heightMm" TO "heightCm";
UPDATE "Cliche" SET "widthCm" = "widthCm" / 10, "heightCm" = "heightCm" / 10;
