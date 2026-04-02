import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { TournamentsService } from './tournaments.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator.js';

class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;
}

@ApiTags('tournaments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tournaments')
export class TournamentsController {
  constructor(private tournamentsService: TournamentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get upcoming and active tournaments' })
  @ApiQuery({ name: 'venueId', required: false })
  getTournaments(@Query('venueId') venueId?: string) {
    return this.tournamentsService.getTournaments(venueId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tournament by id with user participation status' })
  getTournamentById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.tournamentsService.getTournamentById(id, user.id);
  }

  @Get(':id/teams')
  @ApiOperation({ summary: 'List all teams for a tournament' })
  getTeams(@Param('id') id: string) {
    return this.tournamentsService.getTeams(id);
  }

  @Get(':id/my-team')
  @ApiOperation({ summary: 'Get current user team in tournament' })
  getMyTeam(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.tournamentsService.getMyTeam(id, user.id);
  }

  @Post(':id/teams')
  @ApiOperation({ summary: 'Create a new team (captain)' })
  @ApiBody({ type: CreateTeamDto })
  createTeam(
    @Param('id') id: string,
    @Body() dto: CreateTeamDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.tournamentsService.createTeam(id, user.id, dto.name);
  }

  @Get('teams/:teamId')
  @ApiOperation({ summary: 'Get team details by ID (for invite link preview)' })
  getTeamById(@Param('teamId') teamId: string) {
    return this.tournamentsService.getTeamById(teamId);
  }

  @Post('teams/:teamId/join')
  @ApiOperation({ summary: 'Join a team by ID (participant)' })
  joinTeam(
    @Param('teamId') teamId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.tournamentsService.joinTeam(teamId, user.id);
  }

  @Get('my-active')
  @ApiOperation({ summary: 'Get current user active tournament participation' })
  getMyActiveTournament(@CurrentUser() user: CurrentUserPayload) {
    return this.tournamentsService.getMyActiveTournament(user.id);
  }
}
