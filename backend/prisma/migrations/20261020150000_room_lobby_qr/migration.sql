-- AlterTable
ALTER TABLE "rooms" ADD COLUMN "lobbyJoinToken" TEXT,
ADD COLUMN "lobbyJoinExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "rooms_lobbyJoinToken_idx" ON "rooms"("lobbyJoinToken");
