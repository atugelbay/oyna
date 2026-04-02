import * as path from 'path';
import { config } from 'dotenv';

// Всегда backend/.env — должен совпадать с БД, к которой подключается API (см. .env.example для Docker).
config({ path: path.resolve(__dirname, '..', '.env') });

import { PrismaClient, Role, VenueStatus, GameModeType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Check backend/.env');
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const ADMIN_PASSWORD = 'admin123';

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { phone: '+77000000001' },
    update: { passwordHash },
    create: {
      phone: '+77000000001',
      nickname: 'admin',
      name: 'Администратор OYNA',
      role: Role.ADMIN,
      passwordHash,
      balance: { create: { availableSeconds: 0 } },
    },
  });
  console.log(`Admin: ${admin.nickname} (${admin.id}), password: ${ADMIN_PASSWORD}`);

  const operator = await prisma.user.upsert({
    where: { phone: '+77000000002' },
    update: {},
    create: {
      phone: '+77000000002',
      nickname: 'operator1',
      name: 'Оператор Кассы',
      role: Role.OPERATOR,
      balance: { create: { availableSeconds: 0 } },
    },
  });
  console.log(`Operator: ${operator.nickname} (${operator.id})`);

  const testPlayer = await prisma.user.upsert({
    where: { phone: '+77001234567' },
    update: {},
    create: {
      phone: '+77001234567',
      nickname: 'TestPlayer',
      name: 'Тестовый Игрок',
      role: Role.USER,
      balance: { create: { availableSeconds: 3600 } },
    },
  });
  console.log(`Player: ${testPlayer.nickname} (${testPlayer.id})`);

  const forum = await prisma.venue.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'OYNA Forum Almaty',
      city: 'Алматы',
      address: 'ТРЦ Forum Almaty, 3 этаж',
      timezone: 'Asia/Almaty',
      status: VenueStatus.OPEN,
    },
  });
  console.log(`Venue: ${forum.name}`);

  const riviera = await prisma.venue.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {
      name: 'OYNA Riviera',
      city: 'Алматы',
      address: 'OYNA Riviera',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'OYNA Riviera',
      city: 'Алматы',
      address: 'OYNA Riviera',
      timezone: 'Asia/Almaty',
      status: VenueStatus.OPEN,
    },
  });
  console.log(`Venue: ${riviera.name}`);

  const rivieraRoom = await prisma.room.upsert({
    where: { id: '00000000-0000-0000-0000-000000002001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000002001',
      venueId: riviera.id,
      name: 'Mega Grid',
      type: 'grid',
      maxPlayers: 5,
      defaultLevelDuration: 120,
    },
  });
  await prisma.gameMode.upsert({
    where: { id: '00000000-0000-0000-0001-000000002001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0001-000000002001',
      roomId: rivieraRoom.id,
      type: GameModeType.COOP,
      name: 'Кооператив',
      description: `Кооперативный режим — ${riviera.name}`,
      config: { difficulty: 'normal', speed: 1.0 },
    },
  });
  console.log(`Room: ${rivieraRoom.name} (Riviera) + COOP mode`);

  const rooms = [
    { name: 'Mega Grid', type: 'grid', maxPlayers: 5, defaultLevelDuration: 120 },
    { name: 'Arena', type: 'arena', maxPlayers: 4, defaultLevelDuration: 120 },
    { name: 'Hide & Seek', type: 'hideseek', maxPlayers: 6, defaultLevelDuration: 180 },
    { name: 'Laser Matrix', type: 'laser', maxPlayers: 4, defaultLevelDuration: 120 },
  ];

  for (const roomData of rooms) {
    const room = await prisma.room.upsert({
      where: {
        id: `00000000-0000-0000-0000-00000000${roomData.type.padStart(4, '0')}`,
      },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000${roomData.type.padStart(4, '0')}`,
        venueId: forum.id,
        ...roomData,
      },
    });

    await prisma.gameMode.upsert({
      where: {
        id: `00000000-0000-0000-0001-00000000${roomData.type.padStart(4, '0')}`,
      },
      update: {},
      create: {
        id: `00000000-0000-0000-0001-00000000${roomData.type.padStart(4, '0')}`,
        roomId: room.id,
        type: GameModeType.COOP,
        name: 'Кооператив',
        description: `Кооперативный режим для ${roomData.name}`,
        config: { difficulty: 'normal', speed: 1.0 },
      },
    });

    console.log(`Room: ${room.name} + COOP mode`);
  }

  const megaGridId = '00000000-0000-0000-0000-00000000grid';
  await prisma.gameMode.upsert({
    where: { id: '00000000-0000-0000-0002-00000000grid' },
    update: {},
    create: {
      id: '00000000-0000-0000-0002-00000000grid',
      roomId: megaGridId,
      type: GameModeType.COMPETITIVE,
      name: 'Соревновательный',
      description: 'Центр против остальных — Mega Grid',
      config: { difficulty: 'normal', speed: 1.0, centerVsAll: true },
    },
  });
  console.log('Mega Grid: + COMPETITIVE mode');

  const userCount = await prisma.user.count();
  console.log(`\nUsers in DB: ${userCount}`);
  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
