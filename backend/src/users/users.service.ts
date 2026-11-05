import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  parseVisitRules,
  VISIT_RULES_KEY,
  visitStatus,
  type VisitInfo,
  type VisitRules,
  type VisitStatus,
} from './visit-status';

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

    const [status] = await this.visitStatuses([user]);
    return this.formatUser(user, status);
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
        AND u."isActive" = true
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
        AND u."isActive" = true
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
        where: { id: { in: ids }, role: Role.USER, isActive: true },
        include: { balance: true, sessions: true },
      });
      const order = new Map(ids.map((id, i) => [id, i]));
      users.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

      const statuses = await this.visitStatuses(users);
      return {
        data: users.map((u, i) => this.formatUser(u, statuses[i])),
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || (total ? 1 : 0),
        },
      };
    }

    const conditions: Prisma.UserWhereInput[] = [
      { role: Role.USER },
      { isActive: true },
    ];
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

    const statuses = await this.visitStatuses(users);
    return {
      data: users.map((u, i) => this.formatUser(u, statuses[i])),
      meta: { total, page, limit, pages: Math.ceil(total / limit) || (total ? 1 : 0) },
    };
  }

  async update(id: string, dto: UpdateUserDto, actor?: { id: string; role: Role }) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Пользователь не найден');
    }
    const actorRole = actor?.role;
    if ((dto.role !== undefined || dto.isActive !== undefined) && actorRole !== Role.ADMIN) {
      throw new ForbiddenException('Менять роль и доступ может только владелец');
    }
    if (existing.role !== Role.USER && actorRole !== Role.ADMIN) {
      throw new ForbiddenException('Сотрудник не редактирует профиль сотрудника');
    }
    if (dto.birthDate && existing.birthDate && actorRole !== Role.ADMIN) {
      throw new ForbiddenException('Дату рождения после регистрации меняет только владелец');
    }
    if (dto.isActive === false && existing.role !== Role.USER) {
      throw new BadRequestException(
        'Отключать можно только игровой аккаунт (игрок)',
      );
    }

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

    const [status] = await this.visitStatuses([user]);
    return this.formatUser(user, status);
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

  async getVisitRules(): Promise<VisitRules> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: VISIT_RULES_KEY } });
    return parseVisitRules(row?.value);
  }

  async setVisitRules(rules: VisitRules): Promise<VisitRules> {
    const value = JSON.stringify({
      newDays: rules.newDays,
      windowDays: rules.windowDays,
      regularVisits: rules.regularVisits,
    });
    await this.prisma.appSetting.upsert({
      where: { key: VISIT_RULES_KEY },
      create: { key: VISIT_RULES_KEY, value },
      update: { value },
    });
    return parseVisitRules(value);
  }

  /**
   * Статус по визитам. Визит — день по Алматы, в который у игрока был хотя бы один сеанс.
   * Считается при каждом запросе, поэтому всегда актуален после сеанса и со сменой суток.
   */
  private async visitStatuses(users: { id: string; createdAt: Date }[]): Promise<VisitStatus[]> {
    if (!users.length) return [];
    const rules = await this.getVisitRules();
    const ids = users.map((u) => u.id);
    const rows = await this.prisma.$queryRaw<
      { uid: string; first_ago: number; recent: number; today: Date }[]
    >`
      WITH today AS (
        SELECT (now() AT TIME ZONE 'Asia/Almaty')::date AS d
      ), days AS (
        SELECT DISTINCT gsp."userId" AS uid,
          ((COALESCE(gs."startTime", gs."createdAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Almaty')::date AS day
        FROM "game_session_players" gsp
        INNER JOIN "game_sessions" gs ON gs.id = gsp."sessionId"
        WHERE gsp."userId" IN (${Prisma.join(ids)})
          AND gs.status IN ('ACTIVE', 'COMPLETED')
      )
      SELECT days.uid,
        (today.d - MIN(days.day))::int AS first_ago,
        (COUNT(*) FILTER (WHERE days.day > today.d - ${rules.windowDays}::int))::int AS recent
      FROM days CROSS JOIN today
      GROUP BY days.uid, today.d
    `;
    const byUser = new Map(rows.map((r) => [r.uid, r]));
    const now = Date.now();
    return users.map((u) => {
      const row = byUser.get(u.id);
      const info: VisitInfo = {
        firstVisitDaysAgo: row ? Number(row.first_ago) : null,
        recentVisits: row ? Number(row.recent) : 0,
        registeredDaysAgo: Math.floor((now - u.createdAt.getTime()) / 86400000),
      };
      return visitStatus(info, rules);
    });
  }

  private formatUser(user: any, status: VisitStatus) {
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
      status,
      createdAt: user.createdAt,
      transactions: user.transactions,
    };
  }
}


