import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { GameModesService } from './game-modes.service';
import { CreateGameModeDto } from './dto/create-game-mode.dto';
import { UpdateGameModeDto } from './dto/update-game-mode.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';

@ApiTags('Game Modes')
@Controller('game-modes')
export class GameModesController {
  constructor(private gameModesService: GameModesService) {}

  @Get('room/:roomId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Режимы по комнате',
    description:
      'Для COOP-сессий с длительностью в config автоматически создаётся пара FFA (одиночный), если её ещё нет.',
  })
  findByRoom(@Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.gameModesService.findByRoom(roomId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Детали режима' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameModesService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Создать режим (админ / менеджер)' })
  create(@Body() dto: CreateGameModeDto) {
    return this.gameModesService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Обновить режим' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGameModeDto,
  ) {
    return this.gameModesService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Удалить режим (админ / менеджер)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameModesService.remove(id);
  }
}


