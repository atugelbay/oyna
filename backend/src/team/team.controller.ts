import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { CurrentUser, Roles } from '../common/decorators';
import { OperationKind, TeamService } from './team.service';
import { weekStartOf } from './team-rules';

const KINDS: OperationKind[] = ['sales', 'cancelled', 'unchecked', 'compensations', 'manual', 'gaps'];

function requireVenue(venueId?: string) {
  if (!venueId) throw new BadRequestException('Выберите точку');
  return venueId;
}

@ApiTags('Team')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('team')
export class TeamController {
  constructor(private team: TeamService) {}

  @Get('today')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  today(@Query('venueId') venueId?: string) {
    return this.team.today(requireVenue(venueId));
  }

  @Patch('schedule/:id/times')
  @Roles(Role.ADMIN)
  correct(
    @Param('id') id: string,
    @Body() body: { arrivedAt?: string | null; leftAt?: string | null; comment?: string },
    @CurrentUser('id') actorId: string,
  ) {
    return this.team.correctTimes(id, body, actorId);
  }

  @Delete('schedule/:id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.team.removeShift(id, actorId);
  }

  @Get('week')
  @Roles(Role.MANAGER, Role.ADMIN)
  week(@Query('venueId') venueId?: string, @Query('weekStart') weekStart?: string) {
    const day = weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? weekStart : new Date().toISOString().slice(0, 10);
    return this.team.week(requireVenue(venueId), weekStartOf(day));
  }

  @Post('week/copy')
  @Roles(Role.ADMIN)
  copy(@Body() body: { venueId?: string; weekStart?: string }, @CurrentUser('id') actorId: string) {
    if (!body.weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(body.weekStart)) throw new BadRequestException('Неделя не указана');
    return this.team.copyPreviousWeek(requireVenue(body.venueId), weekStartOf(body.weekStart), actorId);
  }

  @Get('month')
  @Roles(Role.MANAGER, Role.ADMIN)
  month(@Query('venueId') venueId?: string, @Query('month') month?: string) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Месяц в формате ГГГГ-ММ');
    return this.team.month(requireVenue(venueId), month);
  }

  @Get('operators/:id/operations')
  @Roles(Role.ADMIN)
  operations(
    @Param('id') operatorId: string,
    @Query('kind') kind?: string,
    @Query('venueId') venueId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const k = (KINDS as string[]).includes(kind ?? '') ? (kind as OperationKind) : 'sales';
    return this.team.operations({ operatorId, kind: k, venueId, from, to });
  }
}
