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
    const rows = await this.prisma.score.findMany({
      where: {
        roomId,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take,
      include: {
        user: { select: { nickname: true, name: true } },
        mode: { select: { config: true, name: true } },
      },
    });

    return rows.map((s) => {
      const modeId =
        engineModeIdFromGameMode(s.mode) ??
        s.mode.name.replace(/\s+/g, '_').toLowerCase();
      return {
        nick: (s.user.nickname ?? s.user.name ?? 'Player').slice(0, 32),
        score: s.score,
        mode_id: modeId,
        played_at: s.createdAt.toISOString(),
      };
    });
  }
}
