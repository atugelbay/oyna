import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoyaltyStatus, MinuteEntryType, MinuteKind, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAID_TTL_MS,
  SESSION_SECONDS,
  bonusExpiresAt,
  formatAlmaty,
  planSpend,
  rewardExpiresAt,
  topupBonusMinutes,
  type LoyaltyTier,
} from '../domain/rules';

type Tx = Prisma.TransactionClient;

const PAID_KINDS: MinuteKind[] = [MinuteKind.PAID, MinuteKind.COMPENSATION, MinuteKind.LEGACY_UNKNOWN];

@Injectable()
export class MinuteLedgerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MinuteLedgerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.expireAllDue().catch((err) => this.logger.warn(`expire sweep: ${err}`));
    }, 7 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async prepareBalance(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockBalance(tx, userId);
      await this.ensureLegacy(tx, userId);
      if (!(await this.isBlocked(tx, userId))) {
        await this.expireUser(tx, userId, new Date());
      }
      const seconds = await this.syncBalance(tx, userId);
      const breakdown = await this.breakdown(tx, userId);
      return { availableSeconds: seconds, availableMinutes: Math.floor(seconds / 60), ...breakdown };
    });
  }

  async credit(input: {
    userId: string;
    seconds: number;
    kind: MinuteKind;
    source: string;
    reason: string;
    idempotencyKey?: string;
    createdById?: string;
    transactionId?: string;
    sessionId?: string;
    tier?: LoyaltyTier;
    expiresAt?: Date | null;
  }) {
    if (input.seconds <= 0 || input.seconds % SESSION_SECONDS !== 0) {
      throw new BadRequestException('Минуты начисляются кратно 10');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockBalance(tx, input.userId);
      await this.ensureLegacy(tx, input.userId);
      const grant = await this.creditTx(tx, input);
      const seconds = await this.syncBalance(tx, input.userId);
      return { grant, availableSeconds: seconds };
    });
  }

  /** Paid package plus the status bonus from the table, without going below a bonus the cashier already entered. */
  async creditTopup(input: {
    userId: string;
    paidSeconds: number;
    bonusSeconds: number;
    tier: LoyaltyTier;
    operatorId: string;
    transactionId: string;
    venueId?: string;
    description: string;
  }) {
    if (input.paidSeconds < 0 || input.paidSeconds % SESSION_SECONDS !== 0) {
      throw new BadRequestException('Оплаченные минуты кратны 10');
    }
    if (input.bonusSeconds < 0 || input.bonusSeconds % SESSION_SECONDS !== 0) {
      throw new BadRequestException('Бонусные минуты кратны 10');
    }
    const paidMinutes = input.paidSeconds / 60;
    const tableBonusMin = topupBonusMinutes(input.tier, paidMinutes);
    const askedBonusMin = input.bonusSeconds / 60;
    const bonusMinutes = Math.max(askedBonusMin, tableBonusMin);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await this.lockBalance(tx, input.userId);
      await this.ensureLegacy(tx, input.userId);
      let paidGrant: { expiresAt: Date | null } | null = null;
      if (input.paidSeconds > 0) {
        paidGrant = await this.creditTx(tx, {
          userId: input.userId,
          seconds: input.paidSeconds,
          kind: MinuteKind.PAID,
          source: 'topup',
          reason: input.description,
          idempotencyKey: `topup:${input.transactionId}`,
          createdById: input.operatorId,
          transactionId: input.transactionId,
          tier: input.tier,
          expiresAt: new Date(now.getTime() + PAID_TTL_MS),
        });
      }
      let bonusGrant: { expiresAt: Date | null } | null = null;
      if (bonusMinutes > 0) {
        bonusGrant = await this.creditTx(tx, {
          userId: input.userId,
          seconds: bonusMinutes * 60,
          kind: MinuteKind.BONUS,
          source: 'topup_bonus',
          reason: `Бонус к пополнению ${bonusMinutes} мин`,
          idempotencyKey: `topup_bonus:${input.transactionId}`,
          createdById: input.operatorId,
          transactionId: input.transactionId,
          tier: input.tier,
          expiresAt: bonusExpiresAt(input.tier, now),
        });
      }
      const availableSeconds = await this.syncBalance(tx, input.userId);
      return {
        paidGrant,
        bonusGrant,
        bonusMinutes,
        paidExpiresAt: paidGrant?.expiresAt ?? null,
        availableSeconds,
        notice: 'Оплаченные минуты действуют 24 часа',
      };
    });
  }

  async spendForSession(userId: string, sessionId: string, seconds = SESSION_SECONDS) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockBalance(tx, userId);
      if (await this.isBlocked(tx, userId)) {
        throw new BadRequestException('Аккаунт заблокирован, минуты заморожены');
      }
      await this.ensureLegacy(tx, userId);
      await this.expireUser(tx, userId, new Date());
      const lots = await tx.minuteGrant.findMany({
        where: { userId, remainingSeconds: { gt: 0 } },
      });
      const plan = planSpend(
        lots.map((l) => ({
          id: l.id,
          remainingSeconds: l.remainingSeconds,
          expiresAt: l.expiresAt,
          createdAt: l.createdAt,
          kind: l.kind,
        })),
        seconds,
      );
      const taken = plan.reduce((s, p) => s + p.seconds, 0);
      if (taken < seconds) {
        throw new BadRequestException('Недостаточно минут. Оплаченные могли сгореть — они действуют 24 часа');
      }
      let paid = 0;
      let bonus = 0;
      let manual = 0;
      for (const slice of plan) {
        await tx.minuteGrant.update({
          where: { id: slice.id },
          data: { remainingSeconds: { decrement: slice.seconds } },
        });
        await tx.minuteEntry.create({
          data: {
            id: randomUUID(),
            userId,
            grantId: slice.id,
            type: MinuteEntryType.DEBIT,
            seconds: slice.seconds,
            reason: `Старт сеанса ${sessionId}`,
            sessionId,
          },
        });
        if (slice.kind === MinuteKind.MANUAL) manual += slice.seconds;
        else if (slice.kind === MinuteKind.BONUS || slice.kind === MinuteKind.REWARD) bonus += slice.seconds;
        else paid += slice.seconds;
      }
      await this.syncBalance(tx, userId);
      return { paid, bonus, manual, taken };
    });
  }

  async compensateSession(sessionId: string, actorId: string, reason: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { players: true },
    });
    if (!session) throw new BadRequestException('Сеанс не найден');
    if (session.compensatedAt) throw new BadRequestException('Компенсация по этому сеансу уже начислена');
    const seconds = session.deductedSeconds || SESSION_SECONDS;
    if (seconds % SESSION_SECONDS !== 0) {
      throw new BadRequestException('Компенсация возможна только на кратные 10 минуты сеанса');
    }
    const now = new Date();
    const credited: string[] = [];
    for (const player of session.players) {
      await this.credit({
        userId: player.userId,
        seconds,
        kind: MinuteKind.COMPENSATION,
        source: 'compensation',
        reason: `Компенсация за сбой сеанса ${sessionId}. ${reason}`,
        idempotencyKey: `compensation:${sessionId}:${player.userId}`,
        createdById: actorId,
        sessionId,
        expiresAt: new Date(now.getTime() + PAID_TTL_MS),
      });
      credited.push(player.userId);
    }
    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: { compensatedAt: now },
    });
    return { sessionId, credited, seconds, countsForRating: true };
  }

  async launchPaidExpiry(actorId: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAID_TTL_MS);
    const legacy = await this.prisma.minuteGrant.findMany({
      where: {
        remainingSeconds: { gt: 0 },
        expiresAt: null,
        kind: { in: [MinuteKind.LEGACY_UNKNOWN, MinuteKind.PAID] },
      },
    });
    let unknownSeconds = 0;
    let paidSeconds = 0;
    for (const grant of legacy) {
      if (grant.kind === MinuteKind.LEGACY_UNKNOWN) unknownSeconds += grant.remainingSeconds;
      else paidSeconds += grant.remainingSeconds;
      await this.prisma.minuteGrant.update({
        where: { id: grant.id },
        data: { expiresAt },
      });
    }
    await this.prisma.appSetting.upsert({
      where: { key: 'paidExpiryLaunchAt' },
      create: { key: 'paidExpiryLaunchAt', value: now.toISOString() },
      update: { value: now.toISOString() },
    });
    return {
      launchAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      grants: legacy.length,
      unknownMinutes: Math.floor(unknownSeconds / 60),
      paidMinutes: Math.floor(paidSeconds / 60),
      actorId,
      note: 'Старые оплаченные и неразобранные остатки сгорят через 24 часа от запуска. Бонусные сроки не менялись.',
    };
  }

  async legacyReport() {
    const rows = await this.prisma.minuteGrant.groupBy({
      by: ['kind'],
      where: { remainingSeconds: { gt: 0 }, expiresAt: null },
      _sum: { remainingSeconds: true },
      _count: true,
    });
    const balances = await this.prisma.accountBalance.aggregate({ _sum: { availableSeconds: true } });
    return {
      openEndedByKind: rows.map((r) => ({
        kind: r.kind,
        grants: r._count,
        minutes: Math.floor((r._sum.remainingSeconds ?? 0) / 60),
      })),
      balanceMinutes: Math.floor((balances._sum.availableSeconds ?? 0) / 60),
    };
  }

  async ledger(userId: string, page = 1, limit = 30) {
    await this.prepareBalance(userId);
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.prisma.minuteEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { grant: { select: { source: true, kind: true, createdAt: true } } },
      }),
      this.prisma.minuteEntry.count({ where: { userId } }),
    ]);
    return {
      data: rows.map((row) => ({
        id: row.id,
        type: row.type,
        minutes: Math.floor(row.seconds / 60),
        reason: row.reason,
        at: row.createdAt,
        atAlmaty: formatAlmaty(row.createdAt),
        kind: row.grant?.kind ?? null,
        source: row.grant?.source ?? null,
      })),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async expireAllDue() {
    const now = new Date();
    const due = await this.prisma.minuteGrant.findMany({
      where: { remainingSeconds: { gt: 0 }, expiresAt: { lte: now } },
      select: { userId: true },
      distinct: ['userId'],
      take: 500,
    });
    for (const row of due) {
      if (await this.prisma.user.findFirst({
        where: {
          id: row.userId,
          OR: [{ blockPermanent: true }, { blockedUntil: { gt: now } }],
        },
        select: { id: true },
      })) {
        continue;
      }
      await this.prisma.$transaction(async (tx) => {
        await this.lockBalance(tx, row.userId);
        await this.expireUser(tx, row.userId, now);
        await this.syncBalance(tx, row.userId);
      });
    }
    return { users: due.length };
  }

  private async creditTx(
    tx: Tx,
    input: {
      userId: string;
      seconds: number;
      kind: MinuteKind;
      source: string;
      reason: string;
      idempotencyKey?: string;
      createdById?: string;
      transactionId?: string;
      sessionId?: string;
      tier?: LoyaltyTier;
      expiresAt?: Date | null;
    },
  ) {
    if (input.idempotencyKey) {
      const existing = await tx.minuteGrant.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }
    const tier = input.tier ?? 'BRONZE';
    const now = new Date();
    let expiresAt = input.expiresAt;
    if (expiresAt === undefined) {
      if (input.kind === MinuteKind.PAID || input.kind === MinuteKind.COMPENSATION) {
        expiresAt = new Date(now.getTime() + PAID_TTL_MS);
      } else if (input.kind === MinuteKind.REWARD) {
        expiresAt = rewardExpiresAt(tier, now);
      } else if (input.kind === MinuteKind.BONUS) {
        expiresAt = bonusExpiresAt(tier, now);
      } else {
        expiresAt = null;
      }
    }
    const grant = await tx.minuteGrant.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        kind: input.kind,
        seconds: input.seconds,
        remainingSeconds: input.seconds,
        expiresAt,
        source: input.source,
        idempotencyKey: input.idempotencyKey,
        loyaltyStatus: (input.tier as LoyaltyStatus | undefined) ?? undefined,
        transactionId: input.transactionId,
        sessionId: input.sessionId,
        createdById: input.createdById,
        reason: input.reason,
      },
    });
    await tx.minuteEntry.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        grantId: grant.id,
        type: MinuteEntryType.CREDIT,
        seconds: input.seconds,
        reason: input.reason,
        sessionId: input.sessionId,
        createdById: input.createdById,
      },
    });
    return grant;
  }

  private async ensureLegacy(tx: Tx, userId: string) {
    const count = await tx.minuteGrant.count({ where: { userId } });
    if (count > 0) return;
    const balance = await tx.accountBalance.findUnique({ where: { userId } });
    if (!balance || balance.availableSeconds <= 0) return;
    const seconds = balance.availableSeconds - (balance.availableSeconds % SESSION_SECONDS);
    if (seconds <= 0) return;
    await this.creditTx(tx, {
      userId,
      seconds,
      kind: MinuteKind.LEGACY_UNKNOWN,
      source: 'legacy',
      reason: 'Остаток до журнала минут. До запуска правила 24 часов срок не назначен.',
      idempotencyKey: `legacy:${userId}`,
      expiresAt: null,
    });
  }

  private async expireUser(tx: Tx, userId: string, now: Date) {
    const due = await tx.minuteGrant.findMany({
      where: { userId, remainingSeconds: { gt: 0 }, expiresAt: { lte: now } },
    });
    for (const grant of due) {
      await tx.minuteEntry.create({
        data: {
          id: randomUUID(),
          userId,
          grantId: grant.id,
          type: MinuteEntryType.EXPIRE,
          seconds: grant.remainingSeconds,
          reason: `Сгорели (начисление ${formatAlmaty(grant.createdAt)})`,
        },
      });
      await tx.minuteGrant.update({
        where: { id: grant.id },
        data: { remainingSeconds: 0 },
      });
    }
  }

  private async syncBalance(tx: Tx, userId: string) {
    const sum = await tx.minuteGrant.aggregate({
      where: { userId, remainingSeconds: { gt: 0 } },
      _sum: { remainingSeconds: true },
    });
    const seconds = sum._sum.remainingSeconds ?? 0;
    await tx.accountBalance.upsert({
      where: { userId },
      update: { availableSeconds: seconds },
      create: { userId, availableSeconds: seconds },
    });
    return seconds;
  }

  private async breakdown(tx: Tx, userId: string) {
    const grants = await tx.minuteGrant.findMany({
      where: { userId, remainingSeconds: { gt: 0 } },
      orderBy: { expiresAt: 'asc' },
    });
    let paidSeconds = 0;
    let bonusSeconds = 0;
    let paidExpiresAt: Date | null = null;
    let bonusExpiresAt: Date | null = null;
    for (const grant of grants) {
      if (PAID_KINDS.includes(grant.kind)) {
        paidSeconds += grant.remainingSeconds;
        if (grant.expiresAt && (!paidExpiresAt || grant.expiresAt < paidExpiresAt)) paidExpiresAt = grant.expiresAt;
      } else {
        bonusSeconds += grant.remainingSeconds;
        if (grant.expiresAt && (!bonusExpiresAt || grant.expiresAt < bonusExpiresAt)) bonusExpiresAt = grant.expiresAt;
      }
    }
    return {
      paidMinutes: Math.floor(paidSeconds / 60),
      bonusMinutes: Math.floor(bonusSeconds / 60),
      paidExpiresAt,
      bonusExpiresAt,
      paidLabel: paidExpiresAt ? `Оплаченные ${Math.floor(paidSeconds / 60)} мин · сгорят ${formatAlmaty(paidExpiresAt)}` : `Оплаченные ${Math.floor(paidSeconds / 60)} мин`,
      bonusLabel: bonusExpiresAt
        ? `Бонусные ${Math.floor(bonusSeconds / 60)} мин · до ${formatAlmaty(bonusExpiresAt)}`
        : `Бонусные ${Math.floor(bonusSeconds / 60)} мин`,
    };
  }

  private async isBlocked(tx: Tx, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { blockPermanent: true, blockedUntil: true, isActive: true },
    });
    if (!user || !user.isActive) return true;
    if (user.blockPermanent) return true;
    return !!(user.blockedUntil && user.blockedUntil > new Date());
  }

  private async lockBalance(tx: Tx, userId: string) {
    await tx.accountBalance.upsert({
      where: { userId },
      update: {},
      create: { userId, availableSeconds: 0 },
    });
    await tx.$queryRaw`SELECT id FROM account_balances WHERE "userId" = ${userId} FOR UPDATE`;
  }
}
