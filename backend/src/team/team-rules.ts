import { almatyDate } from '../domain/rules';

/** Опоздание считается, если пришёл позже начала смены больше чем на 10 минут */
export const LATE_GRACE_MS = 10 * 60 * 1000;

/** Вход в CRM или открытие кассы раньше этого срока не считаются приходом на смену */
export const ARRIVAL_EARLY_MS = 60 * 60 * 1000;

export type ShiftRow = {
  id: string;
  userId: string;
  startsAt: Date;
  endsAt: Date;
  arrivedAt: Date | null;
  leftAt: Date | null;
};

/** Минуты опоздания или 0. */
export function lateMinutes(row: Pick<ShiftRow, 'startsAt' | 'arrivedAt'>): number {
  if (!row.arrivedAt) return 0;
  const gap = row.arrivedAt.getTime() - row.startsAt.getTime();
  return gap > LATE_GRACE_MS ? Math.round(gap / 60000) : 0;
}

/** Смена, к которой относится приход в момент `now`: от часа до начала и до конца смены. */
export function arrivalWindow(now: Date): { startsAtLte: Date; endsAtGte: Date } {
  return { startsAtLte: new Date(now.getTime() + ARRIVAL_EARLY_MS), endsAtGte: now };
}

/** Начало недели (понедельник) по Алматы для даты YYYY-MM-DD. */
export function weekStartOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - shift * 86400000).toISOString().slice(0, 10);
}

/** Границы недели по Алматы: с понедельника 00:00 до следующего понедельника. */
export function weekBounds(weekStart: string): { from: Date; to: Date } {
  const [y, m, d] = weekStart.split('-').map(Number);
  return { from: almatyDate(y, m, d), to: almatyDate(y, m, d + 7) };
}

/** Границы месяца YYYY-MM по Алматы. */
export function monthBounds(month: string): { from: Date; to: Date } {
  const [y, m] = month.split('-').map(Number);
  return { from: almatyDate(y, m, 1), to: almatyDate(y, m + 1, 1) };
}

/** Смены прошлой недели, перенесённые на эту; те, что уже стоят (тот же сотрудник и время), пропускаются. */
export function copyWeek(
  previous: Pick<ShiftRow, 'userId' | 'startsAt' | 'endsAt'>[],
  existing: Pick<ShiftRow, 'userId' | 'startsAt'>[],
): { userId: string; startsAt: Date; endsAt: Date }[] {
  const WEEK = 7 * 86400000;
  const taken = new Set(existing.map((r) => `${r.userId}:${r.startsAt.getTime()}`));
  const out: { userId: string; startsAt: Date; endsAt: Date }[] = [];
  for (const row of previous) {
    const startsAt = new Date(row.startsAt.getTime() + WEEK);
    const key = `${row.userId}:${startsAt.getTime()}`;
    if (taken.has(key)) continue;
    taken.add(key);
    out.push({ userId: row.userId, startsAt, endsAt: new Date(row.endsAt.getTime() + WEEK) });
  }
  return out;
}

/** Итоги месяца по сотрудникам: смен, часов по графику, отработано часов, опозданий, прогулов. */
export function monthTotals(rows: ShiftRow[], now: Date) {
  const by = new Map<
    string,
    { shifts: number; plannedHours: number; workedHours: number; lates: number; lateMinutes: number; missed: number }
  >();
  for (const row of rows) {
    const t = by.get(row.userId) ?? { shifts: 0, plannedHours: 0, workedHours: 0, lates: 0, lateMinutes: 0, missed: 0 };
    t.shifts += 1;
    t.plannedHours += (row.endsAt.getTime() - row.startsAt.getTime()) / 3600000;
    if (row.arrivedAt) {
      const end = row.leftAt ?? (row.endsAt < now ? row.endsAt : now);
      t.workedHours += Math.max(0, end.getTime() - row.arrivedAt.getTime()) / 3600000;
      const late = lateMinutes(row);
      if (late) {
        t.lates += 1;
        t.lateMinutes += late;
      }
    } else if (row.endsAt < now) {
      t.missed += 1;
    }
    by.set(row.userId, t);
  }
  const round = (n: number) => Math.round(n * 10) / 10;
  return [...by.entries()].map(([userId, t]) => ({
    userId,
    ...t,
    plannedHours: round(t.plannedHours),
    workedHours: round(t.workedHours),
  }));
}

/** Время из формы CRM без зоны — это время Алматы (UTC+5). */
export function parseAlmatyInput(value: string): Date {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value);
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return new Date(`${withSeconds}+05:00`);
}

export function formatAlmatyTime(date: Date | null): string {
  if (!date) return '—';
  return new Date(date.getTime() + 5 * 3600000).toISOString().slice(11, 16);
}
