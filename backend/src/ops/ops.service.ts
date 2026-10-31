import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { BookingStatus, MinuteKind, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MinuteLedgerService } from '../ledger/minute-ledger.service';
import {
  addDays,
  almatyDate,
  almatyParts,
  birthdayAmount,
  planRatePercent,
  splitByShifts,
  teambuildingAmount,
  type LoyaltyTier,
} from '../domain/rules';
import { LoyaltyService } from '../loyalty/loyalty.service';

@Injectable()
export class OpsService {
  constructor(
    private prisma: PrismaService,
    private ledger: MinuteLedgerService,
    private loyalty: LoyaltyService,
  ) {}

  sources() {
    return this.prisma.clientSource.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  }

  async createBooking(input: {
    venueId: string;
    type: 'BIRTHDAY' | 'TEAMBUILDING';
    startsAt: string;
    contactName: string;
    contactPhone: string;
    packageName: string;
    packageMinutes: number;
    packagePrice: number;
    people: number;
    pricePerPerson?: number;
    prepayTenge?: number;
    broughtById?: string;
    sourceCode: string;
    comment?: string;
    actorId: string;
  }) {
    if (!input.sourceCode) throw new BadRequestException('Укажите, откуда узнали');
    if (input.type === 'BIRTHDAY' && input.people < 6) throw new BadRequestException('День рождения — от 6 человек');
    if (input.type === 'TEAMBUILDING' && (input.people < 6 || input.people > 20)) {
      throw new BadRequestException('Тимбилдинг — от 6 до 20 человек');
    }
    const amount =
      input.type === 'BIRTHDAY'
        ? birthdayAmount(input.packagePrice, input.people)
        : teambuildingAmount(input.pricePerPerson ?? input.packagePrice, input.people);
    const starts = parseAlmatyInput(input.startsAt);
    const near = await this.prisma.booking.findFirst({
      where: {
        venueId: input.venueId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startsAt: { gte: new Date(starts.getTime() - 2 * 3600000), lte: new Date(starts.getTime() + 2 * 3600000) },
      },
    });
    const booking = await this.prisma.booking.create({
      data: {
        venueId: input.venueId,
        type: input.type,
        startsAt: starts,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        packageName: input.packageName,
        packageMinutes: input.packageMinutes,
        priceLocked: input.type === 'BIRTHDAY' ? input.packagePrice : input.pricePerPerson ?? input.packagePrice,
        people: input.people,
        amountTenge: amount,
        prepayTenge: input.prepayTenge ?? 0,
        broughtById: input.broughtById || input.actorId,
        sourceCode: input.sourceCode,
        comment: input.comment,
        createdById: input.actorId,
        status: (input.prepayTenge ?? 0) > 0 ? 'CONFIRMED' : 'NEW',
      },
    });
    return { booking, overlapWarning: near ? `Рядом уже есть бронь ${near.contactName}` : null };
  }

