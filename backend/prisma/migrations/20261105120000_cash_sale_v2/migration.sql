-- Продажа: гость, несколько игроков в одном чеке, оплата брони, возврат денег
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "isGuest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "userIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "bookingId" TEXT;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "refundTenge" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "refundReason" TEXT;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "refundedById" TEXT;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "sales_bookingId_idx" ON "sales"("bookingId");

UPDATE "sales" SET "userIds" = ARRAY["userId"] WHERE "userId" IS NOT NULL AND cardinality("userIds") = 0;

-- Строка чека: что именно продано (для групп выручки и отмены)
ALTER TABLE "sale_lines" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'ITEM';
ALTER TABLE "sale_lines" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- Сколько уже оплачено по брони (предоплата + доплата)
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "paidTenge" INTEGER NOT NULL DEFAULT 0;

-- Одна плитка на время: пары «N минут Будний» + «N минут Выходной» → «N минут» с двумя ценами
CREATE TEMP TABLE "_price_pairs" AS
SELECT w."id" AS "weekdayId",
       e."id" AS "weekendId",
       regexp_replace(w."name", '\s+[Бб]удний\s*$', '') AS "baseName",
       e."costTenge" AS "weekendCost"
FROM "price_packages" w
JOIN "price_packages" e
  ON e."venueId" = w."venueId"
 AND e."minutes" = w."minutes"
 AND regexp_replace(e."name", '\s+[Вв]ыходной\s*$', '') = regexp_replace(w."name", '\s+[Бб]удний\s*$', '')
WHERE w."name" ~ '\s+[Бб]удний\s*$'
  AND e."name" ~ '\s+[Вв]ыходной\s*$';

UPDATE "price_packages" p
SET "name" = pp."baseName", "costWeekendTenge" = pp."weekendCost", "updatedAt" = now()
FROM "_price_pairs" pp
WHERE p."id" = pp."weekdayId";

DELETE FROM "price_packages" WHERE "id" IN (SELECT "weekendId" FROM "_price_pairs");

-- Старые плитки с «Будний»/«Выходной» скрываем; новые создадутся из прайса
UPDATE "catalog_items"
SET "active" = false
WHERE "category" = 'GAMES' AND "name" ~ '\s+([Бб]удний|[Вв]ыходной)\s*$';

DROP TABLE "_price_pairs";
