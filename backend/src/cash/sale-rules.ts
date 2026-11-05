import { almatyParts } from '../domain/rules';

/** Суббота и воскресенье по времени Алматы — цена выходного дня. */
export function isAlmatyWeekend(at: Date): boolean {
  const p = almatyParts(at);
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return day === 0 || day === 6;
}

/** Цена плитки на дату: в выходные — цена выходного, если она задана. */
export function dayPrice(
  item: { priceTenge: number; priceWeekendTenge: number | null },
  at: Date,
): number {
  if (isAlmatyWeekend(at) && item.priceWeekendTenge != null) return item.priceWeekendTenge;
  return item.priceTenge;
}

/** Группа плитки по тарифу из прайса. */
export function packageCategory(name: string, costTenge: number, weekendTenge: number): 'BARTER' | 'PACKAGES' | 'GAMES' {
  if (costTenge === 0 && weekendTenge === 0) return 'BARTER';
  if (/день\s+рождени|тимбилдинг/i.test(name)) return 'PACKAGES';
  return 'GAMES';
}

/**
 * Минуты чека делятся поровну между игроками: 3 игрока и «20 минут» × 3 → каждому по 20.
 * Возвращает минуты на игрока или текст ошибки.
 */
export function minutesPerPlayer(totalMinutes: number, players: number): number | string {
  if (totalMinutes === 0) return 0;
  if (players < 1) return 'Минуты начисляются только на аккаунт игрока';
  if (totalMinutes % players !== 0) {
    return `Минуты не делятся поровну на ${players} игроков: добавьте плитку на каждого`;
  }
  const each = totalMinutes / players;
  if (each % 10 !== 0) return 'Каждому игроку — кратно 10 минутам';
  return each;
}

/** Что сейчас платить по брони: сначала предоплата, потом остаток. */
export function bookingDue(booking: { amountTenge: number; prepayTenge: number; paidTenge: number }): {
  kind: 'PREPAY' | 'REST' | 'PAID';
  label: string;
  amount: number;
  remaining: number;
} {
  const remaining = Math.max(0, booking.amountTenge - booking.paidTenge);
  if (remaining === 0) return { kind: 'PAID', label: 'Оплачено', amount: 0, remaining };
  const prepayLeft = Math.max(0, booking.prepayTenge - booking.paidTenge);
  if (prepayLeft > 0) return { kind: 'PREPAY', label: 'Предоплата', amount: Math.min(prepayLeft, remaining), remaining };
  return { kind: 'REST', label: 'Доплата', amount: remaining, remaining };
}

/** Сколько ещё можно вернуть по продаже. */
export function refundable(sale: { totalTenge: number; refundTenge: number }): number {
  return Math.max(0, sale.totalTenge - sale.refundTenge);
}

/** Смена не закрыта к 23:00 по Алматы (или осталась с прошлого дня). */
export function shiftOverdue(openedAt: Date, now: Date, hour = 23): boolean {
  const n = almatyParts(now);
  const o = almatyParts(openedAt);
  const sameDay = n.year === o.year && n.month === o.month && n.day === o.day;
  return !sameDay || n.hour >= hour;
}
