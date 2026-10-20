-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN "engineSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_engineSessionId_key" ON "game_sessions"("engineSessionId");
