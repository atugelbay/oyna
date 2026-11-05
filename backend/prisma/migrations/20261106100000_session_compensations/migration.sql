-- Компенсации сеанса: кому, сколько, кто начислил и почему
CREATE TABLE IF NOT EXISTS "session_compensations" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL,
  "userIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reason" TEXT NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "session_compensations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "session_compensations_sessionId_idx" ON "session_compensations"("sessionId");
