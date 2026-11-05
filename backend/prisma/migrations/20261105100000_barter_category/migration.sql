-- Группа «Бартер» в кассе: продажи за 0 ₸ по договору (например, RC Race Lab)
ALTER TYPE "CatalogCategory" ADD VALUE IF NOT EXISTS 'BARTER';

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "isBarter" BOOLEAN NOT NULL DEFAULT false;
