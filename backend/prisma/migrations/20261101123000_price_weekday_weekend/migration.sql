-- AlterTable
ALTER TABLE "price_packages" ADD COLUMN IF NOT EXISTS "costWeekendTenge" INTEGER;
ALTER TABLE "catalog_items" ADD COLUMN IF NOT EXISTS "priceWeekendTenge" INTEGER;

-- Backfill weekend = weekday where missing
UPDATE "price_packages" SET "costWeekendTenge" = "costTenge" WHERE "costWeekendTenge" IS NULL;
UPDATE "catalog_items" SET "priceWeekendTenge" = "priceTenge" WHERE "priceWeekendTenge" IS NULL;
