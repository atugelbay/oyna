import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BalanceService } from './balance.service';
import { TopupDto } from './dto/topup.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { Roles, CurrentUser } from '../common/decorators';

@ApiTags('Balance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('balance')
export class BalanceController {
  constructor(private balanceService: BalanceService) {}

  @Get('me')
  @ApiOperation({ summary: 'Текущий баланс авторизованного пользователя' })
  getMyBalance(@CurrentUser('id') userId: string) {
    return this.balanceService.getBalance(userId);
  }

  @Post('topup')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Пополнение баланса через кассу' })
  topup(
    @Body() dto: TopupDto,
    @CurrentUser('id') operatorId: string,
  ) {
    return this.balanceService.topup(dto, operatorId);
  }
}


