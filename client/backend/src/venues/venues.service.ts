import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class VenuesService {
  constructor(private prisma: PrismaService) {}

  async getVenues() {
    return this.prisma.venue.findMany({
      where: { status: { not: 'MAINTENANCE' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, city: true, address: true, status: true },
    });
  }
}
