import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TopupDto } from './dto/topup.dto';
import { GuestSaleDto } from './dto/guest-sale.dto';
import { TransactionType, TransactionSource } from '@prisma/client';
import { MinuteLedgerService } from '../ledger/minute-ledger.service';
import type { LoyaltyTier } from '../domain/rules';

@Injectable()
export class BalanceService {
  constructor(
    private prisma: PrismaService,
    private ledger: MinuteLedgerService,
  ) {}

  async getBalance(userId: string) {
    const prepared = await this.ledger.prepareBalance(userId);
    return { userId, ...prepared };
  }

  /**
   * Гостевая оплата: выручка в transactions без User / без зачисления минут.
   * Description format matched by stats.bucketForPurchase.
   */
  async guestSale(dto: GuestSaleDto) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: dto.venueId },
    });
    if (!venue) {
      throw new NotFoundException('Площадка не найдена');
    }

    if (dto.roomId) {
      const room = await this.prisma.room.findFirst({
        where: { id: dto.roomId, venueId: dto.venueId },
      });
      if (!room) {
        throw new BadRequestException('Комната не принадлежит этой площадке');
      }
    }

    if (dto.venueId) await this.requireOpenShift(dto.venueId);
    const comment = (dto.comment?.trim() || 'Гость').slice(0, 200);
    const packagePart = dto.packageName?.trim()
      ? ` «${dto.packageName.trim().slice(0, 120)}»`
      : '';
    const description = `Гостевая оплата (guest, ${dto.paymentMethod})${packagePart} ${dto.minutes} мин. ${comment}`;

    const transaction = await this.prisma.transaction.create({
      data: {
        userId: null,
        type: TransactionType.PURCHASE,
        source: TransactionSource.CASHIER,
        amountTenge: dto.amountTenge,
        equivalentSeconds: dto.minutes * 60,
        venueId: dto.venueId,
        description,
      },
    });

    return {
      transactionId: transaction.id,
      amountTenge: transaction.amountTenge,
      minutes: dto.minutes,
      paymentMethod: dto.paymentMethod,
      description: transaction.description,
    };
  }

  async topup(dto: TopupDto, operatorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    if (user.blockPermanent || (user.blockedUntil && user.blockedUntil > new Date())) {
      throw new BadRequestException('Аккаунт заблокирован');
    }
    if (dto.venueId) await this.requireOpenShift(dto.venueId);

    const bonusSeconds = dto.bonusSeconds ?? 0;
    if (bonusSeconds > dto.seconds) {
      throw new BadRequestException('bonusSeconds не может быть больше seconds');
    }
    const purchaseSeconds = dto.seconds - bonusSeconds;
    if (purchaseSeconds % 600 !== 0 || bonusSeconds % 600 !== 0) {
      throw new BadRequestException('Минуты кратны 10. Оплаченные минуты действуют 24 часа');
    }
    if (bonusSeconds > 0 && purchaseSeconds < 60) {
      throw new BadRequestException(
        'При наличии бонусных секунд оплачиваемая часть должна быть не менее 60 с',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.accountBalance.upsert({
        where: { userId: dto.userId },
        update: {},
        create: {
          userId: dto.userId,
          availableSeconds: 0,
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

    const paidSeconds = dto.seconds - bonusSeconds;
    const credited = await this.ledger.creditTopup({
      userId: dto.userId,
      paidSeconds,
      bonusSeconds,
      tier: user.loyaltyStatus as LoyaltyTier,
      operatorId,
      transactionId: result.transaction.id,
      venueId: dto.venueId,
      description: result.transaction.description ?? 'Пополнение',
    });

    return {
      userId: dto.userId,
      newBalanceSeconds: credited.availableSeconds,
      newBalanceMinutes: Math.floor(credited.availableSeconds / 60),
      transactionId: result.transaction.id,
      paidExpiresAt: credited.paidExpiresAt,
      bonusMinutes: credited.bonusMinutes,
      notice: credited.notice,
    };
  }

  private async requireOpenShift(venueId: string) {
    const shift = await this.prisma.cashShift.findFirst({
      where: { venueId, status: 'OPEN' },
    });
    if (!shift) throw new BadRequestException('Откройте смену');
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


