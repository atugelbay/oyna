import { IsInt, Max, Min } from 'class-validator';

export type VisitStatus = 'Новый' | 'Постоянный' | 'Нечастый' | 'Неактивный';

/** Пороги статусов игрока; владелец меняет их в настройках. */
export class VisitRulesDto {
  /** «Новый» — первый визит не больше N дней назад */
  @IsInt()
  @Min(1)
  @Max(365)
  newDays: number;

  /** Окно, за которое считаются визиты для «Постоянный» / «Нечастый» / «Неактивный» */
  @IsInt()
  @Min(1)
  @Max(365)
  windowDays: number;

  /** «Постоянный» — столько визитов и больше за окно */
  @IsInt()
  @Min(1)
  @Max(100)
  regularVisits: number;
}

export type VisitRules = Pick<VisitRulesDto, 'newDays' | 'windowDays' | 'regularVisits'>;

export const DEFAULT_VISIT_RULES: VisitRules = { newDays: 14, windowDays: 30, regularVisits: 3 };

export const VISIT_RULES_KEY = 'player_visit_rules';

export function parseVisitRules(raw: string | null | undefined): VisitRules {
  if (!raw) return DEFAULT_VISIT_RULES;
  try {
    const value = JSON.parse(raw) as Partial<VisitRules>;
    const pick = (n: unknown, fallback: number) =>
      Number.isInteger(n) && (n as number) > 0 ? (n as number) : fallback;
    return {
      newDays: pick(value.newDays, DEFAULT_VISIT_RULES.newDays),
      windowDays: pick(value.windowDays, DEFAULT_VISIT_RULES.windowDays),
      regularVisits: pick(value.regularVisits, DEFAULT_VISIT_RULES.regularVisits),
    };
  } catch {
    return DEFAULT_VISIT_RULES;
  }
}

/** Визиты игрока: визит — день по Алматы, в который был хотя бы один сеанс. */
export type VisitInfo = {
  /** Сколько дней назад был первый визит; null — визитов не было */
  firstVisitDaysAgo: number | null;
  /** Визитов за последние windowDays дней, включая сегодня */
  recentVisits: number;
  /** Сколько дней назад зарегистрирован */
  registeredDaysAgo: number;
};

export function visitStatus(info: VisitInfo, rules: VisitRules): VisitStatus {
  if (info.firstVisitDaysAgo != null) {
    if (info.firstVisitDaysAgo <= rules.newDays) return 'Новый';
  } else if (info.registeredDaysAgo <= rules.newDays) {
    // Только что зарегистрирован и ещё не играл
    return 'Новый';
  }
  if (info.recentVisits >= rules.regularVisits) return 'Постоянный';
  if (info.recentVisits >= 1) return 'Нечастый';
  return 'Неактивный';
}
