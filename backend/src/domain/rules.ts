/** Pure rules from OYNA TZ 29.10.2026. No I/O. */

export const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;
export const PAID_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_SECONDS = 600;

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'LEGEND';

export const TIER_ORDER: LoyaltyTier[] = [
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'LEGEND',
];

/** Minutes played in 90 days (Legend also accepts an invite). */
export const TIER_MINUTES: Record<LoyaltyTier, number> = {
  BRONZE: 0,
  SILVER: 60,
  GOLD: 180,
  PLATINUM: 400,
  LEGEND: 800,
};

/** Bonus-minute lifetime in days. Legend does not expire. */
export const BONUS_DAYS: Record<LoyaltyTier, number | null> = {
  BRONZE: 30,
  SILVER: 45,
  GOLD: 60,
  PLATINUM: 90,
  LEGEND: null,
};

/** Status top-up bonus minutes for paid packages 20/40/60. */
const TOPUP_BONUS: Record<number, Partial<Record<LoyaltyTier, number>>> = {
  20: { PLATINUM: 10, LEGEND: 10 },
  40: { GOLD: 10, PLATINUM: 10, LEGEND: 20 },
  60: { SILVER: 10, GOLD: 10, PLATINUM: 20, LEGEND: 20 },
};

export const BIRTHDAY_BONUS: Record<LoyaltyTier, number> = {
  BRONZE: 10,
  SILVER: 20,
  GOLD: 30,
  PLATINUM: 40,
  LEGEND: 60,
};

export type MinuteLot = {
  id: string;
  remainingSeconds: number;
  expiresAt: Date | null;
  createdAt: Date;
  kind: string;
};

