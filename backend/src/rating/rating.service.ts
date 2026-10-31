import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  almatyParts,
  monthWindow,
  rankRows,
  ratingDayWindow,
  roomSlug,
  yearWindow,
  type RoomSlug,
} from '../domain/rules';

const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

type Period = 'day' | 'month' | 'year' | 'all';

@Injectable()
export class RatingService {
  constructor(private prisma: PrismaService) {}

  resolve(input: {
    period?: string;
    date?: string;
    month?: string;
    year?: string;
    now?: Date;
  }): { period: Period; from: Date | null; to: Date | null; label: string; showingPrevious: boolean } {
    const now = input.now ?? new Date();
    const period = (['day', 'month', 'year', 'all'].includes(input.period ?? '')
      ? input.period
      : 'day') as Period;
    if (period === 'all') {
      return { period, from: null, to: null, label: 'Всё время', showingPrevious: false };
    }
    if (period === 'day') {
      if (input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        const [y, m, d] = input.date.split('-').map((n) => parseInt(n, 10));
        const from = new Date(Date.UTC(y, m - 1, d, 10, 0) - 5 * 3600000);
        const to = new Date(Date.UTC(y, m - 1, d, 23, 0) - 5 * 3600000);
        return { period, from, to, label: `Итоги дня ${input.date}`, showingPrevious: false };
      }
      const day = ratingDayWindow(now);
      return {
        period,
        from: day.from,
        to: day.to,
        label: day.showingPrevious ? `Итоги дня ${day.labelDate}` : `Сегодня, ${day.labelDate}`,
        showingPrevious: day.showingPrevious,
      };
    }
    if (period === 'month') {
      const parts = almatyParts(now);
      let year = parts.year;
      let month = parts.month;
      if (input.month && /^\d{4}-\d{2}$/.test(input.month)) {
        year = parseInt(input.month.slice(0, 4), 10);
        month = parseInt(input.month.slice(5), 10);
      }
      const w = monthWindow(year, month);
      const past = w.to.getTime() <= now.getTime();
      return {
        period,
        from: w.from,
        to: w.to,
        label: `${past ? 'Итоги: ' : ''}${MONTHS[month - 1]} ${year}`,
        showingPrevious: past,
      };
    }
    const year = input.year ? parseInt(input.year, 10) : almatyParts(now).year;
    const w = yearWindow(year);
    return { period, from: w.from, to: w.to, label: String(year), showingPrevious: w.to.getTime() <= now.getTime() };
  }

  async board(input: {
    period?: string;
    date?: string;
    month?: string;
    year?: string;
    room?: string;
    venueId?: string;
    limit?: number;
    userId?: string;
  }) {
    const window = this.resolve(input);
    const room = (input.room || 'all') as RoomSlug;
    const scores = await this.prisma.score.findMany({
      where: this.where(window, input.venueId),
      select: {
        userId: true,
        score: true,
        createdAt: true,
        user: { select: { nickname: true, loyaltyStatus: true, deletedAt: true, isActive: true } },
        room: { select: { name: true, engineRoomId: true, useDevCommands: true } },
      },
    });
    const buckets = new Map<string, { nick: string; status: string; points: number; reachedAt: Date }>();
    for (const row of scores) {
      if (row.room.useDevCommands) continue;
      const slug = roomSlug(row.room.engineRoomId, row.room.name);
      if (room !== 'all' && slug !== room) continue;
      const prev = buckets.get(row.userId);
      const points = (prev?.points ?? 0) + row.score;
      const reachedAt = !prev || row.createdAt > prev.reachedAt ? row.createdAt : prev.reachedAt;
      const nick = row.user.deletedAt ? 'Удалённый игрок' : row.user.nickname;
      buckets.set(row.userId, {
        nick,
        status: row.user.loyaltyStatus,
        points,
        reachedAt,
      });
    }
    const ranked = rankRows(
      [...buckets.entries()].map(([userId, v]) => ({ userId, points: v.points, reachedAt: v.reachedAt })),
    );
    const limit = Math.min(input.limit ?? 50, 50);
    const items = ranked.slice(0, limit).map((row, index) => {
      const meta = buckets.get(row.userId)!;
      return {
        place: index + 1,
        nick: meta.nick,
        status: meta.status,
        points: row.points,
        userId: row.userId,
      };
    });
    let me: { place: number; total: number; points: number } | null = null;
    if (input.userId) {
      const place = ranked.findIndex((r) => r.userId === input.userId);
      if (place >= 0) {
        me = { place: place + 1, total: ranked.length, points: ranked[place].points };
      }
    }
    return {
      period: window.period,
      room,
      from: window.from,
      to: window.to,
      label: window.label,
      showingPrevious: window.showingPrevious,
      updatedAt: new Date().toISOString(),
      items,
      totalPlayers: ranked.length,
      me,
    };
  }

