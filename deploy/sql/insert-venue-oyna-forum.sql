-- Один филиал OYNA Forum (после пустого прода). Выполнить в psql под БД oyna_db:
--   sudo -u postgres psql -d oyna_db -f insert-venue-oyna-forum.sql
-- или скопировать INSERT вручную.

INSERT INTO "venues" (
  "id",
  "name",
  "city",
  "address",
  "timezone",
  "status",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid()::text,
  'OYNA Forum',
  'Алматы',
  'ТРЦ Forum Almaty, 3 этаж',
  'Asia/Almaty',
  'OPEN'::"VenueStatus",
  NOW(),
  NOW()
);
