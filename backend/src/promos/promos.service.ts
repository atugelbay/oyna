import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PromoStatus } from '@prisma/client';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';

@Injectable()
export class PromosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePromoDto) {
    return this.prisma.promo.create({
      data: {
        ...dto,
        dateStart: new Date(dto.dateStart),
        dateEnd: dto.dateEnd ? new Date(dto.dateEnd) : undefined,
      },
      include: { venue: true },
    });
  }

  async findAll(query: { venueId?: string; status?: string }) {
    /** Акции без venueId считаются общими для всех площадок */
    const where: {
      status?: PromoStatus;
      OR?: ({ venueId: string } | { venueId: null })[];
    } = {};
    if (query.venueId) {
      where.OR = [{ venueId: query.venueId }, { venueId: null }];
    }
    if (query.status && Object.values(PromoStatus).includes(query.status as PromoStatus)) {
      where.status = query.status as PromoStatus;
    }

    return this.prisma.promo.findMany({
      where,
      include: { venue: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const promo = await this.prisma.promo.findUnique({
      where: { id },
      include: { venue: true },
    });
    if (!promo) throw new NotFoundException('Promo not found');
    return promo;
  }

  async update(id: string, dto: UpdatePromoDto) {
    await this.findOne(id);
    return this.prisma.promo.update({
      where: { id },
      data: {
        ...dto,
        dateStart: dto.dateStart ? new Date(dto.dateStart) : undefined,
        dateEnd: dto.dateEnd !== undefined
          ? dto.dateEnd
            ? new Date(dto.dateEnd)
            : null
          : undefined,
      },
      include: { venue: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.promo.delete({ where: { id } });
  }
}


