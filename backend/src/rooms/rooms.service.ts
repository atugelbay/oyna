import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRoomDto) {
    return this.prisma.room.create({
      data: dto,
      include: { venue: true },
    });
  }

  async findByVenue(venueId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { venueId },
      include: {
        modes: true,
        sessions: {
          where: { status: { in: ['ACTIVE', 'PENDING'] } },
          include: {
            players: {
              include: { user: { select: { id: true, nickname: true } } },
            },
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return rooms.map((room) => {
      const activeSession = room.sessions[0];
      let status: 'free' | 'occupied' | 'waiting' = 'free';
      let playerNickname: string | undefined;
      let playerId: string | undefined;

      if (activeSession) {
        status = activeSession.status === 'ACTIVE' ? 'occupied' : 'waiting';
        const firstPlayer = activeSession.players[0]?.user;
        if (firstPlayer) {
          playerNickname = firstPlayer.nickname;
          playerId = firstPlayer.id;
        }
      }

      const { sessions, ...roomData } = room;
      return { ...roomData, status, playerNickname, playerId };
    });
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { venue: true, modes: true },
    });
    if (!room) throw new NotFoundException('Комната не найдена');
    return room;
  }

  async update(id: string, dto: UpdateRoomDto) {
    await this.findOne(id);
    return this.prisma.room.update({
      where: { id },
      data: dto,
      include: { venue: true, modes: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.room.delete({ where: { id } });
  }
}


