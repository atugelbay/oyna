import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto, RequestOtpDto, VerifyOtpDto, RefreshDto } from './dto/index.js';

const MVP_OTP_CODE = '1234';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Verify OTP before creating account
    if (dto.code !== MVP_OTP_CODE) {
      throw new UnauthorizedException('Неверный код подтверждения');
    }

    const normalizedPhone = this.normalizePhone(dto.phone);

    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });
    if (existingPhone) {
      throw new ConflictException('Этот номер телефона уже зарегистрирован');
    }

    const existingNick = await this.prisma.user.findUnique({
      where: { nickname: dto.nickname },
    });
    if (existingNick) {
      throw new ConflictException('Этот никнейм уже занят');
    }

    const user = await this.prisma.user.create({
      data: {
        phone: normalizedPhone,
        nickname: dto.nickname,
        name: dto.name ?? dto.nickname,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        role: 'USER',
        balance: {
          create: { availableSeconds: 0 },
        },
      },
      include: { balance: true },
    });

    this.logger.log(`New player registered: ${user.phone} (${user.id})`);

    const tokens = await this.generateTokens(user.id, user.phone, user.role);

    return {
      user: this.formatUser(user, user.balance?.availableSeconds ?? 0),
      ...tokens,
    };
  }

  async requestOtp(dto: RequestOtpDto) {
    const normalizedPhone = this.normalizePhone(dto.phone);

    // Check if existing user is blocked (don't block new registrations)
    const user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { isActive: true, role: true },
    });

    if (user && !user.isActive) {
      throw new UnauthorizedException('Аккаунт заблокирован');
    }
    if (user && user.role !== 'USER') {
      throw new UnauthorizedException('Этот портал предназначен только для игроков');
    }

    this.logger.log(`OTP для ${normalizedPhone}: ${MVP_OTP_CODE}`);

    return { message: 'OTP отправлен', phone: normalizedPhone };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const normalizedPhone = this.normalizePhone(dto.phone);

    if (dto.code !== MVP_OTP_CODE) {
      throw new UnauthorizedException('Неверный код подтверждения');
    }

    const user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      include: { balance: true },
    });

    // New user — OTP is valid, but profile creation is needed
    if (!user) {
      return { needsProfile: true, phone: normalizedPhone };
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Аккаунт заблокирован');
    }
    if (user.role !== 'USER') {
      throw new UnauthorizedException('Этот портал предназначен только для игроков');
    }

    const tokens = await this.generateTokens(user.id, user.phone, user.role);

    return {
      needsProfile: false,
      user: this.formatUser(user, user.balance?.availableSeconds ?? 0),
      ...tokens,
    };
  }

  async refresh(dto: RefreshDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive || user.role !== 'USER') {
        throw new UnauthorizedException();
      }

      return this.generateTokens(user.id, user.phone, user.role);
    } catch {
      throw new UnauthorizedException('Невалидный refresh token');
    }
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    const ten = digits.length >= 10 ? digits.slice(-10) : digits;
    return ten ? `+7${ten}` : phone;
  }

  private formatUser(user: any, balanceSeconds: number) {
    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      name: user.name,
      role: user.role,
      loyaltyStatus: user.loyaltyStatus,
      totalScore: user.totalScore,
      balanceSeconds,
    };
  }

  private async generateTokens(userId: string, phone: string, role: string) {
    const payload = { sub: userId, phone, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET')!,
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') as any ?? '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET')!,
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') as any ?? '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
