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
  @ApiOperation({ summary: 'Get global leaderboard' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getLeaderboard(@Query('limit') limit?: string) {
    return this.leaderboardService.getLeaderboard(limit ? parseInt(limit, 10) : 50);
  }

  @Get('my-rank')
  @ApiOperation({ summary: 'Get current player rank' })
  getMyRank(@CurrentUser() user: CurrentUserPayload) {
    return this.leaderboardService.getMyRank(user.id);
  }
}
