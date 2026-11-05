import { almatyDate, almatyParts } from '../domain/rules';

/** Рабочее время зала по Алматы: с 10:00 до 23:00 */
export const WORK_START_HOUR = 10;
export const WORK_END_HOUR = 23;

/** Комната без связи дольше этого — в «Важное сегодня» */
export const OFFLINE_ALERT_MS = 5 * 60 * 1000;

/** Бронь в ближайшие 30 минут подсвечивается */
export const BOOKING_SOON_MS = 30 * 60 * 1000;

/** Границы суток по Алматы; shiftDays = 1 — завтра. */
export function almatyDayBounds(now: Date, shiftDays = 0): { from: Date; to: Date } {
  const p = almatyParts(now);
  return {
    from: almatyDate(p.year, p.month, p.day + shiftDays),
    to: almatyDate(p.year, p.month, p.day + shiftDays + 1),
  };
}

export function isWorkingHours(now: Date): boolean {
  const h = almatyParts(now).hour;
  return h >= WORK_START_HOUR && h < WORK_END_HOUR;
}

/** Сколько минут комната без связи, если это уже повод для тревоги; иначе null. */
export function offlineAlertMinutes(lastHeartbeatAt: Date | null, now: Date): number | null {
  if (!isWorkingHours(now)) return null;
  if (!lastHeartbeatAt) return null; // комната ни разу не выходила на связь — не настроена
  const gap = now.getTime() - lastHeartbeatAt.getTime();
  return gap > OFFLINE_ALERT_MS ? Math.floor(gap / 60000) : null;
}

/** Сколько секунд осталось в сеансе: оплаченное время минус сыгранное (пауза замораживает). */
export function sessionRemainingSeconds(input: {
  startTime: Date | null;
  pausedAt: Date | null;
  durationSeconds: number;
  now: Date;
}): number | null {
  if (!input.startTime || input.durationSeconds <= 0) return null;
  const ref = input.pausedAt ?? input.now;
  const played = Math.floor((ref.getTime() - input.startTime.getTime()) / 1000);
  return Math.max(0, input.durationSeconds - played);
}

export function bookingSoon(startsAt: Date, now: Date): boolean {
  const diff = startsAt.getTime() - now.getTime();
  return diff >= -BOOKING_SOON_MS / 2 && diff <= BOOKING_SOON_MS;
}

/** Дней до конца месяца по Алматы, включая сегодня. */
export function daysLeftInMonth(now: Date): number {
  const p = almatyParts(now);
  const last = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
  return last - p.day + 1;
}
