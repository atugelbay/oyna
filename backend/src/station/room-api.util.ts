import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

/** Команда агенту: HTTP-вызов в Room API v1 на моноблоке. */
export function roomApiCall(
  method: string,
  path: string,
  body: Record<string, unknown> | null = null,
): Prisma.InputJsonObject {
  return {
    method,
    path,
    body: body as Prisma.InputJsonValue | null,
    idempotency_key: randomUUID(),
  };
}

export function engineModeIdFromGameMode(mode: {
  config: Prisma.JsonValue | null;
}): string | null {
  if (mode.config && typeof mode.config === 'object' && !Array.isArray(mode.config)) {
    const cfg = mode.config as Record<string, unknown>;
    const raw = cfg.mode_id ?? cfg.modeId;
    if (typeof raw === 'string' && raw.includes('.')) return raw;
  }
  return null;
}

/** Начало суток / месяца в Asia/Almaty (UTC+5, без DST). */
export function almatyDayBounds(now = new Date()): {
  startOfDay: Date;
  startOfMonth: Date;
} {
  const offsetMs = 5 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const startOfDay = new Date(Date.UTC(y, m, d) - offsetMs);
  const startOfMonth = new Date(Date.UTC(y, m, 1) - offsetMs);
  return { startOfDay, startOfMonth };
}
