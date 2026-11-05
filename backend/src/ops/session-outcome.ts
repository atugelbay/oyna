export type SessionOutcome =
  | 'PENDING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'INTERRUPTED'
  | 'COMPENSATED'
  | 'CANCELLED';

export const SESSION_OUTCOME_LABEL: Record<SessionOutcome, string> = {
  PENDING: 'Ожидает',
  ACTIVE: 'Идёт',
  COMPLETED: 'Завершён',
  INTERRUPTED: 'Прерван',
  COMPENSATED: 'Компенсирован',
  CANCELLED: 'Отменён',
};

/** Запас на задержки команд старт/стоп, чтобы штатный конец не считался прерыванием. */
const EARLY_STOP_GRACE_SECONDS = 60;

/**
 * Итог сеанса для журнала. «Прерван» — сбой или стоп раньше оплаченного времени.
 */
export function sessionOutcome(row: {
  status: string;
  startTime: Date | null;
  endTime: Date | null;
  deductedSeconds: number;
  compensatedAt: Date | null;
}): SessionOutcome {
  if (row.compensatedAt) return 'COMPENSATED';
  if (row.status === 'PENDING') return 'PENDING';
  if (row.status === 'ACTIVE') return 'ACTIVE';
  if (row.status === 'CANCELLED') return 'CANCELLED';
  if (row.status === 'ERROR') return 'INTERRUPTED';
  if (row.startTime && row.endTime && row.deductedSeconds > 0) {
    const played = (row.endTime.getTime() - row.startTime.getTime()) / 1000;
    if (played < row.deductedSeconds - EARLY_STOP_GRACE_SECONDS) return 'INTERRUPTED';
  }
  return 'COMPLETED';
}
