import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const OFFSET = 5 * 60 * 60 * 1000;

function almatyParts(now: Date) {
  const local = new Date(now.getTime() + OFFSET);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
  };
}

function almatyDate(year: number, month: number, day: number, hour = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour) - OFFSET);
}

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  window(input: { period?: string; date?: string; month?: string; year?: string }) {
    const now = new Date();
    const period = input.period || 'day';
    const p = almatyParts(now);
    if (period === 'all') return { period, from: null as Date | null, to: null as Date | null, label: 'Барлық уақыт' };
    if (period === 'month') {
      let year = p.year;
      let month = p.month;
      if (input.month && /^\d{4}-\d{2}$/.test(input.month)) {
        year = parseInt(input.month.slice(0, 4), 10);
        month = parseInt(input.month.slice(5), 10);
      }
      const from = almatyDate(year, month, 1, 0);
      const to = month === 12 ? almatyDate(year + 1, 1, 1, 0) : almatyDate(year, month + 1, 1, 0);
      return { period, from, to, label: `${year}-${String(month).padStart(2, '0')}` };
    }
    if (period === 'year') {
      const year = input.year ? parseInt(input.year, 10) : p.year;
      return { period, from: almatyDate(year, 1, 1, 0), to: almatyDate(year + 1, 1, 1, 0), label: String(year) };
    }
    if (input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      const [y, m, d] = input.date.split('-').map((n) => parseInt(n, 10));
      return { period: 'day', from: almatyDate(y, m, d, 10), to: almatyDate(y, m, d, 23), label: input.date };
    }
    const showingPrevious = p.hour < 10;
    const base = showingPrevious ? almatyDate(p.year, p.month, p.day - 1, 10) : almatyDate(p.year, p.month, p.day, 10);
    const bp = almatyParts(base);
    return {
      period: 'day',
      from: almatyDate(bp.year, bp.month, bp.day, 10),
      to: almatyDate(bp.year, bp.month, bp.day, 23),
      label: `${bp.year}-${String(bp.month).padStart(2, '0')}-${String(bp.day).padStart(2, '0')}`,
      showingPrevious,
    };
  }

  async getLeaderboard(input: {
    limit?: number;
    period?: string;
    room?: string;
    date?: string;
    month?: string;
    year?: string;
    userId?: string;
  }) {
    const win = this.window(input);
    const room = input.room || 'all';
    const rows = await this.prisma.$queryRaw<
      { userId: string; nickname: string; loyaltyStatus: string; points: number; reached: Date; deletedAt: Date | null; engine: string | null; name: string }[]
    >`
      SELECT u.id AS "userId", u.nickname, u."loyaltyStatus", u."deletedAt",
             SUM(s.score)::int AS points, MAX(s."createdAt") AS reached,
             r."engineRoomId" AS engine, r.name
      FROM scores s
      JOIN game_sessions gs ON gs.id = s."sessionId"
      JOIN rooms r ON r.id = s."roomId"
      JOIN users u ON u.id = s."userId"
      WHERE gs."countsForRating" = true
        AND gs."isTournament" = false
        AND r."useDevCommands" = false
        AND (${win.from}::timestamp IS NULL OR COALESCE(gs."startTime", gs."createdAt") >= ${win.from})
        AND (${win.to}::timestamp IS NULL OR COALESCE(gs."startTime", gs."createdAt") < ${win.to})
      GROUP BY u.id, u.nickname, u."loyaltyStatus", u."deletedAt", r."engineRoomId", r.name, s."userId"
    `;
    const buckets = new Map<string, { nickname: string; loyaltyStatus: string; points: number; reached: Date }>();
    for (const row of rows) {
      const blob = `${row.engine ?? ''} ${row.name}`.toLowerCase();
      const slug = blob.includes('mega') ? 'megagrid' : blob.includes('arena') ? 'arena' : blob.includes('hide') ? 'hide' : blob.includes('laser') ? 'lasers' : 'other';
      if (room !== 'all' && slug !== room) continue;
      const prev = buckets.get(row.userId);
      buckets.set(row.userId, {
        nickname: row.deletedAt ? 'Удалённый игрок' : row.nickname,
        loyaltyStatus: row.loyaltyStatus,
        points: (prev?.points ?? 0) + Number(row.points),
        reached: !prev || new Date(row.reached) > prev.reached ? new Date(row.reached) : prev.reached,
      });
    }
    const ranked = [...buckets.entries()].sort((a, b) => {
      if (b[1].points !== a[1].points) return b[1].points - a[1].points;
      return a[1].reached.getTime() - b[1].reached.getTime();
    });
    const limit = Math.min(input.limit ?? 50, 50);
    const items = ranked.slice(0, limit).map(([id, row], index) => ({
      rank: index + 1,
      id,
      nickname: row.nickname,
      totalScore: row.points,
      loyaltyStatus: row.loyaltyStatus,
    }));
    let me = null as { place: number; total: number; points: number } | null;
    if (input.userId) {
      const place = ranked.findIndex(([id]) => id === input.userId);
      if (place >= 0) me = { place: place + 1, total: ranked.length, points: ranked[place][1].points };
    }
    return { label: win.label, period: win.period, room, items, me, total: ranked.length };
  }
}
