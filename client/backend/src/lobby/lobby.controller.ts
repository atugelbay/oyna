import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LobbyService } from './lobby.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator.js';

@ApiTags('lobby')
@Controller('lobby')
export class LobbyController {
  constructor(private lobby: LobbyService) {}

  @Get('join/:token')
  @ApiOperation({ summary: 'Превью комнаты по QR-токену (без авторизации)' })
  preview(@Param('token') token: string) {
    return this.lobby.preview(token);
  }

  @Post('join/:token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Войти в лобби комнаты по QR (нужен JWT)' })
  join(
    @Param('token') token: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.lobby.join(token, user.id);
  }
}
