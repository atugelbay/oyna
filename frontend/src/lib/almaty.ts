const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Сегодняшняя дата по Алматы в формате YYYY-MM-DD */
export function almatyToday(now = new Date()): string {
  return new Date(now.getTime() + ALMATY_OFFSET_MS).toISOString().slice(0, 10);
}

/** Границы дней по Алматы для фильтров API: с начала `from` до конца `to` включительно. */
export function almatyRange(from: string, to: string): { from?: string; to?: string } {
  const start = from ? new Date(Date.parse(`${from}T00:00:00Z`) - ALMATY_OFFSET_MS).toISOString() : undefined;
  const end = to ? new Date(Date.parse(`${to}T23:59:59.999Z`) - ALMATY_OFFSET_MS).toISOString() : undefined;
  return { from: start, to: end };
}

export function isAlmatyWeekend(d = new Date()): boolean {
  const day = new Date(d.getTime() + ALMATY_OFFSET_MS).getUTCDay();
  return day === 0 || day === 6;
}
