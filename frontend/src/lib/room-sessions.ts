/** Строка из API game_modes (room.include.modes) */
export type RoomModeLike = {
  name: string;
  config?: unknown | null;
};

/** Одна логическая сессия (COOP/FFA с одним именем даёт одну строку) */
/** Одна строка для таблицы: «Сессия A (5 мин), Сессия B (10 мин)» */
export function formatSessionsOneLine(
  sessions: { name: string; minutes: number }[],
): string {
  if (!sessions.length) return "";
  return sessions.map((s) => `${s.name} (${s.minutes} мин)`).join(", ");
}

export function uniqueSessionsFromModes(
  modes: RoomModeLike[] | undefined | null,
): { name: string; minutes: number }[] {
  if (!modes?.length) return [];
  const byName = new Map<string, number>();
  for (const m of modes) {
    if (byName.has(m.name)) continue;
    const cfg = (m.config || {}) as { durationSeconds?: number };
    const sec = cfg.durationSeconds ?? 0;
    const minutes = Math.max(1, Math.round(sec / 60) || 1);
    byName.set(m.name, minutes);
  }
  return Array.from(byName.entries()).map(([name, minutes]) => ({ name, minutes }));
}
