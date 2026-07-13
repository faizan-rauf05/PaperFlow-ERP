-- Rename MaterialType enum value TAPE → KAPTON
ALTER TYPE "MaterialType" RENAME VALUE 'TAPE' TO 'KAPTON';

-- Allow free-text units (e.g. Kapton custom unit)
ALTER TABLE "Material" ALTER COLUMN "unit" TYPE TEXT USING ("unit"::text);
