import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BalanceService } from './balance.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator.js';

@ApiTags('balance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('balance')
export class BalanceController {
  constructor(private balanceService: BalanceService) {}

  @Get()
  @ApiOperation({ summary: 'Get current player balance' })
  getBalance(@CurrentUser() user: CurrentUserPayload) {
    return this.balanceService.getBalance(user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get transaction history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTransactions(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.balanceService.getTransactions(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
