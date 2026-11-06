import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { almatyDayBounds } from '../dashboard/today-rules';
import {
  arrivalWindow,
  copyWeek,
  formatAlmatyTime,
  lateMinutes,
  monthBounds,
  monthTotals,
  parseAlmatyInput,
  weekBounds,
} from './team-rules';

export type OperationKind = 'sales' | 'cancelled' | 'unchecked' | 'compensations' | 'manual' | 'gaps';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  /**
   * Отметка прихода: открытие кассовой смены или первый вход в CRM.
   * Ставится один раз на смену из графика, которая идёт сейчас (или начнётся в течение часа).
   */
  async markArrival(userId: string, venueId?: string, now = new Date()) {
    const window = arrivalWindow(now);
    const row = await this.prisma.staffSchedule.findFirst({
      where: {
        userId,
        ...(venueId ? { venueId } : {}),
        arrivedAt: null,
        startsAt: { lte: window.startsAtLte },
        endsAt: { gte: window.endsAtGte },
      },
      orderBy: { startsAt: 'asc' },
    });
    if (!row) return null;
    return this.prisma.staffSchedule.update({ where: { id: row.id }, data: { arrivedAt: now } });
  }

  /** «Смена сегодня»: кто работает по графику, когда пришёл и ушёл, опоздание. */
  async today(venueId: string) {
    const day = almatyDayBounds(new Date());
    const rows = await this.prisma.staffSchedule.findMany({
      where: { venueId, startsAt: { gte: day.from, lt: day.to } },
      orderBy: { startsAt: 'asc' },
    });
    const names = await this.names(rows.map((r) => r.userId));
    const now = new Date();
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: names.get(r.userId) ?? '—',
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      arrivedAt: r.arrivedAt,
      leftAt: r.leftAt,
      lateMinutes: lateMinutes(r),
      notArrived: !r.arrivedAt && r.startsAt < now,
      note: r.note,
    }));
  }

  /** Владелец поправляет время прихода/ухода; комментарий обязателен, всё пишется в журнал. */
  async correctTimes(
    id: string,
    input: { arrivedAt?: string | null; leftAt?: string | null; comment?: string },
    actorId: string,
  ) {
    const comment = input.comment?.trim();
    if (!comment) throw new BadRequestException('Напишите, почему меняется время');
    const row = await this.prisma.staffSchedule.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Смена не найдена');
    const parse = (v: string | null | undefined, current: Date | null) =>
      v === undefined ? current : v === null || v === '' ? null : parseAlmatyInput(v);
    const arrivedAt = parse(input.arrivedAt, row.arrivedAt);
    const leftAt = parse(input.leftAt, row.leftAt);
    if (arrivedAt && leftAt && leftAt < arrivedAt) throw new BadRequestException('Ушёл раньше, чем пришёл');
    const updated = await this.prisma.staffSchedule.update({
      where: { id },
      data: { arrivedAt, leftAt, note: comment },
    });
    const name = (await this.names([row.userId])).get(row.userId) ?? row.userId;
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'schedule_time_fix',
        entity: 'staff_schedule',
        entityId: id,
        detail:
          `${name}: пришёл ${formatAlmatyTime(row.arrivedAt)} → ${formatAlmatyTime(arrivedAt)}, ` +
          `ушёл ${formatAlmatyTime(row.leftAt)} → ${formatAlmatyTime(leftAt)}. ${comment}`,
      },
    });
    return updated;
  }

  /** Неделя сеткой «сотрудник × день». weekStart — понедельник YYYY-MM-DD. */
  async week(venueId: string, weekStart: string) {
    const w = weekBounds(weekStart);
    const [rows, employees] = await Promise.all([
      this.prisma.staffSchedule.findMany({
        where: { venueId, startsAt: { gte: w.from, lt: w.to } },
        orderBy: { startsAt: 'asc' },
      }),
      this.employees(venueId),
    ]);
    return {
      weekStart,
      employees,
      shifts: rows.map((r) => ({ ...r, lateMinutes: lateMinutes(r) })),
    };
  }

  /** Копировать прошлую неделю на эту; уже поставленные смены не дублируются. */
  async copyPreviousWeek(venueId: string, weekStart: string, actorId: string) {
    const cur = weekBounds(weekStart);
    const prev = { from: new Date(cur.from.getTime() - 7 * 86400000), to: cur.from };
    const [previous, existing] = await Promise.all([
      this.prisma.staffSchedule.findMany({ where: { venueId, startsAt: { gte: prev.from, lt: prev.to } } }),
      this.prisma.staffSchedule.findMany({ where: { venueId, startsAt: { gte: cur.from, lt: cur.to } } }),
    ]);
    const rows = copyWeek(previous, existing);
    if (rows.length) {
      await this.prisma.staffSchedule.createMany({
        data: rows.map((r) => ({ venueId, userId: r.userId, startsAt: r.startsAt, endsAt: r.endsAt })),
      });
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'schedule_copy_week',
          entity: 'staff_schedule',
          detail: `Скопировано смен: ${rows.length} на неделю с ${weekStart}`,
        },
      });
    }
    return { copied: rows.length };
  }

  async removeShift(id: string, actorId: string) {
    const row = await this.prisma.staffSchedule.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Смена не найдена');
    if (row.arrivedAt) throw new BadRequestException('Сотрудник уже отметился — поправьте время, а не удаляйте смену');
    await this.prisma.staffSchedule.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: { actorId, action: 'schedule_delete', entity: 'staff_schedule', entityId: id },
    });
    return { ok: true };
  }

  /** Итоги месяца: часов, опозданий, прогулов по каждому сотруднику. */
  async month(venueId: string, month: string) {
    const m = monthBounds(month);
    const rows = await this.prisma.staffSchedule.findMany({
      where: { venueId, startsAt: { gte: m.from, lt: m.to } },
    });
    const totals = monthTotals(rows, new Date());
    const names = await this.names(totals.map((t) => t.userId));
    return totals.map((t) => ({ ...t, name: names.get(t.userId) ?? '—' })).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Список операций за числом в «Операторах». */
  async operations(input: { operatorId: string; kind: OperationKind; venueId?: string; from?: string; to?: string }) {
    const range: Prisma.DateTimeFilter | undefined =
      input.from || input.to
        ? { ...(input.from ? { gte: new Date(input.from) } : {}), ...(input.to ? { lte: new Date(input.to) } : {}) }
        : undefined;
    const venue = input.venueId ? { venueId: input.venueId } : {};
    if (input.kind === 'compensations') {
      const rows = await this.prisma.sessionCompensation.findMany({
        where: { actorId: input.operatorId, ...(range ? { createdAt: range } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      const players = await this.names(rows.flatMap((r) => r.userIds));
      return rows.map((r) => ({
        id: r.id,
        at: r.createdAt,
        title: `${r.minutes} мин × ${r.userIds.length}`,
        detail: [r.userIds.map((id) => players.get(id) ?? '—').join(', '), r.comment].filter(Boolean).join(' · '),
        sessionId: r.sessionId,
      }));
    }
    if (input.kind === 'manual') {
      const rows = await this.prisma.minuteGrant.findMany({
        where: { kind: 'MANUAL', createdById: input.operatorId, ...(range ? { createdAt: range } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      const players = await this.names(rows.map((r) => r.userId));
      return rows.map((r) => ({
        id: r.id,
        at: r.createdAt,
        title: `${Math.floor(r.seconds / 60)} мин · ${players.get(r.userId) ?? '—'}`,
        detail: r.reason ?? '',
      }));
    }
    if (input.kind === 'gaps') {
      const shifts = await this.prisma.cashShift.findMany({
        where: { openedById: input.operatorId, status: 'CLOSED', ...venue, ...(range ? { openedAt: range } : {}) },
        orderBy: { openedAt: 'desc' },
        take: 100,
      });
      return shifts
        .filter((s) => s.closeComment)
        .map((s) => ({ id: s.id, at: s.closedAt ?? s.openedAt, title: `Смена №${s.number}`, detail: s.closeComment ?? '' }));
    }
    const where: Prisma.SaleWhereInput = {
      operatorId: input.operatorId,
      ...venue,
      ...(range ? { createdAt: range } : {}),
      ...(input.kind === 'cancelled'
        ? { status: 'CANCELLED' }
        : input.kind === 'unchecked'
          ? { status: 'COMPLETED', isBarter: false, receiptChecked: false }
          : { status: 'COMPLETED' }),
    };
    const rows = await this.prisma.sale.findMany({
      where,
      include: { lines: true, payments: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((s) => ({
      id: s.id,
      at: s.createdAt,
      title: `№${s.number} · ${s.isBarter ? 'Бартер' : `${s.totalTenge} ₸`}`,
      detail: [s.lines.map((l) => `${l.name}×${l.qty}`).join(', '), s.cancelReason].filter(Boolean).join(' · '),
    }));
  }

  private async employees(venueId: string) {
    const rows = await this.prisma.user.findMany({
      where: { role: { not: Role.USER }, isActive: true, staffVenues: { some: { venueId } } },
      select: { id: true, name: true, nickname: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, name: r.name || r.nickname }));
  }

  private async names(ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map<string, string>();
    const rows = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, nickname: true },
    });
    return new Map(rows.map((r) => [r.id, r.name || r.nickname]));
  }
}
