import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const FIFTEEN_MIN = 15 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

@Injectable()
export class RateLimitService {
  constructor(private prisma: PrismaService) {}

  async assertRegister(ip: string) {
    await this.hitWindow(`reg:${ip}`, 5, HOUR, 'С этого адреса уже 5 регистраций за час');
  }

  async assertLoginIp(ip: string) {
    await this.hitWindow(`login-ip:${ip}`, 100, 60 * 1000, 'Слишком много попыток входа');
  }

  async assertNotLocked(key: string) {
    const row = await this.prisma.authRateLimit.findUnique({ where: { key } });
    if (row?.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
      const retryAfterSeconds = Math.ceil((row.lockedUntil.getTime() - Date.now()) / 1000);
      throw new HttpException(
        { message: 'Вход заблокирован на 15 минут', retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(key: string) {
    const now = new Date();
    const row = await this.prisma.authRateLimit.findUnique({ where: { key } });
    if (!row || (row.lockedUntil && row.lockedUntil <= now)) {
      const failCount = !row || (row.lockedUntil && row.lockedUntil <= now) ? 1 : row.failCount + 1;
      const lockedUntil = failCount >= 5 ? new Date(now.getTime() + FIFTEEN_MIN) : null;
      await this.prisma.authRateLimit.upsert({
        where: { key },
        create: { key, failCount, windowStart: now, lockedUntil },
        update: { failCount, windowStart: now, lockedUntil },
      });
      return { locked: failCount >= 5 };
    }
    const failCount = row.failCount + 1;
    const lockedUntil = failCount >= 5 ? new Date(now.getTime() + FIFTEEN_MIN) : row.lockedUntil;
    await this.prisma.authRateLimit.update({
      where: { key },
      data: { failCount, lockedUntil },
    });
    return { locked: failCount >= 5 };
  }

  async clearFailures(key: string) {
    await this.prisma.authRateLimit.deleteMany({ where: { key, lockedUntil: null } });
  }

  private async hitWindow(key: string, limit: number, windowMs: number, message: string) {
    const now = new Date();
    const row = await this.prisma.authRateLimit.findUnique({ where: { key } });
    if (!row || now.getTime() - row.windowStart.getTime() >= windowMs) {
      await this.prisma.authRateLimit.upsert({
        where: { key },
        create: { key, failCount: 1, windowStart: now, lockedUntil: null },
        update: { failCount: 1, windowStart: now, lockedUntil: null },
      });
      return;
    }
    if (row.failCount >= limit) {
      const retryAfterSeconds = Math.ceil((row.windowStart.getTime() + windowMs - now.getTime()) / 1000);
      throw new HttpException({ message, retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.prisma.authRateLimit.update({
      where: { key },
      data: { failCount: { increment: 1 } },
    });
  }
}

export function clientIp(req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const remote = req.socket?.remoteAddress ?? '';
  const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  if (loopback) {
    const xff = req.headers?.['x-forwarded-for'];
    const raw = Array.isArray(xff) ? xff[0] : xff;
    const first = raw?.split(',')[0]?.trim();
    if (first) return first;
  }
  return remote || 'unknown';
}
