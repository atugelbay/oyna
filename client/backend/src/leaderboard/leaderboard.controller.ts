import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator.js';

@ApiTags('leaderboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Рейтинг дня, месяца, года и за всё время' })
  @ApiQuery({ name: 'period', required: false })
  @ApiQuery({ name: 'room', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  getLeaderboard(
    @CurrentUser() user: CurrentUserPayload,
    @Query('period') period?: string,
    @Query('room') room?: string,
    @Query('date') date?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leaderboardService.getLeaderboard({
      period,
      room,
      date,
      month,
      year,
      limit: limit ? parseInt(limit, 10) : 50,
      userId: user.id,
    });
  }
}
