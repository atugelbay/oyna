import { changePercent, lineGroup, monthDays, planProgress, repeatExpenseDate, resolvePeriod } from './finance-rules';

// пятница 2026-11-06, 12:00 в Алматы
const now = new Date('2026-11-06T07:00:00Z');

describe('finance rules', () => {
  it('periods and the previous same period', () => {
    const day = resolvePeriod('day', now);
    expect(day.current.from.toISOString()).toBe('2026-11-05T19:00:00.000Z');
    expect(day.previous.from.toISOString()).toBe('2026-11-04T19:00:00.000Z');
    const week = resolvePeriod('week', now);
    expect(week.current.from.toISOString()).toBe('2026-11-01T19:00:00.000Z'); // понедельник 02.11
    expect(week.previous.to.toISOString()).toBe(week.current.from.toISOString());
    const month = resolvePeriod('month', now);
    expect(month.current.from.toISOString()).toBe('2026-10-31T19:00:00.000Z');
    expect(month.previous.from.toISOString()).toBe('2026-09-30T19:00:00.000Z');
    const custom = resolvePeriod('custom', now, { from: '2026-11-01', to: '2026-11-03' });
    expect(custom.current.days).toBe(3);
    expect(custom.previous.from.toISOString()).toBe('2026-10-28T19:00:00.000Z');
  });

  it('change percent', () => {
    expect(changePercent(120, 100)).toBe(20);
    expect(changePercent(80, 100)).toBe(-20);
    expect(changePercent(80, 0)).toBeNull();
  });

  it('revenue groups', () => {
    expect(lineGroup({ name: '20 минут', minutes: 20, category: 'GAMES' })).toBe('GAME');
    expect(lineGroup({ name: 'BOSS MODE День рождения (120 минут)', minutes: 120, category: 'PACKAGES' })).toBe('BIRTHDAY');
    expect(lineGroup({ name: 'Предоплата брони · Иван', minutes: 0, kind: 'BOOKING', bookingType: 'TEAMBUILDING' })).toBe('TEAMBUILDING');
    expect(lineGroup({ name: 'Сертификат 60 мин', minutes: 60, kind: 'CERTIFICATE' })).toBe('CERTIFICATE');
    expect(lineGroup({ name: 'Вода 0,5 л', minutes: 0, category: 'WATER' })).toBe('GOODS');
    expect(lineGroup({ name: 'старое', minutes: 20 })).toBe('GAME');
  });

  it('plan forecast by pace', () => {
    expect(planProgress({ plan: 3_000_000, fact: 600_000, daysPassed: 6, daysInMonth: 30 })).toEqual({
      plan: 3_000_000,
      fact: 600_000,
      forecast: 3_000_000,
      percent: 20,
      forecastPercent: 100,
    });
    expect(monthDays('2026-11', now)).toEqual({ daysPassed: 6, daysInMonth: 30 });
    expect(monthDays('2026-10', now)).toEqual({ daysPassed: 31, daysInMonth: 31 });
  });

  it('repeat expense keeps the day, clamps to month end', () => {
    expect(repeatExpenseDate(new Date('2026-10-31T07:00:00Z'), '2026-11').toISOString()).toBe('2026-11-30T07:00:00.000Z');
  });
});
