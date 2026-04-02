import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async getMySessions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const sessionPlayers = await this.prisma.gameSessionPlayer.findMany({
      where: { userId },
      orderBy: { session: { createdAt: 'desc' } },
      skip,
      take: limit,
      include: {
        session: {
          include: {
            venue: { select: { id: true, name: true, city: true } },
            room: { select: { id: true, name: true, type: true } },
            mode: { select: { id: true, name: true, type: true } },
            scores: {
              where: { userId },
              select: { score: true },
            },
          },
        },
      },
    });

    const total = await this.prisma.gameSessionPlayer.count({ where: { userId } });

    return {
      data: sessionPlayers.map((sp) => ({
        id: sp.session.id,
        status: sp.session.status,
        startTime: sp.session.startTime,
        endTime: sp.session.endTime,
        deductedSeconds: sp.session.deductedSeconds,
        venue: sp.session.venue,
        room: sp.session.room,
        mode: sp.session.mode,
        myScore: sp.session.scores[0]?.score ?? null,
        createdAt: sp.session.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
