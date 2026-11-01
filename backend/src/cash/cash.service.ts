import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CashMoveType, PayMethod, Prisma, Role, SaleStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MinuteLedgerService } from '../ledger/minute-ledger.service';
import type { CancelSaleDto, CashMoveDto, CatalogDto, CloseShiftDto, CreateSaleDto, OpenShiftDto } from './dto';

const STAFF: Role[] = [Role.OPERATOR, Role.MANAGER, Role.ADMIN];

@Injectable()
export class CashService {
  constructor(
    private prisma: PrismaService,
    private ledger: MinuteLedgerService,
  ) {}

  async ensureWater(venueId?: string) {
    const existing = await this.prisma.catalogItem.findFirst({
      where: { name: 'Вода 0,5 л', ...(venueId ? { venueId } : {}) },
    });
    if (existing) return existing;
    return this.prisma.catalogItem.create({
      data: {
        venueId: venueId ?? null,
        name: 'Вода 0,5 л',
        category: 'WATER',
        priceTenge: 500,
        active: true,
        trackStock: true,
        stockQty: 0,
      },
    });
  }

  async openShift(dto: OpenShiftDto, operatorId: string) {
    const open = await this.prisma.cashShift.findFirst({
      where: { venueId: dto.venueId, status: 'OPEN' },
    });
    if (open) throw new BadRequestException('На точке уже открыта смена');
    const prev = await this.prisma.cashShift.findFirst({
      where: { venueId: dto.venueId, status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
    });
    const mismatch = prev && prev.closingCashActual != null && prev.closingCashActual !== dto.openingCash;
    if (mismatch && !dto.openingNote) {
      throw new BadRequestException('Наличные не сходятся с прошлой сменой — нужен комментарий');
    }
    const last = await this.prisma.cashShift.aggregate({
      where: { venueId: dto.venueId },
      _max: { number: true },
    });
    const shift = await this.prisma.cashShift.create({
      data: {
        venueId: dto.venueId,
        number: (last._max.number ?? 0) + 1,
        openedById: operatorId,
        openingCash: dto.openingCash,
        previousCloseCash: prev?.closingCashActual ?? null,
        openingNote: dto.openingNote,
      },
    });
    await this.markArrival(operatorId, dto.venueId);
    return shift;
  }

  async closeShift(shiftId: string, dto: CloseShiftDto, actorId: string, role: Role) {
    const shift = await this.mustShift(shiftId);
    if (shift.status !== 'OPEN') throw new BadRequestException('Смена уже закрыта');
    if (role !== Role.ADMIN && shift.openedById !== actorId) {
      throw new ForbiddenException('Закрыть можно только свою смену');
    }
    const expected = await this.expected(shift.id, shift.openingCash);
    const gaps = {
      cash: dto.closingCashActual - expected.cash,
      kaspi: dto.closingKaspi - expected.kaspi,
      halyk: dto.closingHalyk - expected.halyk,
      freedom: dto.closingFreedom - expected.freedom,
    };
    const hasGap = Object.values(gaps).some((n) => n !== 0);
    if (hasGap && !dto.closeComment?.trim()) {
      throw new BadRequestException('Есть расхождение — нужен комментарий');
    }
    const closed = await this.prisma.cashShift.update({
      where: { id: shift.id },
      data: {
        status: 'CLOSED',
        closedById: actorId,
        closedAt: new Date(),
        closingCashActual: dto.closingCashActual,
        closingKaspi: dto.closingKaspi,
        closingHalyk: dto.closingHalyk,
        closingFreedom: dto.closingFreedom,
        closeComment: dto.closeComment,
      },
    });
    await this.prisma.staffSchedule.updateMany({
      where: { userId: shift.openedById, leftAt: null, arrivedAt: { not: null } },
      data: { leftAt: new Date() },
    });
    return { shift: closed, expected, gaps };
  }

  async current(venueId: string) {
    return this.prisma.cashShift.findFirst({
      where: { venueId, status: 'OPEN' },
      include: { sales: { include: { payments: true, lines: true } }, movements: true },
    });
  }

  async sell(dto: CreateSaleDto, operatorId: string, role: Role) {
    if (role !== Role.ADMIN && !(STAFF as string[]).includes(role)) {
      throw new ForbiddenException('Нет права на продажу');
    }
    const shift = await this.prisma.cashShift.findFirst({
      where: { venueId: dto.venueId, status: 'OPEN' },
    });
    if (!shift) throw new BadRequestException('Откройте смену');
    const total = dto.lines.reduce((s, l) => s + l.priceTenge * l.qty, 0);
    const paid = dto.payments.reduce((s, p) => s + p.amountTenge, 0);
    if (total !== paid) throw new BadRequestException('Сумма оплат не равна итогу');
    if (!dto.payments.length) throw new BadRequestException('Нужен способ оплаты');
    for (const pay of dto.payments) {
      if (pay.method === 'CASH' && pay.cashReceived != null && pay.cashReceived < pay.amountTenge) {
        throw new BadRequestException('Полученных наличных меньше суммы');
      }
    }
    const minutes = dto.lines.reduce((s, l) => s + (l.minutes ?? 0) * l.qty, 0);
    if (minutes > 0 && !dto.userId) {
      throw new BadRequestException('Минуты начисляются только на аккаунт игрока');
    }
    if (minutes > 0 && minutes % 10 !== 0) {
      throw new BadRequestException('Минуты кратны 10');
    }
    const number = (await this.prisma.sale.aggregate({ where: { venueId: dto.venueId }, _max: { number: true } }))._max.number ?? 0;
    const sale = await this.prisma.sale.create({
      data: {
        number: number + 1,
        venueId: dto.venueId,
        shiftId: shift.id,
        operatorId,
        userId: dto.userId,
        totalTenge: total,
        minutesCredited: minutes,
        receiptChecked: dto.receiptChecked ?? false,
        receiptNumber: dto.receiptNumber,
        comment: dto.comment,
        enteredAfterOutage: dto.enteredAfterOutage ?? false,
        lines: {
          create: dto.lines.map((l) => ({
            itemId: l.itemId,
            name: l.name,
            qty: l.qty,
            priceTenge: l.priceTenge,
            minutes: l.minutes ?? 0,
          })),
        },
        payments: {
          create: dto.payments.map((p) => ({
            method: p.method as PayMethod,
            amountTenge: p.amountTenge,
            cashReceived: p.cashReceived,
            changeTenge: p.method === 'CASH' && p.cashReceived != null ? p.cashReceived - p.amountTenge : null,
          })),
        },
      },
      include: { lines: true, payments: true },
    });
    if (dto.userId && minutes > 0) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
      const credited = await this.ledger.creditTopup({
        userId: dto.userId,
        paidSeconds: minutes * 60,
        bonusSeconds: 0,
        tier: (user?.loyaltyStatus ?? 'BRONZE') as 'BRONZE',
        operatorId,
        transactionId: sale.id,
        venueId: dto.venueId,
        description: `Продажа №${sale.number}: ${minutes} мин`,
      });
      await this.prisma.sale.update({
        where: { id: sale.id },
        data: { bonusMinutes: credited.bonusMinutes },
      });
    }
    for (const line of dto.lines) {
      if (!line.itemId) continue;
      const item = await this.prisma.catalogItem.findUnique({ where: { id: line.itemId } });
      if (item?.trackStock) {
        await this.prisma.catalogItem.update({
          where: { id: item.id },
          data: { stockQty: { decrement: line.qty } },
        });
        await this.prisma.stockMove.create({
          data: { itemId: item.id, qty: -line.qty, kind: 'SALE', shiftId: shift.id, operatorId },
        });
      }
    }
    const legacy = await this.prisma.transaction.create({
      data: {
        userId: dto.userId,
        type: 'PURCHASE',
        source: 'CASHIER',
        amountTenge: total,
        equivalentSeconds: minutes * 60,
        venueId: dto.venueId,
        description: this.legacyDescription(dto, minutes),
      },
    });
    await this.prisma.sale.update({ where: { id: sale.id }, data: { transactionId: legacy.id } });
    return this.prisma.sale.findUnique({
      where: { id: sale.id },
      include: { lines: true, payments: true, shift: true },
    });
  }

