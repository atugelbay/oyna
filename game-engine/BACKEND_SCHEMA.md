# OYNA — Backend database schema (Prisma proposal)

> Предложение схемы PostgreSQL для backend-разработчика.
> Prisma синтаксис. Адаптируйте под ваш код style.

---

## Общие принципы

- **UUID первичные ключи** (crypto-safe, не incremental)
- **Timestamps UTC** в БД, конвертация в TZ — на frontend
- **Денормализованные счётчики** там где это упрощает запросы (balance, rating)
- **Audit trail** для всех денежных операций (transaction history)
- **Foreign keys с ON DELETE RESTRICT** для критичных связей
- **Soft deletes** для user (isBlocked flag вместо DELETE)

---

## Prisma schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =============================================================================
// USERS & AUTH
// =============================================================================

model User {
  id              String   @id @default(uuid())
  email           String   @unique
  phone           String?  @unique
  displayName     String
  passwordHash    String
  avatarUrl       String?

  // Balance (denormalized — source of truth is Transaction[])
  balanceMinutes  Int      @default(0)

  // Flags
  isBlocked       Boolean  @default(false)
  isVerified      Boolean  @default(false)

  // Role (for operators/admins)
  role            UserRole @default(PLAYER)

  // Metadata
  createdAt       DateTime @default(now())
  lastLoginAt     DateTime?
  updatedAt       DateTime @updatedAt

  // Relations
  rating          UserRating?
  transactions    Transaction[]
  sessionsJoined  MatchPlayer[]
  sessionsCreated Session[]     @relation("SessionCreator")
  topupsGiven     Transaction[] @relation("TopupOperator")
  ratingEvents    RatingEvent[]

  @@index([email])
  @@index([phone])
  @@index([role])
}

enum UserRole {
  PLAYER
  OPERATOR  // Can create sessions, topup, see venue stats
  ADMIN     // Full access
}

// =============================================================================
// VENUES & STATIONS
// =============================================================================

model Venue {
  id          String   @id @default(uuid())
  slug        String   @unique // "almaty-downtown"
  name        String
  city        String
  address     String
  timezone    String   @default("Asia/Almaty")
  phone       String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  stations    Station[]

  @@index([slug])
}

model Station {
  id              String   @id // "laser-matrix-01" (custom ID, не uuid)
  venueId         String
  name            String   // "Laser Matrix #1"
  roomType        RoomType @default(LASER_MATRIX)

  // Secret for middleware
  apiKeyHash      String   // bcrypt hash of STATION_API_KEY
  apiKeyPrefix    String   // first 8 chars для поиска (без secret)

  // Status (updated by heartbeat)
  isOnline        Boolean  @default(false)
  lastSeenAt      DateTime?
  buildVersion    String?

  // Flags
  isActive        Boolean  @default(true)
  maintenanceMode Boolean  @default(false)

  createdAt       DateTime @default(now())

  venue           Venue    @relation(fields: [venueId], references: [id])
  sessions        Session[]

  @@index([venueId])
  @@index([apiKeyPrefix])
}

enum RoomType {
  LASER_MATRIX
  TARGET_ARENA   // Будущее: тир с мишенями
  LED_GRID       // Будущее
  HIDE_SEEK      // Будущее
}

// =============================================================================
// SESSIONS & MATCHES
// =============================================================================

model Session {
  id                    String         @id @default(uuid())
  stationId             String
  mode                  GameMode
  startLevel            Int            @default(1)
  maxPlayers            Int            @default(6)

  // Auth
  sessionToken          String         @unique
  joinCode              String         @unique // "7AB-KZ9"

  // State
  status                SessionStatus  @default(CREATED)

  // Config
  durationSeconds       Int            @default(600)

  // Timing
  createdAt             DateTime       @default(now())
  qrShownAt             DateTime?
  startedAt             DateTime?
  endedAt               DateTime?
  expiresAt             DateTime       // createdAt + waitingTimeout

  // End state
  endReason             SessionEndReason?

  // Stats (populated on end)
  matchesPlayed         Int            @default(0)
  matchesWon            Int            @default(0)
  totalScore            Int            @default(0)
  totalPauseSeconds     Int            @default(0)

  // Audit
  createdByOperatorId   String?
  cancelledByOperatorId String?

  // Relations
  station               Station        @relation(fields: [stationId], references: [id])
  createdBy             User?          @relation("SessionCreator", fields: [createdByOperatorId], references: [id])
  players               MatchPlayer[]
  matches               Match[]
  transactions          Transaction[]
  ratingEvents          RatingEvent[]

  @@index([stationId, status])
  @@index([joinCode])
  @@index([status, expiresAt])
  @@index([createdAt])
}

