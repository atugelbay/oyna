import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BalanceService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string) {
    const balance = await this.prisma.accountBalance.findUnique({
      where: { userId },
    });

    if (!balance) throw new NotFoundException('Баланс не найден');

    const minutes = Math.floor(balance.availableSeconds / 60);
    const seconds = balance.availableSeconds % 60;
    let paidMinutes = minutes;
    let bonusMinutes = 0;
    let paidExpiresAt: string | null = null;
    let bonusExpiresAt: string | null = null;
    try {
      const grants = await this.prisma.$queryRaw<
        { kind: string; remainingSeconds: number; expiresAt: Date | null }[]
      >`SELECT kind::text AS kind, "remainingSeconds", "expiresAt" FROM minute_grants WHERE "userId" = ${userId} AND "remainingSeconds" > 0`;
      paidMinutes = 0;
      for (const grant of grants) {
        const mins = Math.floor(grant.remainingSeconds / 60);
        const paid = grant.kind === 'PAID' || grant.kind === 'COMPENSATION' || grant.kind === 'LEGACY_UNKNOWN';
        if (paid) {
          paidMinutes += mins;
          if (grant.expiresAt && (!paidExpiresAt || grant.expiresAt.toISOString() < paidExpiresAt)) {
            paidExpiresAt = grant.expiresAt.toISOString();
          }
        } else {
          bonusMinutes += mins;
          if (grant.expiresAt && (!bonusExpiresAt || grant.expiresAt.toISOString() < bonusExpiresAt)) {
            bonusExpiresAt = grant.expiresAt.toISOString();
          }
        }
      }
    } catch {
      paidMinutes = minutes;
    }

    return {
      availableSeconds: balance.availableSeconds,
      displayMinutes: minutes,
      displaySeconds: seconds,
      display: `${minutes}м ${seconds}с`,
      paidMinutes,
      bonusMinutes,
      paidExpiresAt,
      bonusExpiresAt,
    };
  }

  async getLedger(userId: string) {
    try {
      const rows = await this.prisma.$queryRaw<
        { id: string; type: string; seconds: number; reason: string | null; createdAt: Date; kind: string | null }[]
      >`SELECT e.id, e.type::text AS type, e.seconds, e.reason, e."createdAt", g.kind::text AS kind
        FROM minute_entries e
        LEFT JOIN minute_grants g ON g.id = e."grantId"
        WHERE e."userId" = ${userId}
        ORDER BY e."createdAt" DESC
        LIMIT 40`;
      return rows.map((row) => ({
        id: row.id,
        type: row.type,
        minutes: Math.floor(row.seconds / 60),
        reason: row.reason,
        kind: row.kind,
        at: row.createdAt,
      }));
    } catch {
      return [];
    }
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          venue: { select: { id: true, name: true, city: true } },
        },
      }),
      this.prisma.transaction.count({ where: { userId } }),
    ]);

    return {
      data: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        source: t.source,
        amountTenge: t.amountTenge,
        equivalentSeconds: t.equivalentSeconds,
        description: t.description,
        venue: t.venue,
        createdAt: t.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