export function almatyParts(now: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const local = new Date(now.getTime() + ALMATY_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}

export function almatyDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - ALMATY_OFFSET_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function bonusExpiresAt(tier: LoyaltyTier, at: Date): Date | null {
  const days = BONUS_DAYS[tier];
  return days == null ? null : addDays(at, days);
}

/** Task rewards live at least 30 days, or longer when the status says so. */
export function rewardExpiresAt(tier: LoyaltyTier, at: Date): Date | null {
  const days = BONUS_DAYS[tier];
  if (days == null) return null;
  return addDays(at, Math.max(30, days));
}

export function topupBonusMinutes(tier: LoyaltyTier, paidMinutes: number): number {
  return TOPUP_BONUS[paidMinutes]?.[tier] ?? 0;
}

export function tierFromMinutes(minutes90: number, legendInvite = false): LoyaltyTier {
  if (legendInvite || minutes90 >= TIER_MINUTES.LEGEND) return 'LEGEND';
  if (minutes90 >= TIER_MINUTES.PLATINUM) return 'PLATINUM';
  if (minutes90 >= TIER_MINUTES.GOLD) return 'GOLD';
  if (minutes90 >= TIER_MINUTES.SILVER) return 'SILVER';
  return 'BRONZE';
}

/** Monthly recalc may drop at most one step. Promotion is immediate and not limited. */
export function applyMonthlyDrop(current: LoyaltyTier, earned: LoyaltyTier): LoyaltyTier {
  const cur = TIER_ORDER.indexOf(current);
  const next = TIER_ORDER.indexOf(earned);
  if (next >= cur) return earned;
  return TIER_ORDER[Math.max(0, cur - 1)];
}

export function promoteImmediately(current: LoyaltyTier, earned: LoyaltyTier): LoyaltyTier {
  const cur = TIER_ORDER.indexOf(current);
  const next = TIER_ORDER.indexOf(earned);
  return next > cur ? earned : current;
}

export type SpendSlice = { id: string; seconds: number; kind: string };

/** Spend earliest-expiring lots first. Null expiry is last. Stable by createdAt, then id. */
export function planSpend(lots: MinuteLot[], seconds: number): SpendSlice[] {
  const sorted = [...lots]
    .filter((l) => l.remainingSeconds > 0)
    .sort((a, b) => {
      if (a.expiresAt && b.expiresAt) {
        const d = a.expiresAt.getTime() - b.expiresAt.getTime();
        if (d !== 0) return d;
      } else if (a.expiresAt && !b.expiresAt) return -1;
      else if (!a.expiresAt && b.expiresAt) return 1;
      const c = a.createdAt.getTime() - b.createdAt.getTime();
      if (c !== 0) return c;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  const out: SpendSlice[] = [];
  let left = seconds;
  for (const lot of sorted) {
    if (left <= 0) break;
    const take = Math.min(lot.remainingSeconds, left);
    if (take > 0) {
      out.push({ id: lot.id, seconds: take, kind: lot.kind });
      left -= take;
    }
  }
  return out;
}

export function isExpired(expiresAt: Date | null, now: Date): boolean {
  return expiresAt != null && expiresAt.getTime() <= now.getTime();
}

/**
 * Hall day is 10:00–23:00 Asia/Almaty.
 * Before 10:00 the visible day is yesterday's 10:00–23:00.
 */
export function ratingDayWindow(now: Date): {
  from: Date;
  to: Date;
  labelDate: string;
  showingPrevious: boolean;
} {
  const p = almatyParts(now);
  const showingPrevious = p.hour < 10;
  const base = showingPrevious
    ? almatyDate(p.year, p.month, p.day - 1, 10, 0)
    : almatyDate(p.year, p.month, p.day, 10, 0);
  const parts = almatyParts(base);
  const from = almatyDate(parts.year, parts.month, parts.day, 10, 0);
  const to = almatyDate(parts.year, parts.month, parts.day, 23, 0);
  const labelDate = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  return { from, to, labelDate, showingPrevious };
}

export function monthWindow(year: number, month: number): { from: Date; to: Date } {
  const from = almatyDate(year, month, 1, 0, 0);
  const to = month === 12 ? almatyDate(year + 1, 1, 1, 0, 0) : almatyDate(year, month + 1, 1, 0, 0);
  return { from, to };
}

export function yearWindow(year: number): { from: Date; to: Date } {
  return { from: almatyDate(year, 1, 1, 0, 0), to: almatyDate(year + 1, 1, 1, 0, 0) };
}

export function inDayWindow(startedAt: Date, day: { from: Date; to: Date }): boolean {
  const t = startedAt.getTime();
  return t >= day.from.getTime() && t < day.to.getTime();
}

/** Birthday window is 6 days before and 6 days after the calendar birthday in Almaty. */
export function inBirthdayWindow(birthDate: Date, now: Date): boolean {
  const b = almatyParts(birthDate);
  const n = almatyParts(now);
  const thisYear = almatyDate(n.year, b.month, b.day, 12, 0);
  const candidates = [addDays(thisYear, -365), thisYear, addDays(thisYear, 366)];
  const nowMid = almatyDate(n.year, n.month, n.day, 12, 0).getTime();
  return candidates.some((c) => {
    const diff = Math.round((nowMid - c.getTime()) / (24 * 60 * 60 * 1000));
    return diff >= -6 && diff <= 6;
  });
}

export function guestLimit(tier: LoyaltyTier): number | 'per-visit' | 0 {
  if (tier === 'LEGEND') return 'per-visit';
  if (tier === 'PLATINUM') return 2;
  if (tier === 'GOLD') return 1;
  return 0;
}

const MONTHS_RU = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export function formatAlmaty(date: Date): string {
  const p = almatyParts(date);
  return `${p.day} ${MONTHS_RU[p.month - 1]} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Birthday package price: package price / 10 * people. */
export function birthdayAmount(packagePrice: number, people: number): number {
  return Math.round((packagePrice / 10) * people);
}

/**
 * Teambuilding: price per person * people. Organizer is free and not in `people`.
 * Weekday LEVEL UP upgrade priced as STANDARD is passed in by the caller via pricePerPerson.
 */
export function teambuildingAmount(pricePerPerson: number, people: number): number {
  return pricePerPerson * people;
}

export type PlanRates = {
  plan: number;
  overplan: number;
  below: number;
  at: number;
  over: number;
};

/** Rate applies to the whole month revenue. Rates are percents (3 means 3%). */
export function planRatePercent(revenue: number, rates: PlanRates): number {
  if (revenue >= rates.overplan) return rates.over;
  if (revenue >= rates.plan) return rates.at;
  return rates.below;
}

export function splitByShifts(fund: number, shifts: number[]): number[] {
  const total = shifts.reduce((s, n) => s + n, 0);
  if (total <= 0) return shifts.map(() => 0);
  return shifts.map((n) => Math.round((fund * n) / total));
}

export function stockAfter(input: {
  received: number;
  sold: number;
  writtenOff: number;
}): number {
  return input.received - input.sold - input.writtenOff;
}

export type RatingRow = {
  userId: string;
  points: number;
  reachedAt: Date;
};

/** Higher points first. Equal points: whoever reached the total earlier. */
export function rankRows(rows: RatingRow[]): RatingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.reachedAt.getTime() - b.reachedAt.getTime();
  });
}

export function referralCode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i % bytes.length] % alphabet.length];
  return out;
}

export const OFFER_VERSION = '2026-10-29';
export const PRIVACY_VERSION = '2026-10-29';

export const ROOM_SLUGS = ['all', 'megagrid', 'arena', 'hide', 'lasers'] as const;
export type RoomSlug = (typeof ROOM_SLUGS)[number];

export function roomSlug(engineRoomId: string | null | undefined, name: string): RoomSlug | null {
  const raw = `${engineRoomId ?? ''} ${name}`.toLowerCase();
  if (raw.includes('mega')) return 'megagrid';
  if (raw.includes('arena')) return 'arena';
  if (raw.includes('hide')) return 'hide';
  if (raw.includes('laser') || raw.includes('лазер')) return 'lasers';
  return null;
}
