import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAgentCommandsService } from '../station/room-agent-commands.service';
import { StartSessionDto } from './dto/start-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import {
  Prisma,
  SessionStatus,
  TransactionType,
  TransactionSource,
} from '@prisma/client';

/** Минимум на балансе у каждого игрока для старта сессии (10 мин) */
const MIN_BALANCE_SECONDS = 600;

/** Команда агенту: HTTP-вызов в Room API v1 на моноблоке. */
function roomApiCall(
  method: string,
  path: string,
  body: Record<string, unknown> | null = null,
): Prisma.InputJsonObject {
  return {
    method,
    path,
    body: body as Prisma.InputJsonValue | null,
    idempotency_key: randomUUID(),
  };
}

function modeIdFromGameMode(mode: {
  name: string;
  config: Prisma.JsonValue | null;
}): string | null {
  if (mode.config && typeof mode.config === 'object' && !Array.isArray(mode.config)) {
    const cfg = mode.config as Record<string, unknown>;
    const raw = cfg.mode_id ?? cfg.modeId;
    if (typeof raw === 'string' && raw.includes('.')) return raw;
  }
  return null;
}

@Injectable()
export class GameSessionsService {
  constructor(
    private prisma: PrismaService,
    private roomAgentCommands: RoomAgentCommandsService,
  ) {}

  /** CRM может передать primary key или sessionToken (оба uuid) */
  private async findSessionByIdOrToken(idOrToken: string) {
    const byId = await this.prisma.gameSession.findUnique({
      where: { id: idOrToken },
    });
    if (byId) return byId;
    return this.prisma.gameSession.findUnique({
      where: { sessionToken: idOrToken },
    });
  }

