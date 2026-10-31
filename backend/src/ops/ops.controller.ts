import { Body, Controller, Get, Header, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards';
import { CurrentUser, Roles } from '../common/decorators';
import { OpsService } from './ops.service';
import { MinuteLedgerService } from '../ledger/minute-ledger.service';
import { formatAlmaty } from '../domain/rules';
import { excelTable } from '../domain/excel';

@ApiTags('Operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class OpsController {
  constructor(
    private ops: OpsService,
    private ledger: MinuteLedgerService,
  ) {}

  @Get('sources')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  sources() {
    return this.ops.sources();
  }

  @Get('sources/report')
  @Roles(Role.ADMIN)
  sourceReport() {
    return this.ops.sourceReport();
  }

  @Get('live')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  live(@Query('venueId') venueId?: string) {
    return this.ops.live(venueId);
  }

  @Get('sessions-journal')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  sessions(
    @CurrentUser('role') actorRole: Role,
    @Query('venueId') venueId?: string,
    @Query('roomId') roomId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
  ) {
    return this.ops.sessionsJournal({ venueId, roomId, from, to, page: page ? parseInt(page, 10) : 1, actorRole });
  }

  @Get('sessions-journal/export')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  @Header('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
  async sessionsExport(
    @CurrentUser('role') actorRole: Role,
    @Query('venueId') venueId: string | undefined,
    @Res() res: Response,
  ) {
    const journal = await this.ops.sessionsJournal({ venueId, page: 1, take: 2000, actorRole });
    const html = excelTable(
      ['Начало', 'Конец', 'Комната', 'Режим', 'Игроки', 'Оплаченные мин', 'Бонусные мин', 'Статус', 'Причина'],
      journal.data.map((row) => [
        row.start ? formatAlmaty(row.start) : '',
        row.end ? formatAlmaty(row.end) : '',
        row.room,
        row.mode,
        row.players.join(', '),
        row.paidMinutes,
        row.bonusMinutes,
        row.status,
        row.endReason ?? '',
      ]),
    );
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="oyna-sessions.xls"');
    res.send(html);
  }

  @Post('bookings')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  createBooking(@Body() body: any, @CurrentUser('id') actorId: string) {
    return this.ops.createBooking({ ...body, actorId });
  }

  @Get('bookings')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  bookings(@Query('venueId') venueId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ops.listBookings(venueId, from, to);
  }

  @Get('bookings/upcoming')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  upcoming(@Query('venueId') venueId?: string) {
    return this.ops.upcoming(venueId);
  }

  @Post('bookings/:id/status')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  status(
    @Param('id') id: string,
    @Body() body: { status: BookingStatus; reason?: string },
    @CurrentUser('role') role: Role,
  ) {
    return this.ops.setBookingStatus(id, body.status, role, body.reason);
  }

  @Post('bookings/:id/people')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  people(@Param('id') id: string, @Body() body: { people: number }, @CurrentUser('role') role: Role) {
    return this.ops.resizeBooking(id, body.people, role);
  }

  @Post('bookings/:id/participants')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  participant(@Param('id') id: string, @Body() body: any) {
    return this.ops.addParticipant(id, body);
  }

  @Post('bookings/:id/credit')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  credit(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.ops.creditBooking(id, actorId);
  }

  @Post('expenses')
  @Roles(Role.ADMIN)
  expense(@Body() body: any, @CurrentUser('id') actorId: string) {
    return this.ops.addExpense({ ...body, actorId });
  }

  @Get('expenses')
  @Roles(Role.ADMIN)
  expenses(@Query('venueId') venueId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ops.listExpenses(venueId, from, to);
  }

  @Get('finance/pnl')
  @Roles(Role.ADMIN)
  pnl(@Query('venueId') venueId: string, @Query('year') year?: string) {
    return this.ops.pnl(venueId, year ? parseInt(year, 10) : new Date().getFullYear());
  }

  @Get('finance/rooms')
  @Roles(Role.ADMIN)
  rooms(@Query('venueId') venueId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.ops.roomRevenue(venueId, from, to);
  }

  @Post('finance/plan')
  @Roles(Role.ADMIN)
  plan(@Body() body: any) {
    return this.ops.savePlan(body);
  }

  @Get('finance/percents')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  percents(@Query('venueId') venueId: string, @Query('year') year: string, @Query('month') month: string) {
    return this.ops.percents(venueId, parseInt(year, 10), parseInt(month, 10));
  }

  @Get('certificates')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  certificates(@Query('venueId') venueId?: string) {
    return this.ops.listCertificates(venueId);
  }

  @Post('certificates')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  issue(@Body() body: any, @CurrentUser('id') actorId: string) {
    return this.ops.issueCertificate({ ...body, actorId });
  }

  @Post('certificates/activate')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  activate(@Body() body: { code: string; userId: string }, @CurrentUser('id') actorId: string) {
    return this.ops.activateCertificate(body.code, body.userId, actorId);
  }

  @Get('schedule')
  @Roles(Role.ADMIN)
  schedule(@Query('venueId') venueId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ops.listSchedule(venueId, from, to);
  }

  @Post('schedule/:id/arrive')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  arrive(@Param('id') id: string) {
    return this.ops.markArrived(id);
  }

  @Get('finance/heatmap')
  @Roles(Role.ADMIN)
  heatmap(@Query('venueId') venueId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.ops.heatmap(venueId, from, to);
  }

  @Post('schedule')
  @Roles(Role.ADMIN)
  addShift(@Body() body: any, @CurrentUser('id') actorId: string) {
    return this.ops.schedule({ ...body, actorId });
  }

  @Get('schedule/me')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  mySchedule(@CurrentUser('id') id: string) {
    return this.ops.mySchedule(id);
  }

  @Get('schedule/attendance')
  @Roles(Role.ADMIN)
  attendance(@Query('venueId') venueId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.ops.attendance(venueId, from, to);
  }

  @Post('players/:id/phone-change')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  phone(@Param('id') id: string, @Body() body: { newPhone: string; reason: string }, @CurrentUser('id') actorId: string) {
    return this.ops.requestPhoneChange({ userId: id, ...body, actorId });
  }

  @Post('phone-changes/:id/approve')
  @Roles(Role.ADMIN)
  approve(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.ops.approvePhoneChange(id, actorId);
  }

  @Post('players/:id/block')
  @Roles(Role.ADMIN)
  block(@Param('id') id: string, @Body() body: { reason: string; until?: string; permanent?: boolean }, @CurrentUser('id') actorId: string) {
    return this.ops.blockUser({ userId: id, ...body, actorId });
  }

  @Post('players/:id/unblock')
  @Roles(Role.ADMIN)
  unblock(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.ops.unblockUser(id, actorId);
  }

  @Post('players/:id/delete')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.ops.deletePlayer(id, actorId);
  }

  @Post('players/:id/compensate/:sessionId')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  compensate(
    @Param('sessionId') sessionId: string,
    @Body() body: { reason: string },
    @CurrentUser('id') actorId: string,
  ) {
    return this.ledger.compensateSession(sessionId, actorId, body.reason);
  }

  @Get('balance/legacy-report')
  @Roles(Role.ADMIN)
  legacy() {
    return this.ledger.legacyReport();
  }

  @Post('balance/launch-24h')
  @Roles(Role.ADMIN)
  launch(@CurrentUser('id') actorId: string) {
    return this.ledger.launchPaidExpiry(actorId);
  }

  @Get('balance/ledger/:userId')
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  playerLedger(@Param('userId') userId: string, @Query('page') page?: string) {
    return this.ledger.ledger(userId, page ? parseInt(page, 10) : 1);
  }
}
