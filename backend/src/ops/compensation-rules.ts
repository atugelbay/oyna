export const COMPENSATION_REASONS = {
  GAME_FAILURE: 'Сбой игры',
  EQUIPMENT_FAILURE: 'Сбой оборудования',
  OTHER: 'Другое',
} as const;

export type CompensationReason = keyof typeof COMPENSATION_REASONS;

/**
 * Недоигранные минуты сеанса — значение по умолчанию в модалке компенсации.
 * Округляем вверх до 10: начисления кратны 10 минутам, недоигравший не должен проиграть.
 */
export function unplayedMinutes(session: {
  startTime: Date | null;
  endTime: Date | null;
  deductedSeconds: number;
}): number {
  const paid = session.deductedSeconds;
  if (paid <= 0) return 10;
  if (!session.startTime || !session.endTime) return Math.ceil(paid / 600) * 10;
  const played = Math.max(0, (session.endTime.getTime() - session.startTime.getTime()) / 1000);
  const left = Math.max(0, paid - played);
  return Math.max(10, Math.ceil(left / 600) * 10);
}

/** «Компенсирован: 10 мин × 3 · Азамат · Сбой игры: комментарий» */
export function compensationNote(input: {
  minutes: number;
  players: number;
  actorName: string;
  reason: string;
  comment?: string | null;
}): string {
  const label = COMPENSATION_REASONS[input.reason as CompensationReason] ?? input.reason;
  const why = input.comment ? `${label}: ${input.comment}` : label;
  return `Компенсирован: ${input.minutes} мин × ${input.players} · ${input.actorName} · ${why}`;
}

export function validateCompensation(input: {
  minutes: number;
  userIds: string[];
  sessionPlayerIds: string[];
  reason: string;
  comment?: string;
  alreadyCompensated: boolean;
  isOwner: boolean;
}): string | null {
  if (input.alreadyCompensated && !input.isOwner) return 'Повторная компенсация сеанса — только владелец';
  if (!(input.reason in COMPENSATION_REASONS)) return 'Выберите причину из списка';
  if (input.reason === 'OTHER' && !input.comment?.trim()) return 'Для «Другое» напишите комментарий';
  if (!input.userIds.length) return 'Отметьте хотя бы одного игрока';
  const inSession = new Set(input.sessionPlayerIds);
  if (input.userIds.some((id) => !inSession.has(id))) return 'Игрок не участвовал в этом сеансе';
  if (!Number.isInteger(input.minutes) || input.minutes < 10 || input.minutes % 10 !== 0) {
    return 'Минуты — кратно 10';
  }
  if (input.minutes > 120) return 'Больше 120 минут за сеанс не начисляется';
  return null;
}