  async startSession(dto: StartSessionDto) {
    const room = await this.prisma.room.findUnique({
      where: { id: dto.roomId },
    });
    if (!room) throw new NotFoundException('Комната не найдена');

    const mode = await this.prisma.gameMode.findUnique({
      where: { id: dto.modeId },
    });
    if (!mode) throw new NotFoundException('Режим не найден');

    for (const playerId of dto.playerIds) {
      const balance = await this.prisma.accountBalance.findUnique({
        where: { userId: playerId },
      });

      if (!balance || balance.availableSeconds < MIN_BALANCE_SECONDS) {
        const user = await this.prisma.user.findUnique({
          where: { id: playerId },
        });
        throw new BadRequestException(
          `У игрока ${user?.nickname || playerId} недостаточно времени на балансе (нужно минимум ${MIN_BALANCE_SECONDS / 60} мин у каждого)`,
        );
      }
    }

    const session = await this.prisma.gameSession.create({
      data: {
        roomId: dto.roomId,
        modeId: dto.modeId,
        venueId: dto.venueId,
        status: SessionStatus.PENDING,
        players: {
          create: dto.playerIds.map((userId) => ({ userId })),
        },
      },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, nickname: true, name: true },
            },
          },
        },
        room: true,
        mode: true,
      },
    });

    // Room API v1: CRM кладёт игроков в лобби моноблока; старт — кнопка на игре
    // (или POST /v1/_dev/start в dev через activate).
    for (const p of session.players) {
      const balance = await this.prisma.accountBalance.findUnique({
        where: { userId: p.userId },
      });
      const minutesLeft = balance
        ? Math.floor(balance.availableSeconds / 60)
        : null;
      await this.roomAgentCommands.enqueue(
        session.roomId,
        'room_api.lobby_add_player',
        roomApiCall('POST', '/lobby/players', {
          player_id: p.user.id,
          nick: (p.user.nickname ?? p.user.name ?? 'Player').slice(0, 32),
          minutes_left: minutesLeft,
          source: 'operator',
        }),
        session.id,
      );
    }

    const modeId = modeIdFromGameMode(session.mode);
    if (modeId) {
      await this.roomAgentCommands.enqueue(
        session.roomId,
        'room_api.dev_select',
        roomApiCall('POST', '/_dev/select', {
          mode_id: modeId,
          level: 1,
        }),
        session.id,
      );
    }

    return {
      sessionId: session.id,
      sessionToken: session.sessionToken,
      room: { id: session.room.id, name: session.room.name, type: session.room.type },
      mode: { id: session.mode.id, name: session.mode.name, type: session.mode.type, config: session.mode.config },
      players: session.players.map((p) => ({
        userId: p.user.id,
        nickname: p.user.nickname,
        name: p.user.name,
      })),
      defaultLevelDuration: room.defaultLevelDuration,
    };
  }

  async activateSession(sessionToken: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { sessionToken },
      include: {
        mode: true,
        players: {
          include: {
            user: { select: { id: true, nickname: true, name: true } },
          },
        },
      },
    });

    if (!session) throw new NotFoundException('Сессия не найдена');
    if (session.status !== SessionStatus.PENDING) {
      throw new BadRequestException('Сессия уже запущена или завершена');
    }

    const updated = await this.prisma.gameSession.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.ACTIVE,
        startTime: new Date(),
      },
      include: {
        mode: true,
        players: {
          include: {
            user: { select: { id: true, nickname: true, name: true } },
          },
        },
      },
    });

    // Dev/mock: нажать «НАЧАТЬ ИГРУ». В зальной сборке /_dev/* → 404 — старт на моноблоке.
    await this.roomAgentCommands.enqueue(
      updated.roomId,
      'room_api.dev_start',
      roomApiCall('POST', '/_dev/start', null),
      updated.id,
    );

    return updated;
  }

  async pauseActiveSession(sessionId: string) {
    const session = await this.findSessionByIdOrToken(sessionId);
    if (!session) throw new NotFoundException('Сессия не найдена');
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('Пауза доступна только для активной сессии');
    }
    if (!session.startTime) {
      throw new BadRequestException('У сессии не задано время старта');
    }
    if (session.pausedAt) {
      throw new BadRequestException('Сессия уже на паузе');
    }
    // Room API v1 не даёт CRM-паузу игры — только таймер CRM.
    return this.prisma.gameSession.update({
      where: { id: session.id },
      data: { pausedAt: new Date() },
    });
  }

  async resumeActiveSession(sessionId: string) {
    const session = await this.findSessionByIdOrToken(sessionId);
    if (!session) throw new NotFoundException('Сессия не найдена');
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('Возобновить можно только активную сессию');
    }
    if (!session.startTime || !session.pausedAt) {
      throw new BadRequestException('Сессия не на паузе');
    }
    const deltaMs = Date.now() - session.pausedAt.getTime();
    const newStart = new Date(session.startTime.getTime() + deltaMs);
    return this.prisma.gameSession.update({
      where: { id: session.id },
      data: {
        pausedAt: null,
        startTime: newStart,
      },
    });
  }

  /** Отмена лобби в ожидании (CRM) */
  async cancelPendingSession(sessionId: string) {
    const session = await this.findSessionByIdOrToken(sessionId);
    if (!session) throw new NotFoundException('Сессия не найдена');
    if (session.status !== SessionStatus.PENDING) {
      throw new BadRequestException('Отменить можно только сессию в ожидании');
    }
    const full = await this.prisma.gameSession.findUnique({
      where: { id: session.id },
      include: { players: true },
    });
    if (!full) throw new NotFoundException('Сессия не найдена');

    for (const p of full.players) {
      await this.roomAgentCommands.enqueue(
        full.roomId,
        'room_api.lobby_remove_player',
        roomApiCall('DELETE', `/lobby/players/${p.userId}`, null),
        full.id,
      );
    }

    return this.prisma.gameSession.update({
      where: { id: full.id },
      data: { status: SessionStatus.CANCELLED },
    });
  }

  async endSession(sessionId: string, dto: EndSessionDto) {
    const resolved = await this.findSessionByIdOrToken(sessionId);
    if (!resolved) throw new NotFoundException('Сессия не найдена');

    const session = await this.prisma.gameSession.findUnique({
      where: { id: resolved.id },
      include: { players: true },
    });

    if (!session) throw new NotFoundException('Сессия не найдена');

    if (session.status === SessionStatus.COMPLETED) {
      const scores = await this.prisma.score.findMany({
        where: { sessionId: session.id },
        select: { userId: true, score: true },
      });
      return {
        sessionId: session.id,
        status: SessionStatus.COMPLETED,
        deductedSeconds: session.deductedSeconds,
        scores: scores.map((s) => ({
          userId: s.userId,
          score: s.score,
        })),
      };
    }

    const allowedUserIds = new Set(session.players.map((p) => p.userId));
    for (const r of dto.results) {
      if (!allowedUserIds.has(r.userId)) {
        throw new BadRequestException(
          `Игрок ${r.userId} не входит в состав этой сессии`,
        );
      }
    }

    // CRM «Стоп» с нулевыми очками → только Room API /session/stop;
    // реальные очки придут в session_finished → повторный end.
    const allZero = dto.results.every((r) => r.score === 0);
    if (
      allZero &&
      session.engineSessionId &&
      session.status === SessionStatus.ACTIVE
    ) {
      await this.roomAgentCommands.enqueue(
        session.roomId,
        'room_api.session_stop',
        roomApiCall('POST', '/session/stop', {
          session_id: session.engineSessionId,
          reason: 'operator',
        }),
        session.id,
      );
      return {
        sessionId: session.id,
        status: session.status,
        deductedSeconds: session.deductedSeconds,
        scores: dto.results,
        pendingEngineStop: true,
      };
    }

    const pk = session.id;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedSession = await tx.gameSession.update({
        where: { id: pk },
        data: {
          status: SessionStatus.COMPLETED,
          endTime: new Date(),
          deductedSeconds: dto.durationSeconds,
        },
      });

      const scores: Array<{ userId: string; score: number }> = [];
      for (const playerResult of dto.results) {
        const score = await tx.score.create({
          data: {
            userId: playerResult.userId,
            sessionId: pk,
            roomId: session.roomId,
            modeId: session.modeId,
            score: playerResult.score,
          },
        });
        scores.push({ userId: score.userId, score: score.score });

        await tx.user.update({
          where: { id: playerResult.userId },
          data: { totalScore: { increment: playerResult.score } },
        });
      }

      for (const player of session.players) {
        const balance = await tx.accountBalance.findUnique({
          where: { userId: player.userId },
        });

        if (balance) {
          const deduct = Math.min(dto.durationSeconds, balance.availableSeconds);
          await tx.accountBalance.update({
            where: { userId: player.userId },
            data: { availableSeconds: { decrement: deduct } },
          });

          await tx.transaction.create({
            data: {
              userId: player.userId,
              type: TransactionType.GAME_DEBIT,
              source: TransactionSource.CASHIER,
              amountTenge: 0,
              equivalentSeconds: -deduct,
              venueId: session.venueId,
              description: `Игровая сессия ${pk}: -${Math.ceil(deduct / 60)} мин`,
            },
          });
        }
      }

      return { session: updatedSession, scores };
    });

    return {
      sessionId: result.session.id,
      status: result.session.status,
      deductedSeconds: result.session.deductedSeconds,
      scores: result.scores.map((s) => ({
        userId: s.userId,
        score: s.score,
      })),
    };
  }

  async findAll(filter: {
    userId?: string;
    roomId?: string;
    venueId?: string;
    status?: SessionStatus;
    page?: number;
    limit?: number;
  }) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filter.roomId) where.roomId = filter.roomId;
    if (filter.venueId) where.venueId = filter.venueId;
    if (filter.status) where.status = filter.status;
    if (filter.userId) {
      where.players = { some: { userId: filter.userId } };
    }

    const [sessions, total] = await Promise.all([
      this.prisma.gameSession.findMany({
        where,
        include: {
          room: { select: { id: true, name: true, defaultLevelDuration: true } },
          mode: { select: { id: true, name: true } },
          venue: { select: { id: true, name: true } },
          players: {
            include: { user: { select: { id: true, nickname: true } } },
          },
          scores: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.gameSession.count({ where }),
    ]);

    return {
      data: sessions,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findByToken(sessionToken: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { sessionToken },
      include: {
        room: true,
        mode: true,
        venue: { select: { id: true, name: true } },
        players: {
          include: { user: { select: { id: true, nickname: true, name: true } } },
        },
      },
    });

    if (!session) throw new NotFoundException('Сессия не найдена');
    return session;
  }
}


