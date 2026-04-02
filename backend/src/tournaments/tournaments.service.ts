import { Injectable, NotFoundException } from '@nestjs/common';
import { TournamentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTournamentDto) {
    return this.prisma.tournament.create({
      data: {
        name: dto.name,
        description: dto.description,
        venueId: dto.venueId,
        dateStart: new Date(dto.dateStart),
        dateEnd: new Date(dto.dateEnd),
        maxTeams: dto.maxTeams ?? 10,
      },
      include: { venue: true },
    });
  }

  async findAll(query: { venueId?: string; status?: string }) {
    const where: { venueId?: string; status?: TournamentStatus } = {};
    if (query.venueId) where.venueId = query.venueId;
    if (query.status && Object.values(TournamentStatus).includes(query.status as TournamentStatus)) {
      where.status = query.status as TournamentStatus;
    }

    return this.prisma.tournament.findMany({
      where,
      include: { _count: { select: { teams: true } } },
      orderBy: { dateStart: 'desc' },
    });
  }

  async findOne(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        venue: true,
        teams: {
          include: {
            members: { include: { user: true } },
            _count: { select: { members: true } },
          },
        },
        results: { include: { user: true } },
      },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return tournament;
  }

  async update(id: string, dto: UpdateTournamentDto) {
    await this.findOne(id);
    return this.prisma.tournament.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.dateStart !== undefined && { dateStart: new Date(dto.dateStart) }),
        ...(dto.dateEnd !== undefined && { dateEnd: new Date(dto.dateEnd) }),
        ...(dto.maxTeams !== undefined && { maxTeams: dto.maxTeams }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { venue: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tournament.delete({ where: { id } });
  }
}