  async kings(input: { period?: string; date?: string; month?: string; year?: string; venueId?: string }) {
    const rooms: RoomSlug[] = ['all', 'megagrid', 'arena', 'hide', 'lasers'];
    const out: Record<string, { nick: string; points: number; status: string } | null> = {};
    for (const room of rooms) {
      const board = await this.board({ ...input, room, limit: 1 });
      const top = board.items[0];
      out[room] = top ? { nick: top.nick, points: top.points, status: top.status } : null;
    }
    return out;
  }

  /** Rows for PUT /v1/hall_records. Overall rating, same for every room of the venue. */
  async hallPayload(venueId: string) {
    const now = new Date();
    const day = this.resolve({ period: 'day', now });
    const month = this.resolve({ period: 'month', now });
    const [today, monthRows, allTime] = await Promise.all([
      this.hallRows(venueId, day.from, day.to),
      this.hallRows(venueId, month.from, month.to),
      this.hallRows(venueId, null, null),
    ]);
    return { today, month: monthRows, all_time: allTime };
  }

  private async hallRows(venueId: string, from: Date | null, to: Date | null) {
    const window = { from, to, period: 'day' as const, label: '', showingPrevious: false };
    const scores = await this.prisma.score.findMany({
      where: this.where(window, venueId),
      include: {
        user: { select: { nickname: true, name: true, deletedAt: true } },
        mode: { select: { config: true, name: true } },
        room: { select: { useDevCommands: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const byUser = new Map<string, { nick: string; points: number; reachedAt: Date; modeId: string; playedAt: Date }>();
    for (const row of scores) {
      if (row.room.useDevCommands) continue;
      const modeId = modeIdOf(row.mode);
      if (!modeId) continue;
      const prev = byUser.get(row.userId);
      const nick = (row.user.deletedAt ? 'Deleted' : row.user.nickname || row.user.name || 'Player').trim().slice(0, 32);
      byUser.set(row.userId, {
        nick,
        points: (prev?.points ?? 0) + Math.max(0, Math.trunc(row.score)),
        reachedAt: row.createdAt,
        modeId: prev?.modeId && row.score < (prev.points) ? prev.modeId : modeId,
        playedAt: row.createdAt,
      });
    }
    return rankRows(
      [...byUser.entries()].map(([userId, v]) => ({ userId, points: v.points, reachedAt: v.reachedAt })),
    )
      .slice(0, 10)
      .map((row) => {
        const meta = byUser.get(row.userId)!;
        return {
          nick: meta.nick || 'Player',
          score: meta.points,
          mode_id: meta.modeId,
          played_at: toRoomApiTimestamp(meta.playedAt),
        };
      });
  }

  private where(
    window: { from: Date | null; to: Date | null },
    venueId?: string,
  ): Prisma.ScoreWhereInput {
    const started: Prisma.GameSessionWhereInput = {
      countsForRating: true,
      isTournament: false,
      ...(venueId ? { venueId } : {}),
    };
    if (window.from && window.to) {
      started.AND = [
        {
          OR: [
            { startTime: { gte: window.from, lt: window.to } },
            { startTime: null, createdAt: { gte: window.from, lt: window.to } },
          ],
        },
      ];
    }
    return { session: started };
  }
}

function modeIdOf(mode: { config: Prisma.JsonValue | null; name: string }): string | null {
  if (mode.config && typeof mode.config === 'object' && !Array.isArray(mode.config)) {
    const raw = (mode.config as Record<string, unknown>).mode_id ?? (mode.config as Record<string, unknown>).modeId;
    if (typeof raw === 'string' && /^[a-z]+\.[a-z0-9_]+$/.test(raw)) return raw;
  }
  return null;
}

function toRoomApiTimestamp(d: Date): string {
  return d.toISOString().replace(/(\.\d{3})\d*Z$/, '$1Z');
}
