import { DEFAULT_VISIT_RULES, parseVisitRules, visitStatus } from './visit-status';

const rules = DEFAULT_VISIT_RULES;

describe('visitStatus', () => {
  it('first visit within 14 days is Новый', () => {
    expect(visitStatus({ firstVisitDaysAgo: 0, recentVisits: 1, registeredDaysAgo: 0 }, rules)).toBe('Новый');
    expect(visitStatus({ firstVisitDaysAgo: 14, recentVisits: 5, registeredDaysAgo: 40 }, rules)).toBe('Новый');
  });

  it('registered recently without sessions is Новый', () => {
    expect(visitStatus({ firstVisitDaysAgo: null, recentVisits: 0, registeredDaysAgo: 3 }, rules)).toBe('Новый');
  });

  it('3+ visits in 30 days is Постоянный', () => {
    expect(visitStatus({ firstVisitDaysAgo: 60, recentVisits: 3, registeredDaysAgo: 60 }, rules)).toBe('Постоянный');
  });

  it('played today but older player is not Неактивный', () => {
    expect(visitStatus({ firstVisitDaysAgo: 20, recentVisits: 1, registeredDaysAgo: 20 }, rules)).toBe('Нечастый');
  });

  it('no visits in 30 days is Неактивный', () => {
    expect(visitStatus({ firstVisitDaysAgo: 90, recentVisits: 0, registeredDaysAgo: 90 }, rules)).toBe('Неактивный');
    expect(visitStatus({ firstVisitDaysAgo: null, recentVisits: 0, registeredDaysAgo: 90 }, rules)).toBe('Неактивный');
  });

  it('uses owner thresholds', () => {
    const custom = { newDays: 7, windowDays: 30, regularVisits: 5 };
    expect(visitStatus({ firstVisitDaysAgo: 10, recentVisits: 4, registeredDaysAgo: 10 }, custom)).toBe('Нечастый');
  });

  it('parses stored rules with fallback', () => {
    expect(parseVisitRules(null)).toEqual(rules);
    expect(parseVisitRules('{"newDays":7}')).toEqual({ ...rules, newDays: 7 });
    expect(parseVisitRules('garbage')).toEqual(rules);
  });
});
