import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
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

  async register(dto: RegisterDto, ip = "unknown") {
    await this.bumpWindow(`reg:${ip}`, 5, 60 * 60 * 1000);
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
      const code = this.referralCode();
      const phoneHash = createHash("sha256").update(phone).digest("hex");
      const reused = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM users WHERE "phoneHash" = ${phoneHash} LIMIT 1`;
      let referredById: string | null = null;
      if (dto.referralCode && reused.length === 0) {
        const inviter = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM users WHERE "referralCode" = ${dto.referralCode.trim().toUpperCase()} LIMIT 1`;
        if (inviter[0] && inviter[0].id !== user.id) referredById = inviter[0].id;
      }
      await this.prisma.$executeRaw`
        UPDATE users SET
          "referralCode" = ${code},
          "referredById" = ${referredById},
          "birthDateLocked" = ${dto.birthDate ? true : false},
          "offerAcceptedAt" = NOW(),
          "offerVersion" = '2026-10-29',
          "privacyAcceptedAt" = NOW(),
          "privacyVersion" = '2026-10-29',
          "guardianConfirmedAt" = NOW(),
          "sourceCode" = ${dto.sourceCode ?? null}
        WHERE id = ${user.id}`;
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

  async login(dto: LoginDto, ip = "unknown") {
    await this.bumpWindow(`login-ip:${ip}`, 100, 60 * 1000);
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
    const lockKey = `player:${user?.id ?? identifier.toLowerCase()}`;
    await this.assertUnlocked(lockKey);
    if (
      !user ||
      !user.passwordHash ||
      !matches ||
      !user.isActive ||
      user.role !== "USER" ||
      user.deletedAt
    ) {
      await this.recordFailure(lockKey);
      throw new UnauthorizedException("Неверный логин или пароль");
    }
    if (user.blockPermanent || (user.blockedUntil && user.blockedUntil > new Date())) {
      throw new UnauthorizedException("Аккаунт заблокирован");
    }
    await this.clearFailures(lockKey);
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

  private referralCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = randomBytes(6);
    let out = "";
    for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
  }

  private async assertUnlocked(key: string) {
    const rows = await this.prisma.$queryRaw<{ lockedUntil: Date | null }[]>`
      SELECT "lockedUntil" FROM auth_rate_limits WHERE key = ${key}`;
    const until = rows[0]?.lockedUntil;
    if (until && new Date(until).getTime() > Date.now()) {
      throw new HttpException("Вход заблокирован на 15 минут", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async recordFailure(key: string) {
    const rows = await this.prisma.$queryRaw<{ failCount: number; lockedUntil: Date | null }[]>`
      SELECT "failCount", "lockedUntil" FROM auth_rate_limits WHERE key = ${key}`;
    const current = rows[0];
    const expired = current?.lockedUntil && new Date(current.lockedUntil).getTime() <= Date.now();
    const failCount = !current || expired ? 1 : current.failCount + 1;
    const lockedUntil = failCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    if (!current) {
      await this.prisma.$executeRaw`
        INSERT INTO auth_rate_limits (key, "failCount", "windowStart", "lockedUntil", "updatedAt")
        VALUES (${key}, ${failCount}, NOW(), ${lockedUntil}, NOW())`;
    } else {
      await this.prisma.$executeRaw`
        UPDATE auth_rate_limits SET "failCount" = ${failCount}, "lockedUntil" = ${lockedUntil}, "updatedAt" = NOW()
        WHERE key = ${key}`;
    }
  }

  private async clearFailures(key: string) {
    await this.prisma.$executeRaw`DELETE FROM auth_rate_limits WHERE key = ${key} AND "lockedUntil" IS NULL`;
  }

  private async bumpWindow(key: string, limit: number, windowMs: number) {
    const rows = await this.prisma.$queryRaw<{ failCount: number; windowStart: Date }[]>`
      SELECT "failCount", "windowStart" FROM auth_rate_limits WHERE key = ${key}`;
    const row = rows[0];
    if (!row || Date.now() - new Date(row.windowStart).getTime() >= windowMs) {
      await this.prisma.$executeRaw`
        INSERT INTO auth_rate_limits (key, "failCount", "windowStart", "lockedUntil", "updatedAt")
        VALUES (${key}, 1, NOW(), NULL, NOW())
        ON CONFLICT (key) DO UPDATE SET "failCount" = 1, "windowStart" = NOW(), "lockedUntil" = NULL, "updatedAt" = NOW()`;
      return;
    }
    if (row.failCount >= limit) {
      throw new HttpException("Слишком много попыток. Попробуйте позже", HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.prisma.$executeRaw`
      UPDATE auth_rate_limits SET "failCount" = "failCount" + 1, "updatedAt" = NOW() WHERE key = ${key}`;
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
