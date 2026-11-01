/**
 * Отмена тестовых оплат Азамата 01.11 01:20–01:29 Asia/Almaty (UTC 31.10 20:20–20:29).
 * Запуск: cd backend && npx ts-node scripts/cancel-test-sales.ts
 */
import * as path from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config({ path: path.resolve(__dirname, '..', '.env') });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const from = new Date('2026-10-31T20:20:00.000Z');
  const to = new Date('2026-10-31T20:29:59.999Z');
  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: from, lte: to }, status: 'COMPLETED' },
  });
  console.log(`Found ${sales.length} completed sales in window, sum=${sales.reduce((s, x) => s + x.totalTenge, 0)}`);
  for (const sale of sales) {
    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: 'CANCELLED',
        cancelReason: 'Тест',
        cancelledAt: new Date(),
      },
    });
    console.log(`Cancelled sale #${sale.number} ${sale.totalTenge}₸`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
