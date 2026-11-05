import {
  almatyDayBounds,
  bookingSoon,
  daysLeftInMonth,
  isWorkingHours,
  offlineAlertMinutes,
  sessionRemainingSeconds,
} from './today-rules';

// 2026-11-06 07:00 UTC = 12:00 в Алматы
const noon = new Date('2026-11-06T07:00:00Z');

describe('dashboard today rules', () => {
  it('day bounds follow Almaty midnight', () => {
    const today = almatyDayBounds(noon);
    expect(today.from.toISOString()).toBe('2026-11-05T19:00:00.000Z');
    expect(today.to.toISOString()).toBe('2026-11-06T19:00:00.000Z');
    expect(almatyDayBounds(noon, 1).from.toISOString()).toBe('2026-11-06T19:00:00.000Z');
  });

  it('working hours 10–23 Almaty', () => {
    expect(isWorkingHours(noon)).toBe(true);
    expect(isWorkingHours(new Date('2026-11-06T18:30:00Z'))).toBe(false); // 23:30
    expect(isWorkingHours(new Date('2026-11-06T04:59:00Z'))).toBe(false); // 09:59
    expect(isWorkingHours(new Date('2026-11-06T05:00:00Z'))).toBe(true); // 10:00
  });

  it('offline alert after 5 minutes in working hours', () => {
    expect(offlineAlertMinutes(new Date(noon.getTime() - 4 * 60000), noon)).toBeNull();
    expect(offlineAlertMinutes(new Date(noon.getTime() - 12 * 60000), noon)).toBe(12);
    expect(offlineAlertMinutes(null, noon)).toBeNull();
    const night = new Date('2026-11-06T20:00:00Z');
    expect(offlineAlertMinutes(new Date(night.getTime() - 60 * 60000), night)).toBeNull();
  });

  it('remaining session time with pause', () => {
    const start = new Date(noon.getTime() - 5 * 60000);
    expect(sessionRemainingSeconds({ startTime: start, pausedAt: null, durationSeconds: 1200, now: noon })).toBe(900);
    const paused = new Date(start.getTime() + 60000);
    expect(sessionRemainingSeconds({ startTime: start, pausedAt: paused, durationSeconds: 1200, now: noon })).toBe(1140);
    expect(sessionRemainingSeconds({ startTime: null, pausedAt: null, durationSeconds: 1200, now: noon })).toBeNull();
  });

  it('booking within 30 minutes is highlighted', () => {
    expect(bookingSoon(new Date(noon.getTime() + 20 * 60000), noon)).toBe(true);
    expect(bookingSoon(new Date(noon.getTime() + 45 * 60000), noon)).toBe(false);
  });

  it('days left in month', () => {
    expect(daysLeftInMonth(noon)).toBe(25);
  });
});
