-- Названия как в прайсе: STANDARD, START; «Будний» пишется одинаково
UPDATE "price_packages" SET "name" = replace("name", 'STANDART', 'STANDARD') WHERE "name" LIKE '%STANDART%';
UPDATE "catalog_items"  SET "name" = replace("name", 'STANDART', 'STANDARD') WHERE "name" LIKE '%STANDART%';
UPDATE "price_packages" SET "name" = replace("name", 'СТАРТ', 'START') WHERE "name" LIKE '%СТАРТ%';
UPDATE "catalog_items"  SET "name" = replace("name", 'СТАРТ', 'START') WHERE "name" LIKE '%СТАРТ%';
UPDATE "price_packages" SET "name" = regexp_replace("name", '(^|\s)будний', '\1Будний', 'g') WHERE "name" ~ '(^|\s)будний';
UPDATE "catalog_items"  SET "name" = regexp_replace("name", '(^|\s)будний', '\1Будний', 'g') WHERE "name" ~ '(^|\s)будний';

-- Игровые позиции за 0 ₸ — это бартер
UPDATE "catalog_items"
SET "category" = 'BARTER'
WHERE "category" = 'GAMES' AND "priceTenge" = 0 AND COALESCE("priceWeekendTenge", 0) = 0;

UPDATE "sales" s
SET "isBarter" = true
WHERE EXISTS (
  SELECT 1 FROM "sale_lines" sl
  JOIN "catalog_items" ci ON ci."id" = sl."itemId"
  WHERE sl."saleId" = s."id" AND ci."category" = 'BARTER'
);
