import {
  applyMonthlyDrop,
  birthdayAmount,
  bonusExpiresAt,
  inBirthdayWindow,
  inDayWindow,
  planRatePercent,
  planSpend,
  promoteImmediately,
  rankRows,
  ratingDayWindow,
  rewardExpiresAt,
  splitByShifts,
  stockAfter,
  teambuildingAmount,
  tierFromMinutes,
  topupBonusMinutes,
  almatyDate,
} from './rules';

describe('minute spend and expiry', () => {
  const t0 = new Date('2026-10-28T13:30:00.000Z');

  it('spends the lot that expires sooner, then bonus', () => {
    const slices = planSpend(
      [
        {
          id: 'bonus',
          remainingSeconds: 1800,
          expiresAt: new Date(t0.getTime() + 30 * 86400000),
          createdAt: t0,
          kind: 'BONUS',
        },
        {
          id: 'paid',
          remainingSeconds: 1200,
          expiresAt: new Date(t0.getTime() + 24 * 3600000),
          createdAt: t0,
          kind: 'PAID',
        },
      ],
      600,
    );
    expect(slices).toEqual([{ id: 'paid', seconds: 600, kind: 'PAID' }]);
  });

  it('does not spend an already empty lot and keeps stable order', () => {
    const slices = planSpend(
      [
        {
          id: 'b',
          remainingSeconds: 300,
          expiresAt: new Date('2026-10-29T13:30:00.000Z'),
          createdAt: new Date('2026-10-28T13:30:00.000Z'),
          kind: 'PAID',
        },
        {
          id: 'a',
          remainingSeconds: 300,
          expiresAt: new Date('2026-10-29T13:30:00.000Z'),
          createdAt: new Date('2026-10-28T13:30:00.000Z'),
          kind: 'PAID',
        },
      ],
      600,
    );
    expect(slices.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('gives paid minutes 24h and bonus minutes the status term', () => {
    const at = new Date('2026-10-28T13:30:00.000Z');
    expect(bonusExpiresAt('BRONZE', at)?.toISOString()).toBe('2026-11-27T13:30:00.000Z');
    expect(bonusExpiresAt('LEGEND', at)).toBeNull();
    expect(rewardExpiresAt('BRONZE', at)?.toISOString()).toBe('2026-11-27T13:30:00.000Z');
    expect(rewardExpiresAt('SILVER', at)?.toISOString()).toBe('2026-12-12T13:30:00.000Z');
  });
});

describe('status table', () => {
  it('promotes immediately and drops only one step on monthly recalc', () => {
    expect(tierFromMinutes(180)).toBe('GOLD');
    expect(promoteImmediately('BRONZE', 'GOLD')).toBe('GOLD');
    expect(applyMonthlyDrop('PLATINUM', 'BRONZE')).toBe('GOLD');
    expect(applyMonthlyDrop('GOLD', 'GOLD')).toBe('GOLD');
  });

  it('matches the top-up bonus table', () => {
    expect(topupBonusMinutes('SILVER', 60)).toBe(10);
    expect(topupBonusMinutes('BRONZE', 60)).toBe(0);
    expect(topupBonusMinutes('LEGEND', 40)).toBe(20);
    expect(topupBonusMinutes('GOLD', 20)).toBe(0);
    expect(topupBonusMinutes('PLATINUM', 20)).toBe(10);
  });
});

describe('rating day window', () => {
  it('uses 10:00–23:00 Almaty and shows yesterday before 10:00', () => {
    const morning = new Date('2026-10-27T04:30:00.000Z'); // 09:30 Almaty
    const day = ratingDayWindow(morning);
    expect(day.showingPrevious).toBe(true);
    expect(day.labelDate).toBe('2026-10-26');
    expect(day.from.toISOString()).toBe('2026-10-26T05:00:00.000Z');
    expect(day.to.toISOString()).toBe('2026-10-26T18:00:00.000Z');

    const open = new Date('2026-10-27T05:05:00.000Z'); // 10:05 Almaty
    const today = ratingDayWindow(open);
    expect(today.labelDate).toBe('2026-10-27');
    expect(inDayWindow(open, today)).toBe(true);
    expect(inDayWindow(new Date('2026-10-27T04:30:00.000Z'), today)).toBe(false);
    expect(inDayWindow(new Date('2026-10-27T18:15:00.000Z'), today)).toBe(false);
  });

  it('ranks a tie by who reached the score earlier', () => {
    const ranked = rankRows([
      { userId: 'late', points: 100, reachedAt: new Date('2026-10-27T12:00:00Z') },
      { userId: 'early', points: 100, reachedAt: new Date('2026-10-27T11:00:00Z') },
      { userId: 'top', points: 140, reachedAt: new Date('2026-10-27T15:00:00Z') },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(['top', 'early', 'late']);
  });
});

describe('bookings, percents, stock', () => {
  it('prices a birthday and a saturday teambuilding', () => {
    expect(birthdayAmount(80000, 10)).toBe(80000);
    expect(birthdayAmount(80000, 12)).toBe(96000);
    expect(teambuildingAmount(8000, 15)).toBe(120000);
  });

  it('picks the plan rate and splits the fund by shifts', () => {
    const rates = { plan: 5_000_000, overplan: 6_000_000, below: 3, at: 5, over: 7 };
    expect(planRatePercent(4_900_000, rates)).toBe(3);
    expect(planRatePercent(5_600_000, rates)).toBe(5);
    expect(planRatePercent(6_100_000, rates)).toBe(7);
    const fund = Math.round((5_200_000 * 5) / 100);
    expect(splitByShifts(fund, [15, 10])).toEqual([156000, 104000]);
  });

  it('counts water stock and shortage against a count', () => {
    const book = stockAfter({ received: 48, sold: 20, writtenOff: 2 });
    expect(book).toBe(26);
    expect(book - 25).toBe(1);
  });
});

describe('birthday window', () => {
  it('is open six days before and after the birthday', () => {
    const birth = almatyDate(2014, 11, 3, 8, 0);
    expect(inBirthdayWindow(birth, almatyDate(2026, 11, 6, 12, 0))).toBe(true);
    expect(inBirthdayWindow(birth, almatyDate(2026, 10, 28, 12, 0))).toBe(true);
    expect(inBirthdayWindow(birth, almatyDate(2026, 10, 27, 12, 0))).toBe(false);
    expect(inBirthdayWindow(birth, almatyDate(2026, 11, 9, 12, 0))).toBe(true);
    expect(inBirthdayWindow(birth, almatyDate(2026, 11, 10, 12, 0))).toBe(false);
  });
});
