import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAgentCommandsService } from '../station/room-agent-commands.service';
import { PlayerLobbyService } from '../station/player-lobby.service';
import {
  engineModeIdFromGameMode,
  roomApiCall,
} from '../station/room-api.util';
import { StartSessionDto } from './dto/start-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import {
  Prisma,
  SessionStatus,
  TransactionType,
  TransactionSource,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { MinuteLedgerService } from '../ledger/minute-ledger.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

/** Минимум на балансе у каждого игрока для старта сессии (10 мин) */
const MIN_BALANCE_SECONDS = 600;

function modeIdFromGameMode(mode: {
  name: string;
  config: Prisma.JsonValue | null;
}): string | null {
  return engineModeIdFromGameMode(mode);
}

function modePlayerLimits(mode: {
  config: Prisma.JsonValue | null;
}): { min: number; max: number } {
  let min = 1;
  let max = 16;
  if (mode.config && typeof mode.config === 'object' && !Array.isArray(mode.config)) {
    const cfg = mode.config as Record<string, unknown>;
    const mn = Number(cfg.min_players ?? cfg.minPlayers);
    const mx = Number(cfg.max_players ?? cfg.maxPlayers);
    if (Number.isFinite(mn) && mn >= 1) min = Math.floor(mn);
    if (Number.isFinite(mx) && mx >= 1) max = Math.floor(mx);
    if (max < min) max = min;
  }
  return { min, max };
}

