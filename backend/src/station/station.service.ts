import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { GameModeType, Prisma, SessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StationHeartbeatDto } from './dto/station-heartbeat.dto';
import { SessionMatchReportDto } from './dto/session-match-report.dto';
import { RoomApiEventDto } from './dto/room-events.dto';
import { UpsertRoomCatalogDto } from './dto/room-catalog.dto';
import { GameSessionsService } from '../game-sessions/game-sessions.service';
import { LobbyQrService } from './lobby-qr.service';
import { HallRecordsService } from './hall-records.service';
import { PlayerLobbyService } from './player-lobby.service';

@Injectable()
export class StationService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => GameSessionsService))
    private gameSessions: GameSessionsService,
    private lobbyQr: LobbyQrService,
    private hallRecords: HallRecordsService,
    private playerLobby: PlayerLobbyService,
  ) {}

  async heartbeat(roomId: string, dto: StationHeartbeatDto) {
    const row = await this.prisma.room.update({
      where: { id: roomId },
      data: {
        lastHeartbeatAt: new Date(),
        heartbeatBuildVersion: dto.buildVersion ?? null,
      },
      select: {
        id: true,
        lastHeartbeatAt: true,
        heartbeatBuildVersion: true,
      },
    });
    // Тихо продлеваем QR, если скоро истечёт (без PUBLIC_URL — no-op).
    await this.lobbyQr.refreshIfNeeded(roomId, 'heartbeat');
    return row;
  }

  async refreshLobbyQr(roomId: string) {
    const detail = await this.lobbyQr.pushLobbyQr(roomId, 'manual_refresh');
    return { roomId, detail };
  }

  async listPendingCommands(roomId: string, limit = 50) {
    return this.prisma.roomAgentCommand.findMany({
      where: { roomId, deliveredAt: null },
      orderBy: { createdAt: 'asc' },
      take: Math.min(limit, 100),
    });
  }

  async ackCommands(roomId: string, commandIds: string[]) {
    if (commandIds.length === 0) {
      throw new BadRequestException('commandIds required');
    }
    const now = new Date();
    const res = await this.prisma.roomAgentCommand.updateMany({
      where: {
        id: { in: commandIds },
        roomId,
        deliveredAt: null,
      },
      data: { deliveredAt: now },
    });
    return { acknowledged: res.count };
  }

  /**
   * Снимок GET /v1/catalog с моноблока.
   * Создаёт/обновляет GameMode с config.mode_id для UI запуска.
   */
  async upsertCatalog(crmRoomId: string, dto: UpsertRoomCatalogDto) {
    const room = await this.prisma.room.findUnique({ where: { id: crmRoomId } });
    if (!room) throw new NotFoundException('Room not found');

    const hash =
      dto.catalog_hash ??
      room.catalogHash ??
      `sync-${dto.room_id}-${dto.scoring_version}`;

    const existingModes = await this.prisma.gameMode.findMany({
      where: { roomId: crmRoomId },
    });

    const byModeId = new Map<string, (typeof existingModes)[0]>();
    for (const m of existingModes) {
      const cfg =
        m.config && typeof m.config === 'object' && !Array.isArray(m.config)
          ? (m.config as Record<string, unknown>)
          : null;
      const mid = cfg?.mode_id ?? cfg?.modeId;
      if (typeof mid === 'string' && mid.length > 0) {
        byModeId.set(mid, m);
      }
    }

    let created = 0;
    let updated = 0;

    for (const raw of dto.modes) {
      const modeId = String(raw.mode_id ?? '');
      if (!modeId) continue;

      const title =
        raw.title && typeof raw.title === 'object' && !Array.isArray(raw.title)
          ? (raw.title as Record<string, unknown>)
          : {};
      const nameRu =
        typeof title.ru === 'string' && title.ru.trim()
          ? title.ru.trim()
          : modeId;
      const kind = String(raw.kind ?? 'coop');
      const type =
        kind === 'versus' ? GameModeType.COMPETITIVE : GameModeType.COOP;
      const playable = Boolean(raw.playable !== false);
      const config: Prisma.InputJsonObject = {
        mode_id: modeId,
        kind,
        playable,
        rated: Boolean(raw.rated),
        min_players: Number(raw.min_players ?? 1),
        max_players: Number(raw.max_players ?? dto.lobby_max_players),
        sides: (raw.sides as Prisma.InputJsonValue) ?? null,
        levels: (raw.levels as Prisma.InputJsonValue) ?? [],
        title: title as Prisma.InputJsonValue,
        source: 'room_api_catalog',
      };

      const prev = byModeId.get(modeId);
      if (prev) {
        await this.prisma.gameMode.update({
          where: { id: prev.id },
          data: {
            name: nameRu,
            type,
            description: `Room API ${modeId}`,
            config,
          },
        });
        updated += 1;
      } else {
        await this.prisma.gameMode.create({
          data: {
            roomId: crmRoomId,
            name: nameRu,
            type,
            description: `Room API ${modeId}`,
            config,
          },
        });
        created += 1;
      }
    }

    const catalogJson = {
      api_version: dto.api_version,
      room_id: dto.room_id,
      scoring_version: dto.scoring_version,
      c: dto.c,
      lobby_max_players: dto.lobby_max_players,
      modes: dto.modes,
      catalog_hash: hash,
    } as Prisma.InputJsonValue;

    await this.prisma.room.update({
      where: { id: crmRoomId },
      data: {
        engineRoomId: dto.room_id,
        catalogHash: hash,
        catalogJson,
        catalogSyncedAt: new Date(),
        maxPlayers: Math.max(1, Math.floor(dto.lobby_max_players)),
        lastHeartbeatAt: new Date(),
      },
    });

    return {
      roomId: crmRoomId,
      engineRoomId: dto.room_id,
      catalogHash: hash,
      modesCreated: created,
      modesUpdated: updated,
      modesTotal: dto.modes.length,
      catalogSyncedAt: new Date().toISOString(),
    };
  }

  async recordMatchReport(
    roomId: string,
    sessionId: string,
    dto: SessionMatchReportDto,
  ) {
    const session = await this.prisma.gameSession.findFirst({
      where: { id: sessionId, roomId },
    });
    if (!session) {
      throw new NotFoundException('Session not found for this room');
    }

    const completedAt = dto.completedAt
      ? new Date(dto.completedAt)
      : null;

    const row = await this.prisma.sessionMatchReport.upsert({
      where: {
        sessionId_level_attemptNumber: {
          sessionId,
          level: dto.level,
          attemptNumber: dto.attemptNumber,
        },
      },
      create: {
        sessionId,
        level: dto.level,
        attemptNumber: dto.attemptNumber,
        result: dto.result as object,
        durationSeconds: dto.durationSeconds ?? null,
        completedAt,
      },
      update: {},
    });

    return {
      id: row.id,
      sessionId: row.sessionId,
      level: row.level,
      attemptNumber: row.attemptNumber,
    };
  }

  /**
   * Приём журнала Room API v1 от агента.
   * Идемпотентность: повтор session_started / level_finished / session_finished безопасен.
   */
  async ingestRoomEvents(crmRoomId: string, events: RoomApiEventDto[]) {
    const room = await this.prisma.room.findUnique({ where: { id: crmRoomId } });
    if (!room) throw new NotFoundException('Room not found');

    const results: Array<{ event_id: string; type: string; ok: boolean; detail?: string }> =
      [];

    for (const event of events) {
      try {
        const detail = await this.handleRoomEvent(crmRoomId, event);
        results.push({ event_id: event.event_id, type: event.type, ok: true, detail });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          event_id: event.event_id,
          type: event.type,
          ok: false,
          detail: message,
        });
      }
    }

    return { processed: results.length, results };
  }

  private async handleRoomEvent(
    crmRoomId: string,
    event: RoomApiEventDto,
  ): Promise<string | undefined> {
    switch (event.type) {
      case 'room_online':
        return this.onRoomOnline(crmRoomId, event);
      case 'room_status':
        return 'ignored';
      case 'lobby_changed':
        return this.onLobbyChanged(crmRoomId, event);
      case 'session_started':
        return this.onSessionStarted(crmRoomId, event);
      case 'level_finished':
        return this.onLevelFinished(crmRoomId, event);
      case 'session_finished':
        return this.onSessionFinished(crmRoomId, event);
      default:
        return `unknown_type:${event.type}`;
    }
  }

  private async onRoomOnline(crmRoomId: string, event: RoomApiEventDto) {
    const build = String(event.payload?.build ?? 'unknown');
    await this.prisma.room.update({
      where: { id: crmRoomId },
      data: {
        lastHeartbeatAt: new Date(),
        heartbeatBuildVersion: build,
      },
    });
    const qr = await this.lobbyQr.pushLobbyQr(crmRoomId, 'room_online');
    // Чтобы на HUD не висели локальные «—» / гостевые рекорды — сразу наши таблицы.
    const hall = await this.hallRecords.pushForRoom(crmRoomId, 'room_online');
    return `build=${build};${qr};${hall}`;
  }

  /**
   * «ВЫЙТИ» / пустое лобби → отменить PENDING CRM-сессии (минуты не трогаем).
   */
  private async onLobbyChanged(crmRoomId: string, event: RoomApiEventDto) {
    const payload = event.payload ?? {};
    const reason = String(payload.reason ?? '');
    const players = Array.isArray(payload.players) ? payload.players : null;
    const emptyLobby = players !== null && players.length === 0;
    if (reason !== 'exit_button' && !emptyLobby) {
      return 'ignored';
    }

    const res = await this.prisma.gameSession.updateMany({
      where: {
        roomId: crmRoomId,
        status: SessionStatus.PENDING,
      },
      data: { status: SessionStatus.CANCELLED },
    });
    return reason === 'exit_button'
      ? `exit_button:cancelled=${res.count}`
      : `lobby_empty:cancelled=${res.count}`;
  }

  private async onSessionStarted(crmRoomId: string, event: RoomApiEventDto) {
    const engineSessionId = event.session_id;
    if (!engineSessionId) {
      throw new BadRequestException('session_started without session_id');
    }

    const existing = await this.prisma.gameSession.findFirst({
      where: { engineSessionId },
    });
    if (existing) {
      await this.gameSessions.debitBalanceOnSessionStart(existing.id);
      return `already_bound:${existing.id}`;
    }

    const payloadPlayers = Array.isArray(event.payload?.players)
      ? (event.payload.players as Array<{ player_id?: string | null }>)
      : [];
    const playerIds = payloadPlayers
      .map((p) => p.player_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    let session = await this.prisma.gameSession.findFirst({
      where: {
        roomId: crmRoomId,
        status: { in: [SessionStatus.PENDING, SessionStatus.ACTIVE] },
        engineSessionId: null,
        ...(playerIds.length
          ? { players: { every: { userId: { in: playerIds } } } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { players: true },
    });

    if (!session) {
      session = await this.prisma.gameSession.findFirst({
        where: {
          roomId: crmRoomId,
          status: { in: [SessionStatus.PENDING, SessionStatus.ACTIVE] },
          engineSessionId: null,
        },
        orderBy: { createdAt: 'desc' },
        include: { players: true },
      });
    }

    const startedAt = event.payload?.started_at
      ? new Date(String(event.payload.started_at))
      : new Date();

    // QR-only: игроки сели по QR без CRM start → создаём сессию из события.
    if (!session) {
      if (playerIds.length === 0) {
        throw new NotFoundException(
          `No CRM session and no account players in session_started for room=${crmRoomId}`,
        );
      }
      const created = await this.createSessionFromRoomStart({
        crmRoomId,
        engineSessionId,
        engineModeId:
          typeof event.payload?.mode_id === 'string'
            ? event.payload.mode_id
            : null,
        playerIds,
        startedAt,
      });
      await this.gameSessions.debitBalanceOnSessionStart(created.id);
      return `created_from_qr:${created.id}`;
    }

    await this.prisma.gameSession.update({
      where: { id: session.id },
      data: {
        engineSessionId,
        status: SessionStatus.ACTIVE,
        startTime: session.startTime ?? startedAt,
        pausedAt: null,
      },
    });

    // Канон: 10 мин списываем на реальном старте игры (идемпотентно).
    await this.gameSessions.debitBalanceOnSessionStart(session.id);

    return `bound:${session.id}`;
  }

  /**
   * Сеанс начат с HUD после QR-join (без PENDING из CRM).
   * Режим — по payload.mode_id из каталога комнаты.
   */
  private async createSessionFromRoomStart(params: {
    crmRoomId: string;
    engineSessionId: string;
    engineModeId: string | null;
    playerIds: string[];
    startedAt: Date;
  }) {
    const room = await this.prisma.room.findUnique({
      where: { id: params.crmRoomId },
      include: { modes: true },
    });
    if (!room) throw new NotFoundException('Room not found');

    let mode =
      params.engineModeId != null
        ? room.modes.find((m) => {
            const cfg =
              m.config && typeof m.config === 'object' && !Array.isArray(m.config)
                ? (m.config as Record<string, unknown>)
                : null;
            const mid = cfg?.mode_id ?? cfg?.modeId;
            return mid === params.engineModeId;
          })
        : undefined;
    if (!mode) {
      mode = room.modes[0];
    }
    if (!mode) {
      throw new BadRequestException(
        `No GameMode for room=${params.crmRoomId} (sync catalog first)`,
      );
    }

    return this.prisma.gameSession.create({
      data: {
        roomId: params.crmRoomId,
        modeId: mode.id,
        venueId: room.venueId,
        engineSessionId: params.engineSessionId,
        status: SessionStatus.ACTIVE,
        startTime: params.startedAt,
        players: {
          create: params.playerIds.map((userId) => ({ userId })),
        },
      },
    });
  }

  private async onLevelFinished(crmRoomId: string, event: RoomApiEventDto) {
    const session = await this.resolveCrmSession(crmRoomId, event.session_id);
    const payload = event.payload ?? {};
    const level = Number(payload.level ?? 1);
    const attemptNumber = Number(payload.attempt ?? 1);
    const durationSeconds = Math.max(
      0,
      Math.round(Number(payload.duration_sec ?? 0)),
    );
    const score =
      payload.score && typeof payload.score === 'object'
        ? (payload.score as Record<string, unknown>)
        : {};
    const finalScore = Number(score.total ?? 0);
    const engineModeId =
      typeof payload.mode_id === 'string' ? payload.mode_id : '';

    await this.recordMatchReport(crmRoomId, session.id, {
      level,
      attemptNumber,
      durationSeconds,
      completedAt: event.ts,
      result: {
        ...payload,
        finalScore,
        bVictory: Boolean(payload.victory),
        mode: payload.mode_id ?? payload.kind,
      },
    });

    let unlockDetail = '';
    if (payload.unlocks_next === true && engineModeId.includes('.')) {
      const full = await this.prisma.gameSession.findUnique({
        where: { id: session.id },
        include: { players: true },
      });
      const userIds = (full?.players ?? []).map((p) => p.userId);
      const u = await this.playerLobby.applyUnlocksNext({
        userIds,
        engineModeId,
        clearedLevel: level,
      });
      unlockDetail = `;unlock=${u.unlockedLevel}:n=${u.updated}`;
    }

    return `match:${session.id}:L${level}:A${attemptNumber}${unlockDetail}`;
  }

  private async onSessionFinished(crmRoomId: string, event: RoomApiEventDto) {
    if (!event.session_id) {
      throw new BadRequestException('event missing session_id');
    }

    const session = await this.prisma.gameSession.findFirst({
      where: { roomId: crmRoomId, engineSessionId: event.session_id },
      include: { players: true },
    });
    if (!session) {
      throw new NotFoundException(
        `CRM session not found for engineSessionId=${event.session_id}`,
      );
    }

    const payload = event.payload ?? {};
    const durationSeconds = Math.max(
      1,
      Math.round(Number(payload.duration_sec ?? 1)),
    );

    const slotScores = new Map<number, number>();
    if (Array.isArray(payload.players)) {
      for (const row of payload.players as Array<{
        slot?: number;
        total_score?: number;
      }>) {
        if (typeof row.slot === 'number') {
          slotScores.set(row.slot, Number(row.total_score ?? 0));
        }
      }
    }

    const totalScore = Number(payload.total_score ?? 0);

    // slot в Room API — 1-based по порядку входа; в CRM players создаются в том же порядке
    const results = session.players.map((p, index) => {
      const slot = index + 1;
      const score = slotScores.has(slot)
        ? (slotScores.get(slot) as number)
        : totalScore;
      return { userId: p.userId, score };
    });

    if (results.length === 0) {
      throw new BadRequestException('session_finished: CRM session has no players');
    }

    await this.gameSessions.endSession(session.id, {
      durationSeconds,
      results,
    });

    // После сеанса лобби снова пустое — обновить QR и таблицы рекордов на HUD.
    const qr = await this.lobbyQr.pushLobbyQr(crmRoomId, 'session_finished');
    const hall = await this.hallRecords.pushForRoom(
      crmRoomId,
      'session_finished',
    );

    return `ended:${session.id};${qr};${hall}`;
  }

  private async resolveCrmSession(
    crmRoomId: string,
    engineSessionId: string | undefined,
  ) {
    if (!engineSessionId) {
      throw new BadRequestException('event missing session_id');
    }

    const session = await this.prisma.gameSession.findFirst({
      where: { roomId: crmRoomId, engineSessionId },
    });
    if (!session) {
      throw new NotFoundException(
        `CRM session not found for engineSessionId=${engineSessionId}`,
      );
    }
    return session;
  }
}