  async cancel(saleId: string, dto: CancelSaleDto, actorId: string, role: Role) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { shift: true },
    });
    if (!sale) throw new NotFoundException('Продажа не найдена');
    if (sale.status === 'CANCELLED') throw new BadRequestException('Продажа уже отменена');
    const ownOpen = sale.shift?.status === 'OPEN' && sale.operatorId === actorId;
    if (!ownOpen && role !== Role.ADMIN) {
      throw new ForbiddenException('Отмена после смены — только владелец');
    }
    if (sale.userId) {
      const grants = await this.prisma.minuteGrant.findMany({
        where: { transactionId: sale.id, remainingSeconds: { gt: 0 } },
      });
      for (const grant of grants) {
        await this.prisma.minuteEntry.create({
          data: {
            id: randomUUID(),
            userId: sale.userId,
            grantId: grant.id,
            type: 'CANCEL',
            seconds: grant.remainingSeconds,
            reason: `Отмена продажи №${sale.number}: ${dto.reason}`,
            createdById: actorId,
          },
        });
        await this.prisma.minuteGrant.update({
          where: { id: grant.id },
          data: { remainingSeconds: 0 },
        });
      }
      if (grants.length) await this.ledger.prepareBalance(sale.userId);
    }
    return this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.CANCELLED,
        cancelReason: dto.reason,
        cancelledById: actorId,
        cancelledAt: new Date(),
      },
    });
  }

  async move(shiftId: string, dto: CashMoveDto, operatorId: string) {
    const shift = await this.mustShift(shiftId);
    if (shift.status !== 'OPEN') throw new BadRequestException('Смена закрыта');
    const movement = await this.prisma.cashMovement.create({
      data: {
        shiftId,
        type: dto.type as CashMoveType,
        amount: dto.amount,
        article: dto.article,
        comment: dto.comment,
        operatorId,
      },
    });
    if (dto.type === 'EXPENSE') {
      const expense = await this.prisma.expense.create({
        data: {
          venueId: shift.venueId,
          occurredOn: new Date(),
          amountTenge: dto.amount,
          category: 'Прочее',
          article: dto.article || 'Расход из кассы',
          comment: `Из кассы смены №${shift.number}. ${dto.comment ?? ''}`,
          payMethod: 'CASH_REGISTER',
          shiftId: shift.id,
          createdById: operatorId,
        },
      });
      await this.prisma.cashMovement.update({
        where: { id: movement.id },
        data: { expenseId: expense.id },
      });
    }
    return movement;
  }

  async listSales(filter: {
    venueId?: string;
    operatorId?: string;
    method?: string;
    userId?: string;
    from?: string;
    to?: string;
    cancelled?: string;
    page?: number;
    limit?: number;
    actorRole: Role;
    actorId: string;
  }) {
    const where: Prisma.SaleWhereInput = {};
    if (filter.actorRole !== Role.ADMIN) {
      where.operatorId = filter.actorId;
    } else if (filter.operatorId) where.operatorId = filter.operatorId;
    if (filter.venueId) where.venueId = filter.venueId;
    if (filter.userId) where.userId = filter.userId;
    if (filter.cancelled === '1') where.status = 'CANCELLED';
    if (filter.from || filter.to) {
      where.createdAt = {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: new Date(filter.to) } : {}),
      };
    }
    if (filter.method) where.payments = { some: { method: filter.method as PayMethod } };
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 50, 2000);
    const [rows, total, sum] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: { lines: true, payments: true, shift: { select: { number: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sale.count({ where }),
      this.prisma.sale.aggregate({ where: { ...where, status: 'COMPLETED' }, _sum: { totalTenge: true }, _count: true }),
    ]);
    const operators = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.operatorId))] } },
      select: { id: true, name: true, nickname: true },
    });
    const names = new Map(operators.map((o) => [o.id, o.name || o.nickname]));
    const playerIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id))];
    const players = playerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, nickname: true, phone: true },
        })
      : [];
    const playersById = new Map(players.map((p) => [p.id, p]));
    return {
      data: rows.map((row) => {
        const player = row.userId ? playersById.get(row.userId) : undefined;
        return {
          ...row,
          operatorName: names.get(row.operatorId) ?? row.operatorId,
          playerNickname: player?.nickname ?? null,
          playerPhone: maskPhone(player?.phone, filter.actorRole),
        };
      }),
      meta: { total, page, limit },
      totals: {
        count: sum._count,
        sum: sum._sum.totalTenge ?? 0,
        average: sum._count ? Math.round((sum._sum.totalTenge ?? 0) / sum._count) : 0,
      },
    };
  }

  async report(shiftId: string) {
    const shift = await this.prisma.cashShift.findUnique({
      where: { id: shiftId },
      include: { sales: { include: { lines: true, payments: true } }, movements: true },
    });
    if (!shift) throw new NotFoundException('Смена не найдена');
    const expected = await this.expected(shift.id, shift.openingCash);
    const unchecked = shift.sales.filter((s) => s.status === 'COMPLETED' && !s.receiptChecked).length;
    return { shift, expected, uncheckedReceipts: unchecked };
  }

  async discrepancies(venueId?: string) {
    const shifts = await this.prisma.cashShift.findMany({
      where: { status: 'CLOSED', ...(venueId ? { venueId } : {}) },
      orderBy: { closedAt: 'desc' },
      take: 100,
    });
    const out: {
      shiftId: string;
      number: number;
      closedAt: Date | null;
      gaps: { cash: number; kaspi: number; halyk: number; freedom: number };
      note: string | null;
      openingNote: string | null;
    }[] = [];
    for (const shift of shifts) {
      const expected = await this.expected(shift.id, shift.openingCash);
      const gaps = {
        cash: (shift.closingCashActual ?? 0) - expected.cash,
        kaspi: (shift.closingKaspi ?? 0) - expected.kaspi,
        halyk: (shift.closingHalyk ?? 0) - expected.halyk,
        freedom: (shift.closingFreedom ?? 0) - expected.freedom,
      };
      if (Object.values(gaps).some((n) => n !== 0) || shift.openingNote) {
        out.push({ shiftId: shift.id, number: shift.number, closedAt: shift.closedAt, gaps, note: shift.closeComment, openingNote: shift.openingNote });
      }
    }
    return out;
  }

  async catalog(venueId?: string) {
    if (venueId) {
      await this.ensureWater(venueId);
      await this.ensurePackagesFromPrices(venueId);
    }
    return this.prisma.catalogItem.findMany({
      where: { active: true, ...(venueId ? { OR: [{ venueId }, { venueId: null }] } : {}) },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  /** Подтягивает тарифы из прайса в кассовый справочник, чтобы на кассе были все минуты, не только вода. */
  private async ensurePackagesFromPrices(venueId: string) {
    const packages = await this.prisma.pricePackage.findMany({ where: { venueId } });
    for (const pkg of packages) {
      const name = pkg.name?.trim() || `${pkg.minutes} мин`;
      const weekend = pkg.costWeekendTenge ?? pkg.costTenge;
      const existing = await this.prisma.catalogItem.findFirst({
        where: { venueId, name, category: 'GAMES' },
      });
      if (existing) {
        if (
          existing.priceTenge !== pkg.costTenge ||
          existing.priceWeekendTenge !== weekend ||
          existing.minutes !== pkg.minutes
        ) {
          await this.prisma.catalogItem.update({
            where: { id: existing.id },
            data: {
              priceTenge: pkg.costTenge,
              priceWeekendTenge: weekend,
              minutes: pkg.minutes,
              active: true,
            },
          });
        }
        continue;
      }
      await this.prisma.catalogItem.create({
        data: {
          venueId,
          name,
          category: 'GAMES',
          priceTenge: pkg.costTenge,
          priceWeekendTenge: weekend,
          minutes: pkg.minutes,
          active: true,
        },
      });
    }
  }

  createItem(dto: CatalogDto) {
    return this.prisma.catalogItem.create({ data: dto });
  }

  async operatorSummary(venueId?: string, from?: string, to?: string) {
    const createdAt =
      from || to
        ? { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) }
        : undefined;
    const sales = await this.prisma.sale.findMany({
      where: { ...(venueId ? { venueId } : {}), ...(createdAt ? { createdAt } : {}) },
      include: { payments: true },
    });
    const shifts = await this.prisma.cashShift.findMany({
      where: { ...(venueId ? { venueId } : {}), ...(createdAt ? { openedAt: createdAt } : {}) },
    });
    const manuals = await this.prisma.minuteGrant.groupBy({
      by: ['createdById'],
      where: { kind: 'MANUAL', createdById: { not: null }, ...(createdAt ? { createdAt } : {}) },
      _sum: { seconds: true },
      _count: true,
    });
    const byOp = new Map<
      string,
      { shifts: number; sales: number; cancelledSum: number; cash: number; kaspi: number; halyk: number; freedom: number; gaps: number; manualMinutes: number }
    >();
    const bucket = (id: string) => {
      const row = byOp.get(id) ?? { shifts: 0, sales: 0, cancelledSum: 0, cash: 0, kaspi: 0, halyk: 0, freedom: 0, gaps: 0, manualMinutes: 0 };
      byOp.set(id, row);
      return row;
    };
    for (const sale of sales) {
      const row = bucket(sale.operatorId);
      if (sale.status === 'CANCELLED') row.cancelledSum += sale.totalTenge;
      else {
        row.sales += 1;
        for (const pay of sale.payments) {
          if (pay.method === 'CASH') row.cash += pay.amountTenge;
          if (pay.method === 'KASPI') row.kaspi += pay.amountTenge;
          if (pay.method === 'HALYK') row.halyk += pay.amountTenge;
          if (pay.method === 'FREEDOM') row.freedom += pay.amountTenge;
        }
      }
    }
    for (const shift of shifts) {
      const row = bucket(shift.openedById);
      row.shifts += 1;
      if (shift.status === 'CLOSED') {
        const expected = await this.expected(shift.id, shift.openingCash);
        const gaps = [
          (shift.closingCashActual ?? 0) - expected.cash,
          (shift.closingKaspi ?? 0) - expected.kaspi,
          (shift.closingHalyk ?? 0) - expected.halyk,
          (shift.closingFreedom ?? 0) - expected.freedom,
        ];
        if (gaps.some((n) => n !== 0)) row.gaps += 1;
      }
    }
    for (const manual of manuals) {
      if (!manual.createdById) continue;
      bucket(manual.createdById).manualMinutes += Math.floor((manual._sum.seconds ?? 0) / 60);
    }
    const people = await this.prisma.user.findMany({
      where: { id: { in: [...byOp.keys()] } },
      select: { id: true, name: true, nickname: true },
    });
    const names = new Map(people.map((p) => [p.id, p.name || p.nickname]));
    return [...byOp.entries()].map(([operatorId, row]) => ({
      operatorId,
      operatorName: names.get(operatorId) ?? operatorId,
      ...row,
    }));
  }

  private async expected(shiftId: string, openingCash: number) {
    const [payments, movements] = await Promise.all([
      this.prisma.salePayment.findMany({
        where: { sale: { shiftId, status: 'COMPLETED' } },
      }),
      this.prisma.cashMovement.findMany({ where: { shiftId } }),
    ]);
    const by = { cash: openingCash, kaspi: 0, halyk: 0, freedom: 0 };
    for (const pay of payments) {
      if (pay.method === 'CASH') by.cash += pay.amountTenge;
      if (pay.method === 'KASPI') by.kaspi += pay.amountTenge;
      if (pay.method === 'HALYK') by.halyk += pay.amountTenge;
      if (pay.method === 'FREEDOM') by.freedom += pay.amountTenge;
    }
    for (const move of movements) {
      if (move.type === 'IN') by.cash += move.amount;
      if (move.type === 'OUT' || move.type === 'EXPENSE') by.cash -= move.amount;
    }
    return by;
  }

  private async mustShift(id: string) {
    const shift = await this.prisma.cashShift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Смена не найдена');
    return shift;
  }

  private legacyDescription(dto: CreateSaleDto, minutes: number) {
    const method = dto.payments[0]?.method.toLowerCase() ?? 'cash';
    return `Пополнение (sale, ${method}) ${minutes} мин. ${dto.comment ?? ''}`.trim();
  }

  private async markArrival(userId: string, venueId: string) {
    const now = new Date();
    const row = await this.prisma.staffSchedule.findFirst({
      where: { userId, venueId, startsAt: { lte: new Date(now.getTime() + 3 * 3600000) }, endsAt: { gte: new Date(now.getTime() - 3 * 3600000) }, arrivedAt: null },
      orderBy: { startsAt: 'asc' },
    });
    if (row) {
      await this.prisma.staffSchedule.update({ where: { id: row.id }, data: { arrivedAt: now } });
    }
  }
}

function maskPhone(phone: string | undefined, role: Role): string | null {
  if (!phone) return null;
  if (role === Role.ADMIN) return phone;
  return phone.length <= 4 ? phone : `···${phone.slice(-4)}`;
}