  async listBookings(venueId: string | undefined, from?: string, to?: string) {
    return this.prisma.booking.findMany({
      where: {
        ...(venueId ? { venueId } : {}),
        ...(from || to
          ? { startsAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      include: { participants: true },
      orderBy: { startsAt: 'asc' },
    });
  }

  upcoming(venueId?: string) {
    const now = new Date();
    const until = new Date(now.getTime() + 36 * 3600000);
    return this.prisma.booking.findMany({
      where: {
        ...(venueId ? { venueId } : {}),
        startsAt: { gte: new Date(now.getTime() - 12 * 3600000), lte: until },
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async setBookingStatus(id: string, status: BookingStatus, actorRole: Role, reason?: string) {
    if ((status === 'CANCELLED' || status === 'NO_SHOW') && actorRole !== Role.ADMIN) {
      throw new ForbiddenException('Отменить бронь может только владелец');
    }
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Бронь не найдена');
    return this.prisma.booking.update({
      where: { id },
      data: {
        status,
        comment: reason ? `${booking.comment ?? ''} | ${reason}` : booking.comment,
      },
    });
  }

  async resizeBooking(id: string, people: number, actorRole: Role) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Бронь не найдена');
    const amount =
      booking.type === 'BIRTHDAY'
        ? birthdayAmount(booking.priceLocked, people)
        : teambuildingAmount(booking.priceLocked, people);
    if (amount < booking.prepayTenge && actorRole !== Role.ADMIN) {
      throw new BadRequestException('Сумма не может стать меньше предоплаты');
    }
    return this.prisma.booking.update({
      where: { id },
      data: { people, amountTenge: amount },
    });
  }

  async addParticipant(bookingId: string, input: { userId?: string; isGuest?: boolean; role?: 'BIRTHDAY_PERSON' | 'ORGANIZER' | 'PLAYER'; displayName?: string }) {
    if (input.isGuest && (input.role === 'BIRTHDAY_PERSON' || input.role === 'ORGANIZER')) {
      throw new BadRequestException('Именинник и организатор должны быть с аккаунтом');
    }
    return this.prisma.bookingParticipant.create({
      data: {
        bookingId,
        userId: input.userId,
        isGuest: !!input.isGuest,
        role: input.role ?? 'PLAYER',
        displayName: input.displayName,
      },
    });
  }

  async creditBooking(bookingId: string, actorId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { participants: true },
    });
    if (!booking) throw new NotFoundException('Бронь не найдена');
    const seconds = booking.packageMinutes * 60;
    if (seconds % 600 !== 0) throw new BadRequestException('Пакет должен быть кратен 10 минутам');
    const credited: string[] = [];
    for (const person of booking.participants) {
      if (!person.userId || person.isGuest || person.creditedAt) continue;
      const user = await this.prisma.user.findUnique({ where: { id: person.userId } });
      if (!user) continue;
      await this.ledger.credit({
        userId: person.userId,
        seconds,
        kind: MinuteKind.PAID,
        source: 'booking',
        reason: `Пакет брони ${booking.packageName}`,
        idempotencyKey: `booking:${booking.id}:${person.userId}`,
        createdById: actorId,
        tier: user.loyaltyStatus as LoyaltyTier,
      });
      if (person.role === 'BIRTHDAY_PERSON') {
        await this.loyalty.birthdayBonus(person.userId, booking.id, booking.startsAt);
      }
      if (person.role === 'ORGANIZER') {
        await this.ledger.credit({
          userId: person.userId,
          seconds: 1200,
          kind: MinuteKind.BONUS,
          source: 'organizer',
          reason: 'Бонус организатора тимбилдинга',
          idempotencyKey: `organizer:${booking.id}`,
          tier: user.loyaltyStatus as LoyaltyTier,
        });
      }
      await this.prisma.bookingParticipant.update({
        where: { id: person.id },
        data: { creditedAt: new Date() },
      });
      credited.push(person.userId);
    }
    return { credited };
  }

  async addExpense(input: {
    venueId: string;
    occurredOn: string;
    amountTenge: number;
    category: string;
    article: string;
    comment?: string;
    payMethod: 'CASH_REGISTER' | 'BANK' | 'OWNER_CARD';
    actorId: string;
  }) {
    return this.prisma.expense.create({
      data: {
        venueId: input.venueId,
        occurredOn: new Date(input.occurredOn),
        amountTenge: input.amountTenge,
        category: input.category,
        article: input.article,
        comment: input.comment,
        payMethod: input.payMethod,
        createdById: input.actorId,
      },
    });
  }

  listExpenses(venueId?: string, from?: string, to?: string) {
    return this.prisma.expense.findMany({
      where: {
        cancelledAt: null,
        ...(venueId ? { venueId } : {}),
        ...(from || to
          ? { occurredOn: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      orderBy: { occurredOn: 'desc' },
    });
  }

  async pnl(venueId: string, year: number) {
    const sales = await this.prisma.sale.findMany({
      where: { venueId, status: 'COMPLETED', createdAt: { gte: new Date(Date.UTC(year, 0, 1) - 5 * 3600000), lt: new Date(Date.UTC(year + 1, 0, 1) - 5 * 3600000) } },
    });
    const expenses = await this.prisma.expense.findMany({
      where: { venueId, cancelledAt: null, occurredOn: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
    });
    const months: {
      month: number;
      revenue: number;
      expenses: number;
      profit: number;
      margin: number;
      running: number;
    }[] = [];
    let running = 0;
    for (let m = 1; m <= 12; m++) {
      const revenue = sales
        .filter((s) => almatyParts(s.createdAt).month === m && almatyParts(s.createdAt).year === year)
        .reduce((sum, s) => sum + s.totalTenge, 0);
      const spent = expenses
        .filter((e) => almatyParts(e.occurredOn).month === m)
        .reduce((sum, e) => sum + e.amountTenge, 0);
      const profit = revenue - spent;
      running += profit;
      months.push({
        month: m,
        revenue,
        expenses: spent,
        profit,
        margin: revenue ? Math.round((profit / revenue) * 100) : 0,
        running,
      });
    }
    return { year, months };
  }

  async roomRevenue(venueId: string, from: string, to: string) {
    const start = new Date(from);
    const end = new Date(to);
    const sales = await this.prisma.sale.aggregate({
      where: { venueId, status: 'COMPLETED', createdAt: { gte: start, lte: end }, minutesCredited: { gt: 0 } },
      _sum: { totalTenge: true, minutesCredited: true },
    });
    const other = await this.prisma.sale.aggregate({
      where: { venueId, status: 'COMPLETED', createdAt: { gte: start, lte: end }, minutesCredited: 0 },
      _sum: { totalTenge: true },
    });
    const sessions = await this.prisma.gameSession.findMany({
      where: { venueId, startTime: { gte: start, lte: end }, deductedSeconds: { gt: 0 }, isTournament: false },
      include: { room: { select: { name: true, engineRoomId: true } } },
    });
    const played = new Map<string, { name: string; minutes: number; sessions: number }>();
    for (const session of sessions) {
      const key = session.roomId;
      const row = played.get(key) ?? { name: session.room.name, minutes: 0, sessions: 0 };
      row.minutes += Math.round(session.deductedSeconds / 60);
      row.sessions += 1;
      played.set(key, row);
    }
    const totalMinutes = [...played.values()].reduce((s, r) => s + r.minutes, 0);
    const minuteRevenue = sales._sum.totalTenge ?? 0;
    const rooms = [...played.entries()].map(([id, row]) => ({
      roomId: id,
      name: row.name,
      minutes: row.minutes,
      sessions: row.sessions,
      revenue: totalMinutes ? Math.round((minuteRevenue * row.minutes) / totalMinutes) : 0,
      share: totalMinutes ? Math.round((row.minutes / totalMinutes) * 100) : 0,
    }));
    return {
      rooms,
      nonGameRevenue: other._sum.totalTenge ?? 0,
      minuteRevenue,
    };
  }

  async issueCertificate(input: { venueId: string; title: string; minutes: number; priceTenge: number; actorId: string; saleId?: string }) {
    if (input.minutes % 10 !== 0) throw new BadRequestException('Номинал кратен 10 минутам');
    const code = randomBytes(4).toString('hex').toUpperCase();
    return this.prisma.giftCertificate.create({
      data: {
        venueId: input.venueId,
        code,
        title: input.title,
        minutes: input.minutes,
        priceTenge: input.priceTenge,
        saleId: input.saleId,
        activateBy: addDays(new Date(), 90),
        createdById: input.actorId,
      },
    });
  }

  async activateCertificate(code: string, userId: string, actorId: string) {
    const cert = await this.prisma.giftCertificate.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!cert) throw new NotFoundException('Сертификат не найден');
    if (cert.status === 'ACTIVATED') throw new BadRequestException('Сертификат уже активирован');
    if (cert.activateBy.getTime() < Date.now() || cert.status === 'EXPIRED') {
      await this.prisma.giftCertificate.update({ where: { id: cert.id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('Срок активации истёк');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Игрок не найден');
    await this.ledger.credit({
      userId,
      seconds: cert.minutes * 60,
      kind: MinuteKind.PAID,
      source: 'certificate',
      reason: `Сертификат ${cert.code}`,
      idempotencyKey: `certificate:${cert.id}`,
      createdById: actorId,
      tier: user.loyaltyStatus as LoyaltyTier,
    });
    return this.prisma.giftCertificate.update({
      where: { id: cert.id },
      data: { status: 'ACTIVATED', activatedAt: new Date(), activatedFor: userId },
    });
  }

  async schedule(input: { venueId: string; userId: string; startsAt: string; endsAt: string; actorId: string }) {
    return this.prisma.staffSchedule.create({
      data: {
        venueId: input.venueId,
        userId: input.userId,
        startsAt: parseAlmatyInput(input.startsAt),
        endsAt: parseAlmatyInput(input.endsAt),
      },
    });
  }

  mySchedule(userId: string) {
    return this.prisma.staffSchedule.findMany({
      where: { userId, startsAt: { gte: new Date(Date.now() - 2 * 86400000) } },
      orderBy: { startsAt: 'asc' },
    });
  }

  async attendance(venueId: string, from: string, to: string) {
    const rows = await this.prisma.staffSchedule.findMany({
      where: { venueId, startsAt: { gte: new Date(from), lte: new Date(to) } },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((row) => {
      const late = row.arrivedAt ? row.arrivedAt.getTime() - row.startsAt.getTime() > 10 * 60 * 1000 : !row.arrivedAt && row.endsAt.getTime() < Date.now();
      return { ...row, late, missed: !row.arrivedAt && row.endsAt.getTime() < Date.now() };
    });
  }

  async requestPhoneChange(input: { userId: string; newPhone: string; reason: string; actorId: string }) {
    const taken = await this.prisma.user.findUnique({ where: { phone: input.newPhone } });
    if (taken) throw new BadRequestException('Номер уже есть в базе — это объединение, его делает владелец');
    return this.prisma.phoneChangeRequest.create({
      data: {
        userId: input.userId,
        newPhone: input.newPhone,
        reason: input.reason,
        requestedBy: input.actorId,
      },
    });
  }

  async approvePhoneChange(id: string, actorId: string) {
    const req = await this.prisma.phoneChangeRequest.findUnique({ where: { id } });
    if (!req || req.status !== 'PENDING') throw new BadRequestException('Заявка не найдена');
    const user = await this.prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new NotFoundException('Игрок не найден');
    const phoneHash = createHash('sha256').update(user.phone).digest('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { phone: req.newPhone, phoneHash },
    });
    return this.prisma.phoneChangeRequest.update({
      where: { id },
      data: { status: 'APPROVED', decidedBy: actorId, decidedAt: new Date() },
    });
  }

  async blockUser(input: { userId: string; reason: string; until?: string; permanent?: boolean; actorId: string }) {
    return this.prisma.user.update({
      where: { id: input.userId },
      data: {
        blockReason: input.reason,
        blockPermanent: !!input.permanent,
        blockedUntil: input.permanent ? null : input.until ? new Date(input.until) : null,
        blockStartedAt: new Date(),
      },
    });
  }

  async unblockUser(userId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Игрок не найден');
    if (user.blockStartedAt) {
      const frozen = Date.now() - user.blockStartedAt.getTime();
      const grants = await this.prisma.minuteGrant.findMany({
        where: { userId, remainingSeconds: { gt: 0 }, expiresAt: { not: null } },
      });
      for (const grant of grants) {
        if (!grant.expiresAt) continue;
        await this.prisma.minuteGrant.update({
          where: { id: grant.id },
          data: { expiresAt: new Date(grant.expiresAt.getTime() + frozen) },
        });
      }
    }
    await this.prisma.auditLog.create({
      data: { actorId, action: 'unblock', entity: 'user', entityId: userId },
    });
    return this.prisma.user.update({
      where: { id: userId },
      data: { blockPermanent: false, blockedUntil: null, blockStartedAt: null, blockReason: null, isActive: true },
    });
  }

  async deletePlayer(userId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Игрок не найден');
    const phoneHash = createHash('sha256').update(user.phone).digest('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Удалённый игрок',
        nickname: `deleted_${user.id.slice(0, 8)}`,
        phone: `del_${phoneHash.slice(0, 16)}`,
        phoneHash,
        birthDate: null,
        instagram: null,
        deletedAt: new Date(),
        isActive: false,
      },
    });
    await this.prisma.minuteGrant.updateMany({
      where: { userId, remainingSeconds: { gt: 0 } },
      data: { remainingSeconds: 0 },
    });
    await this.ledger.prepareBalance(userId);
    await this.prisma.auditLog.create({
      data: { actorId, action: 'delete_player', entity: 'user', entityId: userId, detail: 'personal data removed' },
    });
    return { ok: true };
  }

  async savePlan(input: {
    venueId: string;
    year: number;
    month: number;
    planTenge: number;
    overplanTenge: number;
    rateBelow: number;
    rateAt: number;
    rateOver: number;
    bookingRate?: number;
  }) {
    return this.prisma.monthlyPlan.upsert({
      where: { venueId_year_month: { venueId: input.venueId, year: input.year, month: input.month } },
      create: input,
      update: input,
    });
  }

  async percents(venueId: string, year: number, month: number) {
    const plan = await this.prisma.monthlyPlan.findUnique({
      where: { venueId_year_month: { venueId, year, month } },
    });
    if (!plan) throw new NotFoundException('План месяца не задан');
    const from = new Date(Date.UTC(year, month - 1, 1) - 5 * 3600000);
    const to = new Date(Date.UTC(year, month, 1) - 5 * 3600000);
    const revenue = (await this.prisma.sale.aggregate({
      where: { venueId, status: 'COMPLETED', createdAt: { gte: from, lt: to } },
      _sum: { totalTenge: true },
    }))._sum.totalTenge ?? 0;
    const rate = planRatePercent(revenue, {
      plan: plan.planTenge,
      overplan: plan.overplanTenge,
      below: plan.rateBelow,
      at: plan.rateAt,
      over: plan.rateOver,
    });
    const fund = Math.round((revenue * rate) / 100);
    const shifts = await this.prisma.staffSchedule.findMany({
      where: { venueId, arrivedAt: { not: null }, startsAt: { gte: from, lt: to } },
    });
    const byUser = new Map<string, number>();
    for (const row of shifts) byUser.set(row.userId, (byUser.get(row.userId) ?? 0) + 1);
    const ids = [...byUser.keys()];
    const shares = splitByShifts(fund, ids.map((id) => byUser.get(id) ?? 0));
    const bookings = await this.prisma.booking.findMany({
      where: { venueId, status: 'COMPLETED', startsAt: { gte: from, lt: to } },
    });
    const bookingPay = new Map<string, number>();
    for (const booking of bookings) {
      bookingPay.set(booking.broughtById, (bookingPay.get(booking.broughtById) ?? 0) + Math.round((booking.amountTenge * plan.bookingRate) / 100));
    }
    return {
      revenue,
      rate,
      fund,
      plan: plan.planTenge,
      staff: ids.map((id, index) => ({
        userId: id,
        shifts: byUser.get(id),
        revenueShare: shares[index],
        bookings: bookingPay.get(id) ?? 0,
        total: shares[index] + (bookingPay.get(id) ?? 0),
      })),
    };
  }

  async live(venueId?: string) {
    const rooms = await this.prisma.room.findMany({
      where: venueId ? { venueId } : {},
      include: {
        sessions: {
          where: { status: 'ACTIVE' },
          include: { mode: true, players: { include: { user: { select: { nickname: true } } } } },
          take: 1,
          orderBy: { startTime: 'desc' },
        },
      },
    });
    const now = Date.now();
    return rooms.map((room) => {
      const session = room.sessions[0];
      const offline = !room.lastHeartbeatAt || now - room.lastHeartbeatAt.getTime() > 60_000;
      return {
        roomId: room.id,
        name: room.name,
        offline,
        busy: !!session,
        mode: session?.mode.name ?? null,
        since: session?.startTime ?? null,
        players: session?.players.map((p) => p.user.nickname) ?? [],
      };
    });
  }

  async sessionsJournal(filter: {
    venueId?: string;
    roomId?: string;
    from?: string;
    to?: string;
    page?: number;
    take?: number;
    actorRole?: Role;
  }) {
    const page = filter.page ?? 1;
    const take = Math.min(filter.take ?? 40, 2000);
    let createdAt: Prisma.DateTimeFilter | undefined =
      filter.from || filter.to
        ? { ...(filter.from ? { gte: new Date(filter.from) } : {}), ...(filter.to ? { lte: new Date(filter.to) } : {}) }
        : undefined;
    if (filter.actorRole && filter.actorRole !== Role.ADMIN) {
      const p = almatyParts(new Date());
      createdAt = { gte: almatyDate(p.year, p.month, p.day, 0, 0), lt: almatyDate(p.year, p.month, p.day + 1, 0, 0) };
    }
    const where: Prisma.GameSessionWhereInput = {
      ...(filter.venueId ? { venueId: filter.venueId } : {}),
      ...(filter.roomId ? { roomId: filter.roomId } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.gameSession.findMany({
        where,
        include: {
          room: { select: { name: true } },
          mode: { select: { name: true } },
          players: { include: { user: { select: { nickname: true } } } },
          scores: { select: { userId: true, score: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.gameSession.count({ where }),
    ]);
    return {
      data: rows.map((row) => ({
        id: row.id,
        start: row.startTime,
        end: row.endTime,
        room: row.room.name,
        mode: row.mode.name,
        players: row.players.map((p) => p.user.nickname),
        playerIds: row.players.map((p) => p.userId),
        paidMinutes: Math.floor(row.paidSecondsDebited / 60),
        bonusMinutes: Math.floor(row.bonusSecondsDebited / 60),
        status: row.status,
        endReason: row.endReason,
        scores: row.scores,
        compensatedAt: row.compensatedAt,
      })),
      meta: { total, page },
    };
  }

  listCertificates(venueId?: string) {
    return this.prisma.giftCertificate.findMany({
      where: venueId ? { venueId } : {},
      orderBy: { soldAt: 'desc' },
      take: 200,
    });
  }

  listSchedule(venueId: string, from?: string, to?: string) {
    return this.prisma.staffSchedule.findMany({
      where: {
        venueId,
        ...(from || to
          ? { startsAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : { startsAt: { gte: new Date(Date.now() - 2 * 86400000) } }),
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  markArrived(id: string) {
    return this.prisma.staffSchedule.update({
      where: { id },
      data: { arrivedAt: new Date() },
    });
  }

  async sourceReport() {
    const users = await this.prisma.user.groupBy({
      by: ['sourceCode'],
      where: { role: 'USER', deletedAt: null },
      _count: true,
    });
    const labels = await this.prisma.clientSource.findMany();
    const name = new Map(labels.map((row) => [row.code, row.label]));
    return users
      .map((row) => ({
        code: row.sourceCode ?? 'unknown',
        label: name.get(row.sourceCode ?? '') ?? row.sourceCode ?? 'Не указан',
        players: row._count,
      }))
      .sort((a, b) => b.players - a.players);
  }

  async heatmap(venueId: string, from: string, to: string) {
    const sessions = await this.prisma.gameSession.findMany({
      where: { venueId, createdAt: { gte: new Date(from), lt: new Date(to) } },
      select: { startTime: true, createdAt: true },
    });
    const hours = Array.from({ length: 13 }, (_, i) => 10 + i);
    const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const grid = days.map((day) => ({ day, hours: hours.map((hour) => ({ hour, count: 0 })) }));
    for (const session of sessions) {
      const at = session.startTime ?? session.createdAt;
      const local = new Date(at.getTime() + 5 * 3600000);
      const p = almatyParts(at);
      if (p.hour < 10 || p.hour > 22) continue;
      grid[local.getUTCDay()].hours[p.hour - 10].count += 1;
    }
    return { hours, grid };
  }
}

/** datetime-local from the CRM has no zone. Treat it as Asia/Almaty (UTC+5). */
function parseAlmatyInput(value: string): Date {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value);
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return new Date(`${withSeconds}+05:00`);
}
