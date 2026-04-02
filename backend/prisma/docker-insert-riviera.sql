-- One-off: add second venue if missing (run against Docker DB when .env points elsewhere)
INSERT INTO "venues" ("id","name","city","address","timezone","status","createdAt","updatedAt")
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'OYNA Riviera',
  'Алматы',
  'OYNA Riviera',
  'Asia/Almaty',
  'OPEN',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "city" = EXCLUDED."city",
  "address" = EXCLUDED."address",
  "updatedAt" = NOW();
