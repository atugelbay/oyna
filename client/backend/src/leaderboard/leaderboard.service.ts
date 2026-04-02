import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async getLeaderboard(limit = 50) {
    const users = await this.prisma.user.findMany({
      where: { role: 'USER', isActive: true },
      orderBy: { totalScore: 'desc' },
      take: limit,
      select: {
        id: true,
        nickname: true,
        totalScore: true,
        loyaltyStatus: true,
      },
    });

    return users.map((u, i) => ({
      rank: i + 1,
      id: u.id,
      nickname: u.nickname,
      totalScore: u.totalScore,
      loyaltyStatus: u.loyaltyStatus,
    }));
  }

  async getMyRank(userId: string) {
    const allUsers = await this.prisma.user.findMany({
      where: { role: 'USER', isActive: true },
      orderBy: { totalScore: 'desc' },
      select: { id: true },
    });
    const rank = allUsers.findIndex((u) => u.id === userId) + 1;
    return { rank: rank > 0 ? rank : null, total: allUsers.length };
  }
}
