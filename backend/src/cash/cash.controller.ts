import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CashService } from './cash.service';
import { CancelSaleDto, CashMoveDto, CatalogDto, CloseShiftDto, CreateSaleDto, OpenShiftDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { CurrentUser, Roles } from '../common/decorators';
import { formatAlmaty } from '../domain/rules';
import { excelTable } from '../domain/excel';

@ApiTags('Cash')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cash')
export class CashController {
  constructor(private cash: CashService) {}

  @Post('shifts/open')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  open(@Body() dto: OpenShiftDto, @CurrentUser('id') id: string) {
    return this.cash.openShift(dto, id);
  }

  @Post('shifts/:id/close')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  close(
    @Param('id') id: string,
    @Body() dto: CloseShiftDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.cash.closeShift(id, dto, actorId, role);
  }

  @Get('shifts/current')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  current(@Query('venueId') venueId: string) {
    return this.cash.current(venueId);
  }

  @Get('shifts/:id/report')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  report(@Param('id') id: string) {
    return this.cash.report(id);
  }

  @Get('discrepancies')
  @Roles(Role.ADMIN)
  discrepancies(@Query('venueId') venueId?: string) {
    return this.cash.discrepancies(venueId);
  }

  @Post('sales')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  sell(
    @Body() dto: CreateSaleDto,
    @CurrentUser('id') id: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.cash.sell(dto, id, role);
  }

  @Post('sales/:id/cancel')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelSaleDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.cash.cancel(id, dto, actorId, role);
  }

  @Get('operators')
  @Roles(Role.ADMIN)
  operators(@Query('venueId') venueId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.cash.operatorSummary(venueId, from, to);
  }

  @Get('sales/export')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  async salesExport(
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') actorRole: Role,
    @Query('venueId') venueId: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const sales = await this.cash.listSales({
      venueId,
      from,
      to,
      page: 1,
      limit: 2000,
      actorId,
      actorRole,
    });
    const html = excelTable(
      ['Дата', 'Сумма', 'Оператор', 'Игрок', 'Телефон', 'Смена', 'Способы', 'Состав', 'Статус'],
      sales.data.map((row) => [
        formatAlmaty(row.createdAt),
        row.totalTenge,
        row.operatorName,
        row.playerNickname,
        row.playerPhone,
        row.shift?.number ?? '',
        row.payments.map((p) => `${p.method} ${p.amountTenge}`).join(', '),
        row.lines.map((l) => l.name).join(', '),
        row.status,
      ]),
    );
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="oyna-sales.xls"');
    res.send(html);
  }

  @Get('sales')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  sales(
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') actorRole: Role,
    @Query('venueId') venueId?: string,
    @Query('operatorId') operatorId?: string,
    @Query('method') method?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cancelled') cancelled?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cash.listSales({
      venueId,
      operatorId,
      method,
      userId,
      from,
      to,
      cancelled,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      actorId,
      actorRole,
    });
  }

  @Post('shifts/:id/movements')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  move(@Param('id') id: string, @Body() dto: CashMoveDto, @CurrentUser('id') operatorId: string) {
    return this.cash.move(id, dto, operatorId);
  }

  @Get('catalog')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  catalog(@Query('venueId') venueId?: string) {
    return this.cash.catalog(venueId);
  }

  @Post('catalog')
  @Roles(Role.ADMIN)
  createItem(@Body() dto: CatalogDto) {
    return this.cash.createItem(dto);
  }

  @Post('catalog/water')
  @Roles(Role.ADMIN)
  water(@Query('venueId') venueId?: string) {
    return this.cash.ensureWater(venueId);
  }
}
