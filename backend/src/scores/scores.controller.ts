import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ScoresService } from './scores.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';

@ApiTags('Scores')
@Controller('scores')
export class ScoresController {
  constructor(private scoresService: ScoresService) {}

  @Get()
  @ApiOperation({ summary: 'Список результатов (с фильтрами)' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'roomId', required: false })
  @ApiQuery({ name: 'modeId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('userId') userId?: string,
    @Query('roomId') roomId?: string,
    @Query('modeId') modeId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.scoresService.findAll({
      userId,
      roomId,
      modeId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Глобальный лидерборд' })
  @ApiQuery({ name: 'venueId', required: false })
  @ApiQuery({ name: 'roomId', required: false })
  @ApiQuery({ name: 'period', required: false, description: 'day | week | month | year | all' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getLeaderboard(
    @Query('venueId') venueId?: string,
    @Query('roomId') roomId?: string,
    @Query('period') period?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.scoresService.getLeaderboard({
      venueId,
      roomId,
      period,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('top/:roomId')
  @ApiOperation({ summary: 'Топ игроков по комнате' })
  @ApiQuery({ name: 'limit', required: false })
  getTopByRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Query('limit') limit?: string,
  ) {
    return this.scoresService.getTopByRoom(
      roomId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('my-stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Статистика текущего пользователя' })
  getMyStats(@CurrentUser('id') userId: string) {
    return this.scoresService.getUserStats(userId);
  }

  @Get('stats/:userId')
  @ApiOperation({ summary: 'Статистика пользователя по ID' })
  getUserStats(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.scoresService.getUserStats(userId);
  }
}


