import { Injectable, Logger } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAgentCommandsService } from './room-agent-commands.service';

/** TTL QR на HUD (сек). Игра по expires_at сама гасит картинку. */
const DEFAULT_TTL_SEC = 10 * 60;

@Injectable()
export class LobbyQrService {
  private readonly logger = new Logger(LobbyQrService.name);

  constructor(
    private prisma: PrismaService,
    private roomAgentCommands: RoomAgentCommandsService,
  ) {}

  /**
   * Выпустить новый join-токен и поставить в очередь PUT /v1/lobby/qr.
   * Если PLAYER_APP_PUBLIC_URL не задан — ничего не шлём (не ломаем зал).
   */
  async pushLobbyQr(roomId: string, reason: string): Promise<string> {
    const base = (process.env.PLAYER_APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
    if (!base) {
      this.logger.debug(
        `skip lobby QR room=${roomId} reason=${reason}: PLAYER_APP_PUBLIC_URL empty`,
      );
      return 'qr_skipped_no_public_url';
    }

    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return 'qr_skipped_room_missing';
    }

    const ttlSec = Math.max(
      60,
      parseInt(process.env.LOBBY_QR_TTL_SEC || String(DEFAULT_TTL_SEC), 10) ||
        DEFAULT_TTL_SEC,
    );
    const token = randomBytes(9).toString('base64url').replace(/=/g, '');
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    // URL для HUD; страница join может появиться позже — формат стабильный.
    const url = `${base}/j/${encodeURIComponent(token)}`;

    await this.prisma.room.update({
      where: { id: roomId },
      data: {
        lobbyJoinToken: token,
        lobbyJoinExpiresAt: expiresAt,
      },
    });

    const body: Prisma.InputJsonObject = {
      url,
      expires_at: expiresAt.toISOString(),
    };

    await this.roomAgentCommands.enqueue(
      roomId,
      'room_api.lobby_qr',
      {
        method: 'PUT',
        path: '/lobby/qr',
        body,
        idempotency_key: randomUUID(),
      },
    );

    this.logger.log(
      `lobby QR enqueued room=${roomId} reason=${reason} expires=${expiresAt.toISOString()}`,
    );
    return `qr_enqueued:${url}`;
  }

  /** Обновить QR, если нет токена или до истечения < 2 мин. */
  async refreshIfNeeded(roomId: string, reason: string): Promise<string> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { lobbyJoinToken: true, lobbyJoinExpiresAt: true },
    });
    if (!room) return 'qr_skipped_room_missing';

    const soon = Date.now() + 2 * 60 * 1000;
    const expired =
      !room.lobbyJoinToken ||
      !room.lobbyJoinExpiresAt ||
      room.lobbyJoinExpiresAt.getTime() < soon;

    if (!expired) {
      return 'qr_still_valid';
    }
    return this.pushLobbyQr(roomId, reason);
  }
}
