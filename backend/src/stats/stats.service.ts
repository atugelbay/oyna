import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionStatus, TransactionType } from '@prisma/client';

function getDateRange(period: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  let from: Date;

  switch (period) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week': {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday as start of week
      from = new Date(now);
      from.setDate(now.getDate() - diff);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case 'month':
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  return { from, to };
}

function parseDateOnlyYmd(s: string, endOfDay: boolean): Date {
  const parts = s.split('-').map((x) => parseInt(x, 10));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return new Date(NaN);
  return endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
}

function resolveStatsRange(
  period: string | undefined,
  fromStr?: string,
  toStr?: string,
): { from: Date; to: Date } {
  if (fromStr && toStr) {
    const from = parseDateOnlyYmd(fromStr, false);
    const to = parseDateOnlyYmd(toStr, true);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) {
      return { from, to };
    }
  }
  return getDateRange(period || 'month');
}

type PaymentBucket = 'cash' | 'card' | 'kaspi_qr' | 'other';

const PAYMENT_BUCKET_ORDER: PaymentBucket[] = ['cash', 'card', 'kaspi_qr', 'other'];

const PAYMENT_LABELS: Record<PaymentBucket, string> = {
  cash: 'Наличные',
  card: 'Платежные карты',
  kaspi_qr: 'Kaspi QR',
  other: 'Прочее',
};

function bucketForPurchase(
  description: string | null | undefined,
  source: string,
): PaymentBucket {
  if (description) {
    const m = description.match(/Пополнение\s*\([^,]+,\s*(cash|card|kaspi_qr)\)/);
    if (m?.[1] === 'cash') return 'cash';
    if (m?.[1] === 'card') return 'card';
    if (m?.[1] === 'kaspi_qr') return 'kaspi_qr';
  }
  if (source === 'CASHIER') return 'cash';
  if (source === 'ONLINE') return 'card';
  return 'other';
}

function getTodayRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(now);
  return { from, to };
}

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(venueId?: string) {
    const { from: todayStart } = getTodayRange();

    const sessionWhere: any = {
      createdAt: { gte: todayStart },
      status: { in: [SessionStatus.ACTIVE, SessionStatus.COMPLETED] },
    };
    if (venueId) sessionWhere.venueId = venueId;

    const roomWhere: any = {};
    if (venueId) roomWhere.venueId = venueId;

    const [sessions, rooms, totalSessions, usersVisitedToday, newPlayersToday] =
      await Promise.all([
        this.prisma.gameSession.findMany({
          where: sessionWhere,
          include: {
            room: { select: { id: true, name: true } },
            players: {
              include: {
                user: { select: { nickname: true } },
              },
              orderBy: { id: 'asc' },
            },
          },
        }),
        this.prisma.room.findMany({
          where: roomWhere,
          include: {
            sessions: {
              where: {
                status: { in: [SessionStatus.ACTIVE, SessionStatus.PENDING] },
              },
              include: {
                players: {
                  include: {
                    user: { select: { nickname: true } },
                  },
                  orderBy: { id: 'asc' },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.gameSession.count({ where: sessionWhere }),
        this.prisma.gameSessionPlayer.findMany({
          where: {
            session: {
              createdAt: { gte: todayStart },
              ...(venueId ? { venueId } : {}),
            },
          },
          select: { userId: true },
          distinct: ['userId'],
        }),
        this.prisma.user.count({
          where: {
            createdAt: { gte: todayStart },
          },
        }),
      ]);

    const sessionsByRoom = Array.from(
      sessions.reduce(
        (acc, s) => {
          const key = s.room.id;
          if (!acc.has(key)) acc.set(key, { name: s.room.name, count: 0, roomId: s.room.id });
          acc.get(key)!.count++;
          return acc;
        },
        new Map<string, { name: string; count: number; roomId: string }>(),
      ),
    ).map(([, v]) => v);

    const roomsResult = rooms.map((room) => {
      const activeSession = room.sessions[0];
      let status: 'free' | 'occupied' | 'waiting' = 'free';
      let playerNickname: string | undefined;

      if (activeSession) {
        if (activeSession.status === SessionStatus.ACTIVE) {
          status = 'occupied';
          const sessionPlayerNicknames = activeSession.players
            .map((p) => p.user.nickname)
            .filter((n): n is string => Boolean(n && String(n).trim()));
          const firstPlayer = activeSession.players[0];
          playerNickname = firstPlayer?.user.nickname;
          const sessionStart =
            activeSession.startTime ?? activeSession.createdAt;
          return {
            id: room.id,
            name: room.name,
            status,
            sessionPlayerNicknames,
            sessionPlayerUserIds: activeSession.players.map((p) => String(p.userId)),
            activeSessionId: String(activeSession.id),
            sessionStartTime: sessionStart.toISOString(),
            levelDurationSeconds: room.defaultLevelDuration,
            pausedAt: activeSession.pausedAt?.toISOString(),
            ...(playerNickname && { playerNickname }),
          };
        } else if (activeSession.status === SessionStatus.PENDING) {
          status = 'waiting';
          const waitingPlayerNicknames = activeSession.players
            .map((p) => p.user.nickname)
            .filter((n): n is string => Boolean(n && String(n).trim()));
          const firstPlayer = activeSession.players[0];
          playerNickname = firstPlayer?.user.nickname;
          return {
            id: room.id,
            name: room.name,
            status,
            waitingPlayerNicknames,
            pendingSessionId: activeSession.id,
            pendingSessionToken: activeSession.sessionToken,
            ...(playerNickname && { playerNickname }),
          };
        }
      }

      return {
        id: room.id,
        name: room.name,
        status,
        ...(playerNickname && { playerNickname }),
      };
    });

    return {
      sessionsByRoom,
      rooms: roomsResult,
      totalSessions,
      totalPlayers: usersVisitedToday.length,
      newPlayers: newPlayersToday,
    };
  }

  async getRevenue(
    venueId?: string,
    period: string = 'month',
    fromStr?: string,
    toStr?: string,
  ) {
    const { from, to } = resolveStatsRange(period, fromStr, toStr);

    const where: any = {
      createdAt: { gte: from, lte: to },
      type: TransactionType.PURCHASE,
    };
    if (venueId) where.venueId = venueId;

    const transactions = await this.prisma.transaction.findMany({
      where,
      select: { source: true, amountTenge: true, description: true },
    });

    const byBucket = new Map<PaymentBucket, number>();
    for (const b of PAYMENT_BUCKET_ORDER) byBucket.set(b, 0);

    for (const t of transactions) {
      const b = bucketForPurchase(t.description, t.source);
      byBucket.set(b, (byBucket.get(b) ?? 0) + t.amountTenge);
    }

    const items = PAYMENT_BUCKET_ORDER.filter((b) => (byBucket.get(b) ?? 0) > 0).map(
      (key) => ({
        key,
        name: PAYMENT_LABELS[key],
        amount: byBucket.get(key) ?? 0,
      }),
    );

    const total = items.reduce((sum, i) => sum + i.amount, 0);

    return { items, total };
  }

  async getOverview(
    venueId?: string,
    period: string = 'month',
    fromStr?: string,
    toStr?: string,
  ) {
    const { from, to } = resolveStatsRange(period, fromStr, toStr);

    const sessionWhere: any = {
      createdAt: { gte: from, lte: to },
    };
    if (venueId) sessionWhere.venueId = venueId;

    const transactionWhere: any = {
      type: TransactionType.BONUS,
      createdAt: { gte: from, lte: to },
    };
    if (venueId) transactionWhere.venueId = venueId;

    const [
      sessions,
      totalSessions,
      sessionsWithDeducted,
      bonusTransactions,
      userCreatedInPeriod,
      totalPlayersRegistered,
    ] = await Promise.all([
      this.prisma.gameSession.findMany({
        where: sessionWhere,
        include: {
          players: { select: { userId: true } },
          room: { select: { id: true, name: true } },
        },
      }),
      this.prisma.gameSession.count({ where: sessionWhere }),
      this.prisma.gameSession.findMany({
        where: {
          ...sessionWhere,
          deductedSeconds: { gt: 0 },
        },
        select: { deductedSeconds: true },
      }),
      this.prisma.transaction.findMany({
        where: transactionWhere,
        select: { equivalentSeconds: true },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: from, lte: to },
        },
      }),
      this.prisma.user.count(),
    ]);

    const avgSessionMinutes =
      sessionsWithDeducted.length > 0
        ? sessionsWithDeducted.reduce((sum, s) => sum + s.deductedSeconds, 0) /
          sessionsWithDeducted.length /
          60
        : 0;

    const bonusMinutesGiven =
      bonusTransactions.reduce((sum, t) => sum + Math.max(0, t.equivalentSeconds), 0) / 60;

    const popularRooms = Array.from(
      sessions.reduce(
        (acc, s) => {
          const r = s.room;
          if (!acc.has(r.id)) acc.set(r.id, { name: r.name, sessions: 0 });
          acc.get(r.id)!.sessions++;
          return acc;
        },
        new Map<string, { name: string; sessions: number }>(),
      ),
    )
      .map(([, v]) => v)
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    return {
      totalPlayers: totalPlayersRegistered,
      newPlayers: userCreatedInPeriod,
      totalSessions,
      avgSessionMinutes: Math.round(avgSessionMinutes * 100) / 100,
      bonusMinutesGiven: Math.round(bonusMinutesGiven * 100) / 100,
      bonusSessionsGiven: bonusTransactions.length,
      popularRooms,
    };
  }
}


