-- AlterTable
ALTER TABLE "rooms" ADD COLUMN "useDevCommands" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN "balanceDebitedAt" TIMESTAMP(3);
