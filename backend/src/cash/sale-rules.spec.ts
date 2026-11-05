import { bookingDue, dayPrice, isAlmatyWeekend, minutesPerPlayer, packageCategory, refundable, shiftOverdue } from './sale-rules';

describe('sale rules', () => {
  it('weekend is decided in Almaty time', () => {
    // 2026-11-06 20:00 UTC = суббота 01:00 в Алматы
    expect(isAlmatyWeekend(new Date('2026-11-06T20:00:00Z'))).toBe(true);
    // 2026-11-06 18:00 UTC = пятница 23:00 в Алматы
    expect(isAlmatyWeekend(new Date('2026-11-06T18:00:00Z'))).toBe(false);
  });

  it('day price picks weekend price on weekends', () => {
    const item = { priceTenge: 4000, priceWeekendTenge: 5000 };
    expect(dayPrice(item, new Date('2026-11-05T10:00:00Z'))).toBe(4000);
    expect(dayPrice(item, new Date('2026-11-07T10:00:00Z'))).toBe(5000);
    expect(dayPrice({ priceTenge: 4000, priceWeekendTenge: null }, new Date('2026-11-07T10:00:00Z'))).toBe(4000);
  });

  it('groups price packages', () => {
    expect(packageCategory('RC Race Lab', 0, 0)).toBe('BARTER');
    expect(packageCategory('BOSS MODE День рождения (120 минут)', 15000, 15000)).toBe('PACKAGES');
    expect(packageCategory('Тимбилдинг 60 мин', 8000, 9000)).toBe('PACKAGES');
    expect(packageCategory('20 минут', 4000, 5000)).toBe('GAMES');
  });

  it('splits minutes equally between players', () => {
    expect(minutesPerPlayer(60, 3)).toBe(20);
    expect(minutesPerPlayer(0, 0)).toBe(0);
    expect(minutesPerPlayer(20, 0)).toMatch(/аккаунт/);
    expect(minutesPerPlayer(40, 3)).toMatch(/поровну/);
    expect(minutesPerPlayer(30, 2)).toMatch(/кратно 10/);
  });

  it('booking: prepay first, then the rest', () => {
    expect(bookingDue({ amountTenge: 80000, prepayTenge: 10000, paidTenge: 0 })).toMatchObject({ kind: 'PREPAY', amount: 10000 });
    expect(bookingDue({ amountTenge: 80000, prepayTenge: 10000, paidTenge: 10000 })).toMatchObject({ kind: 'REST', amount: 70000 });
    expect(bookingDue({ amountTenge: 80000, prepayTenge: 10000, paidTenge: 80000 })).toMatchObject({ kind: 'PAID', amount: 0 });
  });

  it('refundable amount', () => {
    expect(refundable({ totalTenge: 12000, refundTenge: 4000 })).toBe(8000);
    expect(refundable({ totalTenge: 12000, refundTenge: 12000 })).toBe(0);
  });

  it('shift is overdue at 23:00 Almaty or next day', () => {
    const opened = new Date('2026-11-05T05:00:00Z'); // 10:00 Алматы
    expect(shiftOverdue(opened, new Date('2026-11-05T17:59:00Z'))).toBe(false); // 22:59
    expect(shiftOverdue(opened, new Date('2026-11-05T18:00:00Z'))).toBe(true); // 23:00
    expect(shiftOverdue(opened, new Date('2026-11-06T04:00:00Z'))).toBe(true); // следующий день
  });
});
