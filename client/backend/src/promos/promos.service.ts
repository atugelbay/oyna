import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const PROMO_SELECT = {
  id: true,
  title: true,
  headline: true,
  description: true,
  type: true,
  reward: true,
  quantity: true,
  dateStart: true,
  dateEnd: true,
  venue: { select: { id: true, name: true, city: true } },
} as const;

@Injectable()
export class PromosService {
  constructor(private prisma: PrismaService) {}

  async getActivePromos(venueId?: string) {
    return this.prisma.promo.findMany({
      where: {
        status: 'ACTIVE',
        ...(venueId
          ? { OR: [{ venueId }, { venueId: null }] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: PROMO_SELECT,
    });
  }

  async getPromoById(id: string) {
    const promo = await this.prisma.promo.findUnique({
      where: { id },
      select: PROMO_SELECT,
    });
    if (!promo || promo === null) throw new NotFoundException('Акция не найдена');
    return promo;
  }
}
