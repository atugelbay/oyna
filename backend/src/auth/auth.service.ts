import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, RequestOtpDto, VerifyOtpDto, RefreshDto } from './dto';
import { normalizeKzPhone } from '../common/utils/phone.util';
import * as bcrypt from 'bcrypt';

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
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      throw new ConflictException('Этот номер телефона уже зарегистрирован');
    }

    const existingNick = await this.prisma.user.findUnique({
      where: { nickname: dto.nickname },
    });
    if (existingNick) {
      throw new ConflictException('Этот ник уже занят');
    }

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        nickname: dto.nickname,
        name: dto.name,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        balance: {
          create: { availableSeconds: 0 },
        },
      },
      include: { balance: true },
    });

    const tokens = await this.generateTokens(user.id, user.phone, user.role);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        name: user.name,
        role: user.role,
        loyaltyStatus: user.loyaltyStatus,
        totalScore: user.totalScore,
        balanceSeconds: user.balance?.availableSeconds ?? 0,
      },
      ...tokens,
    };
  }

  async requestOtp(dto: RequestOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (!user) {
      throw new BadRequestException('Пользователь с таким телефоном не найден');
    }

    this.logger.log(`OTP для ${dto.phone}: ${MVP_OTP_CODE}`);

    return { message: 'OTP отправлен', phone: dto.phone };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    if (dto.code !== MVP_OTP_CODE) {
      throw new UnauthorizedException('Неверный код');
    }

    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: { balance: true },
    });

    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Аккаунт заблокирован');
    }

    const tokens = await this.generateTokens(user.id, user.phone, user.role);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        name: user.name,
        role: user.role,
        loyaltyStatus: user.loyaltyStatus,
        totalScore: user.totalScore,
        balanceSeconds: user.balance?.availableSeconds ?? 0,
      },
      ...tokens,
    };
  }

  async crmLogin(dto: { phone: string; password?: string; code?: string; isEmployee?: boolean }) {
    const phoneNorm = normalizeKzPhone(dto.phone);
    const user = await this.prisma.user.findUnique({
      where: { phone: phoneNorm },
      include: { balance: true },
    });

    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Аккаунт заблокирован');
    }

    const allowedRoles = ['ADMIN', 'MANAGER', 'OPERATOR'];
    if (!allowedRoles.includes(user.role)) {
      throw new UnauthorizedException('Нет доступа к CRM');
    }

    if (dto.isEmployee && dto.code) {
      const accessCode = await this.prisma.venueAccessCode.findFirst({
        where: { role: user.role as any, code: dto.code },
      });
      if (!accessCode) {
        throw new UnauthorizedException('Неверный код доступа');
      }
    } else if (dto.password) {
      if (!user.passwordHash) {
        throw new UnauthorizedException('Пароль не установлен');
      }
      const isValid = await bcrypt.compare(dto.password, user.passwordHash);
      if (!isValid) {
        throw new UnauthorizedException('Неверный пароль');
      }
    } else {
      throw new BadRequestException('Необходим пароль или код доступа');
    }

    const tokens = await this.generateTokens(user.id, user.phone, user.role);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        name: user.name,
        role: user.role,
        loyaltyStatus: user.loyaltyStatus,
        totalScore: user.totalScore,
        balanceSeconds: user.balance?.availableSeconds ?? 0,
      },
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

      if (!user || !user.isActive) {
        throw new UnauthorizedException();
      }

      return this.generateTokens(user.id, user.phone, user.role);
    } catch {
      throw new UnauthorizedException('Невалидный refresh token');
    }
  }

  private async generateTokens(userId: string, phone: string, role: string) {
    const payload = { sub: userId, phone, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET')!,
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN')! as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET')!,
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')! as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}


