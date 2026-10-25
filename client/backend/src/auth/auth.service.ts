import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service.js";
import { RegisterDto, LoginDto, RefreshDto } from "./dto/index.js";

@Injectable()
export class AuthService {
  // Also compare a valid hash for absent accounts so failed logins follow the same path.
  private readonly dummyHash = bcrypt.hash("oyna-invalid-account", 12);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const phone = this.normalizePhone(dto.phone)!;
    const nickname = dto.nickname.toLowerCase();
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone },
    });
    if (existingPhone)
      throw new ConflictException("Этот номер телефона уже зарегистрирован");
    const existingNick = await this.prisma.user.findFirst({
      where: { nickname: { equals: nickname, mode: "insensitive" } },
    });
    if (existingNick) throw new ConflictException("Этот никнейм уже занят");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          phone,
          nickname,
          passwordHash,
          name: dto.name ?? nickname,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          role: "USER",
          balance: { create: { availableSeconds: 0 } },
        },
        include: { balance: true },
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictException(
          "Номер телефона или никнейм уже зарегистрирован",
        );
      }
      throw error;
    }
    return {
      user: this.formatUser(user, user.balance?.availableSeconds ?? 0),
      ...(await this.generateTokens(user.id, user.phone, user.role)),
    };
  }

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim();
    const phone = this.normalizePhone(identifier);
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { nickname: { equals: identifier, mode: "insensitive" } },
          ...(phone ? [{ phone }] : []),
        ],
      },
      include: { balance: true },
    });
    const matches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (
      !user ||
      !user.passwordHash ||
      !matches ||
      !user.isActive ||
      user.role !== "USER"
    ) {
      throw new UnauthorizedException("Неверный логин или пароль");
    }
    return {
      user: this.formatUser(user, user.balance?.availableSeconds ?? 0),
      ...(await this.generateTokens(user.id, user.phone, user.role)),
    };
  }

  async refresh(dto: RefreshDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive || user.role !== "USER")
        throw new UnauthorizedException();
      return this.generateTokens(user.id, user.phone, user.role);
    } catch {
      throw new UnauthorizedException("Сессия истекла. Войдите ещё раз");
    }
  }

  private normalizePhone(value: string): string | null {
    if (!/^[+\d\s()-]+$/.test(value)) return null;
    let digits = value.replace(/\D/g, "");
    if (digits.length === 10) digits = `7${digits}`;
    if (digits.length === 11 && digits.startsWith("8"))
      digits = `7${digits.slice(1)}`;
    return /^7\d{10}$/.test(digits) ? `+${digits}` : null;
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
        secret: this.configService.get<string>("JWT_ACCESS_SECRET")!,
        expiresIn:
          (this.configService.get<string>("JWT_ACCESS_EXPIRES_IN") as any) ??
          "15m",
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET")!,
        expiresIn:
          (this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") as any) ??
          "7d",
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
