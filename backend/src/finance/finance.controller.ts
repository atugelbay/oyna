import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { CurrentUser, Roles } from '../common/decorators';
import { FinanceService } from './finance.service';
import { EXPENSE_CATEGORIES, type Period } from './finance-rules';

const PERIODS: Period[] = ['day', 'week', 'month', 'custom'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function venue(venueId?: string) {
  if (!venueId) throw new BadRequestException('Выберите точку');
  return venueId;
}

function period(p?: string, from?: string, to?: string): { period: Period; custom?: { from: string; to: string } } {
  const value = (PERIODS as string[]).includes(p ?? '') ? (p as Period) : 'month';
  if (value === 'custom') {
    if (!from || !to || !DAY_RE.test(from) || !DAY_RE.test(to) || from > to) {
      throw new BadRequestException('Свой период: даты с и по в формате ГГГГ-ММ-ДД');
    }
    return { period: value, custom: { from, to } };
  }
  return { period: value };
}

function month(m?: string) {
  if (!m || !MONTH_RE.test(m)) throw new BadRequestException('Месяц в формате ГГГГ-ММ');
  return m;
}

/** Финансы — только владелец. */
@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller()
export class FinanceController {
  constructor(private finance: FinanceService) {}

  @Get('finance/overview')
  overview(@Query('venueId') venueId?: string, @Query('period') p?: string, @Query('from') from?: string, @Query('to') to?: string) {
    const r = period(p, from, to);
    return this.finance.overview(venue(venueId), r.period, r.custom);
  }

  @Get('finance/rooms-played')
  rooms(@Query('venueId') venueId?: string, @Query('period') p?: string, @Query('from') from?: string, @Query('to') to?: string) {
    const r = period(p, from, to);
    return this.finance.roomsByPlayedMinutes(venue(venueId), r.period, r.custom);
  }

  @Get('finance/plan-progress')
  plan(@Query('venueId') venueId?: string, @Query('month') m?: string) {
    return this.finance.planProgress(venue(venueId), month(m));
  }

  @Get('finance/pnl-articles')
  pnl(@Query('venueId') venueId?: string, @Query('month') m?: string) {
    return this.finance.pnlByArticles(venue(venueId), month(m));
  }

  @Get('finance/benchmarks')
  benchmarks() {
    return this.finance.getBenchmarks();
  }

  @Put('finance/benchmarks')
  setBenchmarks(@Body() body: Record<string, unknown>) {
    return this.finance.setBenchmarks(body);
  }

  @Get('finance/expense-categories')
  categories() {
    return EXPENSE_CATEGORIES;
  }

  @Patch('expenses/:id')
  updateExpense(@Param('id') id: string, @Body() body: any, @CurrentUser('id') actorId: string) {
    return this.finance.updateExpense(id, body ?? {}, actorId);
  }

  @Post('expenses/:id/cancel')
  cancelExpense(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.finance.cancelExpense(id, actorId);
  }

  @Post('expenses/repeat-last-month')
  repeat(@Body() body: { venueId?: string; month?: string }, @CurrentUser('id') actorId: string) {
    return this.finance.repeatLastMonth(venue(body.venueId), month(body.month), actorId);
  }
}