@Injectable()
export class GameSessionsService {
  constructor(
    private prisma: PrismaService,
    private roomAgentCommands: RoomAgentCommandsService,
    private playerLobby: PlayerLobbyService,
    private ledger: MinuteLedgerService,
    private loyalty: LoyaltyService,
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
    if (mode.roomId !== dto.roomId) {
      throw new BadRequestException('Режим не принадлежит этой комнате');
    }

    const limits = modePlayerLimits(mode);
    const playerCount = dto.playerIds.length;
    if (playerCount < limits.min || playerCount > limits.max) {
      throw new BadRequestException(
        `Режим «${mode.name}» требует от ${limits.min} до ${limits.max} игроков (сейчас ${playerCount})`,
      );
    }

    for (const playerId of dto.playerIds) {
      const user = await this.prisma.user.findUnique({ where: { id: playerId } });
      if (!user || !user.isActive || user.blockPermanent || (user.blockedUntil && user.blockedUntil > new Date())) {
        throw new BadRequestException(`Игрок ${user?.nickname || playerId} не может начать сеанс`);
      }
      const balance = await this.ledger.prepareBalance(playerId);
      if (balance.availableSeconds < MIN_BALANCE_SECONDS) {
        throw new BadRequestException(
          `У игрока ${user.nickname || playerId} недостаточно времени на балансе (нужно минимум ${MIN_BALANCE_SECONDS / 60} мин у каждого). Оплаченные минуты действуют 24 часа`,
        );
      }
    }

    const session = await this.prisma.gameSession.create({
      data: {
        roomId: dto.roomId,
        modeId: dto.modeId,
        venueId: dto.venueId,
        sessionToken: randomBytes(32).toString('hex'),
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

    const engineModeId = modeIdFromGameMode(session.mode);
    const useDev = Boolean(session.room.useDevCommands);

    // Virtual/mock only: выбрать режим до посадки игроков.
    if (useDev && engineModeId) {
      await this.roomAgentCommands.enqueue(
        session.roomId,
        'room_api.dev_select',
        roomApiCall('POST', '/_dev/select', {
          mode_id: engineModeId,
          level: 1,
        }),
        session.id,
      );
    }

    // Игроки в лобби моноблока (зал + virtual). Баланс здесь не списываем.
    for (const p of session.players) {
      const extras = await this.playerLobby.lobbyPlayerExtras(p.userId);
      const body: Record<string, unknown> = {
        player_id: p.user.id,
        nick: (p.user.nickname ?? p.user.name ?? 'Player').slice(0, 32),
        minutes_left: extras.minutes_left,
        source: 'operator',
      };
      if (extras.unlocked) body.unlocked = extras.unlocked;
      if (extras.rating_month != null) body.rating_month = extras.rating_month;
      if (extras.rank_month != null) body.rank_month = extras.rank_month;

      await this.roomAgentCommands.enqueue(
        session.roomId,
        'room_api.lobby_add_player',
        roomApiCall('POST', '/lobby/players', body),
        session.id,
      );
    }

    return {
      sessionId: session.id,
      sessionToken: session.sessionToken,
      room: {
        id: session.room.id,
        name: session.room.name,
        type: session.room.type,
        useDevCommands: session.room.useDevCommands,
      },
      mode: { id: session.mode.id, name: session.mode.name, type: session.mode.type, config: session.mode.config },
      players: session.players.map((p) => ({
        userId: p.user.id,
        nickname: p.user.nickname,
        name: p.user.name,
      })),
      defaultLevelDuration: room.defaultLevelDuration,
      /** Зал: ждать «НАЧАТЬ ИГРУ» на HUD; virtual: можно activate */
      awaitsHudStart: !useDev,
    };
  }

  async activateSession(sessionToken: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { sessionToken },
      include: {
        mode: true,
        room: true,
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

    if (!session.room.useDevCommands) {
      throw new BadRequestException(
        'Для зальной комнаты старт только кнопкой «НАЧАТЬ ИГРУ» на экране. Включите useDevCommands только для virtual/mock.',
      );
    }

    const updated = await this.prisma.gameSession.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.ACTIVE,
        startTime: new Date(),
      },
      include: {
        mode: true,
        room: true,
        players: {
          include: {
            user: { select: { id: true, nickname: true, name: true } },
          },
        },
      },
    });

    const engineModeId = modeIdFromGameMode(updated.mode);
    if (engineModeId) {
      await this.roomAgentCommands.enqueue(
        updated.roomId,
        'room_api.dev_select',
        roomApiCall('POST', '/_dev/select', {
          mode_id: engineModeId,
          level: 1,
        }),
        updated.id,
      );
    }
    await this.roomAgentCommands.enqueue(
      updated.roomId,
      'room_api.dev_start',
      roomApiCall('POST', '/_dev/start', null),
      updated.id,
    );

    return updated;
  }

  /**
   * Канон владельца: списать 10 мин каждому с аккаунтом на session_started.
   * Идемпотентно по balanceDebitedAt.
   */
  async debitBalanceOnSessionStart(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { players: true },
    });
    if (!session) throw new NotFoundException('Сессия не найдена');
    if (session.balanceDebitedAt) {
      return { sessionId, alreadyDebited: true, deductedSeconds: session.deductedSeconds };
    }