enum GameMode {
  CLASSIC
  DYNAMIC
  CHAOS
}

enum SessionStatus {
  CREATED     // Just created, UE not confirmed QR yet
  WAITING     // QR shown, waiting for players to join
  STARTING    // Operator hit start, UE in countdown
  ACTIVE      // Actively playing
  PAUSED
  COMPLETED   // Finished normally
  CANCELLED   // Cancelled by operator or timeout
  ERROR
}

enum SessionEndReason {
  TIME_ELAPSED
  ALL_LEVELS_COMPLETED
  OPERATOR_CANCELLED
  TIMEOUT_NO_START    // Session was cancelled because nobody joined
  NETWORK_ERROR
  ERROR
}

model MatchPlayer {
  id             String   @id @default(uuid())
  sessionId      String
  userId         String
  slot           Int      // 0-5
  displayName    String   // snapshot at join time
  color          String   // hex
  joinedAt       DateTime @default(now())
  leftAt         DateTime?

  session        Session  @relation(fields: [sessionId], references: [id])
  user           User     @relation(fields: [userId], references: [id])

  @@unique([sessionId, userId])
  @@unique([sessionId, slot])
  @@index([userId])
}

model Match {
  id                String   @id @default(uuid())
  sessionId         String
  level             Int      // 1-10
  attemptNumber     Int      @default(1)

  // Timing
  startedAt         DateTime
  endedAt           DateTime
  durationSeconds   Float

  // Result
  finalScore        Int
  livesLeft         Int
  livesBonus        Int?
  timeBonus         Int?
  timeUsed          Float?
  bVictory          Boolean
  failReason        MatchFailReason?
  mode              GameMode

  // Debug
  rawResult         Json     // FOLLevelResult full dump
  idempotencyKey    String   @unique

  // Relations
  session           Session  @relation(fields: [sessionId], references: [id])

  @@unique([sessionId, level, attemptNumber])
  @@index([sessionId, level])
}

enum MatchFailReason {
  TIME_OUT
  LIVES_LOST
  SESSION_ENDED
}

// =============================================================================
// TRANSACTIONS (balance audit trail)
// =============================================================================

model Transaction {
  id              String            @id @default(uuid())
  userId          String
  type            TransactionType

  amountMinutes   Int               // positive number

  // For topup only
  priceAmount     Decimal?          @db.Decimal(12, 2)  // in KZT
  paymentMethod   PaymentMethod?
  operatorId      String?
  venueId         String?

  // For deduction/refund
  sessionId       String?

  // Audit
  balanceAfter    Int               // snapshot after this transaction
  notes           String?
  createdAt       DateTime          @default(now())

  user            User              @relation(fields: [userId], references: [id])
  operator        User?             @relation("TopupOperator", fields: [operatorId], references: [id])
  session         Session?          @relation(fields: [sessionId], references: [id])

  @@index([userId, createdAt])
  @@index([type])
  @@index([sessionId])
}

enum TransactionType {
  TOPUP
  DEDUCTION
  REFUND
  BONUS       // Promo bonus, e.g. "5 free minutes on signup"
}

enum PaymentMethod {
  CASH
  CARD
  ONLINE
}

// =============================================================================
// RATING (denormalized for leaderboards performance)
// =============================================================================

model UserRating {
  userId              String    @id
  allTimePoints       Int       @default(0)
  monthlyPoints       Int       @default(0)
  dailyPoints         Int       @default(0)
  gamesPlayed         Int       @default(0)
  lastGameAt          DateTime?
  updatedAt           DateTime  @updatedAt

  user                User      @relation(fields: [userId], references: [id])

  @@index([allTimePoints(sort: Desc)])
  @@index([monthlyPoints(sort: Desc)])
  @@index([dailyPoints(sort: Desc)])
}

