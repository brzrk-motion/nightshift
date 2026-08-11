import { describe, expect, it } from 'vitest';
import { currentStreak, longestStreak, streakSummary } from './streaks.js';

const TODAY = '2026-08-11';

describe('currentStreak', () => {
  it('counts a run ending today', () => {
    expect(currentStreak(['2026-08-09', '2026-08-10', '2026-08-11'], TODAY)).toBe(3);
  });

  it('keeps yesterday’s run when today is incomplete', () => {
    expect(currentStreak(['2026-08-09', '2026-08-10'], TODAY)).toBe(2);
  });

  it('is zero when today and yesterday are both incomplete', () => {
    expect(currentStreak(['2026-08-08'], TODAY)).toBe(0);
    expect(currentStreak([], TODAY)).toBe(0);
  });

  it('stops at a gap', () => {
    expect(currentStreak(['2026-08-08', '2026-08-10', '2026-08-11'], TODAY)).toBe(2);
  });
});

describe('longestStreak', () => {
  it('finds the historical maximum', () => {
    expect(
      longestStreak(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-05', '2026-08-11']),
    ).toBe(3);
  });

  it('is zero with no dates', () => {
    expect(longestStreak([])).toBe(0);
  });
});

describe('streakSummary', () => {
  it('retains longest when current drops after clearing today', () => {
    const dates = ['2026-08-09', '2026-08-10', '2026-08-11'];
    expect(streakSummary(dates, TODAY)).toEqual({ current: 3, longest: 3 });
    expect(streakSummary(['2026-08-09', '2026-08-10'], TODAY)).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it('keeps a longer historical run after a gap', () => {
    const dates = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-11'];
    expect(streakSummary(dates, TODAY)).toEqual({ current: 1, longest: 3 });
  });
});
