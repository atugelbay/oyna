import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAgentCommandsService } from './room-agent-commands.service';
import {
  almatyDayBounds,
  engineModeIdFromGameMode,
  roomApiCall,
} from './room-api.util';

type HallRow = {
  nick: string;
  score: number;
  mode_id: string;
  played_at: string;
};

/** Room API v1: <room>.<snake_case>, только латиница (events/common.schema.json). */
const MODE_ID_RE = /^[a-z]+\.[a-z0-9_]+$/;

function toRoomApiTimestamp(d: Date): string {
  // Требует ровно 3 цифры мс + Z: 2026-10-08T14:03:21.412Z
  const iso = d.toISOString();
  return iso.replace(/(\.\d{3})\d*Z$/, '$1Z');
}

@Injectable()
export class HallRecordsService {
  private readonly logger = new Logger(HallRecordsService.name);

  constructor(
    private prisma: PrismaService,
    private roomAgentCommands: RoomAgentCommandsService,
  ) {}

  /** Собрать today / month / all_time (до 10 строк) и PUT /v1/hall_records. */
  async pushForRoom(roomId: string, reason: string): Promise<string> {
    const body = await this.buildPayload(roomId);
    await this.roomAgentCommands.enqueue(
      roomId,
      'room_api.hall_records',
      roomApiCall('PUT', '/hall_records', body),
    );
    this.logger.log(
      `hall_records enqueued room=${roomId} reason=${reason} today=${body.today.length} month=${body.month.length} all=${body.all_time.length}`,
    );
    return `hall_records:${body.today.length}/${body.month.length}/${body.all_time.length}`;
  }

  async buildPayload(roomId: string): Promise<{
    today: HallRow[];
    month: HallRow[];
    all_time: HallRow[];
  }> {
    const { startOfDay, startOfMonth } = almatyDayBounds();
    const [today, month, all_time] = await Promise.all([
      this.topScores(roomId, startOfDay),
      this.topScores(roomId, startOfMonth),
      this.topScores(roomId, null),
    ]);
    return { today, month, all_time };
  }

  private async topScores(
    roomId: string,
    since: Date | null,
    take = 10,
  ): Promise<HallRow[]> {
    // Берём с запасом: часть строк отфильтруем из‑за невалидного mode_id.
    const rows = await this.prisma.score.findMany({
      where: {
        roomId,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: take * 3,
      include: {
        user: { select: { nickname: true, name: true } },
        mode: { select: { config: true, name: true } },
      },
    });

    const out: HallRow[] = [];
    for (const s of rows) {
      const modeId = engineModeIdFromGameMode(s.mode);
      if (!modeId || !MODE_ID_RE.test(modeId)) {
        this.logger.debug(
          `hall_records skip score=${s.id}: mode_id invalid (${modeId ?? s.mode.name})`,
        );
        continue;
      }
      const nick = (s.user.nickname ?? s.user.name ?? 'Player').trim().slice(0, 32);
      if (!nick) continue;
      out.push({
        nick,
        score: Math.max(0, Math.trunc(s.score)),
        mode_id: modeId,
        played_at: toRoomApiTimestamp(s.createdAt),
      });
      if (out.length >= take) break;
    }
    return out;
  }
}