// Event log for per-venue rating computation and history
model RatingEvent {
  id              String    @id @default(uuid())
  userId          String
  sessionId       String
  points          Int
  venueId         String
  mode            GameMode
  createdAt       DateTime  @default(now())

  user            User      @relation(fields: [userId], references: [id])
  session         Session   @relation(fields: [sessionId], references: [id])

  @@index([userId, createdAt])
  @@index([venueId, createdAt])
  @@index([createdAt])
}

// Historical snapshots for "yesterday's top" etc
model RatingSnapshot {
  id              String    @id @default(uuid())
  period          String    // "daily-2026-04-19" or "monthly-2026-04"
  venueId         String?   // null = global
  userId          String
  displayName     String    // snapshot
  points          Int
  rank            Int
  createdAt       DateTime  @default(now())

  @@index([period, venueId, rank])
  @@index([userId])
}
```

---

## Миграция на баланс: триггер обновления

```sql
-- Trigger на вставку Transaction — обновляет user.balanceMinutes
CREATE OR REPLACE FUNCTION update_user_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'TOPUP' OR NEW.type = 'REFUND' OR NEW.type = 'BONUS' THEN
        UPDATE "User"
          SET "balanceMinutes" = "balanceMinutes" + NEW."amountMinutes"
          WHERE id = NEW."userId";
    ELSIF NEW.type = 'DEDUCTION' THEN
        UPDATE "User"
          SET "balanceMinutes" = "balanceMinutes" - NEW."amountMinutes"
          WHERE id = NEW."userId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transaction_balance
AFTER INSERT ON "Transaction"
FOR EACH ROW
EXECUTE FUNCTION update_user_balance();
```

**Альтернатива** (если не любите триггеры): делать это в коде в одной транзакции.

---

## Индексы — когда масштабироваться

Сейчас нагрузка низкая (~30 сессий/час пик = ~300 матчей/час пик). Основные индексы в схеме. При росте:

- `Match.sessionId` — добавить partial index WHERE `bVictory = true` для рейтинга
- `RatingEvent.createdAt` + `venueId` — композитный для TV leaderboards
- Партиционирование `Match` и `RatingEvent` по месяцам при >1M записей
- Материализованное view для leaderboard top-100, обновление каждые 30 сек

---

## Миграция: порядок создания

1. `Venue`, `Station` (нужны для FK)
2. `User`, `UserRating`
3. `Session`, `MatchPlayer`, `Match`
4. `Transaction`
5. `RatingEvent`, `RatingSnapshot`

Prisma: `npx prisma migrate dev --name init`

---

## Seed data (dev)

```typescript
// prisma/seed.ts
await prisma.venue.create({
  data: {
    id: "venue-001",
    slug: "almaty-downtown",
    name: "OYNA Достык",
    city: "Almaty",
    address: "...",
  }
});

await prisma.station.create({
  data: {
    id: "laser-matrix-01",
    venueId: "venue-001",
    name: "Laser Matrix #1",
    apiKeyHash: bcrypt.hashSync("station_live_dev_key_12345", 10),
    apiKeyPrefix: "station_",
  }
});

// Test user
await prisma.user.create({
  data: {
    email: "test@oyna.pro",
    displayName: "Test Player",
    passwordHash: bcrypt.hashSync("test1234", 10),
    balanceMinutes: 100,
    rating: { create: { allTimePoints: 0 } }
  }
});

// Operator
await prisma.user.create({
  data: {
    email: "operator@oyna.pro",
    displayName: "Operator 1",
    passwordHash: bcrypt.hashSync("operator1234", 10),
    role: "OPERATOR",
    rating: { create: {} }
  }
});
```

---

## Вопросы к backend-команде

Открытые вопросы для обсуждения:

1. **Хранить ли `rawResult` FOLLevelResult в БД полностью?** Поможет в debug, но занимает место. Предлагаю хранить, но с TTL 30 дней.
2. **Гостевая игра без регистрации?** Сейчас модель требует регистрацию. Если MVP допускает гостей — нужна "guest_sessions" таблица или спец user_id.
3. **Rating freezes on end of month — как делаем?** Предложен снапшот + reset. Альтернатива: не обнулять, считать на лету через WHERE createdAt >= month_start. Простое но тяжелее для TV screens.
4. **Retention данных?** Match через N месяцев → архив в холодное хранилище? Предлагаю оставлять всё в БД (объёмы малы).
