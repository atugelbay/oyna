-- AlterTable
ALTER TABLE "rooms" ADD COLUMN "stationApiKeyHash" TEXT,
ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN "heartbeatBuildVersion" TEXT;

-- CreateTable
CREATE TABLE "room_agent_commands" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sessionId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "room_agent_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_match_reports" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "durationSeconds" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_match_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_agent_commands_roomId_deliveredAt_idx" ON "room_agent_commands"("roomId", "deliveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "session_match_reports_sessionId_level_attemptNumber_key" ON "session_match_reports"("sessionId", "level", "attemptNumber");

-- AddForeignKey
ALTER TABLE "room_agent_commands" ADD CONSTRAINT "room_agent_commands_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_agent_commands" ADD CONSTRAINT "room_agent_commands_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_match_reports" ADD CONSTRAINT "session_match_reports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
