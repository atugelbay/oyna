-- AlterTable
ALTER TABLE "rooms" ADD COLUMN "engineRoomId" TEXT,
ADD COLUMN "catalogHash" TEXT,
ADD COLUMN "catalogJson" JSONB,
ADD COLUMN "catalogSyncedAt" TIMESTAMP(3);
