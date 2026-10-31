import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAgentCommandsService } from './room-agent-commands.service';
import { roomApiCall } from './room-api.util';
import { RatingService } from '../rating/rating.service';

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
    private rating: RatingService,
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
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return { today: [], month: [], all_time: [] };
    const payload = await this.rating.hallPayload(room.venueId);
    return {
      today: payload.today,
      month: payload.month,
      all_time: payload.all_time,
    };
  }
}
