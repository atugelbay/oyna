-- Guest walk-in sales: Transaction without a player account
ALTER TABLE "transactions" ALTER COLUMN "userId" DROP NOT NULL;
