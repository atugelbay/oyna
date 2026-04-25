import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StationHeartbeatDto } from './dto/station-heartbeat.dto';
import { SessionMatchReportDto } from './dto/session-match-report.dto';

@Injectable()
export class StationService {
  constructor(private prisma: PrismaService) {}

  async heartbeat(roomId: string, dto: StationHeartbeatDto) {
    return this.prisma.room.update({
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
}
