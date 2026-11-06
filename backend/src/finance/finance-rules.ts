import { almatyDate, almatyParts } from '../domain/rules';

export type Period = 'day' | 'week' | 'month' | 'custom';

export type Range = { from: Date; to: Date; label: string; days: number };

const DAY = 86400000;

function ymd(d: Date): string {
  const p = almatyParts(d);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function parseDay(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

/**
 * Период и такой же прошлый для сравнения. Границы — сутки по Алматы, `to` не включается.
 * day — сегодня/вчера, week — с понедельника, month — с 1-го числа, custom — с..по включительно.
 */
export function resolvePeriod(
  period: Period,
  now: Date,
  custom?: { from?: string; to?: string },
): { current: Range; previous: Range } {
  const p = almatyParts(now);
  if (period === 'custom' && custom?.from && custom?.to) {
    const a = parseDay(custom.from);
    const b = parseDay(custom.to);
    const from = almatyDate(a.y, a.m, a.d);
    const to = almatyDate(b.y, b.m, b.d + 1);
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY));
    return {
      current: { from, to, days, label: `${custom.from} – ${custom.to}` },
      previous: { from: new Date(from.getTime() - days * DAY), to: from, days, label: 'прошлый такой же период' },
    };
  }
  if (period === 'day') {
    const from = almatyDate(p.year, p.month, p.day);
    return {
      current: { from, to: new Date(from.getTime() + DAY), days: 1, label: 'Сегодня' },
      previous: { from: new Date(from.getTime() - DAY), to: from, days: 1, label: 'Вчера' },
    };
  }
  if (period === 'week') {
    const weekday = (new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7;
    const from = almatyDate(p.year, p.month, p.day - weekday);
    return {
      current: { from, to: new Date(from.getTime() + 7 * DAY), days: 7, label: 'Эта неделя' },
      previous: { from: new Date(from.getTime() - 7 * DAY), to: from, days: 7, label: 'Прошлая неделя' },
    };
  }
  const from = almatyDate(p.year, p.month, 1);
  const to = almatyDate(p.year, p.month + 1, 1);
  const prevFrom = almatyDate(p.year, p.month - 1, 1);
  return {
    current: { from, to, days: Math.round((to.getTime() - from.getTime()) / DAY), label: 'Этот месяц' },
    previous: { from: prevFrom, to: from, days: Math.round((from.getTime() - prevFrom.getTime()) / DAY), label: 'Прошлый месяц' },
  };
}

/** Изменение к прошлому периоду в процентах; null, если сравнивать не с чем. */
export function changePercent(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export type RevenueGroup = 'GAME' | 'BIRTHDAY' | 'TEAMBUILDING' | 'CERTIFICATE' | 'GOODS' | 'OTHER';

export const REVENUE_GROUP_LABEL: Record<RevenueGroup, string> = {
  GAME: 'Игра',
  BIRTHDAY: 'Дни рождения',
  TEAMBUILDING: 'Тимбилдинг',
  CERTIFICATE: 'Сертификаты',
  GOODS: 'Товары',
  OTHER: 'Прочее',
};

/** Группа выручки строки чека. bookingType — тип брони, если строка — её оплата. */
export function lineGroup(line: {
  kind?: string | null;
  category?: string | null;
  name: string;
  minutes: number;
  bookingType?: string | null;
}): RevenueGroup {
  if (line.kind === 'CERTIFICATE' || line.category === 'CERTIFICATE') return 'CERTIFICATE';
  if (line.kind === 'BOOKING' || line.category === 'BOOKING') {
    return line.bookingType === 'TEAMBUILDING' ? 'TEAMBUILDING' : 'BIRTHDAY';
  }
  if (line.category === 'PACKAGES' || /день\s+рождени|тимбилдинг/i.test(line.name)) {
    return /тимбилдинг/i.test(line.name) ? 'TEAMBUILDING' : 'BIRTHDAY';
  }
  if (line.category === 'WATER' || line.category === 'OTHER') return 'GOODS';
  if (line.category === 'GAMES' || line.category === 'PROMO') return 'GAME';
  // старые продажи без категории: с минутами — игра, без — товар
  return line.minutes > 0 ? 'GAME' : 'GOODS';
}

/** План месяца: факт, прогноз на конец месяца по темпу и процент выполнения. */
export function planProgress(input: { plan: number; fact: number; daysPassed: number; daysInMonth: number }) {
  const forecast = input.daysPassed > 0 ? Math.round((input.fact / input.daysPassed) * input.daysInMonth) : 0;
  return {
    plan: input.plan,
    fact: input.fact,
    forecast,
    percent: input.plan ? Math.round((input.fact / input.plan) * 100) : null,
    forecastPercent: input.plan ? Math.round((forecast / input.plan) * 100) : null,
  };
}

/** Сколько дней месяца прошло (включая сегодня) и сколько в нём всего — по Алматы. */
export function monthDays(month: string, now: Date): { daysPassed: number; daysInMonth: number } {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const p = almatyParts(now);
  if (p.year > y || (p.year === y && p.month > m)) return { daysPassed: daysInMonth, daysInMonth };
  if (p.year < y || (p.year === y && p.month < m)) return { daysPassed: 0, daysInMonth };
  return { daysPassed: p.day, daysInMonth };
}

/** Средняя цена минуты игрока: оплачено ₸ / куплено минут. */
export function avgMinutePrice(paidTenge: number, minutes: number): number {
  return minutes > 0 ? paidTenge / minutes : 0;
}

export const EXPENSE_CATEGORIES = [
  'Аренда',
  'Зарплата',
  'Коммунальные',
  'Маркетинг',
  'Закуп товара',
  'Ремонт и оборудование',
  'Налоги',
  'Прочее',
] as const;

/** Повтор расходов прошлого месяца: тот же день (или последний день месяца), кроме расходов из кассы. */
export function repeatExpenseDate(occurredOn: Date, targetMonth: string): Date {
  const [y, m] = targetMonth.split('-').map(Number);
  const day = almatyParts(occurredOn).day;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return almatyDate(y, m, Math.min(day, last), 12);
}

export { ymd as almatyYmd };
