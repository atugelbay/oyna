import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';

@ApiTags('Stats')
@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
@ApiBearerAuth()
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard stats (today)' })
  getDashboard(@Query('venueId') venueId?: string) {
    return this.statsService.getDashboard(venueId);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Revenue by source' })
  getRevenue(
    @Query('venueId') venueId?: string,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statsService.getRevenue(venueId, period, from, to);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Overview stats' })
  getOverview(
    @Query('venueId') venueId?: string,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statsService.getOverview(venueId, period, from, to);
  }
}


