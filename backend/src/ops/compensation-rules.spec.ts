import { compensationNote, unplayedMinutes, validateCompensation } from './compensation-rules';

const t = (min: number) => new Date(Date.UTC(2026, 10, 6, 12, min));

describe('compensation rules', () => {
  it('default minutes are the unplayed part, rounded up to 10', () => {
    expect(unplayedMinutes({ startTime: t(0), endTime: t(5), deductedSeconds: 1200 })).toBe(20);
    expect(unplayedMinutes({ startTime: t(0), endTime: t(12), deductedSeconds: 1200 })).toBe(10);
    expect(unplayedMinutes({ startTime: t(0), endTime: t(20), deductedSeconds: 1200 })).toBe(10);
    expect(unplayedMinutes({ startTime: null, endTime: null, deductedSeconds: 1200 })).toBe(20);
  });

  it('note format', () => {
    expect(compensationNote({ minutes: 10, players: 3, actorName: 'Азамат', reason: 'GAME_FAILURE' })).toBe(
      'Компенсирован: 10 мин × 3 · Азамат · Сбой игры',
    );
    expect(compensationNote({ minutes: 20, players: 1, actorName: 'Нурсултан', reason: 'OTHER', comment: 'свет' })).toBe(
      'Компенсирован: 20 мин × 1 · Нурсултан · Другое: свет',
    );
  });

  const base = {
    minutes: 10,
    userIds: ['a'],
    sessionPlayerIds: ['a', 'b'],
    reason: 'GAME_FAILURE',
    alreadyCompensated: false,
    isOwner: false,
  };

  it('validates input', () => {
    expect(validateCompensation(base)).toBeNull();
    expect(validateCompensation({ ...base, alreadyCompensated: true })).toMatch(/владелец/);
    expect(validateCompensation({ ...base, alreadyCompensated: true, isOwner: true })).toBeNull();
    expect(validateCompensation({ ...base, reason: 'OTHER' })).toMatch(/комментарий/);
    expect(validateCompensation({ ...base, userIds: [] })).toMatch(/игрока/);
    expect(validateCompensation({ ...base, userIds: ['z'] })).toMatch(/не участвовал/);
    expect(validateCompensation({ ...base, minutes: 15 })).toMatch(/кратно 10/);
  });
});
