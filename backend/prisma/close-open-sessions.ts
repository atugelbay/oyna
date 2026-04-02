/**
 * Принудительно закрывает все сессии в статусах PENDING и ACTIVE (например после сбоев / тестов).
 * Статус CANCELLED — без списания баланса (в отличие от завершения через end).
 *
 * Запуск из папки backend:
 *   npx ts-node prisma/close-open-sessions.ts
 *   npx ts-node prisma/close-open-sessions.ts --dry-run
 */
import { PrismaClient, SessionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dry = process.argv.includes('--dry-run');

  const open = await prisma.gameSession.findMany({
    where: {
      status: { in: [SessionStatus.PENDING, SessionStatus.ACTIVE] },
    },
    select: { id: true, status: true, roomId: true, sessionToken: true },
  });

  if (open.length === 0) {
    console.log('Открытых сессий (PENDING/ACTIVE) нет.');
    return;
  }

  console.log(`Найдено: ${open.length}`);
  for (const s of open) {
    console.log(`  ${s.id}  ${s.status}  room=${s.roomId}`);
  }

  if (dry) {
    console.log('\n--dry-run: изменения не применены.');
    return;
  }

  const result = await prisma.gameSession.updateMany({
    where: {
      status: { in: [SessionStatus.PENDING, SessionStatus.ACTIVE] },
    },
    data: {
      status: SessionStatus.CANCELLED,
      endTime: new Date(),
      pausedAt: null,
    },
  });

  console.log(`\nОбновлено записей: ${result.count} → CANCELLED`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
