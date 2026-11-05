import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CashMoveType, PayMethod, Prisma, Role, SaleStatus } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MinuteLedgerService } from '../ledger/minute-ledger.service';
import { addDays } from '../domain/rules';
import type {
  CancelSaleDto,
  CashMoveDto,
  CatalogDto,
  CloseShiftDto,
  CreateSaleDto,
  OpenShiftDto,
  RefundSaleDto,
} from './dto';
import { bookingDue, dayPrice, minutesPerPlayer, packageCategory, refundable, shiftOverdue } from './sale-rules';

const STAFF: Role[] = [Role.OPERATOR, Role.MANAGER, Role.ADMIN];

/** Срок, за который нужно активировать проданный сертификат */
const CERTIFICATE_ACTIVATE_DAYS = 90;

type ResolvedLine = {
  kind: 'ITEM' | 'CERTIFICATE' | 'BOOKING';
  itemId?: string;
  bookingId?: string;
  name: string;
  qty: number;
  priceTenge: number;
  minutes: number;
  category: string;
};

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
    if (!(STAFF as string[]).includes(role)) {
      throw new ForbiddenException('Нет права на продажу');
    }
    const isAdmin = role === Role.ADMIN;
    const shift = await this.prisma.cashShift.findFirst({
      where: { venueId: dto.venueId, status: 'OPEN' },
    });
    if (!shift) throw new BadRequestException('Откройте смену');
    if (!isAdmin && shift.openedById !== operatorId) {
      throw new ForbiddenException('Смена открыта другим сотрудником: закройте её и откройте свою');
    }
    const players = [...new Set([...(dto.userIds ?? []), ...(dto.userId ? [dto.userId] : [])])];
    if (dto.guest && players.length) {
      throw new BadRequestException('Выберите либо гостя, либо игроков');
    }
    const now = new Date();
    const lines = await this.resolveLines(dto, isAdmin, now);
    const isBarter = this.checkBarter(lines, dto.comment);
    const total = lines.reduce((s, l) => s + l.priceTenge * l.qty, 0);
    const paid = dto.payments.reduce((s, p) => s + p.amountTenge, 0);
    if (total !== paid) throw new BadRequestException('Сумма оплат не равна итогу');
    if (!dto.payments.length && !(isBarter && total === 0)) {
      throw new BadRequestException('Нужен способ оплаты');
    }
    for (const pay of dto.payments) {
      if (pay.method === 'CASH' && pay.cashReceived != null && pay.cashReceived < pay.amountTenge) {
        throw new BadRequestException('Полученных наличных меньше суммы');
      }
    }
    const gameMinutes = lines
      .filter((l) => l.kind === 'ITEM')
      .reduce((s, l) => s + l.minutes * l.qty, 0);
    let perPlayer = 0;
    if (!dto.guest && gameMinutes > 0) {
      const split = minutesPerPlayer(gameMinutes, players.length);
      if (typeof split === 'string') throw new BadRequestException(split);
      perPlayer = split;
    }
    const bookingLines = lines.filter((l) => l.kind === 'BOOKING');
    if (bookingLines.length > 1) throw new BadRequestException('Одна бронь на чек');
    const bookingId = bookingLines[0]?.bookingId ?? null;

    const number = (await this.prisma.sale.aggregate({ where: { venueId: dto.venueId }, _max: { number: true } }))._max.number ?? 0;
    const sale = await this.prisma.sale.create({
      data: {
        number: number + 1,
        venueId: dto.venueId,
        shiftId: shift.id,
        operatorId,
        userId: players[0],
        userIds: players,
        isGuest: !!dto.guest,
        bookingId,
        totalTenge: total,
        minutesCredited: dto.guest ? 0 : gameMinutes,
        receiptChecked: dto.receiptChecked ?? false,
        receiptNumber: dto.receiptNumber,
        comment: dto.comment?.trim() || (dto.guest ? 'Гость' : undefined),
        enteredAfterOutage: dto.enteredAfterOutage ?? false,
        isBarter,
        lines: {
          create: lines.map((l) => ({
            itemId: l.itemId,
            name: l.name,
            qty: l.qty,
            priceTenge: l.priceTenge,
            minutes: l.minutes,
            kind: l.kind,
            category: l.category,
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
    });

    let bonusMinutes = 0;
    if (perPlayer > 0) {
      const users = await this.prisma.user.findMany({ where: { id: { in: players } } });
      const tiers = new Map(users.map((u) => [u.id, u.loyaltyStatus]));
      for (const userId of players) {
        const credited = await this.ledger.creditTopup({
          userId,
          paidSeconds: perPlayer * 60,
          bonusSeconds: 0,
          tier: (tiers.get(userId) ?? 'BRONZE') as 'BRONZE',
          operatorId,
          transactionId: sale.id,
          // У каждого игрока свой ключ, иначе второй и дальше не получат минуты
          idempotencyKey: players.length > 1 ? `${sale.id}:${userId}` : undefined,
          venueId: dto.venueId,
          description: `Продажа №${sale.number}: ${perPlayer} мин`,
        });
        bonusMinutes += credited.bonusMinutes;
      }
      if (bonusMinutes) {
        await this.prisma.sale.update({ where: { id: sale.id }, data: { bonusMinutes } });
      }
    }

    const certificates: { code: string; minutes: number }[] = [];
    for (const line of lines.filter((l) => l.kind === 'CERTIFICATE')) {
      for (let i = 0; i < line.qty; i++) {
        const cert = await this.prisma.giftCertificate.create({
          data: {
            venueId: dto.venueId,
            code: randomBytes(4).toString('hex').toUpperCase(),
            title: line.name,
            minutes: line.minutes,
            priceTenge: line.priceTenge,
            saleId: sale.id,
            activateBy: addDays(now, CERTIFICATE_ACTIVATE_DAYS),
            createdById: operatorId,
          },
        });
        certificates.push({ code: cert.code, minutes: cert.minutes });
      }
    }

    if (bookingId) {
      const amount = bookingLines[0].priceTenge * bookingLines[0].qty;
      const booking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: { paidTenge: { increment: amount } },
      });
      if (booking.status === 'NEW' && booking.paidTenge >= booking.prepayTenge) {
        await this.prisma.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' } });
      }
    }

    for (const line of lines) {
      if (!line.itemId || line.kind !== 'ITEM') continue;
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
        userId: players[0],
        type: 'PURCHASE',
        source: 'CASHIER',
        amountTenge: total,
        equivalentSeconds: (dto.guest ? 0 : gameMinutes) * 60,
        venueId: dto.venueId,
        description: this.legacyDescription(dto, dto.guest ? 0 : gameMinutes),
      },
    });
    await this.prisma.sale.update({ where: { id: sale.id }, data: { transactionId: legacy.id } });
    const result = await this.prisma.sale.findUnique({
      where: { id: sale.id },
      include: { lines: true, payments: true, shift: true },
    });
    return { ...result, minutesPerPlayer: perPlayer, certificates };
  }

  /** Строки чека с ценами, которые проверил сервер. Оператор не меняет цену, владелец может. */
  private async resolveLines(dto: CreateSaleDto, isAdmin: boolean, now: Date): Promise<ResolvedLine[]> {
    if (!dto.lines.length) throw new BadRequestException('Добавьте товары в чек');
    const itemIds = [...new Set(dto.lines.map((l) => l.itemId).filter((id): id is string => !!id))];
    const items = itemIds.length
      ? await this.prisma.catalogItem.findMany({ where: { id: { in: itemIds } } })
      : [];
    const byId = new Map(items.map((i) => [i.id, i]));
    const out: ResolvedLine[] = [];
    for (const line of dto.lines) {
      const kind = line.kind ?? 'ITEM';
      if (kind === 'BOOKING') {
        if (!line.bookingId) throw new BadRequestException('Не выбрана бронь');
        const booking = await this.prisma.booking.findUnique({ where: { id: line.bookingId } });
        if (!booking) throw new NotFoundException('Бронь не найдена');
        if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') {
          throw new BadRequestException('Бронь отменена');
        }
        const due = bookingDue(booking);
        if (due.kind === 'PAID') throw new BadRequestException('Бронь уже оплачена');
        const price = isAdmin ? line.priceTenge : due.amount;
        if (price < 1 || price > due.remaining) {
          throw new BadRequestException(`Сумма по брони — от 1 до ${due.remaining} ₸`);
        }
        out.push({
          kind,
          bookingId: booking.id,
          name: `${price === due.amount ? due.label : 'Оплата'} брони · ${booking.contactName}`,
          qty: 1,
          priceTenge: price,
          minutes: 0,
          category: 'BOOKING',
        });
        continue;
      }
      const item = line.itemId ? byId.get(line.itemId) : undefined;
      if (line.itemId && !item) throw new BadRequestException('Позиция не найдена');
      if (!item && !isAdmin) {
        throw new ForbiddenException('Позиция не из каталога — только владелец');
      }
      const expected = item ? dayPrice(item, now) : line.priceTenge;
      const price = isAdmin ? line.priceTenge : expected;
      if (kind === 'CERTIFICATE') {
        const minutes = item?.minutes ?? line.minutes ?? 0;
        if (!minutes || minutes % 10 !== 0) throw new BadRequestException('Сертификат — кратно 10 минутам');
        out.push({
          kind,
          itemId: item?.id,
          name: `Сертификат ${minutes} мин`,
          qty: line.qty,
          priceTenge: price,
          minutes,
          category: 'CERTIFICATE',
        });
        continue;
      }
      out.push({
        kind: 'ITEM',
        itemId: item?.id,
        name: item?.name ?? line.name,
        qty: line.qty,
        priceTenge: price,
        minutes: item ? item.minutes ?? 0 : line.minutes ?? 0,
        category: item?.category ?? 'OTHER',
      });
    }
    return out;
  }

  async cancel(saleId: string, dto: CancelSaleDto, actorId: string, role: Role) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { shift: true, lines: true },
    });
    if (!sale) throw new NotFoundException('Продажа не найдена');
    if (sale.status === 'CANCELLED') throw new BadRequestException('Продажа уже отменена');
    if (sale.refundTenge > 0) throw new BadRequestException('По продаже уже был возврат');
    const ownOpen = sale.shift?.status === 'OPEN' && sale.operatorId === actorId;
    if (!ownOpen && role !== Role.ADMIN) {
      throw new ForbiddenException('Отмена после смены — только владелец');
    }
    const certs = await this.prisma.giftCertificate.findMany({ where: { saleId: sale.id } });
    if (certs.some((c) => c.status === 'ACTIVATED')) {
      throw new BadRequestException('Сертификат из этой продажи уже активирован');
    }
    await this.removeSaleMinutes(sale, `Отмена продажи №${sale.number}: ${dto.reason}`, actorId);
    if (certs.length) {
      await this.prisma.giftCertificate.updateMany({
        where: { saleId: sale.id },
        data: { status: 'EXPIRED' },
      });
    }
    if (sale.bookingId) {
      const paid = sale.lines.filter((l) => l.kind === 'BOOKING').reduce((s, l) => s + l.priceTenge * l.qty, 0);
      if (paid) {
        await this.prisma.booking.update({
          where: { id: sale.bookingId },
          data: { paidTenge: { decrement: paid } },
        });
      }
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

  /** Возврат денег, когда часть минут уже сыграна: только владелец, сумма вручную, остаток минут снимается. */
  async refund(saleId: string, dto: RefundSaleDto, actorId: string, role: Role) {
    if (role !== Role.ADMIN) throw new ForbiddenException('Возврат денег — только владелец');
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Продажа не найдена');
    if (sale.status !== 'COMPLETED') throw new BadRequestException('Продажа отменена');
    if (sale.isBarter) throw new BadRequestException('По бартеру денег не было');
    const max = refundable(sale);
    if (dto.amountTenge > max) throw new BadRequestException(`Можно вернуть не больше ${max} ₸`);
    let cashShiftId: string | null = null;
    if (dto.method === 'CASH') {
      const open = await this.prisma.cashShift.findFirst({ where: { venueId: sale.venueId, status: 'OPEN' } });
      if (!open) throw new BadRequestException('Наличные выдаются из открытой смены — откройте смену');
      cashShiftId = open.id;
    }
    const reason = dto.reason.trim();
    const removedMinutes = await this.removeSaleMinutes(sale, `Возврат по продаже №${sale.number}: ${reason}`, actorId);
    if (cashShiftId) {
      await this.prisma.cashMovement.create({
        data: {
          shiftId: cashShiftId,
          type: 'OUT',
          amount: dto.amountTenge,
          article: 'Возврат',
          comment: `Возврат по продаже №${sale.number}: ${reason}`,
          operatorId: actorId,
        },
      });
    }
    const updated = await this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        refundTenge: { increment: dto.amountTenge },
        refundReason: reason,
        refundedById: actorId,
        refundedAt: new Date(),
      },
    });
    return { sale: updated, removedMinutes };
  }

  /** Снимает неизрасходованные минуты всех игроков продажи. Возвращает, сколько минут снято. */
  private async removeSaleMinutes(sale: { id: string }, reason: string, actorId: string) {
    const grants = await this.prisma.minuteGrant.findMany({
      where: { transactionId: sale.id, remainingSeconds: { gt: 0 } },
    });
    let seconds = 0;
    for (const grant of grants) {
      await this.prisma.minuteEntry.create({
        data: {
          id: randomUUID(),
          userId: grant.userId,
          grantId: grant.id,
          type: 'CANCEL',
          seconds: grant.remainingSeconds,
          reason,
          createdById: actorId,
        },
      });
      await this.prisma.minuteGrant.update({
        where: { id: grant.id },
        data: { remainingSeconds: 0 },
      });
      seconds += grant.remainingSeconds;
    }
    for (const userId of new Set(grants.map((g) => g.userId))) {
      await this.ledger.prepareBalance(userId);
    }
    return Math.floor(seconds / 60);
  }

  /** Брони для кассы: поиск по телефону или имени, только с остатком к оплате. */
  async bookingsForCash(venueId: string, q?: string) {
    const query = (q ?? '').trim();
    const digits = query.replace(/\D/g, '');
    const rows = await this.prisma.booking.findMany({
      where: {
        venueId,
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
        startsAt: { gte: addDays(new Date(), -2) },
        ...(query
          ? {
              OR: [
                ...(digits.length >= 3 ? [{ contactPhone: { contains: digits } }] : []),
                { contactName: { contains: query, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { startsAt: 'asc' },
      take: 20,
    });
    return rows
      .map((b) => ({
        id: b.id,
        startsAt: b.startsAt,
        contactName: b.contactName,
        contactPhone: b.contactPhone,
        packageName: b.packageName,
        people: b.people,
        amountTenge: b.amountTenge,
        prepayTenge: b.prepayTenge,
        paidTenge: b.paidTenge,
        due: bookingDue(b),
      }))
      .filter((b) => b.due.kind !== 'PAID');
  }

  /** Смены, не закрытые к 23:00 — уведомление владельцу. */
  async overdueShifts(venueId?: string) {
    const open = await this.prisma.cashShift.findMany({
      where: { status: 'OPEN', ...(venueId ? { venueId } : {}) },
    });
    const now = new Date();
    const late = open.filter((s) => shiftOverdue(s.openedAt, now));
    if (!late.length) return [];
    const people = await this.prisma.user.findMany({
      where: { id: { in: late.map((s) => s.openedById) } },
      select: { id: true, name: true, nickname: true },
    });
    const names = new Map(people.map((p) => [p.id, p.name || p.nickname]));
    return late.map((s) => ({
      shiftId: s.id,
      venueId: s.venueId,
      number: s.number,
      openedAt: s.openedAt,
      operatorName: names.get(s.openedById) ?? '—',
    }));
  }

  async move(shiftId: string, dto: CashMoveDto, operatorId: string) {
    const shift = await this.mustShift(shiftId);
    if (shift.status !== 'OPEN') throw new BadRequestException('Смена закрыта');
    const comment = dto.comment?.trim();
    if (!comment) throw new BadRequestException('Напишите комментарий к движению денег');
    const movement = await this.prisma.cashMovement.create({
      data: {
        shiftId,
        type: dto.type as CashMoveType,
        amount: dto.amount,
        article: dto.article,
        comment,
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
          comment: `Из кассы смены №${shift.number}. ${comment}`,
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
      this.prisma.sale.aggregate({
        where: { ...where, status: 'COMPLETED', isBarter: false },
        _sum: { totalTenge: true, refundTenge: true },
        _count: true,
      }),
    ]);
    const operators = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.operatorId))] } },
      select: { id: true, name: true, nickname: true },
    });
    const names = new Map(operators.map((o) => [o.id, o.name || o.nickname]));
    const playerIds = [
      ...new Set(rows.flatMap((r) => (r.userIds.length ? r.userIds : r.userId ? [r.userId] : []))),
    ];
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
        const ids = row.userIds.length ? row.userIds : row.userId ? [row.userId] : [];
        return {
          ...row,
          operatorName: names.get(row.operatorId) ?? row.operatorId,
          playerNickname: player?.nickname ?? null,
          playerNicknames: ids.map((id) => playersById.get(id)?.nickname ?? '—'),
          playerPhone: maskPhone(player?.phone, filter.actorRole),
        };
      }),
      meta: { total, page, limit },
      totals: {
        count: sum._count,
        sum: (sum._sum.totalTenge ?? 0) - (sum._sum.refundTenge ?? 0),
        average: sum._count
          ? Math.round(((sum._sum.totalTenge ?? 0) - (sum._sum.refundTenge ?? 0)) / sum._count)
          : 0,
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
    const completed = shift.sales.filter((s) => s.status === 'COMPLETED');
    const unchecked = completed.filter((s) => !s.isBarter && !s.receiptChecked).length;
    const barterSales = completed.filter((s) => s.isBarter);
    const paidSales = completed.filter((s) => !s.isBarter);
    const byMethod = { CASH: 0, KASPI: 0, HALYK: 0, FREEDOM: 0 } as Record<string, number>;
    for (const sale of paidSales) {
      for (const pay of sale.payments) byMethod[pay.method] = (byMethod[pay.method] ?? 0) + pay.amountTenge;
    }
    const sum = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);
    return {
      shift,
      expected,
      /** X-отчёт: промежуточный итог без закрытия смены */
      summary: {
        sales: paidSales.length,
        revenue: paidSales.reduce((t, s) => t + s.totalTenge - s.refundTenge, 0),
        refunds: paidSales.reduce((t, s) => t + s.refundTenge, 0),
        cancelled: shift.sales.filter((s) => s.status === 'CANCELLED').length,
        minutes: completed.reduce((t, s) => t + s.minutesCredited, 0),
        byMethod,
        cashIn: sum(shift.movements.filter((m) => m.type === 'IN')),
        cashOut: sum(shift.movements.filter((m) => m.type === 'OUT')),
        expenses: sum(shift.movements.filter((m) => m.type === 'EXPENSE')),
      },
      uncheckedReceipts: unchecked,
      barter: {
        sales: barterSales.length,
        minutes: barterSales.reduce((sum, s) => sum + s.minutesCredited, 0),
      },
    };
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
      // 0 ₸ — бартер (RC Race Lab), «День рождения»/«Тимбилдинг» — своя группа
      const category = packageCategory(name, pkg.costTenge, weekend);
      const existing = await this.prisma.catalogItem.findFirst({
        where: { venueId, name, category: { in: ['GAMES', 'BARTER', 'PACKAGES'] } },
      });
      if (existing) {
        if (
          existing.category !== category ||
          existing.priceTenge !== pkg.costTenge ||
          existing.priceWeekendTenge !== weekend ||
          existing.minutes !== pkg.minutes
        ) {
          await this.prisma.catalogItem.update({
            where: { id: existing.id },
            data: {
              category,
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
          category,
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

  /** Бартер — отдельный чек только из бартерных позиций, с комментарием «кто / по какому договору». */
  private checkBarter(lines: ResolvedLine[], comment?: string) {
    const barter = lines.filter((l) => l.category === 'BARTER');
    if (!barter.length) return false;
    if (barter.length !== lines.length) {
      throw new BadRequestException('Бартер проводится отдельным чеком');
    }
    if (!comment?.trim()) {
      throw new BadRequestException('Бартер: напишите, кто и по какому договору');
    }
    return true;
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
