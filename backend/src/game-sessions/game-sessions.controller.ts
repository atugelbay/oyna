import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Role, SessionStatus } from '@prisma/client';
import { GameSessionsService } from './game-sessions.service';
import { StartSessionDto } from './dto/start-session.dto';
import { EndSessionDto } from './dto/end-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';

@ApiTags('Game Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('game-sessions')
export class GameSessionsController {
  constructor(private gameSessionsService: GameSessionsService) {}

  @Post('start')
  @ApiOperation({ summary: 'Создать игровую сессию (QR-сценарий)' })
  start(@Body() dto: StartSessionDto) {
    return this.gameSessionsService.startSession(dto);
  }

  @Post(':id/cancel-pending')
  @ApiOperation({ summary: 'Отменить сессию в ожидании (CRM)' })
  cancelPending(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameSessionsService.cancelPendingSession(id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Пауза активной сессии (CRM)' })
  pauseActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameSessionsService.pauseActiveSession(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Возобновить активную сессию (CRM)' })
  resumeActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameSessionsService.resumeActiveSession(id);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'Завершить сессию с результатами' })
  end(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndSessionDto,
  ) {
    return this.gameSessionsService.endSession(id, dto);
  }

  /** После всех маршрутов `:id/...`, чтобы не пересекаться с двусегментными путями */
  @Post(':token/activate')
  @ApiOperation({ summary: 'Активировать сессию (UE запрашивает старт)' })
  activate(@Param('token') token: string) {
    return this.gameSessionsService.activateSession(token);
  }

  @Get('by-token/:token')
  @ApiOperation({ summary: 'Получить сессию по session_token (для UE)' })
  findByToken(@Param('token') token: string) {
    return this.gameSessionsService.findByToken(token);
  }

  @Get()
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Список сессий (с фильтрами)' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'roomId', required: false })
  @ApiQuery({ name: 'venueId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: SessionStatus })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('userId') userId?: string,
    @Query('roomId') roomId?: string,
    @Query('venueId') venueId?: string,
    @Query('status') status?: SessionStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.gameSessionsService.findAll({
      userId,
      roomId,
      venueId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}


