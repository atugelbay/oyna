import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const TOURNAMENT_SELECT = {
  id: true,
  name: true,
  description: true,
  dateStart: true,
  dateEnd: true,
  maxTeams: true,
  status: true,
  venue: { select: { id: true, name: true, city: true, address: true } },
  teams: {
    select: {
      id: true,
      name: true,
      participantsCount: true,
      _count: { select: { members: true } },
      members: {
        select: {
          isCaptain: true,
          user: { select: { id: true, nickname: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  async getTournaments(venueId?: string) {
    return this.prisma.tournament.findMany({
      where: {
        status: { in: ['UPCOMING', 'ACTIVE'] },
        ...(venueId ? { venueId } : {}),
      },
      orderBy: { dateStart: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        dateStart: true,
        dateEnd: true,
        maxTeams: true,
        status: true,
        venue: { select: { id: true, name: true, city: true } },
        _count: { select: { teams: true } },
      },
    });
  }

  async getTournamentById(id: string, userId?: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      select: TOURNAMENT_SELECT,
    });
    if (!tournament) throw new NotFoundException('Турнир не найден');

    let myTeam: object | null = null;
    if (userId) {
      const member = await this.prisma.tournamentMember.findFirst({
        where: {
          userId,
          team: { tournamentId: id },
        },
        select: {
          isCaptain: true,
          team: {
            select: {
              id: true,
              name: true,
              _count: { select: { members: true } },
              members: {
                select: {
                  isCaptain: true,
                  user: { select: { id: true, nickname: true } },
                },
              },
            },
          },
        },
      });
      if (member) myTeam = { ...member.team, isCaptain: member.isCaptain };
    }

    return { ...tournament, myTeam };
  }

  async getTeams(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });
    if (!tournament) throw new NotFoundException('Турнир не найден');

    return this.prisma.tournamentTeam.findMany({
      where: { tournamentId },
      select: {
        id: true,
        name: true,
        participantsCount: true,
        _count: { select: { members: true } },
        members: {
          select: {
            isCaptain: true,
            user: { select: { id: true, nickname: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createTeam(tournamentId: string, userId: string, teamName: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, status: true, maxTeams: true, _count: { select: { teams: true } } },
    });
    if (!tournament) throw new NotFoundException('Турнир не найден');
    if (tournament.status === 'COMPLETED') {
      throw new BadRequestException('Турнир уже завершён');
    }
    if (tournament._count.teams >= tournament.maxTeams) {
      throw new BadRequestException('Достигнуто максимальное количество команд');
    }

    // Check if user already in this tournament
    const existing = await this.prisma.tournamentMember.findFirst({
      where: { userId, team: { tournamentId } },
    });
    if (existing) throw new ConflictException('Вы уже участвуете в этом турнире');

    // Create team with user as captain
    const team = await this.prisma.tournamentTeam.create({
      data: {
        name: teamName,
        tournamentId,
        participantsCount: 1,
        members: {
          create: { userId, isCaptain: true },
        },
      },
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
        members: {
          select: {
            isCaptain: true,
            user: { select: { id: true, nickname: true } },
          },
        },
      },
    });

    return { ...team, isCaptain: true };
  }

  async getMyTeam(tournamentId: string, userId: string) {
    const member = await this.prisma.tournamentMember.findFirst({
      where: {
        userId,
        team: { tournamentId },
      },
      select: {
        isCaptain: true,
        team: {
          select: {
            id: true,
            name: true,
            _count: { select: { members: true } },
            members: {
              select: {
                isCaptain: true,
                user: { select: { id: true, nickname: true } },
              },
            },
          },
        },
      },
    });

    if (!member) return null;
    return { ...member.team, isCaptain: member.isCaptain };
  }

  async getTeamById(teamId: string) {
    const team = await this.prisma.tournamentTeam.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        tournamentId: true,
        _count: { select: { members: true } },
        tournament: {
          select: {
            id: true,
            name: true,
            maxTeams: true,
            dateEnd: true,
            status: true,
          },
        },
        members: {
          select: {
            isCaptain: true,
            user: { select: { id: true, nickname: true } },
          },
        },
      },
    });
    if (!team) throw new NotFoundException('Команда не найдена');
    return team;
  }

  async joinTeam(teamId: string, userId: string) {
    const team = await this.prisma.tournamentTeam.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        tournamentId: true,
        tournament: { select: { status: true, maxTeams: true, _count: { select: { teams: true } } } },
        _count: { select: { members: true } },
      },
    });
    if (!team) throw new NotFoundException('Команда не найдена');
    if (team.tournament.status === 'COMPLETED') {
      throw new BadRequestException('Турнир уже завершён');
    }

    const existing = await this.prisma.tournamentMember.findFirst({
      where: { userId, team: { tournamentId: team.tournamentId } },
    });
    if (existing) throw new ConflictException('Вы уже участвуете в этом турнире');

    await this.prisma.tournamentMember.create({
      data: { teamId, userId, isCaptain: false },
    });

    // Update participantsCount
    await this.prisma.tournamentTeam.update({
      where: { id: teamId },
      data: { participantsCount: { increment: 1 } },
    });

    return this.getTeamById(teamId);
  }

  async getMyActiveTournament(userId: string) {
    const member = await this.prisma.tournamentMember.findFirst({
      where: {
        userId,
        team: {
          tournament: { status: { in: ['UPCOMING', 'ACTIVE'] } },
        },
      },
      orderBy: { team: { tournament: { dateStart: 'desc' } } },
      select: {
        isCaptain: true,
        team: {
          select: {
            id: true,
            name: true,
            _count: { select: { members: true } },
            tournament: {
              select: {
                id: true,
                name: true,
                dateEnd: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!member) return null;
    return {
      isCaptain: member.isCaptain,
      team: {
        id: member.team.id,
        name: member.team.name,
        membersCount: member.team._count.members,
      },
      tournament: member.team.tournament,
    };
  }
}
