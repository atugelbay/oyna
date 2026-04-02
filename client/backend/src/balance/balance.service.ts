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

    return {
      availableSeconds: balance.availableSeconds,
      displayMinutes: minutes,
      displaySeconds: seconds,
      display: `${minutes}м ${seconds}с`,
    };
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
