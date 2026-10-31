-- TZ 29.10: minute ledger, cash shifts, bookings, loyalty support.
-- Existing columns and Room API tables are unchanged.

ALTER TYPE "LoyaltyStatus" ADD VALUE 'LEGEND';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "referralCode" TEXT,
  ADD COLUMN IF NOT EXISTS "referredById" TEXT,
  ADD COLUMN IF NOT EXISTS "birthDateLocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "offerAcceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "offerVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "privacyVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "guardianConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourceCode" TEXT,
  ADD COLUMN IF NOT EXISTS "instagram" TEXT,
  ADD COLUMN IF NOT EXISTS "legendInvite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mergedIntoId" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneHash" TEXT,
  ADD COLUMN IF NOT EXISTS "blockedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "blockStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "blockPermanent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "blockReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_referralCode_key" ON "users"("referralCode");
CREATE INDEX IF NOT EXISTS "users_phoneHash_idx" ON "users"("phoneHash");

ALTER TABLE "game_sessions"
  ADD COLUMN IF NOT EXISTS "paidSecondsDebited" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "bonusSecondsDebited" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "countsForRating" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "isTournament" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "endReason" TEXT,
  ADD COLUMN IF NOT EXISTS "compensatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "launchedById" TEXT;

CREATE TYPE "MinuteKind" AS ENUM ('PAID', 'BONUS', 'REWARD', 'COMPENSATION', 'MANUAL', 'LEGACY_UNKNOWN');
CREATE TYPE "MinuteEntryType" AS ENUM ('CREDIT', 'DEBIT', 'EXPIRE', 'CANCEL');
CREATE TYPE "PayMethod" AS ENUM ('CASH', 'KASPI', 'HALYK', 'FREEDOM');
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED');
CREATE TYPE "CatalogCategory" AS ENUM ('GAMES', 'PACKAGES', 'PROMO', 'WATER', 'OTHER', 'CERTIFICATE');
CREATE TYPE "CashMoveType" AS ENUM ('IN', 'OUT', 'EXPENSE');
CREATE TYPE "ExpensePay" AS ENUM ('CASH_REGISTER', 'BANK', 'OWNER_CARD');
CREATE TYPE "BookingType" AS ENUM ('BIRTHDAY', 'TEAMBUILDING');
CREATE TYPE "BookingStatus" AS ENUM ('NEW', 'CONFIRMED', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "ParticipantRole" AS ENUM ('BIRTHDAY_PERSON', 'ORGANIZER', 'PLAYER');
CREATE TYPE "CertificateStatus" AS ENUM ('SOLD', 'ACTIVATED', 'EXPIRED');
CREATE TYPE "PhoneChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "app_settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "minute_grants" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "MinuteKind" NOT NULL,
  "seconds" INTEGER NOT NULL,
  "remainingSeconds" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "source" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "loyaltyStatus" "LoyaltyStatus",
  "transactionId" TEXT,
  "sessionId" TEXT,
  "createdById" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "minute_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "minute_grants_idempotencyKey_key" ON "minute_grants"("idempotencyKey");
CREATE INDEX "minute_grants_userId_expiresAt_idx" ON "minute_grants"("userId", "expiresAt");
CREATE INDEX "minute_grants_userId_remainingSeconds_idx" ON "minute_grants"("userId", "remainingSeconds");
ALTER TABLE "minute_grants" ADD CONSTRAINT "minute_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "minute_entries" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "grantId" TEXT,
  "type" "MinuteEntryType" NOT NULL,
  "seconds" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "sessionId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "minute_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "minute_entries_userId_createdAt_idx" ON "minute_entries"("userId", "createdAt");
CREATE INDEX "minute_entries_sessionId_idx" ON "minute_entries"("sessionId");
ALTER TABLE "minute_entries" ADD CONSTRAINT "minute_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "minute_entries" ADD CONSTRAINT "minute_entries_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "minute_grants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "auth_rate_limits" (
  "key" TEXT NOT NULL,
  "failCount" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "detail" TEXT,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

CREATE TABLE "catalog_items" (
  "id" TEXT NOT NULL,
  "venueId" TEXT,
  "name" TEXT NOT NULL,
  "category" "CatalogCategory" NOT NULL,
  "priceTenge" INTEGER NOT NULL,
  "minutes" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "trackStock" BOOLEAN NOT NULL DEFAULT false,
  "stockQty" INTEGER NOT NULL DEFAULT 0,
  "lowStockAt" INTEGER NOT NULL DEFAULT 10,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "catalog_items_venueId_active_idx" ON "catalog_items"("venueId", "active");

CREATE TABLE "cash_shifts" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "openedById" TEXT NOT NULL,
  "closedById" TEXT,
  "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
  "openingCash" INTEGER NOT NULL,
  "previousCloseCash" INTEGER,
  "openingNote" TEXT,
  "closingCashActual" INTEGER,
  "closingKaspi" INTEGER,
  "closingHalyk" INTEGER,
  "closingFreedom" INTEGER,
  "closeComment" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "cash_shifts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cash_shifts_venueId_status_idx" ON "cash_shifts"("venueId", "status");
CREATE INDEX "cash_shifts_openedById_idx" ON "cash_shifts"("openedById");

CREATE TABLE "sales" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "venueId" TEXT NOT NULL,
  "shiftId" TEXT,
  "operatorId" TEXT NOT NULL,
  "userId" TEXT,
  "totalTenge" INTEGER NOT NULL,
  "minutesCredited" INTEGER NOT NULL DEFAULT 0,
  "bonusMinutes" INTEGER NOT NULL DEFAULT 0,
  "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
  "receiptChecked" BOOLEAN NOT NULL DEFAULT false,
  "receiptNumber" TEXT,
  "comment" TEXT,
  "enteredAfterOutage" BOOLEAN NOT NULL DEFAULT false,
  "cancelReason" TEXT,
  "cancelledById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "transactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sales_venueId_createdAt_idx" ON "sales"("venueId", "createdAt");
CREATE INDEX "sales_operatorId_createdAt_idx" ON "sales"("operatorId", "createdAt");
CREATE INDEX "sales_userId_idx" ON "sales"("userId");
CREATE INDEX "sales_shiftId_idx" ON "sales"("shiftId");
ALTER TABLE "sales" ADD CONSTRAINT "sales_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "cash_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "sale_lines" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "itemId" TEXT,
  "name" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "priceTenge" INTEGER NOT NULL,
  "minutes" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "sale_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sale_lines_saleId_idx" ON "sale_lines"("saleId");
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sale_payments" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "method" "PayMethod" NOT NULL,
  "amountTenge" INTEGER NOT NULL,
  "cashReceived" INTEGER,
  "changeTenge" INTEGER,
  CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sale_payments_saleId_idx" ON "sale_payments"("saleId");
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cash_movements" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "type" "CashMoveType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "article" TEXT,
  "comment" TEXT,
  "operatorId" TEXT NOT NULL,
  "expenseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cash_movements_shiftId_idx" ON "cash_movements"("shiftId");
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "cash_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "expenses" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "occurredOn" TIMESTAMP(3) NOT NULL,
  "amountTenge" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "article" TEXT NOT NULL,
  "comment" TEXT,
  "payMethod" "ExpensePay" NOT NULL,
  "shiftId" TEXT,
  "createdById" TEXT NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expenses_venueId_occurredOn_idx" ON "expenses"("venueId", "occurredOn");

CREATE TABLE "monthly_plans" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "planTenge" INTEGER NOT NULL,
  "overplanTenge" INTEGER NOT NULL,
  "rateBelow" INTEGER NOT NULL,
  "rateAt" INTEGER NOT NULL,
  "rateOver" INTEGER NOT NULL,
  "bookingRate" INTEGER NOT NULL DEFAULT 10,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monthly_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "monthly_plans_venueId_year_month_key" ON "monthly_plans"("venueId", "year", "month");

CREATE TABLE "staff_schedules" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "arrivedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "replacedBy" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "staff_schedules_venueId_startsAt_idx" ON "staff_schedules"("venueId", "startsAt");
CREATE INDEX "staff_schedules_userId_startsAt_idx" ON "staff_schedules"("userId", "startsAt");

CREATE TABLE "bookings" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "type" "BookingType" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "contactName" TEXT NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "packageName" TEXT NOT NULL,
  "packageMinutes" INTEGER NOT NULL,
  "priceLocked" INTEGER NOT NULL,
  "people" INTEGER NOT NULL,
  "amountTenge" INTEGER NOT NULL,
  "prepayTenge" INTEGER NOT NULL DEFAULT 0,
  "broughtById" TEXT NOT NULL,
  "sourceCode" TEXT NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'NEW',
  "comment" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bookings_venueId_startsAt_idx" ON "bookings"("venueId", "startsAt");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

CREATE TABLE "booking_participants" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "userId" TEXT,
  "isGuest" BOOLEAN NOT NULL DEFAULT false,
  "role" "ParticipantRole" NOT NULL DEFAULT 'PLAYER',
  "displayName" TEXT,
  "creditedAt" TIMESTAMP(3),
  CONSTRAINT "booking_participants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "booking_participants_bookingId_idx" ON "booking_participants"("bookingId");
CREATE INDEX "booking_participants_userId_idx" ON "booking_participants"("userId");
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "gift_certificates" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL,
  "priceTenge" INTEGER NOT NULL,
  "saleId" TEXT,
  "status" "CertificateStatus" NOT NULL DEFAULT 'SOLD',
  "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activateBy" TIMESTAMP(3) NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "activatedFor" TEXT,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "gift_certificates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gift_certificates_code_key" ON "gift_certificates"("code");
CREATE INDEX "gift_certificates_status_idx" ON "gift_certificates"("status");

CREATE TABLE "client_sources" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "client_sources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "client_sources_code_key" ON "client_sources"("code");

INSERT INTO "client_sources" ("id", "code", "label", "active", "sortOrder") VALUES
  ('src-instagram', 'instagram', 'Instagram', true, 1),
  ('src-tiktok', 'tiktok', 'TikTok', true, 2),
  ('src-2gis', '2gis', '2GIS', true, 3),
  ('src-google', 'google', 'Google / поиск', true, 4),
  ('src-friends', 'friends', 'Друзья и знакомые', true, 5),
  ('src-mall', 'mall', 'Увидел в ТРЦ', true, 6),
  ('src-ads', 'ads', 'Реклама / таргет', true, 7),
  ('src-school', 'school', 'Школа / вуз', true, 8),
  ('src-other', 'other', 'Другое', true, 9)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE "phone_change_requests" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "newPhone" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "PhoneChangeStatus" NOT NULL DEFAULT 'PENDING',
  "requestedBy" TEXT NOT NULL,
  "decidedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "phone_change_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "phone_change_requests_status_idx" ON "phone_change_requests"("status");

CREATE TABLE "visit_days" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visit_days_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "visit_days_userId_day_key" ON "visit_days"("userId", "day");

CREATE TABLE "status_plays" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL,
  "playedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "status_plays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "status_plays_sessionId_userId_key" ON "status_plays"("sessionId", "userId");
CREATE INDEX "status_plays_userId_playedAt_idx" ON "status_plays"("userId", "playedAt");

CREATE TABLE "stock_moves" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "reason" TEXT,
  "shiftId" TEXT,
  "operatorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_moves_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_moves_itemId_createdAt_idx" ON "stock_moves"("itemId", "createdAt");

CREATE TABLE "tv_screens" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "seconds" INTEGER NOT NULL DEFAULT 15,
  "topN" INTEGER NOT NULL DEFAULT 10,
  "sponsorOn" BOOLEAN NOT NULL DEFAULT false,
  "sponsorText" TEXT,
  "ticker" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tv_screens_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tv_screens_venueId_idx" ON "tv_screens"("venueId");
