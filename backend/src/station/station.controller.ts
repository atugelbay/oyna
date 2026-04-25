import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { StationService } from './station.service';
import { StationAuthGuard } from './guards/station-auth.guard';
import { StationHeartbeatDto } from './dto/station-heartbeat.dto';
import { AckCommandsDto } from './dto/ack-commands.dto';
import { SessionMatchReportDto } from './dto/session-match-report.dto';
import { ActivateByTokenDto } from './dto/activate-by-token.dto';
import { GameSessionsService } from '../game-sessions/game-sessions.service';
import { EndSessionDto } from '../game-sessions/dto/end-session.dto';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Station (Room Agent)')
@ApiBearerAuth('StationApiKey')
@UseGuards(StationAuthGuard)
@Controller('station/rooms')
export class StationController {
  constructor(
    private readonly stationService: StationService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => GameSessionsService))
    private readonly gameSessionsService: GameSessionsService,
  ) {}

  @Post(':roomId/heartbeat')
  @ApiOperation({ summary: 'Heartbeat станции (онлайн, версия билда)' })
  heartbeat(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: StationHeartbeatDto,
  ) {
    return this.stationService.heartbeat(roomId, dto);
  }

  @Get(':roomId/commands')
  @ApiOperation({
    summary: 'Очередь команд CRM → агент (polling). Не доставленные: deliveredAt=null',
  })
  @ApiQuery({ name: 'limit', required: false })
  listCommands(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 50;
    return this.stationService.listPendingCommands(roomId, n);
  }

  @Post(':roomId/commands/ack')
  @ApiOperation({ summary: 'Подтвердить доставку команд агенту' })
  ack(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: AckCommandsDto,
  ) {
    return this.stationService.ackCommands(roomId, dto.commandIds);
  }

  @Post(':roomId/sessions/:sessionId/match-reports')
  @ApiOperation({
    summary: 'Отчёт об уровне (идемпотентно по sessionId+level+attemptNumber)',
  })
  matchReport(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: SessionMatchReportDto,
  ) {
    return this.stationService.recordMatchReport(roomId, sessionId, dto);
  }

  @Post(':roomId/sessions/activate-by-token')
  @ApiOperation({
    summary:
      'Активировать сессию по sessionToken (агент без JWT; roomId должен совпадать)',
  })
  async activateByToken(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: ActivateByTokenDto,
  ) {
    const session = await this.prisma.gameSession.findUnique({
      where: { sessionToken: dto.sessionToken },
    });
    if (!session || session.roomId !== roomId) {
      throw new NotFoundException('Сессия не найдена для этой комнаты');
    }
    return this.gameSessionsService.activateSession(dto.sessionToken);
  }

  @Post(':roomId/sessions/:sessionId/end')
  @ApiOperation({
    summary:
      'Завершить сессию от имени станции (проверка roomId; идемпотентный end)',
  })
  async endSession(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: EndSessionDto,
  ) {
    const session = await this.prisma.gameSession.findFirst({
      where: { id: sessionId, roomId },
    });
    if (!session) {
      throw new NotFoundException('Сессия не найдена для этой комнаты');
    }
    return this.gameSessionsService.endSession(sessionId, dto);
  }
}
