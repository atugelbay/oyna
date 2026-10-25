import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, SessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const MIN_BALANCE_SECONDS = 600;

@Injectable()
export class LobbyService {
  constructor(private prisma: PrismaService) {}

  /** Публичный превью для страницы /j/:token */
  async preview(token: string) {
    const room = await this.findRoomByToken(token);
    const expired =
      !room.lobbyJoinExpiresAt || room.lobbyJoinExpiresAt.getTime() < Date.now();
    return {
      roomId: room.id,
      roomName: room.name,
      venueName: room.venue.name,
      expiresAt: room.lobbyJoinExpiresAt?.toISOString() ?? null,
      expired,
      minBalanceMinutes: MIN_BALANCE_SECONDS / 60,
    };
  }

  async join(token: string, userId: string) {
    const room = await this.findRoomByToken(token);
    if (
      !room.lobbyJoinExpiresAt ||
      room.lobbyJoinExpiresAt.getTime() < Date.now()
    ) {
      throw new GoneException(
        'QR истёк. Попросите на ресепшене обновить код на экране комнаты.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { balance: true },
    });
    if (!user || !user.isActive) {
      throw new NotFoundException('Игрок не найден');
    }

    const available = user.balance?.availableSeconds ?? 0;
    if (available < MIN_BALANCE_SECONDS) {
      throw new BadRequestException(
        'Недостаточно минут на балансе. Пополните баланс',
      );
    }

    const busy = await this.prisma.gameSessionPlayer.findFirst({
      where: {
        userId,
        session: {
          status: { in: [SessionStatus.PENDING, SessionStatus.ACTIVE] },
          roomId: { not: room.id },
        },
      },
      include: { session: { include: { room: { select: { name: true } } } } },
    });
    if (busy) {
      throw new BadRequestException(
        `Вы уже в лобби комнаты «${busy.session.room.name}»`,
      );
    }

    const unlocks = await this.prisma.playerModeUnlock.findMany({
      where: { userId },
      select: { engineModeId: true, unlockedLevel: true },
    });
    const unlocked: Record<string, number> = {};
    for (const u of unlocks) {
      if (u.unlockedLevel >= 1) unlocked[u.engineModeId] = u.unlockedLevel;
    }

    const { startOfMonth } = this.almatyMonthStart();
    const aggregates = await this.prisma.score.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: startOfMonth } },
      _sum: { score: true },
    });
    const byUser = new Map(
      aggregates.map((a) => [a.userId, a._sum.score ?? 0] as const),
    );
    let rating_month: number | null = null;
    let rank_month: number | null = null;
    if (byUser.has(userId)) {
      rating_month = byUser.get(userId) ?? 0;
      rank_month = 1;
      for (const s of byUser.values()) {
        if (s > (rating_month ?? 0)) rank_month += 1;
      }
    }

    const body: Record<string, unknown> = {
      player_id: user.id,
      nick: (user.nickname ?? user.name ?? 'Player').slice(0, 32),
      minutes_left: Math.floor(available / 60),
      source: 'qr',
    };
    if (Object.keys(unlocked).length) body.unlocked = unlocked;
    if (rating_month != null) body.rating_month = rating_month;
    if (rank_month != null) body.rank_month = rank_month;

    await this.prisma.roomAgentCommand.create({
      data: {
        roomId: room.id,
        type: 'room_api.lobby_add_player',
        payload: {
          method: 'POST',
          path: '/lobby/players',
          body: body as Prisma.InputJsonValue,
          idempotency_key: randomUUID(),
        },
      },
    });

    return {
      ok: true,
      roomId: room.id,
      roomName: room.name,
      venueName: room.venue.name,
      minutesLeft: Math.floor(available / 60),
      message: 'Вы в лобби. На экране комнаты нажмите «НАЧАТЬ ИГРУ».',
    };
  }

  private async findRoomByToken(token: string) {
    const clean = String(token || '').trim();
    if (!clean) throw new NotFoundException('Некорректный QR');

    const room = await this.prisma.room.findFirst({
      where: { lobbyJoinToken: clean },
      include: { venue: { select: { id: true, name: true } } },
    });
    if (!room) throw new NotFoundException('QR не найден или уже недействителен');
    return room;
  }

  private almatyMonthStart() {
    const offsetMs = 5 * 60 * 60 * 1000;
    const now = new Date();
    const local = new Date(now.getTime() + offsetMs);
    const startOfMonth = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - offsetMs,
    );
    return { startOfMonth };
  }
}
