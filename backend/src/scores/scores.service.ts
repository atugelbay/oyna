import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ScoreFilter {
  userId?: string;
  roomId?: string;
  modeId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ScoresService {
  constructor(private prisma: PrismaService) {}

  async findAll(filter: ScoreFilter) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filter.userId) where.userId = filter.userId;
    if (filter.roomId) where.roomId = filter.roomId;
    if (filter.modeId) where.modeId = filter.modeId;

    const [scores, total] = await Promise.all([
      this.prisma.score.findMany({
        where,
        include: {
          user: { select: { id: true, nickname: true } },
          room: { select: { id: true, name: true } },
          mode: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.score.count({ where }),
    ]);

    return {
      data: scores,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async getTopByRoom(roomId: string, limit = 50) {
    const scores = await this.prisma.score.groupBy({
      by: ['userId'],
      where: { roomId },
      _sum: { score: true },
      orderBy: { _sum: { score: 'desc' } },
      take: limit,
    });

    const userIds = scores.map((s) => s.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nickname: true, name: true, loyaltyStatus: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return scores.map((s, index) => ({
      rank: index + 1,
      userId: s.userId,
      user: userMap.get(s.userId),
      totalScore: s._sum.score,
    }));
  }

  async getLeaderboard(params: {
    venueId?: string;
    roomId?: string;
    period?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;

    const where: any = {};
    if (params.roomId) where.roomId = params.roomId;
    if (params.venueId) where.session = { venueId: params.venueId };

    if (params.period) {
      const now = new Date();
      let dateFrom: Date;
      switch (params.period) {
        case 'day':
          dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week': {
          const day = now.getDay() || 7;
          dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
          break;
        }
        case 'month':
          dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          dateFrom = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          dateFrom = new Date(0);
      }
      where.createdAt = { gte: dateFrom };
    }

    const scores = await this.prisma.score.groupBy({
      by: ['userId'],
      where,
      _sum: { score: true },
      orderBy: { _sum: { score: 'desc' } },
      take: limit,
      skip: (page - 1) * limit,
    });

    const userIds = scores.map((s) => s.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nickname: true, name: true, loyaltyStatus: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return scores.map((s, index) => ({
      rank: (page - 1) * limit + index + 1,
      userId: s.userId,
      nickname: userMap.get(s.userId)?.nickname,
      score: s._sum.score ?? 0,
    }));
  }

  async getUserStats(userId: string) {
    const [totalGames, totalScore, bestScore] = await Promise.all([
      this.prisma.score.count({ where: { userId } }),
      this.prisma.score.aggregate({
        where: { userId },
        _sum: { score: true },
      }),
      this.prisma.score.findFirst({
        where: { userId },
        orderBy: { score: 'desc' },
        include: {
          room: { select: { id: true, name: true } },
          mode: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      userId,
      totalGames,
      totalScore: totalScore._sum.score || 0,
      bestScore: bestScore
        ? {
            score: bestScore.score,
            room: bestScore.room,
            mode: bestScore.mode,
            date: bestScore.createdAt,
          }
        : null,
    };
  }
}


