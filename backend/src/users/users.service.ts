import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        balance: true,
        sessions: true,
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    return this.formatUser(user);
  }

  async search(query: string, page = 1, limit = 20, filter?: string) {
    const skip = (page - 1) * limit;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const month = todayStart.getMonth() + 1;
    const day = todayStart.getDate();
    const qTrim = (query || '').trim();

    if (filter === 'birthdayToday') {
      const searchSql = qTrim
        ? Prisma.sql`AND (
            u.phone LIKE ${`%${qTrim}%`}
            OR LOWER(u.nickname) LIKE LOWER(${`%${qTrim}%`})
            OR LOWER(u.name) LIKE LOWER(${`%${qTrim}%`})
          )`
        : Prisma.empty;

      const idRows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id FROM "users" u
        WHERE u.role = ${Role.USER}::"Role"
        AND u."birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM u."birthDate") = ${month}
        AND EXTRACT(DAY FROM u."birthDate") = ${day}
        ${searchSql}
        ORDER BY u."createdAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      `;

      const countRows = await this.prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(*)::bigint AS c FROM "users" u
        WHERE u.role = ${Role.USER}::"Role"
        AND u."birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM u."birthDate") = ${month}
        AND EXTRACT(DAY FROM u."birthDate") = ${day}
        ${searchSql}
      `;

      const total = Number(countRows[0]?.c ?? 0);
      const ids = idRows.map((r) => r.id);
      if (ids.length === 0) {
        return {
          data: [],
          meta: {
            total,
            page,
            limit,
            pages: total > 0 ? Math.ceil(total / limit) : 0,
          },
        };
      }

      const users = await this.prisma.user.findMany({
        where: { id: { in: ids }, role: Role.USER },
        include: { balance: true, sessions: true },
      });
      const order = new Map(ids.map((id, i) => [id, i]));
      users.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

      return {
        data: users.map((u) => this.formatUser(u)),
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || (total ? 1 : 0),
        },
      };
    }

    const conditions: Prisma.UserWhereInput[] = [{ role: Role.USER }];
    if (qTrim) {
      conditions.push({
        OR: [
          { phone: { contains: qTrim } },
          { nickname: { contains: qTrim, mode: 'insensitive' } },
          { name: { contains: qTrim, mode: 'insensitive' } },
        ],
      });
    }
    if (filter === 'newToday') {
      conditions.push({ createdAt: { gte: todayStart } });
    }

    const where: Prisma.UserWhereInput =
      conditions.length === 1 ? conditions[0]! : { AND: conditions };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { balance: true, sessions: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => this.formatUser(u)),
      meta: { total, page, limit, pages: Math.ceil(total / limit) || (total ? 1 : 0) },
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.nickname && { nickname: dto.nickname }),
        ...(dto.name && { name: dto.name }),
        ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
        ...(dto.role && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { balance: true, sessions: true },
    });

    return this.formatUser(user);
  }

  async getStats(venueId?: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const where: Prisma.UserWhereInput = {
      role: Role.USER,
      ...(venueId
        ? { sessions: { some: { session: { venueId } } } }
        : {}),
    };

    const month = todayStart.getMonth() + 1;
    const day = todayStart.getDate();

    const venueBirthdaySql = venueId
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "game_session_players" gsp
          INNER JOIN "game_sessions" gs ON gs.id = gsp."sessionId"
          WHERE gsp."userId" = u.id AND gs."venueId" = ${venueId}
        )`
      : Prisma.empty;

    const [newToday, birthdaysRow] = await Promise.all([
      this.prisma.user.count({
        where: { ...where, createdAt: { gte: todayStart } },
      }),
      this.prisma.$queryRaw<[{ c: bigint }]>`
        SELECT COUNT(DISTINCT u.id)::bigint AS c
        FROM "users" u
        WHERE u.role = ${Role.USER}::"Role"
        AND u."birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM u."birthDate") = ${month}
        AND EXTRACT(DAY FROM u."birthDate") = ${day}
        ${venueBirthdaySql}
      `,
    ]);

    const birthdaysToday = Number(birthdaysRow[0]?.c ?? 0);

    return { newToday, birthdaysToday };
  }

  private computeAge(birthDate: Date | null): string | null {
    if (!birthDate) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return `${age} лет`;
  }

  private computeVisitStatus(sessionsCount: number): string {
    if (sessionsCount >= 10) return 'Постоянный';
    if (sessionsCount >= 3) return 'Нечастый';
    return 'Неактивный';
  }

  private formatUser(user: any) {
    const sessionsCount = user.sessions?.length ?? 0;
    const balanceSeconds = user.balance?.availableSeconds ?? 0;

    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      name: user.name,
      birthDate: user.birthDate,
      age: this.computeAge(user.birthDate),
      role: user.role,
      loyaltyStatus: user.loyaltyStatus,
      segment: user.loyaltyStatus,
      totalScore: user.totalScore,
      isActive: user.isActive,
      balanceSeconds,
      balanceMinutes: Math.floor(balanceSeconds / 60),
      sessionsCount,
      status: this.computeVisitStatus(sessionsCount),
      createdAt: user.createdAt,
      transactions: user.transactions,
    };
  }
}


