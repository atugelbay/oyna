import { copyWeek, lateMinutes, monthBounds, monthTotals, weekBounds, weekStartOf } from './team-rules';

const at = (iso: string) => new Date(iso);

describe('team rules', () => {
  it('late after 10 minutes', () => {
    expect(lateMinutes({ startsAt: at('2026-11-06T05:00:00Z'), arrivedAt: at('2026-11-06T05:09:00Z') })).toBe(0);
    expect(lateMinutes({ startsAt: at('2026-11-06T05:00:00Z'), arrivedAt: at('2026-11-06T05:25:00Z') })).toBe(25);
    expect(lateMinutes({ startsAt: at('2026-11-06T05:00:00Z'), arrivedAt: null })).toBe(0);
  });

  it('week starts on Monday, bounds in Almaty', () => {
    expect(weekStartOf('2026-11-06')).toBe('2026-11-02'); // пятница → понедельник
    expect(weekStartOf('2026-11-08')).toBe('2026-11-02'); // воскресенье
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09');
    const w = weekBounds('2026-11-02');
    expect(w.from.toISOString()).toBe('2026-11-01T19:00:00.000Z');
    expect(w.to.toISOString()).toBe('2026-11-08T19:00:00.000Z');
    expect(monthBounds('2026-12').to.toISOString()).toBe('2026-12-31T19:00:00.000Z');
  });

  it('copy last week skips shifts already set', () => {
    const prev = [
      { userId: 'a', startsAt: at('2026-10-27T05:00:00Z'), endsAt: at('2026-10-27T15:00:00Z') },
      { userId: 'b', startsAt: at('2026-10-28T05:00:00Z'), endsAt: at('2026-10-28T15:00:00Z') },
    ];
    const existing = [{ userId: 'a', startsAt: at('2026-11-03T05:00:00Z') }];
    const out = copyWeek(prev, existing);
    expect(out).toHaveLength(1);
    expect(out[0].userId).toBe('b');
    expect(out[0].startsAt.toISOString()).toBe('2026-11-04T05:00:00.000Z');
  });

  it('month totals: hours, lates, missed', () => {
    const now = at('2026-11-10T00:00:00Z');
    const rows = [
      { id: '1', userId: 'a', startsAt: at('2026-11-02T05:00:00Z'), endsAt: at('2026-11-02T15:00:00Z'), arrivedAt: at('2026-11-02T05:30:00Z'), leftAt: at('2026-11-02T15:00:00Z') },
      { id: '2', userId: 'a', startsAt: at('2026-11-03T05:00:00Z'), endsAt: at('2026-11-03T15:00:00Z'), arrivedAt: null, leftAt: null },
    ];
    const [a] = monthTotals(rows, now);
    expect(a).toMatchObject({ shifts: 2, plannedHours: 20, workedHours: 9.5, lates: 1, lateMinutes: 30, missed: 1 });
  });
});
