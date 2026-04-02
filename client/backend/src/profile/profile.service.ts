import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { balance: true },
    });

    if (!user) throw new NotFoundException('Пользователь не найден');

    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      name: user.name,
      birthDate: user.birthDate,
      role: user.role,
      loyaltyStatus: user.loyaltyStatus,
      totalScore: user.totalScore,
      balanceSeconds: user.balance?.availableSeconds ?? 0,
      createdAt: user.createdAt,
    };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    if (dto.nickname) {
      const existing = await this.prisma.user.findFirst({
        where: { nickname: dto.nickname, NOT: { id: userId } },
      });
      if (existing) throw new ConflictException('Этот никнейм уже занят');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.nickname && { nickname: dto.nickname }),
        ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
      },
      include: { balance: true },
    });

    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      name: user.name,
      birthDate: user.birthDate,
      role: user.role,
      loyaltyStatus: user.loyaltyStatus,
      totalScore: user.totalScore,
      balanceSeconds: user.balance?.availableSeconds ?? 0,
      createdAt: user.createdAt,
    };
  }
}
