import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TopupDto } from './dto/topup.dto';
import { TransactionType, TransactionSource } from '@prisma/client';

@Injectable()
export class BalanceService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string) {
    const balance = await this.prisma.accountBalance.findUnique({
      where: { userId },
    });

    if (!balance) {
      throw new NotFoundException('Баланс не найден');
    }

    return {
      userId,
      availableSeconds: balance.availableSeconds,
      availableMinutes: Math.floor(balance.availableSeconds / 60),
    };
  }

  async topup(dto: TopupDto, operatorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const bonusSeconds = dto.bonusSeconds ?? 0;
    if (bonusSeconds > dto.seconds) {
      throw new BadRequestException('bonusSeconds не может быть больше seconds');
    }
    const purchaseSeconds = dto.seconds - bonusSeconds;
    if (bonusSeconds > 0 && purchaseSeconds < 60) {
      throw new BadRequestException(
        'При наличии бонусных секунд оплачиваемая часть должна быть не менее 60 с',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.accountBalance.upsert({
        where: { userId: dto.userId },
        update: {
          availableSeconds: { increment: dto.seconds },
        },
        create: {
          userId: dto.userId,
          availableSeconds: dto.seconds,
        },
      });

      const baseDescription =
        dto.description ||
        `Пополнение ${Math.floor(dto.seconds / 60)} мин. Оператор: ${operatorId}`;

      const purchase = await tx.transaction.create({
        data: {
          userId: dto.userId,
          type: TransactionType.PURCHASE,
          source: TransactionSource.CASHIER,
          amountTenge: dto.amountTenge,
          equivalentSeconds: purchaseSeconds,
          venueId: dto.venueId,
          description: baseDescription,
        },
      });

      if (bonusSeconds > 0) {
        await tx.transaction.create({
          data: {
            userId: dto.userId,
            type: TransactionType.BONUS,
            source: TransactionSource.CASHIER,
            amountTenge: 0,
            equivalentSeconds: bonusSeconds,
            venueId: dto.venueId,
            description: `Бонусные минуты (${Math.floor(bonusSeconds / 60)} мин). ${baseDescription}`,
          },
        });
      }

      return { balance, transaction: purchase };
    });

    return {
      userId: dto.userId,
      newBalanceSeconds: result.balance.availableSeconds,
      newBalanceMinutes: Math.floor(result.balance.availableSeconds / 60),
      transactionId: result.transaction.id,
    };
  }

  async deduct(userId: string, seconds: number, description: string) {
    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.accountBalance.findUnique({
        where: { userId },
      });

      if (!balance || balance.availableSeconds < seconds) {
        throw new Error('Недостаточно времени на балансе');
      }

      const updated = await tx.accountBalance.update({
        where: { userId },
        data: {
          availableSeconds: { decrement: seconds },
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.GAME_DEBIT,
          source: TransactionSource.CASHIER,
          amountTenge: 0,
          equivalentSeconds: -seconds,
          description,
        },
      });

      return updated;
    });
  }
}


