import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { almatyDayBounds } from './room-api.util';

@Injectable()
export class PlayerLobbyService {
  constructor(private prisma: PrismaService) {}

  /** Карта unlocked для POST /lobby/players (режим → высший открытый уровень). */
  async unlockedMap(userId: string): Promise<Record<string, number>> {
    const rows = await this.prisma.playerModeUnlock.findMany({
      where: { userId },
      select: { engineModeId: true, unlockedLevel: true },
    });
    const out: Record<string, number> = {};
    for (const r of rows) {
      if (r.unlockedLevel >= 1) out[r.engineModeId] = r.unlockedLevel;
    }
    return out;
  }

  /**
   * Рейтинг за текущий месяц (сумма Score) и место 1..N среди игравших в этом месяце.
   * Нет очков за месяц → null (игра просто не показывает).
   */
  async monthlyRatingRank(
    userId: string,
  ): Promise<{ rating_month: number | null; rank_month: number | null }> {
    const { startOfMonth } = almatyDayBounds();
    const aggregates = await this.prisma.score.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: startOfMonth } },
      _sum: { score: true },
    });
    const byUser = new Map(
      aggregates.map((a) => [a.userId, a._sum.score ?? 0] as const),
    );
    if (!byUser.has(userId)) {
      return { rating_month: null, rank_month: null };
    }
    const rating = byUser.get(userId) ?? 0;
    let rank = 1;
    for (const s of byUser.values()) {
      if (s > rating) rank += 1;
    }
    return { rating_month: rating, rank_month: rank };
  }

  /**
   * После level_finished с unlocks_next: открыть level+1 всем игрокам сессии.
   */
  async applyUnlocksNext(params: {
    userIds: string[];
    engineModeId: string;
    clearedLevel: number;
  }) {
    const nextLevel = Math.max(1, Math.floor(params.clearedLevel) + 1);
    const modeId = params.engineModeId;
    if (!modeId.includes('.')) return { updated: 0 };

    let updated = 0;
    for (const userId of params.userIds) {
      const existing = await this.prisma.playerModeUnlock.findUnique({
        where: {
          userId_engineModeId: { userId, engineModeId: modeId },
        },
      });
      if (existing) {
        if (existing.unlockedLevel >= nextLevel) continue;
        await this.prisma.playerModeUnlock.update({
          where: { id: existing.id },
          data: { unlockedLevel: nextLevel },
        });
      } else {
        await this.prisma.playerModeUnlock.create({
          data: {
            userId,
            engineModeId: modeId,
            unlockedLevel: nextLevel,
          },
        });
      }
      updated += 1;
    }
    return { updated, unlockedLevel: nextLevel };
  }

  /** Поля игрока для POST /lobby/players (кроме player_id/nick/source). */
  async lobbyPlayerExtras(userId: string) {
    const [balance, unlocked, rating] = await Promise.all([
      this.prisma.accountBalance.findUnique({ where: { userId } }),
      this.unlockedMap(userId),
      this.monthlyRatingRank(userId),
    ]);
    const minutesLeft = balance
      ? Math.floor(balance.availableSeconds / 60)
      : null;
    return {
      minutes_left: minutesLeft,
      unlocked: Object.keys(unlocked).length ? unlocked : undefined,
      rating_month: rating.rating_month,
      rank_month: rating.rank_month,
    };
  }
}
