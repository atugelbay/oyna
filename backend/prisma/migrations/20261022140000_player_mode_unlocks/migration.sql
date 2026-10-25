-- CreateTable
CREATE TABLE "player_mode_unlocks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "engineModeId" TEXT NOT NULL,
    "unlockedLevel" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_mode_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_mode_unlocks_userId_idx" ON "player_mode_unlocks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "player_mode_unlocks_userId_engineModeId_key" ON "player_mode_unlocks"("userId", "engineModeId");

-- AddForeignKey
ALTER TABLE "player_mode_unlocks" ADD CONSTRAINT "player_mode_unlocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
