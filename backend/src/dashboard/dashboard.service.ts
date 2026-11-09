import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RatingService } from '../rating/rating.service';
import { almatyParts } from '../domain/rules';
import { bookingDue } from '../cash/sale-rules';
import {
  almatyDayBounds,
  bookingSoon,
  daysLeftInMonth,
  offlineAlertMinutes,
  sessionRemainingSeconds,
} from './today-rules';

/**
 * Экран сотрудника «Главная»: за 5 секунд видно, что важно сейчас.
 * Своих форм нет — только данные и ссылки в Кассу, Зал и Команду.
 */
@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private rating: RatingService,
  ) {}

  async today(venueId: string, actor: { id: string; role: Role }) {
    const now = new Date();
    const today = almatyDayBounds(now);
    const tomorrow = almatyDayBounds(now, 1);
    const [shift, bookings, tomorrowCount, rooms, important, numbers] = await Promise.all([
      this.shift(venueId),
      this.bookingsToday(venueId, today, now),
      this.prisma.booking.count({
        where: { venueId, startsAt: { gte: tomorrow.from, lt: tomorrow.to }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      }),
      this.rooms(venueId, now),
      this.important(venueId, today, now),
      this.numbers(venueId, today, actor),
    ]);
    return { now, shift, bookings, tomorrowBookings: tomorrowCount, rooms, important, numbers };
  }

  private async shift(venueId: string) {
    const open = await this.prisma.cashShift.findFirst({ where: { venueId, status: 'OPEN' } });
    if (!open) return null;
    const operator = await this.prisma.user.findUnique({
      where: { id: open.openedById },
      select: { name: true, nickname: true },
    });
    return {
      id: open.id,
      number: open.number,
      openedAt: open.openedAt,
      openedById: open.openedById,
      operatorName: operator?.name || operator?.nickname || '—',
    };
  }

  private async bookingsToday(venueId: string, day: { from: Date; to: Date }, now: Date) {
    const rows = await this.prisma.booking.findMany({
      where: { venueId, startsAt: { gte: day.from, lt: day.to }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((b) => {
      const due = bookingDue(b);
      return {
        id: b.id,
        startsAt: b.startsAt,
        type: b.type,
        packageName: b.packageName,
        people: b.people,
        contactName: b.contactName,
        contactPhone: b.contactPhone,
        amountTenge: b.amountTenge,
        prepayTenge: b.prepayTenge,
        paidTenge: b.paidTenge,
        remainingTenge: due.remaining,
        due,
        status: b.status,
        soon: bookingSoon(b.startsAt, now),
      };
    });
  }

  private async rooms(venueId: string, now: Date) {
    const rooms = await this.prisma.room.findMany({
      where: { venueId, useDevCommands: false },
      orderBy: { name: 'asc' },
      include: {
        sessions: {
          where: { status: 'ACTIVE' },
          include: { players: { include: { user: { select: { nickname: true } } } } },
          take: 1,
          orderBy: { startTime: 'desc' },
        },
      },
    });
    return rooms.map((room) => {
      const session = room.sessions[0];
      const offline = !room.lastHeartbeatAt || now.getTime() - room.lastHeartbeatAt.getTime() > 60_000;
      const remaining = session
        ? sessionRemainingSeconds({
            startTime: session.startTime,
            pausedAt: session.pausedAt,
            durationSeconds: session.deductedSeconds || room.defaultLevelDuration,
            now,
          })
        : null;
      return {
        roomId: room.id,
        name: room.name,
        status: offline ? 'OFFLINE' : session ? 'BUSY' : 'FREE',
        remainingSeconds: remaining,
        paused: !!session?.pausedAt,
        players: session ? Math.max(session.players.length, 1) : 0,
        playerNicknames: session?.players.map((p) => p.user.nickname) ?? [],
      };
    });
  }

  private async important(venueId: string, day: { from: Date; to: Date }, now: Date) {
    const p = almatyParts(now);
    const venueRooms = await this.prisma.room.findMany({
      where: { venueId },
      select: { id: true, name: true },
    });
    const roomIds = venueRooms.map((r) => r.id);
    const [birthdays, expiring, offlineRooms, lowStock, leader, eventSyncFails] = await Promise.all([
      this.prisma.$queryRaw<{ id: string; nickname: string; birthDate: Date }[]>`
        SELECT u.id, u.nickname, u."birthDate"
        FROM "users" u
        WHERE u.role = 'USER'::"Role"
          AND u."isActive" = true
          AND u."deletedAt" IS NULL
          AND u."birthDate" IS NOT NULL
          AND EXTRACT(MONTH FROM u."birthDate") = ${p.month}
          AND EXTRACT(DAY FROM u."birthDate") = ${p.day}
        ORDER BY u.nickname
        LIMIT 30
      `,
      this.prisma.minuteGrant.groupBy({
        by: ['userId'],
        where: { remainingSeconds: { gt: 0 }, expiresAt: { gt: now, lt: day.to } },
        _sum: { remainingSeconds: true },
        _min: { expiresAt: true },
      }),
      this.prisma.room.findMany({
        where: { venueId, useDevCommands: false },
        select: { id: true, name: true, lastHeartbeatAt: true },
      }),
      this.prisma.catalogItem.findMany({
        where: { active: true, trackStock: true, OR: [{ venueId }, { venueId: null }] },
        select: { id: true, name: true, stockQty: true, lowStockAt: true },
      }),
      this.rating
        .board({ period: 'month', venueId, limit: 1 })
        .then((b) => b.items[0] ?? null)
        .catch(() => null),
      roomIds.length
        ? this.prisma.auditLog.findMany({
            where: {
              action: 'ROOM_EVENTS_SYNC_FAIL',
              entityId: { in: roomIds },
              createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60_000) },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : Promise.resolve([]),
    ]);

    const expiringUsers = expiring.length
      ? await this.prisma.user.findMany({
          where: { id: { in: expiring.map((e) => e.userId) }, deletedAt: null },
          select: { id: true, nickname: true, phone: true },
        })
      : [];
    const nick = new Map(expiringUsers.map((u) => [u.id, u]));
    const roomName = new Map(venueRooms.map((r) => [r.id, r.name]));
    const seenSync = new Set<string>();
    const roomEventsSyncFails: {
      roomId: string;
      name: string;
      detail: string;
      minutes: number;
    }[] = [];
    for (const row of eventSyncFails) {
      if (!row.entityId || seenSync.has(row.entityId)) continue;
      seenSync.add(row.entityId);
      roomEventsSyncFails.push({
        roomId: row.entityId,
        name: roomName.get(row.entityId) ?? 'Комната',
        detail: row.detail ?? '',
        minutes: Math.max(0, Math.floor((now.getTime() - row.createdAt.getTime()) / 60_000)),
      });
    }

    return {
      birthdays: birthdays.map((b) => ({
        userId: b.id,
        nickname: b.nickname,
        age: p.year - new Date(b.birthDate).getUTCFullYear(),
      })),
      expiringMinutes: expiring
        .filter((e) => nick.has(e.userId))
        .map((e) => ({
          userId: e.userId,
          nickname: nick.get(e.userId)!.nickname,
          phone: nick.get(e.userId)!.phone,
          minutes: Math.floor((e._sum.remainingSeconds ?? 0) / 60),
          expiresAt: e._min.expiresAt,
        }))
        .filter((e) => e.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes),
      offlineRooms: offlineRooms
        .map((r) => ({ roomId: r.id, name: r.name, minutes: offlineAlertMinutes(r.lastHeartbeatAt, now) }))
        .filter((r): r is { roomId: string; name: string; minutes: number } => r.minutes != null),
      lowStock: lowStock.filter((i) => i.stockQty <= i.lowStockAt),
      roomEventsSyncFails,
      tournament: {
        daysLeft: daysLeftInMonth(now),
        leader: leader ? { nickname: leader.nick, points: leader.points } : null,
      },
    };
  }

  /** Выручку дня видит только владелец; оператор — свои продажи за смену. */
  private async numbers(venueId: string, day: { from: Date; to: Date }, actor: { id: string; role: Role }) {
    if (actor.role === Role.ADMIN) {
      const sum = await this.prisma.sale.aggregate({
        where: { venueId, status: 'COMPLETED', isBarter: false, createdAt: { gte: day.from, lt: day.to } },
        _sum: { totalTenge: true, refundTenge: true },
        _count: true,
      });
      return {
        scope: 'DAY' as const,
        sales: sum._count,
        revenue: (sum._sum.totalTenge ?? 0) - (sum._sum.refundTenge ?? 0),
      };
    }
    const shift = await this.prisma.cashShift.findFirst({
      where: { venueId, status: 'OPEN', openedById: actor.id },
    });
    if (!shift) return { scope: 'MY_SHIFT' as const, sales: 0, revenue: 0 };
    const sum = await this.prisma.sale.aggregate({
      where: { shiftId: shift.id, operatorId: actor.id, status: 'COMPLETED', isBarter: false },
      _sum: { totalTenge: true, refundTenge: true },
      _count: true,
    });
    return {
      scope: 'MY_SHIFT' as const,
      sales: sum._count,
      revenue: (sum._sum.totalTenge ?? 0) - (sum._sum.refundTenge ?? 0),
    };
  }
}
