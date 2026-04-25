import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomAgentCommandsService {
  constructor(private prisma: PrismaService) {}

  enqueue(
    roomId: string,
    type: string,
    payload: Prisma.InputJsonValue,
    sessionId?: string,
  ) {
    return this.prisma.roomAgentCommand.create({
      data: {
        roomId,
        type,
        payload,
        sessionId: sessionId ?? null,
      },
    });
  }
}