    let paid = 0;
    let bonus = 0;
    let manual = 0;
    for (const player of [...session.players].sort((a, b) => a.userId.localeCompare(b.userId))) {
      try {
        const spent = await this.ledger.spendForSession(player.userId, sessionId, MIN_BALANCE_SECONDS);
        paid += spent.paid;
        bonus += spent.bonus;
        manual += spent.manual;
        await this.prisma.transaction.create({
          data: {
            userId: player.userId,
            type: TransactionType.GAME_DEBIT,
            source: TransactionSource.CASHIER,
            amountTenge: 0,
            equivalentSeconds: -spent.taken,
            venueId: session.venueId,
            description: `Старт сессии ${sessionId}: -${Math.ceil(spent.taken / 60)} мин`,
          },
        });
        if (!session.isTournament) {
          await this.loyalty.onSessionDebit({
            userId: player.userId,
            sessionId,
            paidSeconds: spent.paid,
            bonusSeconds: spent.bonus,
            manualSeconds: spent.manual,
          });
        }
      } catch (err) {
        if (!(err instanceof BadRequestException)) throw err;
      }
    }

    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        balanceDebitedAt: new Date(),
        deductedSeconds: MIN_BALANCE_SECONDS,
        paidSecondsDebited: paid,
        bonusSecondsDebited: bonus,
        countsForRating: manual === 0 && !session.isTournament,
      },
    });

    return { sessionId, alreadyDebited: false, deductedSeconds: MIN_BALANCE_SECONDS };
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

    const allowedUserIds = new Set(session.players.map((p) => p.userId));
    for (const r of dto.results) {
      if (!allowedUserIds.has(r.userId)) {
        throw new BadRequestException(
          `Игрок ${r.userId} не входит в состав этой сессии`,
        );
      }
    }

    // CRM «Стоп»/«Завершить» шлёт нули (или пустой results у гостей).
    // Раньше ждали только session_finished → при Room API уже idle (409)
    // комната в CRM зависала. Теперь сразу COMPLETED + best-effort stop;
    // реальные очки допишет session_finished, если придёт позже.
    const operatorStopIntent =
      dto.results.length === 0 ||
      dto.results.every((r) => r.score === 0);

    if (session.status === SessionStatus.COMPLETED) {
      const existing = await this.prisma.score.findMany({
        where: { sessionId: session.id },
        select: { userId: true, score: true },
      });
      // Поздние очки с моноблока после операторского finalize без Score.
      if (
        existing.length === 0 &&
        dto.results.length > 0 &&
        !operatorStopIntent
      ) {
        await this.prisma.$transaction(async (tx) => {
          for (const playerResult of dto.results) {
            await tx.score.create({
              data: {
                userId: playerResult.userId,
                sessionId: session.id,
                roomId: session.roomId,
                modeId: session.modeId,
                score: playerResult.score,
              },
            });
            if (playerResult.score > 0) {
              await tx.user.update({
                where: { id: playerResult.userId },
                data: { totalScore: { increment: playerResult.score } },
              });
            }
          }
        });
        return {
          sessionId: session.id,
          status: SessionStatus.COMPLETED,
          deductedSeconds: session.deductedSeconds,
          scores: dto.results,
          lateScoresApplied: true,
        };
      }
      return {
        sessionId: session.id,
        status: SessionStatus.COMPLETED,
        deductedSeconds: session.deductedSeconds,
        scores: existing.map((s) => ({
          userId: s.userId,
          score: s.score,
        })),
      };
    }

    if (
      operatorStopIntent &&
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
      // Не return: ниже сразу COMPLETED. 409 no_session на агенте — ок.
    }

    const pk = session.id;

    const alreadyDebited = Boolean(session.balanceDebitedAt);
    /** Нули от кассы — плейсхолдер; Score пишем только с реальными очками. */
    const skipPlaceholderScores = operatorStopIntent;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedSession = await tx.gameSession.update({
        where: { id: pk },
        data: {
          status: SessionStatus.COMPLETED,
          endTime: new Date(),
          // Если уже списали на session_started — не затираем сумму списания длительностью.
          ...(alreadyDebited ? {} : { deductedSeconds: dto.durationSeconds }),
        },
      });

      const scores: Array<{ userId: string; score: number }> = [];
      if (!skipPlaceholderScores) {
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
      }

      return { session: updatedSession, scores };
    });

    if (!alreadyDebited) {
      await this.debitBalanceOnSessionStart(pk);
    }

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
    const dead = session.status === SessionStatus.COMPLETED
      || session.status === SessionStatus.CANCELLED
      || session.status === SessionStatus.ERROR;
    const pendingExpired = session.status === SessionStatus.PENDING
      && Date.now() - session.createdAt.getTime() > 10 * 60 * 1000;
    if (dead || pendingExpired) throw new NotFoundException('Сессия не найдена');
    return {
      id: session.id,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      room: { id: session.room.id, name: session.room.name, engineRoomId: session.room.engineRoomId },
      mode: { id: session.mode.id, name: session.mode.name },
      players: session.players.map((p) => ({
        id: p.user.id,
        nickname: p.user.nickname,
      })),
    };
  }
}


