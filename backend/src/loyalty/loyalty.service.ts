import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MinuteKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MinuteLedgerService } from '../ledger/minute-ledger.service';
import {
  BIRTHDAY_BONUS,
  TIER_MINUTES,
  TIER_ORDER,
  almatyParts,
  applyMonthlyDrop,
  guestLimit,
  inBirthdayWindow,
  promoteImmediately,
  tierFromMinutes,
  type LoyaltyTier,
} from '../domain/rules';

@Injectable()
export class LoyaltyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LoyaltyService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private ledger: MinuteLedgerService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.maybeMonthlyDrop().catch((err) => this.logger.warn(`monthly drop: ${err}`));
    }, 6 * 60 * 60 * 1000);
    this.timer.unref?.();
    void this.maybeMonthlyDrop().catch((err) => this.logger.warn(`monthly drop: ${err}`));
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** On the 1st of the month in Almaty, drop each player at most one status step. */
  private async maybeMonthlyDrop() {
    const parts = almatyParts(new Date());
    if (parts.day !== 1 || parts.hour < 4) return;
    const key = `loyalty-drop-${parts.year}-${parts.month}`;
    try {
      await this.prisma.appSetting.create({ data: { key, value: 'started' } });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') return;
      throw err;
    }
    try {
      const result = await this.monthlyDrop();
      await this.prisma.appSetting.update({ where: { key }, data: { value: JSON.stringify(result) } });
    } catch (err) {
      await this.prisma.appSetting.delete({ where: { key } }).catch(() => undefined);
      throw err;
    }
  }

  async onSessionDebit(input: {
    userId: string;
    sessionId: string;
    paidSeconds: number;
    bonusSeconds: number;
    manualSeconds: number;
    at?: Date;
  }) {
    const at = input.at ?? new Date();
    const played = input.paidSeconds + input.bonusSeconds + input.manualSeconds;
    if (played <= 0) return;
    try {
      await this.prisma.statusPlay.create({
        data: {
          userId: input.userId,
          sessionId: input.sessionId,
          minutes: 10,
          playedAt: at,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
    await this.refreshStatus(input.userId, at);
    await this.recordVisit(input.userId, at);
    if (input.paidSeconds > 0) await this.addReferralProgress(input.userId, input.paidSeconds);
  }

  async onLevelTen(userIds: string[], modeId: string) {
    for (const userId of userIds) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'USER') continue;
      try {
        await this.ledger.credit({
          userId,
          seconds: 600,
          kind: MinuteKind.REWARD,
          source: 'lvl10',
          reason: `10-й уровень ${modeId}`,
          idempotencyKey: `lvl10:${userId}:${modeId}`,
          tier: user.loyaltyStatus as LoyaltyTier,
        });
      } catch (err) {
        this.logger.warn(`lvl10 ${userId}: ${err}`);
      }
    }
  }

  async birthdayBonus(userId: string, bookingId: string, at = new Date()) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.birthDate) return { granted: false, reason: 'Нет даты рождения' };
    if (!inBirthdayWindow(user.birthDate, at)) {
      return { granted: false, reason: 'День рождения вне окна ±6 дней' };
    }
    const year = almatyParts(at).year;
    const minutes = BIRTHDAY_BONUS[user.loyaltyStatus as LoyaltyTier] ?? 10;
    await this.ledger.credit({
      userId,
      seconds: minutes * 60,
      kind: MinuteKind.BONUS,
      source: 'birthday',
      reason: `Бонус дня рождения ${year}`,
      idempotencyKey: `birthday:${userId}:${year}`,
      tier: user.loyaltyStatus as LoyaltyTier,
    });
    return { granted: true, minutes, bookingId };
  }

  async statusGuest(hostId: string) {
    const host = await this.prisma.user.findUnique({ where: { id: hostId } });
    if (!host) return { ok: false, reason: 'Игрок не найден' };
    const limit = guestLimit(host.loyaltyStatus as LoyaltyTier);
    if (limit === 0) return { ok: false, reason: 'Бесплатный гость доступен с Gold' };
    if (limit === 'per-visit') return { ok: true, limit: 'per-visit' };
    const parts = almatyParts(new Date());
    const key = `status_guest:${hostId}:${parts.year}-${parts.month}`;
    const used = await this.prisma.minuteEntry.count({
      where: { reason: { startsWith: key } },
    });
    if (used >= limit) return { ok: false, reason: `Лимит гостей в этом месяце: ${limit}` };
    await this.prisma.minuteEntry.create({
      data: {
        id: randomUUID(),
        userId: hostId,
        type: 'CREDIT',
        seconds: 0,
        reason: `${key}:${used + 1}`,
      },
    });
    return { ok: true, used: used + 1, limit };
  }

  progress(userId: string) {
    return this.progressView(userId, new Date());
  }

  private async refreshStatus(userId: string, at: Date) {
    const since = new Date(at.getTime() - 90 * 24 * 3600000);
    const sum = await this.prisma.statusPlay.aggregate({
      where: { userId, playedAt: { gte: since } },
      _sum: { minutes: true },
    });
    const minutes = sum._sum.minutes ?? 0;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const earned = tierFromMinutes(minutes, user.legendInvite);
    const next = promoteImmediately(user.loyaltyStatus as LoyaltyTier, earned);
    if (next !== user.loyaltyStatus) {
      await this.prisma.user.update({ where: { id: userId }, data: { loyaltyStatus: next } });
    }
  }

  private async recordVisit(userId: string, at: Date) {
    const p = almatyParts(at);
    const day = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    try {
      await this.prisma.visitDay.create({ data: { userId, day } });
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
    const from = new Date(at.getTime() - 60 * 24 * 3600000);
    const days = await this.prisma.visitDay.findMany({
      where: { userId, createdAt: { gte: from } },
      orderBy: { day: 'asc' },
    });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const cards = await this.prisma.minuteGrant.count({
      where: { userId, source: 'visits8' },
    });
    if (days.length >= 8 * (cards + 1)) {
      await this.ledger.credit({
        userId,
        seconds: 3600,
        kind: MinuteKind.REWARD,
        source: 'visits8',
        reason: '8 визитов',
        idempotencyKey: `visits8:${userId}:${cards + 1}`,
        tier: user.loyaltyStatus as LoyaltyTier,
      });
    }
    await this.maybeStreak(userId, days.map((d) => d.day), user.loyaltyStatus as LoyaltyTier, at);
  }

  private async maybeStreak(userId: string, days: string[], tier: LoyaltyTier, at: Date) {
    const set = new Set(days);
    const p = almatyParts(at);
    let streak = 0;
    for (let i = 0; i < 5; i++) {
      const date = new Date(Date.UTC(p.year, p.month - 1, p.day) - i * 86400000);
      const key = date.toISOString().slice(0, 10);
      if (!set.has(key)) break;
      streak++;
    }
    if (streak < 5) return;
    const recent = await this.prisma.minuteGrant.findFirst({
      where: { userId, source: 'streak5', createdAt: { gte: new Date(at.getTime() - 30 * 86400000) } },
    });
    if (recent) return;
    const stamp = `${p.year}-${String(p.month).padStart(2, '0')}`;
    await this.ledger.credit({
      userId,
      seconds: 1200,
      kind: MinuteKind.REWARD,
      source: 'streak5',
      reason: 'Серия 5 дней',
      idempotencyKey: `streak5:${userId}:${stamp}`,
      tier,
    });
  }

  private async addReferralProgress(inviteeId: string, paidSeconds: number) {
    const invitee = await this.prisma.user.findUnique({ where: { id: inviteeId } });
    if (!invitee?.referredById || invitee.referredById === invitee.id) return;
    const key = `referral_paid:${inviteeId}`;
    const existing = await this.prisma.appSetting.findUnique({ where: { key } });
    const total = (existing ? parseInt(existing.value, 10) : 0) + paidSeconds;
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value: String(total) },
      update: { value: String(total) },
    });
    if (total < 1200) return;
    const monthKey = almatyMonthKey(new Date());
    const rewarded = await this.prisma.minuteGrant.count({
      where: {
        userId: invitee.referredById,
        source: 'referral',
        createdAt: { gte: monthStart() },
      },
    });
    if (rewarded >= 5) return;
    const inviter = await this.prisma.user.findUnique({ where: { id: invitee.referredById } });
    if (!inviter) return;
    await this.ledger.credit({
      userId: inviter.id,
      seconds: 1200,
      kind: MinuteKind.REWARD,
      source: 'referral',
      reason: `Друг ${invitee.nickname} сыграл 20 оплаченных минут`,
      idempotencyKey: `referral:${inviteeId}:inviter`,
      tier: inviter.loyaltyStatus as LoyaltyTier,
    });
    await this.ledger.credit({
      userId: invitee.id,
      seconds: 1200,
      kind: MinuteKind.REWARD,
      source: 'referral',
      reason: 'Бонус за первое оплаченное время по приглашению',
      idempotencyKey: `referral:${inviteeId}:invitee`,
      tier: invitee.loyaltyStatus as LoyaltyTier,
    });
    void monthKey;
  }

  private async progressView(userId: string, at: Date) {
    const since = new Date(at.getTime() - 90 * 24 * 3600000);
    const sum = await this.prisma.statusPlay.aggregate({
      where: { userId, playedAt: { gte: since } },
      _sum: { minutes: true },
    });
    const minutes = sum._sum.minutes ?? 0;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const tier = (user?.loyaltyStatus ?? 'BRONZE') as LoyaltyTier;
    const idx = TIER_ORDER.indexOf(tier);
    const next = TIER_ORDER[Math.min(TIER_ORDER.length - 1, idx + 1)];
    const goal = TIER_MINUTES[next];
    const visits = await this.prisma.visitDay.count({
      where: { userId, createdAt: { gte: new Date(at.getTime() - 60 * 86400000) } },
    });
    return {
      tier,
      minutes90: minutes,
      nextTier: next,
      minutesToNext: Math.max(0, goal - minutes),
      visitsIn60: visits % 8,
      visitsGoal: 8,
    };
  }

  async monthlyDrop() {
    const users = await this.prisma.user.findMany({
      where: { role: 'USER', deletedAt: null },
      select: { id: true, loyaltyStatus: true, legendInvite: true },
    });
    const since = new Date(Date.now() - 90 * 24 * 3600000);
    let changed = 0;
    for (const user of users) {
      const sum = await this.prisma.statusPlay.aggregate({
        where: { userId: user.id, playedAt: { gte: since } },
        _sum: { minutes: true },
      });
      const earned = tierFromMinutes(sum._sum.minutes ?? 0, user.legendInvite);
      const next = applyMonthlyDrop(user.loyaltyStatus as LoyaltyTier, earned);
      if (next !== user.loyaltyStatus) {
        await this.prisma.user.update({ where: { id: user.id }, data: { loyaltyStatus: next } });
        changed++;
      }
    }
    return { changed };
  }
}

function monthStart() {
  const p = almatyParts(new Date());
  return new Date(Date.UTC(p.year, p.month - 1, 1) - 5 * 3600000);
}

function almatyMonthKey(now: Date) {
  const p = almatyParts(now);
  return `${p.year}-${p.month}`;
}
